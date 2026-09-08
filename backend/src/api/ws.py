"""WebSocket chat endpoint — auth, message routing, and event forwarding."""

import asyncio
import uuid

from fastapi import APIRouter, Cookie, WebSocket, WebSocketDisconnect

from src.auth.jwt_utils import user_id_from_token
from src.config.settings import settings
from src.database.redis import redis_manager
from src.handlers.chat import authorize_thread_access
from src.handlers.streaming import run_agent_stream
from src.middleware.ws_limits import (
    check_ws_connect_rate,
    check_ws_run_rate,
    release_run_slot,
    try_acquire_run_slot,
)
from src.utils.context_budget import exceeds_char_limit
from src.utils.util_logger.logger import logger

ws_chat_router = APIRouter(prefix="/chat", tags=["Chat WS"])

_GENERIC_THREAD_DENIED = "Conversation not found."
_GENERIC_RATE_LIMITED = "Rate limit exceeded. Please try again later."


async def _authenticate(websocket: WebSocket, access_token: str | None) -> int | None:
    """Resolve the user from the cookie JWT, else a first auth frame.

    Auth-frame tokens are preferably short-lived single-use WS tickets minted by
    POST /auth/ws-ticket. Long-lived JWTs are still accepted on the cookie path
    (and as a fallback for non-browser clients) but must not be exposed to JS.
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

    # Opaque WS tickets (browser BFF path) — single-use, not a REST bearer.
    ticket_user = await redis_manager.consume_ws_ticket(token)
    if ticket_user is not None:
        return ticket_user

    # Cookie JWT, or non-browser clients sending a JWT in the auth frame.
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
    the first message (WS ticket from /api/ws-token, or JWT for non-browser clients).

    Client sends:
      {"type": "run", "thread_id": "<uuid from POST /chat/new>", "content": "...", "voice_mode": false}
      {"type": "user_input", "content": "..."}   # answers an ask_user question

    Server sends: agent_status, text_delta, text_done, thinking_delta,
    thinking_done, tool_call, tool_result, question, run_done, error.
    """
    await websocket.accept()

    client_ip = websocket.client.host if websocket.client else "unknown"
    if not await check_ws_connect_rate(client_ip):
        await websocket.send_json({"type": "error", "message": _GENERIC_RATE_LIMITED})
        await websocket.close(code=4029)
        return

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
            voice_mode = bool(msg.get("voice_mode"))

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

            # Authorize before any history load / LLM / Redis write.
            if not await authorize_thread_access(thread_id, user_id):
                await websocket.send_json({"type": "error", "message": _GENERIC_THREAD_DENIED})
                continue

            if not await check_ws_run_rate(user_id):
                await websocket.send_json({"type": "error", "message": _GENERIC_RATE_LIMITED})
                continue

            if not await try_acquire_run_slot(user_id):
                await websocket.send_json({"type": "error", "message": _GENERIC_RATE_LIMITED})
                continue

            # Fresh queue per run so a previous answer can't bleed into the next
            input_queue = asyncio.Queue()

            try:
                await run_agent_stream(
                    websocket.send_json,
                    user_id=user_id,
                    thread_id=thread_id,
                    content=content,
                    websocket=websocket,
                    input_queue=input_queue,
                    voice_mode=voice_mode,
                )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error(f"[ws] run error user={user_id} thread={thread_id!r}: {exc}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Something went wrong. Please try again.",
                    })
                except Exception:
                    pass
            finally:
                await release_run_slot(user_id)

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error(f"[ws] connection error user={user_id}: {exc}")
    finally:
        receiver_task.cancel()
        logger.info(f"[ws] connection closed user={user_id}")
