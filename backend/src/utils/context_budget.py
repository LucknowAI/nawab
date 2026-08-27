"""Guards that keep a single LLM request within its context window.

Two independent limits are enforced:

1. A hard cap on a single incoming user message (``exceeds_char_limit``) —
   rejected outright with a clear error rather than sent to the model.
2. A sliding-window trim of the stored conversation history
   (``trim_message_history``) — applied every time history is loaded from
   Redis/DB, before it's handed to ``agent.run_stream_events``. Without this
   the message list stored per thread grows every turn (see
   ``save_chat_snapshot``) and eventually exceeds the model's context
   window, causing request failures or slow/hung responses.

Both work in char counts rather than real tokens — no tokenizer dependency
is pulled in; ~4 chars/token is a good enough estimate for a budget guard.
"""
from __future__ import annotations

import json


def exceeds_char_limit(text: str, max_chars: int) -> bool:
    """True if `text` is longer than `max_chars`."""
    return len(text) > max_chars


def _is_turn_start(message: dict) -> bool:
    """A turn starts at a request message carrying a user-prompt part.

    Everything between one turn-start and the next (tool calls, tool
    returns, the final text response) belongs to that same turn and must
    never be split apart, or the tool-call/tool-return pairing pydantic-ai
    expects breaks.
    """
    if message.get("kind") != "request":
        return False
    return any(p.get("part_kind") == "user-prompt" for p in message.get("parts", []))


def trim_message_history(
    messages: list[dict] | None,
    max_turns: int,
    max_chars: int | None = None,
) -> list[dict] | None:
    """Keep at most the last `max_turns` complete turns of `messages`, then
    shrink further (still by whole turns) until the JSON size fits
    `max_chars` — but never drop below the single most recent turn.

    Turn boundaries are found from the message shape itself (see
    `_is_turn_start`), so a tool-call is never separated from its
    tool-return.
    """
    if not messages:
        return messages

    turn_starts = [i for i, m in enumerate(messages) if _is_turn_start(m)]
    if not turn_starts:
        # Unexpected shape (e.g. no user-prompt found anywhere) — fail safe
        # and leave the history untouched rather than guess.
        return messages

    keep_from = max(0, len(turn_starts) - max_turns) if max_turns > 0 else len(turn_starts) - 1
    keep_from = min(keep_from, len(turn_starts) - 1)

    if max_chars is not None:
        while keep_from < len(turn_starts) - 1:
            candidate = messages[turn_starts[keep_from]:]
            if len(json.dumps(candidate, default=str)) <= max_chars:
                break
            keep_from += 1

    return messages[turn_starts[keep_from]:]
