"""Conversation handlers: create, list, delete, and read back history.

Also owns the shared conversation queries and the history/persistence helpers
the streaming layer calls, so nothing has to reach into a router for them.
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from pydantic import BaseModel, TypeAdapter
from pydantic_ai.messages import ModelMessage
from sqlalchemy import func as sqlfunc
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from sqlalchemy_models.chat import ChatMessageModel, ConversationModel, MessageSnapshotModel
from src.cities.registry import get_city
from src.config.settings import settings
from src.database.db import get_db
from src.database.redis import redis_manager
from src.utils.context_budget import trim_message_history
from src.utils.message_replay import messages_snapshot_to_events
from src.utils.util_logger.logger import logger

_message_list_adapter = TypeAdapter(list[ModelMessage])


class NewChatRequest(BaseModel):
    city_id: str | None = None


# ── Shared queries ──────────────────────────────────────────────────────────

async def fetch_conversation(db, thread_id: str, user_id: int, required=True):
    """Return the user's conversation for `thread_id`, or 404 when required."""
    result = await db.execute(
        select(ConversationModel)
        .where(ConversationModel.session_id == thread_id)
        .where(ConversationModel.user_id == user_id)
    )
    conv = result.scalar_one_or_none()
    if conv is None and required:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {thread_id!r} not found.",
        )
    return conv


