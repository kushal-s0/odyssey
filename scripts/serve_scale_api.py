"""One isolated loopback API replica for the explicit local scale harness."""
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import uvicorn

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.auth.jwt import TokenVerifier
from app.config import Settings
from app.main import create_app


def main():
    path=Path(sys.argv[1]).resolve()
    if not path.is_relative_to(ROOT/'.local'):
        raise SystemExit('Scale configuration must remain in ignored local artifacts')
    fixture=json.loads(path.read_text())
    if urlsplit(fixture['settings']['database_url']).hostname not in {'127.0.0.1','localhost'}:
        raise SystemExit('Scale API requires the isolated local database')
    settings=Settings(_env_file=None,**fixture['settings'])
    app=create_app(settings)
    app.state.token_verifier=TokenVerifier(settings,httpx.MockTransport(lambda _:httpx.Response(200,json={'keys':[fixture['jwk']]})))
    uvicorn.run(app,host='127.0.0.1',port=int(sys.argv[2]),log_level='critical',access_log=False)


if __name__=='__main__':
    main()
