from uuid import uuid4

from app.auth.access import ActorView, require_actor
from app.contracts.location import LocationInsights
from product_helpers import save_assessment
from test_submissions import workspace


def test_confirmed_location_cache_scope_and_shared_throttle(database, tmp_path, monkeypatch):
    calls = []
    def nearby(settings, payload, trade):
        calls.append(payload)
        return LocationInsights(status='empty', source='OpenStreetMap Overpass',
            latitude=payload.latitude, longitude=payload.longitude, radius_m=payload.radius_m, area_label=payload.area_label)
    monkeypatch.setattr('app.routes.location_insights.nearby', nearby)
    with database.transaction() as c:
        c.execute("DELETE FROM public.shared_limits WHERE key='osm:overpass:global'")
    with workspace(database, tmp_path) as (client, data, app):
        value = save_assessment(database, data['submissions'][0], data['revisions'][0])
        path = f'/v1/submissions/{value.submission_id}'
        assert client.get(path + '/location-insights').json()['status'] == 'not_requested'
        assert client.get(path + '/location-settings').json()['geocoding_enabled'] is False
        assert client.post(path + '/geocode', json={'expected_revision_id': str(value.input_revision_id)}).status_code == 409
        body = {'expected_revision_id': str(value.input_revision_id), 'latitude': 12.97167,
                'longitude': 77.59467, 'area_label': 'Confirmed coarse business area', 'confirmed': True}
        first = client.post(path + '/location-insights', json=body)
        assert first.status_code == 200, first.text
        assert first.json()['status'] == 'empty' and 'no competition' in first.json()['note']
        assert client.post(path + '/location-insights', json=body).json()['cached'] is True
        assert len(calls) == 1 and calls[0].latitude == 12.972
        body['radius_m'] = 2000
        assert client.post(path + '/location-insights', json=body).status_code == 429
        body['expected_revision_id'] = str(uuid4())
        assert client.post(path + '/location-insights', json=body).status_code == 409
        app.dependency_overrides[require_actor] = lambda: ActorView(id=data['people'][1], role='applicant', cohorts=[])
        assert client.get(path + '/location-insights').status_code == 404
        assert client.post(path + '/location-insights', json=body).status_code == 404


def test_osm_query_is_bounded_and_provider_names_are_not_html(monkeypatch):
    from contextlib import contextmanager
    import httpx
    from app.config import Settings
    from app.contracts.location import LocationLookup
    from app.providers.osm import nearby
    seen = []
    @contextmanager
    def stream(self, method, url, **kwargs):
        seen.append(kwargs)
        yield httpx.Response(200, request=httpx.Request('POST', url), json={'elements': [
            {'type': 'node', 'id': 123, 'lat': 12.972, 'lon': 77.595,
             'tags': {'name': '<script>untrusted</script>', 'amenity': 'cafe'}},
            {'type': 'node', 'id': 124, 'lat': 12.9, 'lon': 77.5, 'tags': {'amenity': 'cafe'}}]})
    monkeypatch.setattr(httpx.Client, 'stream', stream)
    query = LocationLookup(expected_revision_id=uuid4(), latitude=12.972, longitude=77.595,
        area_label='PRIVATE LABEL NOT SENT', confirmed=True)
    result = nearby(Settings(_env_file=None), query, 'tea_stall')
    assert len(result.items) == 1 and result.items[0].osm_id == 123
    assert result.items[0].url == 'https://www.openstreetmap.org/node/123'
    ql = seen[0]['params']['data']
    assert 'PRIVATE LABEL' not in ql and '[timeout:10]' in ql and 'out center 60' in ql


def test_real_dated_snapshot_is_geofenced_and_cannot_be_substituted_for_another_area():
    from app.contracts.location import LocationLookup
    from app.providers.osm import snapshot
    query=LocationLookup(expected_revision_id=uuid4(),latitude=12.972,longitude=77.595,
        area_label='Confirmed coarse area',radius_m=1000,confirmed=True)
    result=snapshot(query,'tea_stall')
    assert result is not None and result.source == 'OpenStreetMap dated snapshot'
    assert result.retrieved_at is not None and 'Offline dated' in result.note
    assert all(item.distance_m <= 1000 for item in result.items)
    query.latitude=28.61
    assert snapshot(query,'tea_stall') is None
    query.latitude=12.972
    assert snapshot(query,'tailoring') is None
