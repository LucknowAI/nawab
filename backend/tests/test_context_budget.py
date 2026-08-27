import json

import pytest

from src.utils.context_budget import trim_message_history, exceeds_char_limit


def _req(parts):
    return {"kind": "request", "parts": parts}


def _resp(parts):
    return {"kind": "response", "parts": parts}


def _user_turn(text):
    """A minimal one-message turn: request with a user-prompt part."""
    return _req([{"part_kind": "user-prompt", "content": text}])


def _tool_turn(user_text, tool_name, tool_args, tool_result):
    """A turn with a tool round-trip: user request -> tool-call response ->
    tool-return request -> final text response."""
    return [
        _req([{"part_kind": "user-prompt", "content": user_text}]),
        _resp([{"part_kind": "tool-call", "tool_name": tool_name, "args": tool_args}]),
        _req([{"part_kind": "tool-return", "tool_name": tool_name, "content": tool_result}]),
        _resp([{"part_kind": "text", "content": "done"}]),
    ]


class TestTrimMessageHistory:
    def test_empty_history_returns_empty(self):
        assert trim_message_history([], max_turns=5) == []

    def test_none_history_returns_none(self):
        assert trim_message_history(None, max_turns=5) is None

    def test_under_limit_is_unchanged(self):
        messages = [_user_turn("hi"), _resp([{"part_kind": "text", "content": "hey"}])]
        assert trim_message_history(messages, max_turns=5) == messages

    def test_drops_oldest_whole_turns_only(self):
        messages = []
        for i in range(5):
            messages.append(_user_turn(f"msg{i}"))
            messages.append(_resp([{"part_kind": "text", "content": f"reply{i}"}]))

        trimmed = trim_message_history(messages, max_turns=2)

        # Only the last 2 turns (4 messages) should survive.
        assert len(trimmed) == 4
        assert trimmed[0]["parts"][0]["content"] == "msg3"
        assert trimmed[2]["parts"][0]["content"] == "msg4"

    def test_never_splits_a_tool_call_return_pair(self):
        messages = []
        messages.extend(_tool_turn("t0", "search", {}, "r0"))
        messages.extend(_tool_turn("t1", "search", {}, "r1"))
        messages.extend(_tool_turn("t2", "search", {}, "r2"))

        trimmed = trim_message_history(messages, max_turns=1)

        # The kept turn must start on a user-prompt request and contain its
        # matching tool-call/tool-return pair — never an orphaned half.
        assert trimmed[0]["parts"][0]["part_kind"] == "user-prompt"
        assert trimmed[0]["parts"][0]["content"] == "t2"
        assert len(trimmed) == 4

    def test_shrinks_further_to_respect_char_budget(self):
        big = "x" * 1000
        messages = []
        for i in range(10):
            messages.append(_user_turn(big))
            messages.append(_resp([{"part_kind": "text", "content": big}]))

        trimmed = trim_message_history(messages, max_turns=10, max_chars=2500)

        assert len(json.dumps(trimmed)) <= 2500 or len(trimmed) == 2  # at least one turn kept
        # Always keeps at least the most recent turn even if it alone exceeds budget.
        assert trimmed[-2]["parts"][0]["content"] == big

    def test_keeps_at_least_last_turn_even_over_budget(self):
        big = "x" * 5000
        messages = [_user_turn(big), _resp([{"part_kind": "text", "content": "ok"}])]

        trimmed = trim_message_history(messages, max_turns=10, max_chars=100)

        assert trimmed == messages

    def test_no_turn_boundaries_returns_original(self):
        # Malformed/unexpected shape — no user-prompt anywhere; fail safe.
        messages = [_resp([{"part_kind": "text", "content": "??"}])]
        assert trim_message_history(messages, max_turns=1) == messages


class TestExceedsCharLimit:
    def test_within_limit(self):
        assert exceeds_char_limit("hello", 10) is False

    def test_exactly_at_limit(self):
        assert exceeds_char_limit("hello", 5) is False

    def test_over_limit(self):
        assert exceeds_char_limit("hello world", 5) is True

    def test_empty_string_never_exceeds(self):
        assert exceeds_char_limit("", 0) is False
