"""Accessible pinned NLLB translation on owned hardware, with no hosted calls.

NLLB weights are CC-BY-NC-4.0; selected for this noncommercial hackathon
prototype. See models/PROVENANCE.md before any broader deployment/use.
"""
import importlib
from typing import Any

from ..contracts.models import Language
from ..worker.manifest import MANIFEST
from .local_models import CACHE, ModelUnavailable


class LocalTranslator:
    def __init__(self) -> None:
        self.model: Any = None
        self.tokenizer: Any = None
        self.torch: Any = None
        self.device = 'cpu'

    def load(self) -> None:
        if self.model is not None:
            return
        artifact = MANIFEST['translation']
        snapshot = CACHE / ('models--' + artifact['id'].replace('/','--')) / 'snapshots' / artifact['revision']
        if not (snapshot / 'pytorch_model.bin').is_file() and not (snapshot / 'model.safetensors').is_file():
            raise ModelUnavailable('Pinned local translation weights must be provisioned explicitly')
        self.torch = importlib.import_module('torch')
        transformers = importlib.import_module('transformers')
        self.device = 'cuda' if self.torch.cuda.is_available() else 'cpu'
        self.tokenizer = transformers.AutoTokenizer.from_pretrained(str(snapshot), local_files_only=True, trust_remote_code=False)
        # Torch 2.9 safe weights-only loading; no repository Python is executed.
        self.model = transformers.AutoModelForSeq2SeqLM.from_pretrained(str(snapshot), local_files_only=True,
            trust_remote_code=False, weights_only=True,
            dtype=self.torch.float16 if self.device == 'cuda' else self.torch.float32).to(self.device).eval()

    def translate(self, text: str, source: Language, target: Language = 'en') -> str:
        if source == target:
            return text
        codes = {'en':'eng_Latn','hi':'hin_Deva','mr':'mar_Deva','te':'tel_Telu','bn':'ben_Beng','or':'ory_Orya'}
        if source not in codes or target not in codes or not text.strip() or len(text) > 1200:
            raise ModelUnavailable('Translation requires a supported source/target and bounded input')
        self.load()
        self.tokenizer.src_lang = codes[source]
        # Split by actual tokenizer length, never truncate an original answer.
        pending = [text]
        chunks = []
        while pending:
            part = pending.pop(0)
            if len(self.tokenizer(part)['input_ids']) <= 480:
                chunks.append(part)
                continue
            midpoint = part.rfind(' ', 1, len(part)//2 + 1)
            if midpoint < 1 or len(chunks) + len(pending) > 15:
                raise ModelUnavailable('Translation segment cannot be split safely')
            pending[:0] = [part[:midpoint],part[midpoint+1:]]
        translated = []
        for part in chunks:
            encoded = self.tokenizer(part, return_tensors='pt', truncation=False).to(self.device)
            with self.torch.inference_mode():
                output = self.model.generate(**encoded, forced_bos_token_id=self.tokenizer.convert_tokens_to_ids(codes[target]),
                                             max_new_tokens=512, num_beams=3, do_sample=False)
            if output.shape[1] >= 512:
                raise ModelUnavailable('Translation was truncated; human review is required')
            result = str(self.tokenizer.batch_decode(output,skip_special_tokens=True)[0]).strip()
            if not result:
                raise ModelUnavailable('Translation produced no usable text')
            translated.append(result)
        return ' '.join(translated)
