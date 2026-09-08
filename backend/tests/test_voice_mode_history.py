"""Voice-mode instructions must not bleed into later typed turns via history."""

import os

# Importing streaming pulls chat → db engine; allow collection without a real DB.
os.environ.setdefault(
    "POSTGRES_DB_URL",
    "postgresql+asyncpg://nawab:nawab@localhost:5432/nawab_test",
)

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from pydantic_ai.messages import (
    ModelRequest,
    ModelResponse,
    SystemPromptPart,
    TextPart,
    UserPromptPart,
)
from pydantic_ai.run import AgentRunResultEvent

from src.agent.prompt import VOICE_MODE_PROMPT
from src.handlers.streaming import run_agent_stream, strip_voice_mode_prompt


def test_voice_mode_prompt_requires_devanagari_forbids_roman():
    """Kokoro TTS quality depends on Devanagari input, not Roman Hinglish."""
    prompt = VOICE_MODE_PROMPT
    assert "Devanagari" in prompt
    assert "Hindi" in prompt and "Awadhi" in prompt
    lower = prompt.lower()
    assert "roman" in lower or "latin" in lower
    assert "never" in lower
    assert "markdown" in lower
    # Example of correct mixed script still present for the model
    assert "आप" in prompt or "स्वागत" in prompt


def _assert_no_voice_prompt_in_history(messages):
    """History must not carry VOICE_MODE_PROMPT via parts or .instructions."""
    for msg in messages or []:
        if isinstance(msg, ModelRequest):
            assert msg.instructions != VOICE_MODE_PROMPT
        for part in getattr(msg, "parts", []):
            assert not (
                isinstance(part, SystemPromptPart) and part.content == VOICE_MODE_PROMPT
            )


def test_strip_voice_mode_prompt_removes_standalone_and_mixed_parts():
    leaked = ModelRequest(parts=[SystemPromptPart(content=VOICE_MODE_PROMPT)])
    mixed = ModelRequest(
        parts=[
            SystemPromptPart(content=VOICE_MODE_PROMPT),
            UserPromptPart(content="keep me"),
        ]
    )
    normal = ModelRequest(parts=[UserPromptPart(content="hello")])
    reply = ModelResponse(parts=[TextPart(content="namaste")])

    cleaned = strip_voice_mode_prompt([leaked, mixed, normal, reply])

    assert len(cleaned) == 3
    assert isinstance(cleaned[0], ModelRequest)
    assert len(cleaned[0].parts) == 1
    assert cleaned[0].parts[0].content == "keep me"
    assert cleaned[1] is normal
    assert cleaned[2] is reply
    assert VOICE_MODE_PROMPT not in str(cleaned)
    _assert_no_voice_prompt_in_history(cleaned)


def test_strip_voice_mode_prompt_clears_instructions_field():
    """pydantic-ai persists run instructions on ModelRequest.instructions."""
    other = "unrelated system instructions — keep me"
    with_voice_instr = ModelRequest(
        parts=[UserPromptPart(content="voice hi")],
        instructions=VOICE_MODE_PROMPT,
    )
    with_other_instr = ModelRequest(
        parts=[UserPromptPart(content="typed")],
        instructions=other,
    )
    mixed_parts_and_instr = ModelRequest(
        parts=[
            SystemPromptPart(content=VOICE_MODE_PROMPT),
            UserPromptPart(content="both leak vectors"),
        ],
        instructions=VOICE_MODE_PROMPT,
    )
    reply = ModelResponse(parts=[TextPart(content="ok")])

    cleaned = strip_voice_mode_prompt(
        [with_voice_instr, with_other_instr, mixed_parts_and_instr, reply]
    )

    assert len(cleaned) == 4
    assert cleaned[0].instructions is None
    assert cleaned[0].parts[0].content == "voice hi"
    assert cleaned[1] is with_other_instr
    assert cleaned[1].instructions == other
    assert cleaned[2].instructions is None
    assert len(cleaned[2].parts) == 1
    assert cleaned[2].parts[0].content == "both leak vectors"
    assert cleaned[3] is reply
    _assert_no_voice_prompt_in_history(cleaned)


class _Result:
    def __init__(self, messages):
        self._messages = messages

    def all_messages(self):
        return self._messages


class _StreamEvents:
    def __init__(self, events):
        self._events = events
        self.kwargs = None
        self.args = None

    def __call__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def __aiter__(self):
        for event in self._events:
            yield event


def _voice_leaked_result(user_text: str, assistant_text: str):
    """Simulate the confirmed bug: VOICE_MODE_PROMPT on ModelRequest.instructions."""
    return [
        ModelRequest(
            parts=[UserPromptPart(content=user_text)],
            instructions=VOICE_MODE_PROMPT,
        ),
        ModelResponse(parts=[TextPart(content=assistant_text)]),
    ]


