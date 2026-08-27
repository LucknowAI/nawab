"""Builds and caches one pydantic-ai Agent per city."""

import asyncio
import os
from dataclasses import dataclass

from fastapi import WebSocket
from pydantic_ai import Agent, RunContext
from pydantic_ai.settings import ModelSettings

from src.agent.prompt import UI_TOOLS_PROMPT
from src.agent.tools import display, metro, search
from src.cities.registry import get_city
from src.config.settings import Settings


@dataclass
class AgentDeps:
    """Per-run dependencies passed to every agent tool."""

    city_id: str
    websocket: WebSocket | None = None
    input_queue: asyncio.Queue | None = None


if Settings.GEMINI_API_KEY:
    # pydantic-ai's Google provider reads this from the environment.
    os.environ.setdefault("GEMINI_API_KEY", Settings.GEMINI_API_KEY)
    # `google-gla:` was dropped in pydantic-ai 2.x — the prefix is now `google:`
    model_name = Settings.GEMINI_MODEL_NAME or "google:gemini-3-flash-preview"
    # Reasoning tokens share the output budget on Gemini's thinking models.
    # Capped below max_tokens so the post-tool-call turn always has room left
    # to answer — uncapped, the model has burned the whole budget thinking,
    # returned neither text nor a tool call, and pydantic-ai's forced retry
    # made it re-answer from scratch: duplicated reply, then a hard failure
    # once retries ran out ("Exceeded maximum output retries").
    _reasoning_settings = {"google_thinking_config": {"thinking_budget": 8192}}
else:
    model_name = Settings.OPENAI_MODEL_NAME or "openai:gpt-5.2"
    # Same failure class applies to OpenAI's reasoning models (o-series/gpt-5):
    # reasoning tokens count against max_completion_tokens too. No numeric
    # budget knob here, only an effort level — capped so it can't dominate.
    _reasoning_settings = {"openai_reasoning_effort": "low"}

_agent_cache: dict[str, Agent] = {}


def build_agent(city) -> Agent:
    """Create an Agent wired to one city's persona and tools."""
    agent = Agent(
        model_name,
        system_prompt=city.system_prompt + UI_TOOLS_PROMPT,
        deps_type=AgentDeps,
        # Without an explicit cap the provider default applies — see
        # `_reasoning_settings` above for why that's dangerous on a thinking
        # model. 16384 gives that capped reasoning budget headroom to still
        # leave room for the actual reply.
        model_settings=ModelSettings(max_tokens=16384, **_reasoning_settings),
    )

    search.register(agent, city)
    display.register(agent)
    metro.register(agent, city)

    @agent.tool
    async def ask_user(ctx: RunContext[AgentDeps], question: str) -> str:
        """Ask the user a clarifying question and wait for their response before
        continuing. Use this when the request is ambiguous and a short answer
        from the user would significantly improve the response quality.

        Args:
            question: The clarifying question to show the user.
        """
        websocket = ctx.deps.websocket
        input_queue = ctx.deps.input_queue
        if websocket is None or input_queue is None:
            return "No answer available."

        await websocket.send_json({"type": "question", "question": question})
        try:
            return await asyncio.wait_for(input_queue.get(), timeout=300.0)
        except asyncio.TimeoutError:
            return "No answer received (timed out)."

    return agent


def get_agent(city_id: str) -> Agent:
    """Return the cached Agent for a city, building it on first use."""
    if city_id not in _agent_cache:
        _agent_cache[city_id] = build_agent(get_city(city_id))
    return _agent_cache[city_id]
