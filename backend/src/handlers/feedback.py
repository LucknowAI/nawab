"""Feedback handlers — submit and list the caller's own feedback."""

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from sqlalchemy_models.feedback import FeedbackModel
from src.database.db import get_db


class FeedbackRequest(BaseModel):
    message: str


def _serialize(fb, include_user=False) -> dict:
    row = {
        "id": fb.id,
        "message": fb.message,
        "created_at": fb.created_at.isoformat(),
    }
    if include_user:
        row["user_id"] = fb.user_id
    return row


async def create_feedback(user_id: int, message: str) -> dict:
    """Store one feedback message from the authenticated user."""
    message = message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="message cannot be empty")

    async with get_db() as db:
        fb = FeedbackModel(user_id=user_id, message=message)
        db.add(fb)
        await db.flush()
        await db.refresh(fb)
        return _serialize(fb, include_user=True)


async def list_feedback(user_id: int, limit: int = 50, offset: int = 0) -> list:
    """Return the user's feedback, newest first."""
    async with get_db() as db:
        result = await db.execute(
            select(FeedbackModel)
            .where(FeedbackModel.user_id == user_id)
            .order_by(FeedbackModel.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return [_serialize(fb) for fb in result.scalars().all()]


if __name__ == "__main__":
    import asyncio

    async def _demo():
        """Writes one row against the configured database, then deletes it."""
        try:
            await create_feedback(user_id=1, message="   ")
            raise AssertionError("expected 422 for an empty message")
        except HTTPException as exc:
            assert exc.status_code == 422

        created = await create_feedback(user_id=1, message="handler self-check")
        try:
            rows = await list_feedback(user_id=1, limit=5)
            assert any(r["id"] == created["id"] for r in rows)
            print(f"ok — created feedback {created['id']} and read it back")
        finally:
            async with get_db() as db:
                fb = await db.get(FeedbackModel, created["id"])
                if fb:
                    await db.delete(fb)
            print("ok — cleaned up")

    asyncio.run(_demo())