def test_voice_then_typed_does_not_persist_or_reapply_voice_prompt():
    """typed → voice(voice_mode=true) → persist → typed again → no voice prompt."""
    persisted_snapshots = []
    redis_saves = []

    history_store = {"msgs": None}

    async def fake_load(_thread_id, _user_id):
        return "lucknow", history_store["msgs"]

    async def fake_persist(_tid, _uid, _city, _user, _asst, all_messages):
        persisted_snapshots.append(list(all_messages))
        history_store["msgs"] = list(all_messages)

    async def fake_redis_save(_tid, snapshot):
        redis_saves.append(snapshot)

    async def flush_background():
        await asyncio.sleep(0)
        pending = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

    async def _run():
        # --- Turn 1: typed ---
        stream1 = _StreamEvents([
            AgentRunResultEvent(
                result=_Result([
                    ModelRequest(parts=[UserPromptPart(content="hello typed")]),
                    ModelResponse(parts=[TextPart(content="Aadaab")]),
                ])
            )
        ])
        agent1 = MagicMock()
        agent1.run_stream_events = stream1

        with patch("src.handlers.streaming.get_agent", return_value=agent1), \
             patch("src.handlers.streaming.load_history", side_effect=fake_load), \
             patch("src.handlers.streaming.persist_conversation", side_effect=fake_persist), \
             patch("src.handlers.streaming.redis_manager") as redis:
            redis.save_chat_snapshot = AsyncMock(side_effect=fake_redis_save)
            sent = []

            async def capture(event):
                sent.append(event)

            await run_agent_stream(capture, 1, "t1", "hello typed", voice_mode=False)
            await flush_background()

        assert "instructions" not in (stream1.kwargs or {})
        assert history_store["msgs"] is not None
        _assert_no_voice_prompt_in_history(history_store["msgs"])

        # --- Turn 2: voice (simulate all_messages that leak .instructions) ---
        stream2 = _StreamEvents([
            AgentRunResultEvent(result=_Result(_voice_leaked_result("voice hi", "नमस्ते")))
        ])
        agent2 = MagicMock()
        agent2.run_stream_events = stream2

        with patch("src.handlers.streaming.get_agent", return_value=agent2), \
             patch("src.handlers.streaming.load_history", side_effect=fake_load), \
             patch("src.handlers.streaming.persist_conversation", side_effect=fake_persist), \
             patch("src.handlers.streaming.redis_manager") as redis:
            redis.save_chat_snapshot = AsyncMock(side_effect=fake_redis_save)
            sent = []

            async def capture(event):
                sent.append(event)

            await run_agent_stream(capture, 1, "t1", "voice hi", voice_mode=True)
            await flush_background()

        assert stream2.kwargs.get("instructions") == VOICE_MODE_PROMPT
        # Persisted history must NOT contain the voice directive even if all_messages did.
        assert persisted_snapshots[-1]
        _assert_no_voice_prompt_in_history(persisted_snapshots[-1])
        assert VOICE_MODE_PROMPT not in str(redis_saves[-1])
        for entry in redis_saves[-1]:
            if isinstance(entry, dict):
                assert entry.get("instructions") != VOICE_MODE_PROMPT

        # --- Turn 3: typed again — must not pass instructions, history scrubbed ---
        stream3 = _StreamEvents([
            AgentRunResultEvent(
                result=_Result([
                    *(history_store["msgs"] or []),
                    ModelRequest(parts=[UserPromptPart(content="typed again")]),
                    ModelResponse(parts=[TextPart(content="Sure")]),
                ])
            )
        ])
        agent3 = MagicMock()
        agent3.run_stream_events = stream3

        with patch("src.handlers.streaming.get_agent", return_value=agent3), \
             patch("src.handlers.streaming.load_history", side_effect=fake_load), \
             patch("src.handlers.streaming.persist_conversation", side_effect=fake_persist), \
             patch("src.handlers.streaming.redis_manager") as redis:
            redis.save_chat_snapshot = AsyncMock(side_effect=fake_redis_save)
            sent = []

            async def capture(event):
                sent.append(event)

            await run_agent_stream(capture, 1, "t1", "typed again", voice_mode=False)
            await flush_background()

        assert "instructions" not in (stream3.kwargs or {})
        hist = stream3.kwargs.get("message_history") or []
        _assert_no_voice_prompt_in_history(hist)
        for msg in hist:
            for part in getattr(msg, "parts", []):
                if isinstance(part, SystemPromptPart):
                    assert "Devanagari" not in (part.content or "")
                    assert "Voice Mode" not in (part.content or "")
        _assert_no_voice_prompt_in_history(persisted_snapshots[-1])

    asyncio.run(_run())


