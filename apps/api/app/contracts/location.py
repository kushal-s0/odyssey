from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from .models import Contract, Location


class LocationLookup(Contract):
    expected_revision_id: UUID
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: int = Field(default=1500, ge=200, le=5000)
    area_label: str = Field(min_length=2, max_length=200)
    confirmed: Literal[True]


class LocalBusiness(Contract):
    osm_type: Literal['node','way','relation']
    osm_id: int = Field(gt=0)
    name: str
    category: str
    latitude: float
    longitude: float
    distance_m: int
    url: str


class LocationInsights(Contract):
    status: Literal['ready','empty','not_requested','unsupported_trade','unavailable']
    source: Literal['OpenStreetMap Overpass','OpenStreetMap dated snapshot','none']
    attribution: str = '© OpenStreetMap contributors · ODbL'
    retrieved_at: datetime | None = None
    area_label: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    radius_m: int | None = None
    category: str | None = None
    items: list[LocalBusiness] = Field(default_factory=list, max_length=30)
    note: str = 'OSM listings may be incomplete or outdated. Nearby listings are context, not verified direct competitors. Empty results do not mean there is no competition.'
    cached: bool = False


class LocationSettings(Contract):
    revision_id: UUID
    declared_location: Location | None = None
    geocoding_enabled: bool
    supported_trade: bool


class GeocodeRequest(Contract):
    expected_revision_id: UUID


class GeocodeCandidate(Contract):
    label: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class GeocodeResults(Contract):
    candidates: list[GeocodeCandidate] = Field(max_length=5)
    attribution: str = '© OpenStreetMap contributors · ODbL · Nominatim'
    note: str = 'Choose and confirm the business area. Coordinates are approximate; a PIN is not an exact address.'
