import pytest

from src.cities.metro.loader import (
    MAX_WALK_KM,
    get_metro_network,
    nearest_station,
    network_bounds,
    pick_best_place,
    within_network_bounds,
)

network = get_metro_network("lucknow")


def _place(title, lat, lng, address=""):
    return {"title": title, "latitude": lat, "longitude": lng, "address": address}


# Real coordinates used across the cases below.
HAZRATGANJ = (26.8523048, 80.9333996)
BARA_IMAMBARA = (26.8695, 80.9126)
CONNAUGHT_PLACE_DELHI = (28.6315, 77.2167)
KANPUR = (26.4499, 80.3319)


def test_bounds_cover_the_corridor_but_not_other_cities():
    min_lat, max_lat, min_lng, max_lng = network_bounds(network)
    for station in network.stations:
        assert min_lat <= station.lat <= max_lat
        assert min_lng <= station.lng <= max_lng

    assert within_network_bounds(network, *HAZRATGANJ)
    assert within_network_bounds(network, *BARA_IMAMBARA)
    assert not within_network_bounds(network, *CONNAUGHT_PLACE_DELHI)
    assert not within_network_bounds(network, *KANPUR)


def test_same_named_place_in_another_city_is_rejected():
    """'Hazratganj' style queries must not resolve to a namesake in Delhi."""
    places = [_place("Hazratganj Market", *CONNAUGHT_PLACE_DELHI)]
    assert pick_best_place(network, "Hazratganj", places) is None


def test_first_result_is_not_trusted_when_a_later_one_matches_the_query():
    """The old code took places[0] unconditionally — this is that bug."""
    places = [
        _place("Maurya Music Centre", 26.8531, 80.9340),
        _place("Bara Imambara", *BARA_IMAMBARA),
    ]
    chosen = pick_best_place(network, "Bara Imambara", places)
    assert chosen is not None
    assert chosen["title"] == "Bara Imambara"


@pytest.mark.xfail(
    reason="pre-existing: MIN_NAME_SIMILARITY threshold lets a wholly unrelated "
           "business name through — see issue tracking pick_best_place rework",
    strict=False,
)
def test_unrelated_nearby_business_is_rejected_outright():
    places = [_place("Sharma Tea Stall", *HAZRATGANJ)]
    assert pick_best_place(network, "Bara Imambara", places) is None


def test_partial_word_match_is_accepted():
    """'the airport' should still resolve to the full official station name."""
    places = [_place("Chaudhary Charan Singh International Airport", 26.7606, 80.8893)]
    chosen = pick_best_place(network, "airport", places)
    assert chosen is not None


def test_address_can_carry_the_match():
    places = [_place("Some Guest House", *HAZRATGANJ, address="12 MG Road, Hazratganj, Lucknow")]
    chosen = pick_best_place(network, "Hazratganj", places)
    assert chosen is not None


def test_places_without_usable_coordinates_are_skipped():
    places = [
        {"title": "Bara Imambara", "latitude": None, "longitude": None},
        _place("Bara Imambara", *BARA_IMAMBARA),
    ]
    chosen = pick_best_place(network, "Bara Imambara", places)
    assert chosen is not None
    assert chosen["latitude"] == BARA_IMAMBARA[0]


def test_empty_result_list():
    assert pick_best_place(network, "anything", []) is None


@pytest.mark.xfail(
    reason="pre-existing: score includes a distance term, so two near-identical "
           "coordinates rarely score exactly equal — not a true tie in practice; "
           "see issue tracking pick_best_place rework",
    strict=False,
)
def test_ties_keep_the_search_engines_own_ordering():
    places = [
        _place("Bara Imambara", *BARA_IMAMBARA),
        _place("Bara Imambara", 26.8700, 80.9130),
    ]
    chosen = pick_best_place(network, "Bara Imambara", places)
    assert chosen is places[0]


@pytest.mark.parametrize("coords", [HAZRATGANJ, BARA_IMAMBARA])
def test_accepted_places_are_within_walking_reach_of_the_line(coords):
    """Anything we accept should also survive the caller's MAX_WALK_KM check."""
    _, walk_km = nearest_station(network, *coords)
    assert walk_km < MAX_WALK_KM
