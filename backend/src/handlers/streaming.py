"""Runs the agent for one user turn: streams events out, then persists the turn."""

import asyncio
from dataclasses import replace

from pydantic_ai.messages import ModelRequest, SystemPromptPart
from pydantic_ai.run import AgentRunResultEvent

from src.agent import AgentDeps, get_agent
from src.agent.prompt import VOICE_MODE_PROMPT
from src.database.redis import redis_manager
from src.handlers.chat import load_history, messages_to_json, persist_conversation
from src.handlers.stream_events import map_pydantic_event, sanitize_tool_event, tool_status_event
from src.utils.util_logger.logger import logger

# Strong references to in-flight background persistence tasks. Without this, a
# task created via asyncio.create_task() and referenced only by a local variable
# can be garbage-collected mid-run once its creating coroutine returns (e.g. the
# client disconnects right after the last turn) — dropping the DB write before
# it commits. See asyncio docs: "Save a reference to the result of this
# function, to avoid a task disappearing mid-execution."
_background_tasks = set()


def _persist_in_background(*args) -> None:
    task = asyncio.create_task(persist_conversation(*args))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


def _is_voice_mode_system_part(part) -> bool:
    return isinstance(part, SystemPromptPart) and part.content == VOICE_MODE_PROMPT


def strip_voice_mode_prompt(messages) -> list:
    """Drop ephemeral VOICE_MODE_PROMPT so it never enters Redis/DB history.

    Clears matching SystemPromptPart entries and ModelRequest.instructions when
    equal to VOICE_MODE_PROMPT. Voice brevity/Devanagari directives are per-turn
    only. Older sessions that accidentally persisted them are cleaned on the
    next load/persist path.
    """
    if not messages:
        return []

    cleaned = []
    for msg in messages:
        if not isinstance(msg, ModelRequest):
            cleaned.append(msg)
            continue
        kept = [p for p in msg.parts if not _is_voice_mode_system_part(p)]
        if not kept:
            continue
        clear_instructions = msg.instructions == VOICE_MODE_PROMPT
        parts_changed = len(kept) != len(msg.parts)
        if not parts_changed and not clear_instructions:
            cleaned.append(msg)
        else:
            cleaned.append(
                replace(
                    msg,
                    parts=kept,
                    instructions=None if clear_instructions else msg.instructions,
                )
            )
    return cleaned


async def run_agent_stream(send, user_id: int, thread_id: str, content: str,
                           websocket=None, input_queue=None,
                           voice_mode: bool = False) -> None:
    """Run one turn, pushing each frontend event through `send`.

    `send` is an async callable taking one event dict — websocket.send_json in
    production. It takes a callback rather than yielding, because the closing
    run_done frame and the DB write must still happen when the client has
    already gone away; a generator abandoned mid-iteration never resumes.

    When `voice_mode` is True, VOICE_MODE_PROMPT is passed via pydantic-ai
    `instructions` (ephemeral for this run only) so typed chat never inherits
    brief/Devanagari voice directives from Redis/DB history.
    """
    city_id, message_history = await load_history(thread_id, user_id)
    agent = get_agent(city_id)

    # Scrub any historically leaked voice directives before the model sees them.
    if message_history:
        message_history = strip_voice_mode_prompt(message_history)

    run_kwargs = {
        "message_history": message_history,
        "deps": AgentDeps(city_id=city_id, websocket=websocket, input_queue=input_queue),
    }
    if voice_mode:
        run_kwargs["instructions"] = VOICE_MODE_PROMPT

    all_messages = []
    assistant_text_parts = []
    known_image_urls = set()
    image_lookup = {}

    try:
        async with agent.run_stream_events(content, **run_kwargs) as events:
            async for event in events:
                if isinstance(event, AgentRunResultEvent):
                    # Belt-and-suspenders: never persist ephemeral voice instructions.
                    all_messages = strip_voice_mode_prompt(event.result.all_messages())
                    continue

                ws_event = map_pydantic_event(event, assistant_text_parts)
                if not ws_event:
                    continue
                if not sanitize_tool_event(ws_event, known_image_urls, image_lookup):
                    continue

                await send(ws_event)

                if ws_event["type"] == "tool_call":
                    status = tool_status_event(ws_event["tool_name"], ws_event.get("args", {}))
                    if status:
                        await send(status)

    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.exception(f"[stream] agent error thread={thread_id!r}: {exc}")
        try:
            await send({
                "type": "error",
                "message": "Something went wrong. Please try again.",
            })
        except Exception:
            pass

    finally:
        # run_done is what releases the client's "thinking" state, so nothing
        # that can raise may run before it — a serialization error here used to
        # escape the finally and leave the UI spinning forever.
        try:
            snapshot = messages_to_json(all_messages) if all_messages else []
        except Exception:
            logger.exception(f"[stream] snapshot serialization failed thread={thread_id!r}")
            snapshot = []

        try:
            await send({"type": "run_done", "messages_snapshot": snapshot})
        except Exception:
            pass  # client gone; the turn is still worth saving

        if all_messages:
            await redis_manager.save_chat_snapshot(thread_id, snapshot)
            _persist_in_background(
                thread_id, user_id, city_id, content,
                "".join(assistant_text_parts), all_messages,
            )


if __name__ == "__main__":
    from dataclasses import dataclass
    from unittest.mock import patch

    @dataclass
    class _Delta:
        content_delta: str
        part_delta_kind: str = "text"

    @dataclass
    class _PartDelta:
        delta: _Delta
        event_kind: str = "part_delta"

    class _StubEvents:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def __aiter__(self):
            yield _PartDelta(_Delta("Aadaab"))
            yield _PartDelta(_Delta(", Lucknow"))

    class _StubAgent:
        def run_stream_events(self, *a, **kw):
            return _StubEvents()

    async def _demo():
        """Drives one turn against a stub agent — no LLM call, no network."""
        sent = []

        async def _capture(event):
            sent.append(event)

        # Patch this module's own globals — under `python -m` that is __main__,
        # not src.handlers.streaming.
        with patch(f"{__name__}.get_agent", return_value=_StubAgent()), \
             patch(f"{__name__}.load_history", return_value=("lucknow", None)):
            await run_agent_stream(_capture, 1, "demo-thread", "hi")

        assert [e["type"] for e in sent] == ["text_delta", "text_delta", "run_done"]
        assert "".join(e["delta"] for e in sent if e["type"] == "text_delta") == "Aadaab, Lucknow"
        assert sent[-1]["messages_snapshot"] == []  # stub produced no result event

        # A send that always fails must not stop run_done or the persist path
        async def _broken(_event):
            raise ConnectionError("client gone")

        with patch(f"{__name__}.get_agent", return_value=_StubAgent()), \
             patch(f"{__name__}.load_history", return_value=("lucknow", None)):
            await run_agent_stream(_broken, 1, "demo-thread", "hi")

        print(f"ok — {len(sent)} events, text reassembled, survives a dead client")

    asyncio.run(_demo())
