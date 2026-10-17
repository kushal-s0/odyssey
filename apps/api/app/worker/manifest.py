import hashlib
import json

# Expected pipeline artifacts, not a deployment/quality claim. T09+ verify individual handlers.
MANIFEST = {
    'pipeline': 'screening-v1', 'protocol': 'stage-v1',
    'qwen': {'id':'Qwen/Qwen3-VL-2B-Instruct','revision':'89644892e4d85e24eaac8bacfd4f463576704203'},
    'asr': {'id':'ai4bharat/indic-conformer-600m-multilingual','revision':'2a77d305038dfc502fd9464e7d028b90381976cb'},
    'indic_en': {'id':'ai4bharat/indictrans2-indic-en-dist-200M','revision':'d66a2122ad6d28184f3dc3797b652bd80ae3f65f'},
    'en_indic': {'id':'ai4bharat/indictrans2-en-indic-dist-200M','revision':'2cfd0a20057756d756bf3e53528f492afc52f91a'},
    'embedding': {'id':'sentence-transformers/all-MiniLM-L6-v2','revision':'1110a243fdf4706b3f48f1d95db1a4f5529b4d41'},
    'rubric': 'rubric-v1', 'preprocessing':'bounded-originals-v1',
}
MANIFEST_HASH = hashlib.sha256(json.dumps(MANIFEST, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def initial_stages(kind: str) -> list[str]:
    return ['extract:'+kind, 'translate', 'structure', 'assess']
