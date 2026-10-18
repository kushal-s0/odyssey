"""Pinned Whisper turbo; source-language transcription, not English translation."""
import importlib
from typing import Any

from ..contracts.models import Language, LanguageResult
from ..worker.manifest import MANIFEST
from .local_models import CACHE, ModelUnavailable

SUPPORTED = {'en','hi','mr','te','bn'}  # Whisper does not advertise Odia.


class LocalSpeech:
    def __init__(self, preferred: Language = 'und') -> None:
        torch = importlib.import_module('torch')
        transformers = importlib.import_module('transformers')
        self.odia = preferred == 'or'
        artifact = MANIFEST['speech_odia'] if self.odia else MANIFEST['speech']
        snapshot = CACHE / ('models--' + artifact['id'].replace('/','--')) / 'snapshots' / artifact['revision']
        if not (snapshot / 'model.safetensors').is_file() and not (snapshot / 'model.safetensors.index.json').is_file():
            raise ModelUnavailable('Pinned speech weights must be explicitly provisioned')
        self.torch = torch
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.dtype = torch.float16 if self.device == 'cuda' else torch.float32
        self.processor = transformers.AutoProcessor.from_pretrained(str(snapshot), local_files_only=True, trust_remote_code=False)
        self.model = transformers.AutoModelForSpeechSeq2Seq.from_pretrained(str(snapshot), local_files_only=True,
            trust_remote_code=False, dtype=self.dtype, attn_implementation='sdpa').to(self.device).eval()
        if self.odia:
            # Upstream ARTPARK-IISc usage explicitly clears inherited forced
            # decoder IDs for its Odia-finetuned model; do not force Hindi.
            self.model.config.forced_decoder_ids = None
            self.model.generation_config.forced_decoder_ids = None

    def transcribe(self, samples: Any, preferred: Language) -> tuple[str, LanguageResult]:
        if (preferred == 'or') != self.odia:
            raise ModelUnavailable('Select the pinned language-specific speech model before inference')
        language: str = preferred
        provenance = 'declared'
        with self.torch.inference_mode():
            if language == 'und':
                encoded = self.processor(samples, sampling_rate=16000, return_tensors='pt', return_attention_mask=True)
                features = encoded.input_features.to(self.device, dtype=self.dtype)
                token = int(self.model.detect_language(features)[0])
                raw = str(self.processor.tokenizer.convert_ids_to_tokens(token)).strip('<|>')
                if raw not in SUPPORTED:
                    raise ModelUnavailable('Detected audio language requires a supported model or human transcript')
                language = raw
                provenance = 'detected'
        def generate_part(part: Any, depth: int = 0) -> str:
            encoded_part = self.processor(part, sampling_rate=16000, return_tensors='pt', return_attention_mask=True)
            with self.torch.inference_mode():
                output = self.model.generate(input_features=encoded_part.input_features.to(self.device, dtype=self.dtype),
                    attention_mask=encoded_part.attention_mask.to(self.device),
                    **({} if self.odia else {'language':language, 'task':'transcribe'}),
                    max_new_tokens=384, do_sample=False, num_beams=1, return_timestamps=False)
            if output.shape[1] >= 384:
                # Retry disjoint source halves, never publish a capped prefix.
                # At most three levels / eight leaves within the stage deadline.
                if depth >= 3 or len(part) <= 5 * 16000:
                    raise ValueError('Bounded audio subdivision still requires human transcription')
                midpoint = len(part) // 2
                return ' '.join(filter(None, (generate_part(part[:midpoint], depth + 1),
                                               generate_part(part[midpoint:], depth + 1))))
            return str(self.processor.batch_decode(output,skip_special_tokens=True)[0]).strip()

        result = generate_part(samples)
        return result, LanguageResult.model_validate({'code':language,'provenance':provenance,
            'model_id':MANIFEST['speech']['id'] if provenance == 'detected' else None,'needs_confirmation':True})
