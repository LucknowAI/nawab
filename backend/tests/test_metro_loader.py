import pytest

from src.cities.metro.loader import (
    MAX_WALK_KM,
    fare_for_stops,
    find_station_by_name,
    get_metro_network,
    nearest_station,
    route_distance_km,
    stops_between,
)

network = get_metro_network("lucknow")


def test_network_loads():
    assert network is not None
    assert len(network.stations) == 21


def test_unknown_city_returns_none():
    assert get_metro_network("does-not-exist") is None


def test_find_station_by_exact_name():
    station = find_station_by_name(network, "Hazratganj")
    assert station is not None
    assert station.id == "hazratganj"


def test_find_station_by_name_case_and_whitespace_insensitive():
    station = find_station_by_name(network, "  charbagh  ")
    assert station is not None
    assert station.id == "charbagh"


def test_find_station_by_name_no_match():
    assert find_station_by_name(network, "some random place in delhi") is None


@pytest.mark.parametrize(
    "text,expected_id",
    [
        # People routinely write two-word station names as one word.
        ("munshipulia", "munshi_pulia"),
        ("indiranagar", "indira_nagar"),
        ("bhootnathmarket", "bhootnath_market"),
        # ...and tack "metro station" on the end.
        ("munshipulia metro station", "munshi_pulia"),
        ("Hazratganj Metro Station", "hazratganj"),
        # Official portal station codes.
        ("MSPA", "munshi_pulia"),
        ("hznj", "hazratganj"),
    ],
)
def test_find_station_by_name_handles_real_world_spellings(text, expected_id):
    station = find_station_by_name(network, text)
    assert station is not None, f"{text!r} should match a station"
    assert station.id == expected_id


def test_exact_name_wins_over_longer_prefix_sibling():
    """'alambagh' must not be ambiguous just because 'Alambagh ISBT' exists."""
    station = find_station_by_name(network, "alambagh")
    assert station is not None
    assert station.id == "alambagh"
    assert find_station_by_name(network, "alambagh isbt").id == "alambagh_isbt"


def test_non_station_landmark_still_falls_through_to_geocoding():
    """Landmarks that aren't stations must return None so the caller geocodes."""
    assert find_station_by_name(network, "gomti nagar") is None
    assert find_station_by_name(network, "bara imambara") is None


def test_nearest_station_finds_closest():
    charbagh = next(s for s in network.stations if s.id == "charbagh")
    station, dist = nearest_station(network, charbagh.lat, charbagh.lng)
    assert station.id == "charbagh"
    assert dist == 0.0


def test_nearest_station_far_away_exceeds_walk_threshold():
    # Somewhere in Delhi, ~500km away — should resolve to *a* station but
    # the caller is expected to reject it via MAX_WALK_KM.
    _, dist = nearest_station(network, 28.6139, 77.2090)
    assert dist > MAX_WALK_KM


def test_route_distance_is_along_line_not_straight_line():
    airport = next(s for s in network.stations if s.id == "ccsa")
    charbagh = next(s for s in network.stations if s.id == "charbagh")
    hop_sum = route_distance_km(network, airport, charbagh)
    from src.cities.metro.loader import haversine

    straight = haversine(airport.lat, airport.lng, charbagh.lat, charbagh.lng)
    # Following the line through intermediate stations is >= as long as the
    # direct straight-line distance.
    assert hop_sum >= straight


def test_route_distance_symmetric():
    a = next(s for s in network.stations if s.id == "hazratganj")
    b = next(s for s in network.stations if s.id == "indira_nagar")
    assert route_distance_km(network, a, b) == route_distance_km(network, b, a)


def test_route_distance_same_station_is_zero():
    charbagh = next(s for s in network.stations if s.id == "charbagh")
    assert route_distance_km(network, charbagh, charbagh) == 0.0


@pytest.mark.parametrize(
    "stops,expected_fare",
    [(0, 0), (1, 10), (2, 15), (6, 20), (9, 30), (13, 40), (17, 50), (20, 60), (99, 60)],
)
def test_fare_for_stops(stops, expected_fare):
    assert fare_for_stops(network, stops) == expected_fare


def test_stops_between_is_symmetric():
    charbagh = next(s for s in network.stations if s.id == "charbagh")
    airport = next(s for s in network.stations if s.id == "ccsa")
    assert stops_between(charbagh, airport) == stops_between(airport, charbagh) == 9


def test_fallback_chart_matches_official_fares_for_every_stop_count():
    """Every trip length on the line must have a fare in the offline chart."""
    max_stops = len(network.stations) - 1
    for stops in range(1, max_stops + 1):
        assert stops in network.fare_by_stops_inr, f"no fallback fare for {stops} stops"