def test_voice_typed_voice_sanitizes_across_mode_switches():
    """voice → typed → voice: history never retains VOICE_MODE_PROMPT."""
    history_store = {"msgs": None}
    persisted_snapshots = []

    async def fake_load(_thread_id, _user_id):
        return "lucknow", history_store["msgs"]

    async def fake_persist(_tid, _uid, _city, _user, _asst, all_messages):
        persisted_snapshots.append(list(all_messages))
        history_store["msgs"] = list(all_messages)

    async def flush_background():
        await asyncio.sleep(0)
        pending = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

    async def _run():
        # --- Turn 1: voice ---
        stream1 = _StreamEvents([
            AgentRunResultEvent(result=_Result(_voice_leaked_result("bol", "जी")))
        ])
        agent1 = MagicMock()
        agent1.run_stream_events = stream1

        with patch("src.handlers.streaming.get_agent", return_value=agent1), \
             patch("src.handlers.streaming.load_history", side_effect=fake_load), \
             patch("src.handlers.streaming.persist_conversation", side_effect=fake_persist), \
             patch("src.handlers.streaming.redis_manager") as redis:
            redis.save_chat_snapshot = AsyncMock()
            await run_agent_stream(AsyncMock(), 1, "t1", "bol", voice_mode=True)
            await flush_background()

        assert stream1.kwargs.get("instructions") == VOICE_MODE_PROMPT
        _assert_no_voice_prompt_in_history(persisted_snapshots[-1])

        # --- Turn 2: typed — history scrubbed, no run instructions ---
        stream2 = _StreamEvents([
            AgentRunResultEvent(
                result=_Result([
                    *(history_store["msgs"] or []),
                    ModelRequest(parts=[UserPromptPart(content="type please")]),
                    ModelResponse(parts=[TextPart(content="Sure")]),
                ])
            )
        ])
        agent2 = MagicMock()
        agent2.run_stream_events = stream2

        with patch("src.handlers.streaming.get_agent", return_value=agent2), \
             patch("src.handlers.streaming.load_history", side_effect=fake_load), \
             patch("src.handlers.streaming.persist_conversation", side_effect=fake_persist), \
             patch("src.handlers.streaming.redis_manager") as redis:
            redis.save_chat_snapshot = AsyncMock()
            await run_agent_stream(AsyncMock(), 1, "t1", "type please", voice_mode=False)
            await flush_background()

        assert "instructions" not in (stream2.kwargs or {})
        _assert_no_voice_prompt_in_history(stream2.kwargs.get("message_history") or [])
        _assert_no_voice_prompt_in_history(persisted_snapshots[-1])

        # --- Turn 3: voice again — fresh instructions only for this run ---
        stream3 = _StreamEvents([
            AgentRunResultEvent(
                result=_Result([
                    *(history_store["msgs"] or []),
                    ModelRequest(
                        parts=[UserPromptPart(content="voice again")],
                        instructions=VOICE_MODE_PROMPT,
                    ),
                    ModelResponse(parts=[TextPart(content="ठीक")]),
                ])
            )
        ])
        agent3 = MagicMock()
        agent3.run_stream_events = stream3

        with patch("src.handlers.streaming.get_agent", return_value=agent3), \
             patch("src.handlers.streaming.load_history", side_effect=fake_load), \
             patch("src.handlers.streaming.persist_conversation", side_effect=fake_persist), \
             patch("src.handlers.streaming.redis_manager") as redis:
            redis.save_chat_snapshot = AsyncMock()
            await run_agent_stream(AsyncMock(), 1, "t1", "voice again", voice_mode=True)
            await flush_background()

        assert stream3.kwargs.get("instructions") == VOICE_MODE_PROMPT
        hist = stream3.kwargs.get("message_history") or []
        _assert_no_voice_prompt_in_history(hist)
        _assert_no_voice_prompt_in_history(persisted_snapshots[-1])

    asyncio.run(_run())


def test_voice_mode_uses_instructions_not_history_mutation():
    stream = _StreamEvents([
        AgentRunResultEvent(
            result=_Result([
                ModelRequest(parts=[UserPromptPart(content="bol")]),
                ModelResponse(parts=[TextPart(content="जी")]),
            ])
        )
    ])
    agent = MagicMock()
    agent.run_stream_events = stream
    prior = [ModelRequest(parts=[UserPromptPart(content="earlier")])]

    async def _run():
        with patch("src.handlers.streaming.get_agent", return_value=agent), \
             patch("src.handlers.streaming.load_history", return_value=("lucknow", prior)), \
             patch("src.handlers.streaming.persist_conversation", new_callable=AsyncMock), \
             patch("src.handlers.streaming.redis_manager") as redis:
            redis.save_chat_snapshot = AsyncMock()
            await run_agent_stream(AsyncMock(), 1, "t1", "bol", voice_mode=True)

    asyncio.run(_run())

    assert stream.kwargs["instructions"] == VOICE_MODE_PROMPT
    # History passed to the agent is prior only — not an appended SystemPromptPart.
    hist = stream.kwargs["message_history"]
    assert hist == prior
    assert not any(
        isinstance(p, SystemPromptPart)
        for m in hist
        for p in getattr(m, "parts", [])
    )
    _assert_no_voice_prompt_in_history(hist)
