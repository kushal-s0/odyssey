"""Bounded public OSM context. Never takes applicant identity or arbitrary QL."""
import math
from datetime import datetime, timezone

import httpx

from ..config import Settings
from ..config import ROOT
from ..contracts.location import GeocodeCandidate, GeocodeResults, LocalBusiness, LocationInsights, LocationLookup

CATEGORIES: dict[str, list[tuple[str, str]]] = {
    'tea_stall': [('amenity', 'cafe'), ('shop', 'tea')],
    'tailoring': [('shop', 'tailor')],
    'food_service': [('amenity', 'restaurant'), ('amenity', 'fast_food')],
    'dairy': [('shop', 'dairy')],
    'poultry': [('shop', 'butcher')],
    'beauty_services': [('shop', 'beauty'), ('shop', 'hairdresser')],
    'mobile_repair': [('shop', 'mobile_phone'), ('craft', 'electronics_repair')],
    'agricultural_inputs': [('shop', 'agrarian')],
    'solar_services': [('craft', 'electrician')],
    'packaged_water': [('shop', 'water')],
    'bag_manufacturing': [('shop', 'bag')],
}


class OsmUnavailable(RuntimeError):
    pass


def snapshot(query: LocationLookup, trade: str) -> LocationInsights | None:
    import json
    path=ROOT/'data/osm/bengaluru-tea.json'
    if not path.is_file():
        return None
    try:
        payload=json.loads(path.read_text(encoding='utf-8'))
        result=LocationInsights.model_validate(payload['result'])
        if (payload['trade'] != trade or result.latitude is None or result.longitude is None or
                distance(query.latitude,query.longitude,result.latitude,result.longitude)+query.radius_m > payload['coverage_radius_m']):
            return None
        items=[item for item in result.items if distance(query.latitude,query.longitude,item.latitude,item.longitude)<=query.radius_m]
        items=[item.model_copy(update={'distance_m':distance(query.latitude,query.longitude,item.latitude,item.longitude)}) for item in items]
        return result.model_copy(update={'source':'OpenStreetMap dated snapshot','status':'ready' if items else 'empty',
            'area_label':query.area_label,'latitude':query.latitude,'longitude':query.longitude,'radius_m':query.radius_m,
            'cached':True,'items':sorted(items,key=lambda item:item.distance_m),
            'note':'Offline dated regional snapshot; not a fresh lookup. ' + result.note})
    except (ValueError,KeyError,TypeError):
        return None


def distance(lat: float, lon: float, target_lat: float, target_lon: float) -> int:
    a, b = math.radians(lat), math.radians(target_lat)
    hav = math.sin((b-a)/2)**2 + math.cos(a)*math.cos(b)*math.sin(math.radians(target_lon-lon)/2)**2
    return round(6371000 * 2 * math.asin(math.sqrt(min(1, hav))))


def nearby(settings: Settings, query: LocationLookup, trade: str) -> LocationInsights:
    categories = CATEGORIES.get(trade)
    if not categories:
        return LocationInsights(status='unsupported_trade', source='none')
    clauses = ''.join(f'nwr(around:{query.radius_m},{query.latitude:.5f},{query.longitude:.5f})["{key}"="{value}"];'
                      for key, value in categories)
    ql = '[out:json][timeout:10][maxsize:67108864];(' + clauses + ');out center 60;'
    try:
        with httpx.Client(timeout=httpx.Timeout(14, connect=4), follow_redirects=False) as client:
            with client.stream('GET', settings.osm_overpass_url, params={'data': ql},
                               headers={'User-Agent': settings.osm_user_agent}) as response:
                if response.status_code != 200:
                    # Keep provider diagnostics local to an explicit verification
                    # command; routes return a safe unavailable state instead.
                    fragment = next(response.iter_text(), '')[:1600]
                    import re
                    diagnostic = re.sub(r'<[^>]+>', ' ', fragment)
                    raise OsmUnavailable('http_' + str(response.status_code) + ': ' + ' '.join(diagnostic.split())[-800:])
                response.raise_for_status()
                content = bytearray()
                for chunk in response.iter_bytes():
                    content.extend(chunk)
                    if len(content) > 2_000_000:
                        raise OsmUnavailable()
        import json
        payload = json.loads(content)
        if payload.get('remark'):
            raise OsmUnavailable()
        items = []
        for element in payload.get('elements', [])[:60]:
            tags = element.get('tags', {})
            center = element.get('center', element)
            if 'lat' not in center or 'lon' not in center or element.get('type') not in {'node','way','relation'}:
                continue
            lat, lon = float(center['lat']), float(center['lon'])
            if not math.isfinite(lat) or not math.isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
                continue
            metres = distance(query.latitude, query.longitude, lat, lon)
            if metres > query.radius_m:
                continue
            category = next((v for k, v in categories if tags.get(k) == v), None)
            if not category:
                continue
            identifier = int(element['id'])
            kind = element['type']
            items.append(LocalBusiness(osm_type=kind, osm_id=identifier,
                name=str(tags.get('name:en') or tags.get('name') or 'Unnamed ' + category.replace('_',' '))[:200],
                category=category, latitude=lat, longitude=lon, distance_m=metres,
                url=f'https://www.openstreetmap.org/{kind}/{identifier}'))
        items.sort(key=lambda item: (item.distance_m, item.osm_id))
        return LocationInsights(status='ready' if items else 'empty', source='OpenStreetMap Overpass',
            retrieved_at=datetime.now(timezone.utc), area_label=query.area_label, latitude=query.latitude,
            longitude=query.longitude, radius_m=query.radius_m, category=trade, items=items[:30])
    except httpx.HTTPStatusError as error:
        raise OsmUnavailable('http_' + str(error.response.status_code)) from None
    except (httpx.HTTPError, ValueError, KeyError, TypeError, OverflowError) as error:
        raise OsmUnavailable(type(error).__name__) from None


def geocode(settings: Settings, area: str) -> GeocodeResults:
    try:
        with httpx.Client(timeout=httpx.Timeout(8, connect=3), follow_redirects=False) as client:
            response = client.get(settings.osm_nominatim_url, headers={'User-Agent': settings.osm_user_agent},
                params={'q': area, 'format': 'jsonv2', 'limit': 5, 'countrycodes': 'in', 'addressdetails': 0})
            response.raise_for_status()
        if len(response.content) > 100_000:
            raise OsmUnavailable()
        candidates = [GeocodeCandidate(label=str(item['display_name'])[:300], latitude=float(item['lat']), longitude=float(item['lon']))
                      for item in response.json()[:5]]
        return GeocodeResults(candidates=candidates)
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise OsmUnavailable() from None
