"""The response envelope every REST endpoint returns.

Success bodies are built by `ok()` in the routers; failures are built by the
exception handlers registered in main.py, so no route needs its own try/except.
WebSocket frames are deliberately not wrapped — they are a typed event stream.
"""

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class StandardResponse(BaseModel):
    """Envelope for a successful REST response."""

    success: bool = True
    status_code: int = 200
    message: object = None  # the endpoint's payload — dict, list, or str


class StandardError(BaseModel):
    """Envelope for a failed REST response."""

    success: bool = False
    status_code: int = 500
    message: object = "Internal server error"


def ok(message, status_code=200):
    """Wrap a handler result in StandardResponse."""
    body = StandardResponse(status_code=status_code, message=jsonable_encoder(message))
    return JSONResponse(body.model_dump(), status_code=status_code)


def fail(message, status_code=500):
    """Wrap an error in StandardError."""
    body = StandardError(status_code=status_code, message=jsonable_encoder(message))
    return JSONResponse(body.model_dump(), status_code=status_code)
