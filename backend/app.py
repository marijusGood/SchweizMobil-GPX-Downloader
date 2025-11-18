from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
import gpxpy.gpx
import requests
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:3000",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "https://marijusgudiskis.com",
        "http://marijusgudiskis.com",
        "https://gpx.marijusgudiskis.com",
        "http://gpx.marijusgudiskis.com",
        "https://gpx-backend.marijusgudiskis.com",
        "http://gpx-backend.marijusgudiskis.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HIKING_ROUTE = {
    "WanderlandRoutenNational", "WanderlandRoutenRegional", "WanderlandRoutenLokal"
}

CYCLING_ROUTE = {
    "VelolandRoutenNational", "VelolandRoutenRegional", "VelolandRoutenLokal"
}

PART_MAPPING = {
    "hiking": "hike",
    "cycling": "cycle"
}

def lv03_to_wgs84(y, x, z):
    y_aux = (y - 600000) / 1000000
    x_aux = (x - 200000) / 1000000
    lng = (
        (
            2.6779094
            + 4.728982 * y_aux
            + 0.791484 * y_aux * x_aux
            + 0.1306 * y_aux * x_aux ** 2
            - 0.0436 * y_aux ** 3
        )
        * 100 / 36
    )
    lat = (
        (
            16.9023892
            + 3.238272 * x_aux
            - 0.270978 * y_aux ** 2
            - 0.002528 * x_aux ** 2
            - 0.0447 * y_aux ** 2 * x_aux
            - 0.0140 * x_aux ** 3
        )
        * 100 / 36
    )
    return lat, lng, z


def schweizmobil_url(route_type, route_nr):
    qs = f"{route_type}={route_nr}"
    return f"https://map.schweizmobil.ch/api/4/query/featuresmultilayers?{qs}"


def segment_url(route_type, route_nr, segment_nr):
    route_type = get_part_type(route_type)
    return f"https://schweizmobil.ch/api/4/route_or_segment/{route_type}/{route_nr}/{segment_nr}.json"


def get_route_param(param):
    if param == "hiking":
        return HIKING_ROUTE
    if param == "cycling":
        return CYCLING_ROUTE
    return None


def get_part_type(type):
    return PART_MAPPING.get(type)


def fetch_schweizmobil_points(route_nr, param):
    route_list = get_route_param(param)
    if not route_list:
        return None

    for route_type in route_list:
        try:
            r = requests.get(schweizmobil_url(route_type, route_nr), timeout=10)
            feature = r.json()
            if "features" in feature and feature["features"]:
                return feature["features"][0]["geometry"]["coordinates"][0]
        except Exception:
            continue

    return None


def fetch_schweizmobil_points_part(route_type, route_nr, segment_nr):
    try:
        r = requests.get(segment_url(route_type, route_nr, segment_nr), timeout=10)
        feature = r.json()
        return feature["coordinates"][0]
    except Exception:
        return None


def gpx_from_points(wgs84_points):
    segment = gpxpy.gpx.GPXTrackSegment()
    for (lat, lon, z) in wgs84_points:
        segment.points.append(gpxpy.gpx.GPXTrackPoint(lat, lon, z))

    track = gpxpy.gpx.GPXTrack()
    track.segments.append(segment)

    gpx = gpxpy.gpx.GPX()
    gpx.tracks.append(track)
    return gpx


def convert_to_xml(lv03_points):
    if not lv03_points:
        return None
    wgs84_points = [lv03_to_wgs84(y, x, z) for (y, x, z) in lv03_points]
    gpx = gpx_from_points(wgs84_points)
    return gpx.to_xml().encode("utf-8")

# --------------------------------------------------------------------
#                     FASTAPI ENDPOINTS
# --------------------------------------------------------------------

@app.get("/route/{param}/{route_nr}", response_class=Response)
def get_full_route(param: str, route_nr: int):
    """Return full route GPX as XML."""
    lv03_points = fetch_schweizmobil_points(route_nr, param)
    xml = convert_to_xml(lv03_points)

    if xml is None:
        raise HTTPException(
            status_code=404,
            detail="Route not found or SchweizMobil returned no coordinates"
        )

    return Response(content=xml, media_type="application/xml")


@app.get("/route/{param}/{route_nr}/part/{segment_nr}", response_class=Response)
def get_route_part(param: str, route_nr: int, segment_nr: int):
    """Return specific route segment GPX as XML."""
    lv03_points = fetch_schweizmobil_points_part(param, route_nr, segment_nr)
    xml = convert_to_xml(lv03_points)

    if xml is None:
        raise HTTPException(
            status_code=404,
            detail="Segment not found or SchweizMobil returned no coordinates"
        )

    return Response(content=xml, media_type="application/xml")
