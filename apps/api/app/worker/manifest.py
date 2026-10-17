import hashlib
import json
from typing import TypedDict


class Artifact(TypedDict):
    id: str
    revision: str


class PipelineManifest(TypedDict):
    pipeline: str
    protocol: str
    qwen: Artifact
    ocr: Artifact
    asr: Artifact
    indic_en: Artifact
    en_indic: Artifact
    embedding: Artifact
    speech: Artifact
    speech_odia: Artifact
    translation: Artifact
    rubric: str
    preprocessing: str
    language_detector: str
    assessment_policy: str
    relevance: str
    extraction_policy: str
    document_policy: str

# Expected pipeline artifacts, not a deployment/quality claim. T09+ verify individual handlers.
MANIFEST: PipelineManifest = {
    'pipeline': 'screening-v1', 'protocol': 'stage-v1',
    'qwen': {'id':'Qwen/Qwen3-VL-2B-Instruct','revision':'89644892e4d85e24eaac8bacfd4f463576704203'},
    'ocr': {'id':'PaddlePaddle/PaddleOCR-VL-1.5','revision':'2a4195faa5e7914c12f2fc601d72c81caf8d2da5'},
    'asr': {'id':'ai4bharat/indic-conformer-600m-multilingual','revision':'2a77d305038dfc502fd9464e7d028b90381976cb'},
    'indic_en': {'id':'ai4bharat/indictrans2-indic-en-dist-200M','revision':'d66a2122ad6d28184f3dc3797b652bd80ae3f65f'},
    'en_indic': {'id':'ai4bharat/indictrans2-en-indic-dist-200M','revision':'2cfd0a20057756d756bf3e53528f492afc52f91a'},
    'embedding': {'id':'sentence-transformers/all-MiniLM-L6-v2','revision':'1110a243fdf4706b3f48f1d95db1a4f5529b4d41'},
    'speech': {'id':'openai/whisper-large-v3-turbo','revision':'41f01f3fe87f28c78e2fbf8b568835947dd65ed9'},
    'speech_odia': {'id':'ARTPARK-IISc/whisper-large-v3-vaani-odia','revision':'357f3571fde5962196596cef29b76807e0932ff4'},
    'translation': {'id':'facebook/nllb-200-distilled-600M','revision':'f8d333a098d19b4fd9a8b18f94170487ad3f821d'},
    'rubric': 'rubric-v1', 'preprocessing':'text-evidence-v1', 'language_detector':'py3langid-0.3.0',
    'assessment_policy':'grounded-domain-v1', 'relevance':'rules-cosine-baseline-v1',
    'extraction_policy':'quoted-facts-v5-individual-grounding-repair',
    'document_policy':'pdf-pages-v1-review-required-ocr',
}
MANIFEST_HASH = hashlib.sha256(json.dumps(MANIFEST, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def initial_stages(kind: str) -> list[str]:
    return ['extract:'+kind, 'translate', 'structure', 'assess']