async def fetch_latest_snapshot(db, conversation_id: int):
    """Return the most recent message snapshot row for a conversation, or None."""
    result = await db.execute(
        select(MessageSnapshotModel)
        .where(MessageSnapshotModel.conversation_id == conversation_id)
        .order_by(MessageSnapshotModel.sequence.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def messages_to_json(messages) -> list:
    """Serialize pydantic-ai ModelMessages to JSON-safe dicts (datetimes included)."""
    return _message_list_adapter.dump_python(messages, mode="json")


def _parse_history(raw, city_id):
    """Trim a stored message list to the context budget and validate it."""
    trimmed = trim_message_history(
        raw, settings.MAX_CONTEXT_MESSAGES, settings.MAX_HISTORY_CHARS
    )
    return city_id, _message_list_adapter.validate_python(trimmed)


# ── History and persistence (used by the streaming layer) ───────────────────

async def load_history(thread_id: str, user_id: int):
    """Return (city_id, message_history) for a thread — Redis first, then DB."""
    session = await redis_manager.get_session(thread_id)
    city_id = (session or {}).get("city_id") or settings.DEFAULT_CITY_ID

    snapshot = await redis_manager.get_chat_snapshot(thread_id)
    if snapshot:
        try:
            return _parse_history(snapshot, city_id)
        except Exception as exc:
            logger.warning(f"[history] Redis snapshot parse error for {thread_id}: {exc}")

    try:
        async with get_db() as db:
            conv = await fetch_conversation(db, thread_id, user_id, required=False)
            if conv is None:
                return city_id, None
            city_id = conv.city_id
            latest = await fetch_latest_snapshot(db, conv.id)

        if latest and isinstance(latest.event, dict):
            try:
                return _parse_history(latest.event.get("messages", []), city_id)
            except Exception as exc:
                logger.warning(f"[history] DB snapshot parse error for {thread_id}: {exc}")
    except Exception as exc:
        logger.error(f"[history] DB load failed for {thread_id}: {exc}")

    return city_id, None


async def persist_conversation(
    thread_id: str,
    user_id: int,
    city_id: str,
    user_text: str,
    assistant_text: str,
    all_messages,
) -> None:
    """Append one turn to the DB: snapshot row plus the two chat_messages rows.

    Runs as a background task, so it swallows and logs its own failures.
    """
    try:
        async with get_db() as db:
            conv = await fetch_conversation(db, thread_id, user_id, required=False)
            if conv is None:
                conv = ConversationModel(
                    user_id=user_id,
                    session_id=thread_id,
                    status="active",
                    message_count=0,
                    city_id=city_id,
                )
                db.add(conv)
                await db.flush()

            if conv.title is None and user_text:
                truncated = user_text[:50].rstrip()
                conv.title = truncated + ("…" if len(user_text) > 50 else "")

            seq_result = await db.execute(
                select(sqlfunc.coalesce(sqlfunc.max(MessageSnapshotModel.sequence), -1))
                .where(MessageSnapshotModel.conversation_id == conv.id)
            )
            next_seq = (seq_result.scalar() or -1) + 1

            await db.execute(
                pg_insert(MessageSnapshotModel).values(
                    [{"conversation_id": conv.id, "sequence": next_seq,
                      "event": {"type": "messages_snapshot", "messages": messages_to_json(all_messages)}}]
                ).on_conflict_do_nothing()
            )

            await db.execute(
                ChatMessageModel.__table__.insert(),
                [
                    {"message_id": str(uuid.uuid4()), "conversation_id": conv.id,
                     "role": "user", "content": user_text},
                    {"message_id": str(uuid.uuid4()), "conversation_id": conv.id,
                     "role": "assistant", "content": assistant_text},
                ],
            )

            conv.message_count = (conv.message_count or 0) + 2
            logger.info(f"[persist] conv_id={conv.id} thread={thread_id!r}")
    except Exception as exc:
        logger.exception(f"[persist] failed for thread={thread_id!r}: {exc}")


# ── Endpoint handlers ───────────────────────────────────────────────────────

async def create_conversation(user_id: int, city_id: str | None = None) -> dict:
    """Create an empty conversation and return the thread_id the client opens a WS with."""
    city_id = city_id or settings.DEFAULT_CITY_ID
    city = get_city(city_id)
    thread_id = str(uuid.uuid4())

    async with get_db() as db:
        db.add(ConversationModel(
            user_id=user_id,
            session_id=thread_id,
            status="active",
            message_count=0,
            city_id=city_id,
        ))

    await redis_manager.cache_session(thread_id, str(user_id), {"city_id": city_id})
    logger.info(f"[chat] created thread={thread_id!r} city={city_id!r} user={user_id}")
    return {"thread_id": thread_id, "city_id": city_id, "greeting": city.greeting}


async def list_conversations(user_id: int, limit: int = 50, offset: int = 0) -> list:
    """Return the user's non-deleted conversations, newest first."""
    async with get_db() as db:
        result = await db.execute(
            select(ConversationModel)
            .where(ConversationModel.user_id == user_id)
            .where(ConversationModel.deleted_at.is_(None))
            .order_by(ConversationModel.id.desc())
            .limit(limit)
            .offset(offset)
        )
        convs = result.scalars().all()

    return [
        {
            "thread_id":     c.session_id,
            "title":         c.title,
            "city_id":       c.city_id,
            "status":        c.status,
            "message_count": c.message_count,
            "created_at":    c.created_at.isoformat() if c.created_at else None,
            "updated_at":    c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in convs
    ]


async def delete_conversation(user_id: int, thread_id: str) -> dict:
    """Soft-delete a conversation by stamping deleted_at."""
    async with get_db() as db:
        conv = await fetch_conversation(db, thread_id, user_id)
        if conv.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {thread_id!r} not found.",
            )
        conv.deleted_at = datetime.now(timezone.utc)
    return {"deleted": thread_id}


async def get_conversation_events(user_id: int, thread_id: str) -> list:
    """Return the raw pydantic-ai message list from the latest snapshot."""
    async with get_db() as db:
        conv = await fetch_conversation(db, thread_id, user_id)
        latest = await fetch_latest_snapshot(db, conv.id)

    if latest and isinstance(latest.event, dict) and latest.event.get("type") == "messages_snapshot":
        return latest.event.get("messages", [])
    return []


async def get_conversation_messages(user_id: int, thread_id: str) -> list:
    """Return plain-text chat messages in chronological order — cheap history display."""
    async with get_db() as db:
        conv = await fetch_conversation(db, thread_id, user_id)
        result = await db.execute(
            select(ChatMessageModel)
            .where(ChatMessageModel.conversation_id == conv.id)
            .order_by(ChatMessageModel.timestamp)
        )
        msgs = result.scalars().all()

    return [
        {
            "message_id": m.message_id,
            "role":       m.role,
            "content":    m.content,
            "timestamp":  m.timestamp.isoformat() if m.timestamp else None,
        }
        for m in msgs
    ]


async def get_conversation_replay(user_id: int, thread_id: str) -> list:
    """Return the conversation as the same event types the WebSocket stream emits."""
    async with get_db() as db:
        conv = await fetch_conversation(db, thread_id, user_id)
        latest = await fetch_latest_snapshot(db, conv.id)

    if latest and isinstance(latest.event, dict):
        return messages_snapshot_to_events(latest.event.get("messages", []))
    return []


if __name__ == "__main__":
    import asyncio

    async def _demo():
        """Round-trips one conversation against the configured database."""
        created = await create_conversation(user_id=1, city_id="lucknow")
        thread_id = created["thread_id"]
        assert created["greeting"]
        try:
            rows = await list_conversations(user_id=1, limit=5)
            assert any(r["thread_id"] == thread_id for r in rows)

            city_id, history = await load_history(thread_id, user_id=1)
            assert city_id == "lucknow" and history is None  # nothing said yet

            assert await get_conversation_events(user_id=1, thread_id=thread_id) == []
            assert await get_conversation_replay(user_id=1, thread_id=thread_id) == []
            print(f"ok — created, listed, and read back {thread_id}")
        finally:
            await delete_conversation(user_id=1, thread_id=thread_id)
            print("ok — soft-deleted")

    asyncio.run(_demo())
