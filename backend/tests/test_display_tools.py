"""Display-tool schemas.

The system prompt describes every display tool the same way, so the model
passes `title` to any of them. A tool whose signature lacks it fails arg
validation with extra_forbidden — pydantic-ai turns that into a retry prompt
and the model re-writes its whole answer, so the user sees the reply twice.
"""

import pytest
from pydantic_ai import Agent

from src.agent.tools import display


@pytest.fixture(scope="module")
def tools():
    agent = Agent()
    display.register(agent)
    return agent._function_toolset.tools


def test_every_display_tool_accepts_title(tools):
    for name, tool in tools.items():
        assert "title" in tool.function_schema.json_schema["properties"], (
            f"{name} rejects `title`; the model passes it and the run retries"
        )


def test_showSources_accepts_a_title(tools):
    schema = tools["showSources"].function_schema
    schema.validator.validate_python(
        {"sources": [{"title": "IMD", "url": "https://mausam.imd.gov.in"}], "title": "Sources"}
    )
