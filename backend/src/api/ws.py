"""WebSocket chat endpoint — auth, message routing, and event forwarding."""

import asyncio
import uuid

from fastapi import APIRouter, Cookie, WebSocket, WebSocketDisconnect

from src.auth.jwt_utils import user_id_from_token
from src.config.settings import settings
from src.handlers.streaming import run_agent_stream
from src.utils.context_budget import exceeds_char_limit
from src.utils.util_logger.logger import logger

ws_chat_router = APIRouter(prefix="/chat", tags=["Chat WS"])


async def _authenticate(websocket: WebSocket, access_token: str | None) -> int | None:
    """Resolve the user from the cookie, else from a first {"type":"auth"} frame.

    Closes the socket and returns None if that fails.
    """
    token = access_token
    if token is None:
        try:
            first = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
            if first.get("type") == "auth":
                token = first.get("token")
        except asyncio.TimeoutError:
            await websocket.send_json({"type": "error", "message": "Auth timeout"})
            await websocket.close(code=4001)
            return None
        except Exception:
            await websocket.send_json({"type": "error", "message": "Failed to receive auth message"})
            await websocket.close(code=4001)
            return None

    if token is None:
        await websocket.send_json({
            "type": "error",
            "message": "Auth message must have type='auth' and a token field",
        })
        await websocket.close(code=4001)
        return None

    try:
        return user_id_from_token(token)
    except Exception:
        await websocket.send_json({"type": "error", "message": "Unauthorized"})
        await websocket.close(code=4001)
        return None


@ws_chat_router.websocket("/ws")
async def chat_websocket(websocket: WebSocket, access_token: str | None = Cookie(default=None)):
    """
    Auth: the access_token HttpOnly cookie, or {"type":"auth","token":"..."} as
    the first message (for non-browser clients).

    Client sends:
      {"type": "run", "thread_id": "<uuid from POST /chat/new>", "content": "..."}
      {"type": "user_input", "content": "..."}   # answers an ask_user question

    Server sends: agent_status, text_delta, text_done, thinking_delta,
    thinking_done, tool_call, tool_result, question, run_done, error.
    """
    await websocket.accept()

    user_id = await _authenticate(websocket, access_token)
    if user_id is None:
        return

    run_queue: asyncio.Queue = asyncio.Queue(maxsize=10)
    input_queue: asyncio.Queue = asyncio.Queue()

    async def _receiver():
        try:
            while True:
                data = await websocket.receive_json()
                kind = data.get("type")
                if kind == "run":
                    if run_queue.full():
                        await websocket.send_json({"type": "error", "message": "Too many pending run requests"})
                    else:
                        await run_queue.put(data)
                elif kind == "user_input":
                    await input_queue.put(data.get("content", ""))
        except WebSocketDisconnect:
            await run_queue.put(None)

    receiver_task = asyncio.create_task(_receiver())

    try:
        while True:
            msg = await run_queue.get()
            if msg is None:
                break

            thread_id = msg.get("thread_id") or str(uuid.uuid4())
            content = (msg.get("content") or "").strip()

            if not content:
                await websocket.send_json({"type": "error", "message": "content is required"})
                continue

            if exceeds_char_limit(content, settings.MAX_USER_MESSAGE_CHARS):
                await websocket.send_json({
                    "type": "error",
                    "message": f"Message is too long ({len(content)} chars). "
                               f"Please shorten it to under {settings.MAX_USER_MESSAGE_CHARS} characters.",
                })
                continue

            # Fresh queue per run so a previous answer can't bleed into the next
            input_queue = asyncio.Queue()

            await run_agent_stream(
                websocket.send_json,
                user_id=user_id,
                thread_id=thread_id,
                content=content,
                websocket=websocket,
                input_queue=input_queue,
            )

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error(f"[ws] connection error user={user_id}: {exc}")
    finally:
        receiver_task.cancel()
        logger.info(f"[ws] connection closed user={user_id}")
