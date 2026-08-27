"""Live fare/route lookup against UPMRC's official portal API.

The portal is the same backend that lucknow.upmetrorail.com's journey planner
uses, so its fare is the authoritative one — the distance slabs in lucknow.json
are only a fallback for when this call fails.
"""

import asyncio
import logging

import aiohttp

logger = logging.getLogger(__name__)

BASE_URL = "https://portal.upmetrorail.com/en/api/v2"

# The portal rejects requests that don't look like they came from the public
# journey planner, so mirror the browser's origin/referer.
_HEADERS = {
    "Accept": "*/*",
    "Content-Type": "application/json",
    "Origin": "https://lucknow.upmetrorail.com",
    "Referer": "https://lucknow.upmetrorail.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
}

# The portal's route path carries a travel date. The journey planner sends the
# epoch date for "no specific date", and fares are the same either way.
_ANY_DATE = "1970-01-01"

REQUEST_TIMEOUT_SECONDS = 8.0


def route_url(from_code: str, to_code: str, date: str = _ANY_DATE) -> str:
    """Official journey-planner route endpoint for a station-to-station trip."""
    return (
        f"{BASE_URL}/route/{from_code.upper()}/{to_code.upper()}"
        f"/station/station/least-distance/{date}/"
    )


async def fetch_route(
    from_code: str,
    to_code: str,
    *,
    date: str = _ANY_DATE,
    timeout: float = REQUEST_TIMEOUT_SECONDS,
) -> dict | None:
    """Fetch the official fare and route for a trip between two station codes.

    Returns a normalized dict, or None if the portal is unreachable or returns
    something unusable — callers are expected to fall back to local estimates.
    """
    url = route_url(from_code, to_code, date)
    try:
        client_timeout = aiohttp.ClientTimeout(total=timeout)
        async with aiohttp.ClientSession(timeout=client_timeout) as session:
            async with session.get(url, headers=_HEADERS) as response:
                response.raise_for_status()
                # The portal serves JSON under a text/plain content type on
                # some edges, so don't let aiohttp's content-type check reject it.
                payload = await response.json(content_type=None)
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as exc:
        logger.warning("UPMRC route lookup failed for %s->%s: %s", from_code, to_code, exc)
        return None

    fare = payload.get("fare")
    if not isinstance(fare, (int, float)):
        logger.warning("UPMRC route response for %s->%s had no fare", from_code, to_code)
        return None

    return {
        "fare_inr": int(fare),
        "num_stations": payload.get("stations"),
        "from_station": payload.get("from"),
        "to_station": payload.get("to"),
        "travel_time": payload.get("total_time"),
        "from_station_status": (payload.get("from_station_status") or {}).get("status"),
        "to_station_status": (payload.get("to_station_status") or {}).get("status"),
        "lines": [leg.get("line") for leg in payload.get("route") or [] if leg.get("line")],
        "path": [
            stop.get("name")
            for leg in payload.get("route") or []
            for stop in leg.get("path") or []
            if stop.get("name")
        ],
        "message": payload.get("message") or "",
        "source": "upmrc_official_api",
    }
