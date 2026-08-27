"""Lucknow Metro tools — station resolution, routing and official fares."""

from pydantic_ai import RunContext

from src.cities.metro.loader import (
    MAX_WALK_KM,
    fare_for_stops,
    find_station_by_name,
    get_metro_network,
    nearest_station,
    pick_best_place,
    route_distance_km,
    stops_between,
)
from src.cities.metro.upmetro_api import fetch_route as fetch_official_route
from src.tools.serper import APIHandler

_serper = APIHandler()

NO_NETWORK = {"error": "Metro network data isn't available for this city."}


def register(agent, city):
    """Attach the metro tools. Only Lucknow has a network, so other cities skip."""
    if city.id != "lucknow":
        return

    network = get_metro_network("lucknow")

    async def resolve_station(text: str):
        """Match `text` against station names first (fast, no external call),
        then fall back to geocoding plus nearest-station."""
        if network is not None:
            station = find_station_by_name(network, text)
            if station is not None:
                return station, 0.0

        geo = await _serper.maps_api([text], coordinates=city.coordinates)
        places = ((geo or {}).get("data") or {}).get("places") or []
        if not places:
            return None, 0.0

        # Never trust the first hit blindly — it can be a loosely related
        # business or a same-named place in another city entirely.
        point = pick_best_place(network, text, places)
        if point is None:
            return None, 0.0

        return nearest_station(network, point["latitude"], point["longitude"])

    @agent.tool
    async def find_metro_route(ctx: RunContext, origin: str, destination: str) -> dict:
        """Find the nearest Lucknow Metro stations to a starting point and a
        destination, and compute the fare and walking distances for that trip.

        Args:
            origin: Free-text description of where the user is starting from (e.g. "Hazratganj").
            destination: Free-text description of where the user wants to go (e.g. "the airport").
        """
        if network is None:
            return NO_NETWORK

        origin_station, origin_walk_km = await resolve_station(origin)
        if origin_station is None:
            return {"error": f"Couldn't find a location for the origin {origin!r}."}

        dest_station, dest_walk_km = await resolve_station(destination)
        if dest_station is None:
            return {"error": f"Couldn't find a location for the destination {destination!r}."}

        if origin_walk_km > MAX_WALK_KM:
            return {"error": f"{origin!r} looks too far from any Lucknow Metro station to be a realistic start point."}
        if dest_walk_km > MAX_WALK_KM:
            return {"error": f"{destination!r} looks too far from any Lucknow Metro station to be a realistic destination."}

        if origin_station.id == dest_station.id:
            return {"same_station": True, "station_name": origin_station.name}

        ride_km = route_distance_km(network, origin_station, dest_station)
        num_stops = stops_between(origin_station, dest_station)

        # Prefer UPMRC's own fare; the local stops chart is only a fallback
        # for when the portal is unreachable.
        official = await fetch_official_route(origin_station.st_code, dest_station.st_code)
        fare = official["fare_inr"] if official else fare_for_stops(network, num_stops)

        result = {
            "origin_input": origin,
            "origin_station": {"name": origin_station.name, "lat": origin_station.lat, "lng": origin_station.lng},
            "origin_walk_km": origin_walk_km,
            "destination_input": destination,
            "destination_station": {"name": dest_station.name, "lat": dest_station.lat, "lng": dest_station.lng},
            "destination_walk_km": dest_walk_km,
            "distance_km": round(ride_km, 2),
            "fare_inr": fare,
            "fare_source": "official" if official else "estimated",
            "num_stops": num_stops,
        }

        if official is not None:
            result["travel_time"] = official["travel_time"]
            result["origin_station_status"] = official["from_station_status"]
            result["destination_station_status"] = official["to_station_status"]

        return result

    @agent.tool
    async def get_metro_fare(ctx: RunContext, from_station: str, to_station: str) -> dict:
        """Look up the exact, official Lucknow Metro fare between two named
        metro stations, straight from UPMRC's journey planner.

        Use this when the user names both metro stations directly (e.g.
        "fare from Munshi Pulia to Indira Nagar"). For trips described by
        landmark or address rather than station name, use find_metro_route
        instead — it resolves the nearest stations first.

        Args:
            from_station: Origin station name or code, e.g. "Munshi Pulia" or "MSPA".
            to_station: Destination station name or code, e.g. "Indira Nagar" or "IDNM".
        """
        if network is None:
            return NO_NETWORK

        origin_station = find_station_by_name(network, from_station)
        if origin_station is None:
            return {"error": f"{from_station!r} doesn't match any Lucknow Metro station."}

        dest_station = find_station_by_name(network, to_station)
        if dest_station is None:
            return {"error": f"{to_station!r} doesn't match any Lucknow Metro station."}

        if origin_station.id == dest_station.id:
            return {"same_station": True, "station_name": origin_station.name}

        official = await fetch_official_route(origin_station.st_code, dest_station.st_code)
        ride_km = route_distance_km(network, origin_station, dest_station)
        num_stops = stops_between(origin_station, dest_station)

        if official is None:
            return {
                "from_station": origin_station.name,
                "to_station": dest_station.name,
                "fare_inr": fare_for_stops(network, num_stops),
                "fare_source": "estimated",
                "distance_km": ride_km,
                "num_stops": num_stops,
                "note": "UPMRC's live fare service didn't respond, so this is a distance-based estimate.",
            }

        return {
            "from_station": official["from_station"] or origin_station.name,
            "to_station": official["to_station"] or dest_station.name,
            "fare_inr": official["fare_inr"],
            "fare_source": "official",
            "distance_km": ride_km,
            "num_stops": num_stops,
            "travel_time": official["travel_time"],
            "from_station_status": official["from_station_status"],
            "to_station_status": official["to_station_status"],
            "lines": official["lines"],
            "path": official["path"],
        }

    @agent.tool_plain
    async def showMetroRoute(
        origin_input: str, origin_station: dict, origin_walk_km: float,
        destination_input: str, destination_station: dict, destination_walk_km: float,
        distance_km: float, fare_inr: int, num_stops: int,
        fare_source: str = "official", travel_time: str | None = None,
        origin_station_status: str | None = None, destination_station_status: str | None = None,
    ) -> str:
        """Display an interactive metro route card: nearest station, fare, stops, and a route map."""
        return f"Displayed metro route to the user (fare ₹{fare_inr})."
