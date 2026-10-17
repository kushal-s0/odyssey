"""Export expected artifact identities; measured readiness belongs in task reports."""
# ruff: noqa: E402 -- repository path bootstrap for the shared canonical manifest.
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.worker.manifest import MANIFEST, MANIFEST_HASH

licenses={'qwen':'Apache-2.0','asr':'MIT','indic_en':'MIT','en_indic':'MIT','embedding':'Apache-2.0'}
payload={'schema_version':'1','manifest_hash':MANIFEST_HASH,'pipeline':MANIFEST['pipeline'],
    'protocol':MANIFEST['protocol'],'preprocessing':MANIFEST['preprocessing'],'rubric':MANIFEST['rubric'],
    'language_detector':{'id':MANIFEST['language_detector'],'license':'BSD-3-Clause','provenance':'pretrained third-party detector'},
    'artifacts':[{'task':name,**MANIFEST[name],'license':license_name,'provenance':'third-party pretrained open weights',
                  'owned_framework':'PyTorch/Transformers','readiness':'see measured reports; not a deployment claim'}
                 for name,license_name in licenses.items()],
    'owned_text_limits':{'concurrency':1,'context_tokens':4096,'output_tokens':640,'segment_characters':1200,
                         'batch_characters':2400,'format_repair_attempts':1},
    'promotion':{'relevance':'not trained yet; advisory baseline only'},
    'deployment':'not deployed; expected artifacts only'}
(ROOT/'models/manifest.json').write_text(json.dumps(payload,indent=2)+'\n')
print('Exported expected manifest without credentials or private data.')
