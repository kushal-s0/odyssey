"""Export expected artifact identities; measured readiness belongs in task reports."""
# ruff: noqa: E402 -- repository path bootstrap for the shared canonical manifest.
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.worker.manifest import MANIFEST, MANIFEST_HASH

licenses={'qwen':'Apache-2.0','ocr':'Apache-2.0','asr':'MIT','indic_en':'MIT','en_indic':'MIT','embedding':'Apache-2.0',
          'speech':'MIT','speech_odia':'Apache-2.0','translation':'CC-BY-NC-4.0'}
payload={'schema_version':'1','manifest_hash':MANIFEST_HASH,'pipeline':MANIFEST['pipeline'],
    'protocol':MANIFEST['protocol'],'preprocessing':MANIFEST['preprocessing'],'rubric':MANIFEST['rubric'],
    'assessment_policy':MANIFEST['assessment_policy'],'extraction_policy':MANIFEST['extraction_policy'],
    'document_policy':MANIFEST['document_policy'],
    'language_detector':{'id':MANIFEST['language_detector'],'license':'BSD-3-Clause','provenance':'pretrained third-party detector'},
    'artifacts':[{'task':name,**MANIFEST[name],'license':license_name,'provenance':'third-party pretrained open weights',
                  'owned_framework':'PyTorch/Transformers','readiness':'see measured reports; not a deployment claim'}
                 for name,license_name in licenses.items()],
    'owned_text_limits':{'concurrency':1,'context_tokens':4096,'output_tokens':640,'segment_characters':1200,
                         'batch_characters':2400,'batch_segments':4,'format_repair_attempts':1},
    'owned_pdf_limits':{'pages':20,'image_pixels':1200000,'ocr_output_tokens':2048,
                        'checkpoints':'one per completed page','ocr':'unverified; headline/ranking withheld'},
    'promotion':{'relevance':'experimental candidate rejected; '+MANIFEST['relevance']+' selected'},
    'selected_speech':MANIFEST['speech'], 'selected_odia_speech':MANIFEST['speech_odia'], 'selected_translation':MANIFEST['translation'],
    'owned_speech_limits':{'languages':['en','hi','mr','te','bn','or'],'odia':'separate declared-language ARTPARK-IISc model; quality validation recorded separately',
        'max_seconds':600,'chunk_seconds':28,'odia_chunk_seconds':10,'timestamps':'actual non-overlapping sample ranges, not word alignment',
        'review':'transcriptions require source review; headline/ranking withheld'},
    'translation_usage':'NLLB CC-BY-NC-4.0; noncommercial hackathon prototype, not a general commercial deployment license',
    'deployment':'not deployed; expected artifacts only'}
(ROOT/'models/manifest.json').write_text(json.dumps(payload,indent=2)+'\n')
print('Exported expected manifest without credentials or private data.')
