"""City handler — what the frontend's city selector reads."""

from src.cities.registry import list_cities


async def list_supported_cities() -> list:
    """Return every registered city as {id, name, display_name}."""
    return [
        {"id": city.id, "name": city.name, "display_name": city.display_name}
        for city in list_cities()
    ]


if __name__ == "__main__":
    import asyncio

    async def _demo():
        cities = await list_supported_cities()
        assert cities and all({"id", "name", "display_name"} <= c.keys() for c in cities)
        assert any(c["id"] == "lucknow" for c in cities)
        print(f"ok — {len(cities)} cities: {', '.join(c['id'] for c in cities)}")

    asyncio.run(_demo())
