import hashlib
import json
import re
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from psycopg.types.json import Jsonb

from ..auth.access import ActorDep, DatabaseDep, submission_access
from ..contracts.location import (GeocodeRequest, GeocodeResults, LocationInsights, LocationLookup, LocationSettings)
from ..contracts.models import Location
from ..providers.osm import CATEGORIES, OsmUnavailable, geocode, nearby, snapshot
from ..services.limits import take_limit
from .assessments import assessment

router = APIRouter(tags=['location context'])


@router.get('/v1/submissions/{submission_id}/location-settings', response_model=LocationSettings)
def location_settings(submission_id: UUID, request: Request, actor: ActorDep, database: DatabaseDep) -> LocationSettings:
    submission = submission_access(database, actor, submission_id)
    with database.transaction(actor.id, read_scoped=True) as c:
        row = c.execute('SELECT declared_location FROM public.submission_versions WHERE id=%s', (submission['current_revision_id'],)).fetchone()
    value = assessment(submission_id, actor, database)
    return LocationSettings(revision_id=submission['current_revision_id'],
        declared_location=Location.model_validate(row['declared_location']) if row and row['declared_location'] else None,
        geocoding_enabled=request.app.state.settings.enable_public_nominatim,
        supported_trade=value.business.trade.value in CATEGORIES)


@router.get('/v1/submissions/{submission_id}/location-insights', response_model=LocationInsights)
def location_insights(submission_id: UUID, actor: ActorDep, database: DatabaseDep) -> LocationInsights:
    submission = submission_access(database, actor, submission_id)
    with database.transaction(actor.id, read_scoped=True) as c:
        row = c.execute('''SELECT result FROM public.location_queries WHERE submission_id=%s AND input_revision_id=%s
            AND source='overpass' AND expires_at>now() ORDER BY retrieved_at DESC LIMIT 1''',
            (submission_id, submission['current_revision_id'])).fetchone()
    return LocationInsights.model_validate(row['result']).model_copy(update={'cached': True}) if row else LocationInsights(status='not_requested', source='none')


@router.post('/v1/submissions/{submission_id}/location-insights', response_model=LocationInsights)
def lookup(submission_id: UUID, payload: LocationLookup, request: Request, actor: ActorDep, database: DatabaseDep) -> LocationInsights:
    submission = submission_access(database, actor, submission_id)
    if submission['current_revision_id'] != payload.expected_revision_id:
        raise HTTPException(409, 'A newer idea revision is available. Refresh before looking up its area.')
    value = assessment(submission_id, actor, database)
    settings = request.app.state.settings
    # Label is retained privately. Only rounded confirmed area coordinates and a
    # server-chosen trade category are sent to Overpass, never the label/source.
    payload.latitude = round(payload.latitude, 3)
    payload.longitude = round(payload.longitude, 3)
    key = hashlib.sha256(json.dumps([payload.latitude, payload.longitude, payload.radius_m,
                                    value.business.trade.value, settings.osm_overpass_url]).encode()).hexdigest()
    with database.transaction(actor.id, read_scoped=True) as c:
        cached = c.execute('''SELECT result FROM public.location_queries WHERE submission_id=%s
            AND input_revision_id=%s AND cache_key=%s AND source='overpass' AND expires_at>now()
            ORDER BY retrieved_at DESC LIMIT 1''', (submission_id, payload.expected_revision_id, key)).fetchone()
    if cached:
        return LocationInsights.model_validate(cached['result']).model_copy(update={'cached': True})
    if value.business.trade.value not in CATEGORIES:
        return LocationInsights(status='unsupported_trade', source='none')
    take_limit(database, 'osm:overpass:global', 1, 10)
    take_limit(database, 'osm:overpass:user:' + str(actor.id), 6, 3600)
    try:
        result = nearby(settings, payload, value.business.trade.value)
    except OsmUnavailable:
        saved_snapshot = snapshot(payload,value.business.trade.value)
        if saved_snapshot is None:
            return LocationInsights(status='unavailable', source='none', area_label=payload.area_label,
                                    latitude=payload.latitude, longitude=payload.longitude, radius_m=payload.radius_m)
        result = saved_snapshot
    with database.transaction() as c:
        c.execute('''INSERT INTO public.location_queries(submission_id,input_revision_id,cache_key,source,query_area,result,expires_at)
            VALUES(%s,%s,%s,'overpass',%s,%s,now()+make_interval(hours=>%s))''',
            (submission_id, payload.expected_revision_id, key,
             Jsonb(payload.model_dump(mode='json', exclude={'expected_revision_id'})),
             Jsonb(result.model_dump(mode='json')), settings.osm_cache_hours))
    return result


@router.post('/v1/submissions/{submission_id}/geocode', response_model=GeocodeResults)
def locate(submission_id: UUID, payload: GeocodeRequest, request: Request, actor: ActorDep, database: DatabaseDep) -> GeocodeResults:
    saved = location_settings(submission_id, request, actor, database)
    if saved.revision_id != payload.expected_revision_id:
        raise HTTPException(409, 'Refresh the current revision before locating its area')
    if not saved.geocoding_enabled:
        raise HTTPException(409, 'Public geocoding is disabled. Use confirmed area coordinates or ask the coordinator to enable the configured provider.')
    location = saved.declared_location
    if not location or not location.applicant_confirmed:
        raise HTTPException(422, 'An applicant-confirmed business locality is required; an inferred address cannot be geocoded')
    area = ', '.join(str(part) for part in (location.locality, location.block, location.district, location.state, location.pin) if part)[:250]
    if not area or re.search(r'@|https?://|\d[\d\s()-]{8,}\d', area):
        raise HTTPException(422, 'Use a business locality without contact details')
    settings = request.app.state.settings
    key = hashlib.sha256((area.casefold() + settings.osm_nominatim_url).encode()).hexdigest()
    with database.transaction(actor.id, read_scoped=True) as c:
        cached = c.execute('''SELECT result FROM public.location_queries WHERE submission_id=%s
            AND cache_key=%s AND source='nominatim' AND expires_at>now() ORDER BY retrieved_at DESC LIMIT 1''', (submission_id, key)).fetchone()
    if cached:
        return GeocodeResults.model_validate(cached['result'])
    # Application-wide max one per second, even across API replicas. Never
    # autocomplete, auto-run or bulk geocode. This endpoint uses saved locality.
    take_limit(database, 'osm:nominatim:global', 1, 1)
    take_limit(database, 'osm:nominatim:user:' + str(actor.id), 10, 3600)
    try:
        result = geocode(settings, area)
    except OsmUnavailable:
        raise HTTPException(503, 'Location lookup is temporarily unavailable. Confirm area coordinates instead.') from None
    with database.transaction() as c:
        c.execute('''INSERT INTO public.location_queries(submission_id,input_revision_id,cache_key,source,query_area,result,expires_at)
            VALUES(%s,%s,%s,'nominatim',%s,%s,now()+interval '7 days')''',
            (submission_id, payload.expected_revision_id, key, Jsonb({'area': area}), Jsonb(result.model_dump(mode='json'))))
    return result
