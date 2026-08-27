"""Serper-backed search tools. Step 1 of the agent's two-step answer protocol."""

import uuid

from pydantic_ai import RunContext

from src.tools.serper import APIHandler

_serper = APIHandler()


def register(agent, city):
    """Attach the five search tools, scoped to `city`'s location and coordinates."""

    @agent.tool
    async def google_search(ctx: RunContext, query: str) -> dict:
        """Search the web using Google (via Serper) and return organic results.

        Args:
            query: The search query string.
        """
        return await _serper.search_api(query)

    @agent.tool
    async def google_news(ctx: RunContext, keywords: list[str]) -> dict:
        """Search Google News via Serper for recent news articles.

        Args:
            keywords: List of keywords to search for (e.g. ["latest", "technology"]).
        """
        return await _serper.news_api(keywords, location=city.location_string)

    @agent.tool
    async def google_maps(ctx: RunContext, keywords: list[str]) -> dict:
        """Search Google Maps via Serper for local places or businesses.

        Args:
            keywords: List of keywords describing the place (e.g. ["hospitals"]).
        """
        return await _serper.maps_api(keywords, coordinates=city.coordinates)

    @agent.tool
    async def google_videos(ctx: RunContext, keywords: list[str]) -> dict:
        """Search Google Videos via Serper for relevant video content.

        Args:
            keywords: List of keywords to search for.
        """
        return await _serper.video_api(keywords, location=city.location_string)

    @agent.tool
    async def google_images(ctx: RunContext, keywords: list[str]) -> dict:
        """Search Google Images via Serper for pictures of places, food, events, or landmarks.

        Each result gets a short `id`. Pass that `id` back verbatim when calling
        showImages — never copy the imageUrl/thumbnailUrl by hand, the backend
        resolves the id to the real URL for you.

        Args:
            keywords: List of keywords (e.g. ["Imambara", "Lucknow"]).
        """
        result = await _serper.images_api(keywords, location=city.location_string)
        images = ((result or {}).get("data") or {}).get("images")
        if isinstance(images, list):
            for img in images:
                if isinstance(img, dict):
                    img["id"] = uuid.uuid4().hex[:8]
        return result
