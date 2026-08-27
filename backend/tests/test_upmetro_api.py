import asyncio

import pytest

from src.cities.metro.loader import get_metro_network
from src.cities.metro.upmetro_api import fetch_route, route_url

network = get_metro_network("lucknow")


def test_every_station_has_an_official_code():
    codes = [s.st_code for s in network.stations]
    assert all(codes), "every station needs an st_code for the official fare lookup"
    assert len(set(codes)) == len(codes), "station codes must be unique"


def test_route_url_shape():
    assert route_url("mspa", "idnm") == (
        "https://portal.upmetrorail.com/en/api/v2/route/MSPA/IDNM"
        "/station/station/least-distance/1970-01-01/"
    )


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def raise_for_status(self):
        return None

    async def json(self, content_type=None):
        return self._payload


class _FakeSession:
    def __init__(self, payload):
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def get(self, url, headers=None):
        return _FakeResponse(self._payload)


def test_fetch_route_normalizes_portal_payload(monkeypatch):
    payload = {
        "stations": 2,
        "from": "MUNSHIPULIA",
        "to": "INDIRA NAGAR",
        "from_station_status": {"status": "Station Open"},
        "to_station_status": {"status": "Station Open"},
        "total_time": "0:02:00",
        "fare": 10,
        "route": [
            {
                "line": "LN2",
                "path": [{"name": "MUNSHIPULIA"}, {"name": "INDIRA NAGAR"}],
            }
        ],
        "message": "",
    }
    monkeypatch.setattr(
        "src.cities.metro.upmetro_api.aiohttp.ClientSession",
        lambda *a, **kw: _FakeSession(payload),
    )

    result = asyncio.run(fetch_route("MSPA", "IDNM"))
    assert result["fare_inr"] == 10
    assert result["num_stations"] == 2
    assert result["lines"] == ["LN2"]
    assert result["path"] == ["MUNSHIPULIA", "INDIRA NAGAR"]
    assert result["from_station_status"] == "Station Open"
    assert result["source"] == "upmrc_official_api"


def test_fetch_route_returns_none_when_fare_missing(monkeypatch):
    monkeypatch.setattr(
        "src.cities.metro.upmetro_api.aiohttp.ClientSession",
        lambda *a, **kw: _FakeSession({"message": "No route found"}),
    )
    assert asyncio.run(fetch_route("MSPA", "IDNM")) is None


def test_fetch_route_returns_none_on_transport_error(monkeypatch):
    import aiohttp

    class _BoomSession(_FakeSession):
        def get(self, url, headers=None):
            raise aiohttp.ClientError("connection reset")

    monkeypatch.setattr(
        "src.cities.metro.upmetro_api.aiohttp.ClientSession",
        lambda *a, **kw: _BoomSession(None),
    )
    assert asyncio.run(fetch_route("MSPA", "IDNM")) is None


@pytest.mark.network
def test_live_fare_lookup():
    """Hits the real UPMRC portal. Deselected by default; run with `-m network`."""
    result = asyncio.run(fetch_route("MSPA", "IDNM"))
    assert result is not None
    assert result["fare_inr"] > 0


@pytest.mark.network
def test_offline_fare_chart_still_matches_the_official_api():
    """Sweeps all 210 station pairs against UPMRC and checks the offline
    fallback chart hasn't drifted from the official fares."""
    import itertools

    from src.cities.metro.loader import fare_for_stops, stops_between

    async def sweep():
        drift = []
        for a, b in itertools.combinations(network.stations, 2):
            official = await fetch_route(a.st_code, b.st_code)
            assert official is not None, f"portal rejected {a.st_code}->{b.st_code}"
            stops = stops_between(a, b)
            local = fare_for_stops(network, stops)
            if official["fare_inr"] != local:
                drift.append((a.st_code, b.st_code, official["fare_inr"], local))
            assert official["num_stations"] == stops + 1
            await asyncio.sleep(0.05)
        return drift

    drift = asyncio.run(sweep())
    assert not drift, f"offline fare chart has drifted: {drift}"
