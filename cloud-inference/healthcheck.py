"""Readiness check without exposing the bearer token in process arguments."""
import json
import os
from urllib.request import Request, urlopen
request = Request("http://127.0.0.1:8080/health/ready", headers={
    "Authorization": "Bearer " + os.environ.get("CLOUD_SERVICE_TOKEN", "")
})
try:
    with urlopen(request, timeout=8) as response:
        ok = response.status == 200 and json.load(response).get("ready") is True
except Exception:
    ok = False
raise SystemExit(0 if ok else 1)
