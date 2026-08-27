"""Static metro network data — station lookup and fare calculation."""

import difflib
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

_DATA_DIR = Path(__file__).parent

# Beyond this walking distance, a "nearest station" match is no longer a
# reasonable trip suggestion — the point is likely outside the metro's
# service area entirely.
MAX_WALK_KM = 5.0

# How far beyond the station corridor a geocoded place may sit and still be
# plausibly "in this city". ~0.35 degrees is roughly 35-40 km here, which
# comfortably covers Lucknow's outskirts while still excluding other cities.
CITY_BOUNDS_MARGIN_DEG = 0.35

# A geocoded place whose name looks nothing like what the user asked for is
# probably the search engine reaching for a loosely related business.
MIN_NAME_SIMILARITY = 0.34


@dataclass
class Station:
    id: str
    name: str
    order: int
    lat: float
    lng: float
    # Station code used by UPMRC's official portal API, e.g. "HZNJ".
    st_code: str = ""


@dataclass
class MetroNetwork:
    city_id: str
    network_name: str
    line: str
    stations: list[Station]
    # Number of stops travelled -> fare in INR.
    fare_by_stops_inr: dict[int, int]


_network_cache: dict[str, MetroNetwork | None] = {}


def _load_network(city_id: str) -> MetroNetwork | None:
    path = _DATA_DIR / f"{city_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    stations = [Station(**s) for s in data["stations"]]
    return MetroNetwork(
        city_id=data["city_id"],
        network_name=data["network_name"],
        line=data["line"],
        stations=stations,
        fare_by_stops_inr={int(k): v for k, v in data["fare_by_stops_inr"].items()},
    )


def get_metro_network(city_id: str) -> MetroNetwork | None:
    """Return the cached MetroNetwork for a city, or None if it has no metro data."""
    if city_id not in _network_cache:
        _network_cache[city_id] = _load_network(city_id)
    return _network_cache[city_id]


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points in km."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearest_station(network: MetroNetwork, lat: float, lng: float) -> tuple[Station, float]:
    """Return the (station, walk_distance_km) closest to the given coordinates."""
    closest = min(network.stations, key=lambda s: haversine(lat, lng, s.lat, s.lng))
    dist = haversine(lat, lng, closest.lat, closest.lng)
    return closest, round(dist, 2)


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _squash(text: str) -> str:
    """Normalize and drop spacing entirely, so that station names people write
    as one word ('munshipulia') still match the official two-word spelling."""
    return _normalize(text).replace(" ", "")


def find_station_by_name(network: MetroNetwork, text: str) -> Station | None:
    """Match free text against known station names/ids, e.g. 'hazratganj' or
    'charbagh station'. Returns None if nothing matches well enough."""
    needle = _normalize(text)
    if not needle:
        return None
    squashed = _squash(text)

    for station in network.stations:
        if (
            _normalize(station.name) == needle
            or _normalize(station.id) == needle
            or (station.st_code and _normalize(station.st_code) == needle)
            or _squash(station.name) == squashed
            or _squash(station.id) == squashed
        ):
            return station

    # Strip the words people tack on to a station name before falling back to
    # substring matching, so "munshipulia metro station" still resolves.
    squashed = re.sub(r"(metro|railway|station|stop)", "", squashed)

    candidates = [
        station
        for station in network.stations
        if needle in _normalize(station.name)
        or _normalize(station.name) in needle
        or (squashed and (squashed in _squash(station.name) or _squash(station.name) in squashed))
    ]
    if len(set(s.id for s in candidates)) == 1:
        return candidates[0]
    return None


def route_distance_km(network: MetroNetwork, a: Station, b: Station) -> float:
    """Ride distance along the line between two stations, i.e. the sum of
    consecutive station-to-station hops rather than a straight line between
    the endpoints — a much closer approximation of actual track distance."""
    ordered = sorted(network.stations, key=lambda s: s.order)
    lo, hi = sorted((a.order, b.order))
    hops = [s for s in ordered if lo <= s.order <= hi]
    return round(
        sum(haversine(x.lat, x.lng, y.lat, y.lng) for x, y in zip(hops, hops[1:])),
        2,
    )


def network_bounds(
    network: MetroNetwork, margin_deg: float = CITY_BOUNDS_MARGIN_DEG
) -> tuple[float, float, float, float]:
    """Lat/lng box around the station corridor, widened by a margin, as
    (min_lat, max_lat, min_lng, max_lng). Used to throw out geocoding results
    that landed in an entirely different city."""
    lats = [s.lat for s in network.stations]
    lngs = [s.lng for s in network.stations]
    return (
        min(lats) - margin_deg,
        max(lats) + margin_deg,
        min(lngs) - margin_deg,
        max(lngs) + margin_deg,
    )


def within_network_bounds(network: MetroNetwork, lat: float, lng: float) -> bool:
    min_lat, max_lat, min_lng, max_lng = network_bounds(network)
    return min_lat <= lat <= max_lat and min_lng <= lng <= max_lng


def _name_similarity(query: str, name: str) -> float:
    """How much a place's name looks like what the user asked for, in 0..1.

    Blends whole-string similarity with token overlap, so that both "airport"
    vs "Chaudhary Charan Singh International Airport" (few shared characters,
    one shared word) and mild misspellings score reasonably.
    """
    q, n = _normalize(query), _normalize(name)
    if not q or not n:
        return 0.0
    ratio = difflib.SequenceMatcher(None, q, n).ratio()

    q_tokens, n_tokens = set(q.split()), set(n.split())
    overlap = len(q_tokens & n_tokens) / len(q_tokens) if q_tokens else 0.0
    # A query fully contained in the name is a strong signal on its own.
    if q in n or n in q:
        overlap = max(overlap, 0.9)

    return max(ratio, overlap)


def pick_best_place(network: MetroNetwork, query: str, places: list[dict]) -> dict | None:
    """Choose which geocoding result to trust for a free-text location.

    The search API's first result is only a suggestion — it can be a loosely
    related business, or a same-named place in another city. Anything outside
    the city box or bearing no resemblance to the query is discarded, and of
    what remains the best name match wins, with distance to the metro corridor
    as the tie-breaker.
    """
    scored: list[tuple[float, int, dict]] = []

    for index, place in enumerate(places):
        lat, lng = place.get("latitude"), place.get("longitude")
        if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
            continue
        if not within_network_bounds(network, lat, lng):
            continue

        label = place.get("title") or place.get("name") or ""
        address = place.get("address") or ""
        similarity = max(_name_similarity(query, label), _name_similarity(query, address))
        if similarity < MIN_NAME_SIMILARITY:
            continue

        _, walk_km = nearest_station(network, lat, lng)
        # Distance only nudges the ranking; a clearly better name still wins.
        score = similarity - min(walk_km / MAX_WALK_KM, 1.0) * 0.15
        scored.append((score, index, place))

    if not scored:
        return None

    # Sort by score, falling back to the search engine's own ordering on ties.
    scored.sort(key=lambda item: (-item[0], item[1]))
    return scored[0][2]


def stops_between(a: Station, b: Station) -> int:
    """Number of stops travelled between two stations on the line."""
    return abs(a.order - b.order)


def fare_for_stops(network: MetroNetwork, stops: int) -> int:
    """Offline fare lookup by stop count, for when the official UPMRC fare API
    is unreachable. UPMRC prices this network purely by number of stops — the
    distance bands for adjacent fares overlap, so km cannot be used here."""
    if stops <= 0:
        return 0
    table = network.fare_by_stops_inr
    if stops in table:
        return table[stops]
    # Longer than any known trip: charge the maximum on the chart.
    return table[max(table)]
