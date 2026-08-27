"""UI display tools. Step 2 of the agent's two-step answer protocol.

The frontend renders these; the backend only acknowledges them. They must
still be registered so pydantic-ai can pair each ToolCallPart with a
ToolReturnPart in the message history, otherwise the next run fails with
"unprocessed tool calls".

Each stub is written out rather than generated from a spec: pydantic-ai builds
the tool schema from the signature, and the argument names are the contract the
frontend cards read.
"""


def _ack(items, noun) -> str:
    return f"Displayed {len(items)} {noun}(s) to the user."


def register(agent):
    """Attach the display tools shared by every city."""

    @agent.tool_plain
    async def showPlaces(places: list, title: str | None = None) -> str:
        """Display tourist spots, historical sites, restaurants, or any list of places as visual cards in the UI."""
        return _ack(places, "place")

    @agent.tool_plain
    async def showNews(articles: list, title: str | None = None) -> str:
        """Display a visual news digest with articles as cards in the UI."""
        return _ack(articles, "article")

    @agent.tool_plain
    async def showVideos(videos: list, title: str | None = None) -> str:
        """Display YouTube video results as playable cards in the UI."""
        return _ack(videos, "video")

    @agent.tool_plain
    async def showMapResults(places: list, title: str | None = None) -> str:
        """Display local business or place results from a Maps search as cards in the UI."""
        return _ack(places, "map result")

    @agent.tool_plain
    async def showImages(images: list, title: str | None = None) -> str:
        """Display a visual gallery of images in the UI."""
        return _ack(images, "image")

    @agent.tool_plain
    async def showSources(sources: list, title: str | None = None) -> str:
        """Display source URLs referenced in the response at the bottom of the UI."""
        return _ack(sources, "source")

    @agent.tool_plain
    async def showFact(title: str, content: str, category: str | None = None) -> str:
        """Display a beautifully formatted cultural, historical, or culinary highlight card in the UI."""
        return f"Displayed fact '{title}' to the user."
