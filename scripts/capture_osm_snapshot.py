"""One bounded public Overpass read for an attributed non-private regional snapshot.

No geocoding, applicant/source data, public load test or application deployment.
"""
# ruff: noqa: E402
import json
import argparse
import sys
from pathlib import Path
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.config import Settings
from app.contracts.location import LocationLookup
from app.providers.osm import nearby, OsmUnavailable

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--provider',choices=['main','coffee'],default='coffee')
args=parser.parse_args()
endpoint='https://overpass.private.coffee/api/interpreter' if args.provider=='coffee' else 'https://overpass-api.de/api/interpreter'
query=LocationLookup(expected_revision_id=uuid4(),latitude=12.972,longitude=77.595,
    radius_m=1500,area_label='Central Bengaluru · public regional sample',confirmed=True)
try:
    result=nearby(Settings(_env_file=None,osm_overpass_url=endpoint),query,'tea_stall')
except OsmUnavailable as error:
    print('Public bounded Overpass snapshot unavailable (' + str(error) + '); no snapshot fabricated.')
    raise SystemExit(1) from None
target=ROOT/'data/osm'
target.mkdir(parents=True,exist_ok=True)
payload={'license':'ODbL-1.0','license_url':'https://opendatacommons.org/licenses/odbl/1-0/',
    'source_url':endpoint,'source':'OpenStreetMap contributors',
    'scope':'One bounded query of cafe/tea listings, not complete competition coverage; no applicant data',
    'trade':'tea_stall','coverage_radius_m':1500,'result':result.model_dump(mode='json')}
(target/'bengaluru-tea.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':result.status,'listings':len(result.items),'retrieved_at':str(result.retrieved_at),
    'attribution':result.attribution,'scope':'Real public read only; no geocoding/private source sent'}))
