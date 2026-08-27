"""Chat routes — conversation lifecycle and history reads."""

from fastapi import APIRouter, Depends

from src.auth.jwt_utils import get_current_user_id
from src.handlers import chat as handler
from src.schemas.response import ok

chat_router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
    responses={404: {"description": "Not found"}},
)


@chat_router.post("/new", summary="Create a new conversation")
async def new_chat(body: handler.NewChatRequest, user_id: int = Depends(get_current_user_id)):
    """Create an empty conversation. Call this before opening the WebSocket."""
    return ok(await handler.create_conversation(user_id, body.city_id), 201)


@chat_router.get("/conversations", summary="List user conversations")
async def list_conversations(
    user_id: int = Depends(get_current_user_id),
    limit: int = 50,
    offset: int = 0,
):
    return ok(await handler.list_conversations(user_id, limit, offset))


@chat_router.delete("/conversations/{thread_id}", summary="Delete a conversation")
async def delete_conversation(thread_id: str, user_id: int = Depends(get_current_user_id)):
    return ok(await handler.delete_conversation(user_id, thread_id))


@chat_router.get("/conversations/{thread_id}/events", summary="Stored messages, for replay")
async def get_conversation_events(thread_id: str, user_id: int = Depends(get_current_user_id)):
    return ok(await handler.get_conversation_events(user_id, thread_id))


@chat_router.get("/conversations/{thread_id}/messages", summary="Human-readable messages")
async def get_conversation_messages(thread_id: str, user_id: int = Depends(get_current_user_id)):
    return ok(await handler.get_conversation_messages(user_id, thread_id))


@chat_router.get("/conversations/{thread_id}/replay", summary="Conversation as frontend events")
async def get_conversation_replay(thread_id: str, user_id: int = Depends(get_current_user_id)):
    return ok(await handler.get_conversation_replay(user_id, thread_id))
