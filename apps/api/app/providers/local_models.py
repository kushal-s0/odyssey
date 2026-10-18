"""Owned open-weight inference. Heavy libraries are loaded only in model children."""
from __future__ import annotations

import importlib
from collections.abc import Callable
import json
import os
import time
from pathlib import Path
from typing import Any

from ..contracts.models import Language, LanguageResult
from ..worker.manifest import MANIFEST
from ..config import ROOT

CACHE=ROOT/'.cache/huggingface/hub'


class ModelUnavailable(RuntimeError):
    pass


class LanguageIdentifier:
    def __init__(self) -> None:
        module=importlib.import_module('py3langid.langid')
        self.detector=module.LanguageIdentifier.from_pickled_model(module.MODEL_FILE,norm_probs=True)

    def __call__(self, text: str, preferred: Language) -> LanguageResult:
        code,confidence=self.detector.classify(text)
        confidence=float(confidence)
        if code in {'en','hi','mr','te','bn','or'} and confidence>=.95 and len(text.split())>=4:
            return LanguageResult(code=code,provenance='detected',model_id='py3langid-0.3.0',
                model_confidence=confidence,needs_confirmation=code not in {'en','hi'} or preferred not in {'und',code})
        if preferred!='und':
            return LanguageResult(code=preferred,provenance='declared',needs_confirmation=True)
        return LanguageResult()


class Qwen:
    def __init__(self) -> None:
        os.environ['HF_HUB_OFFLINE']='1'
        os.environ['TRANSFORMERS_OFFLINE']='1'
        torch=importlib.import_module('torch')
        transformers=importlib.import_module('transformers')
        self.torch=torch
        self.device='cuda' if torch.cuda.is_available() else 'cpu'
        started=time.perf_counter()
        artifact=MANIFEST['qwen']
        snapshot=CACHE/('models--'+artifact['id'].replace('/','--'))/'snapshots'/artifact['revision']
        if not snapshot.is_dir():
            raise ModelUnavailable('The pinned model snapshot has not been provisioned')
        options={'local_files_only':True}
        # Models must be downloaded explicitly by the operator/provisioning
        # command. Inference never switches to a remote/paid model endpoint.
        self.model=transformers.Qwen3VLForConditionalGeneration.from_pretrained(str(snapshot),
            dtype=torch.float16 if self.device=='cuda' else torch.float32,
            attn_implementation='sdpa',**options).to(self.device).eval()
        self.processor=transformers.AutoProcessor.from_pretrained(str(snapshot),**options)
        self.load_seconds=time.perf_counter()-started
        self.measurements: list[dict[str,str|float|int|bool]]=[]

    def generate(self, system: str, source: str, *, max_tokens: int = 640, image: Any = None) -> str:
        if len(source)>12000 or not 1<=max_tokens<=1024:
            raise ValueError('Inference input/output exceeds bounds')
        torch=self.torch
        if self.device=='cuda':
            torch.cuda.reset_peak_memory_stats()
        started=time.perf_counter()
        content: list[dict[str,Any]]=[{'type':'text','text':source}]
        if image is not None:
            if image.width * image.height > 1_600_000:
                raise ValueError('Page image exceeds the pixel bound')
            content.insert(0, {'type':'image','image':image})
        messages=[{'role':'system','content':[{'type':'text','text':system}]},
                  {'role':'user','content':content}]
        inputs=self.processor.apply_chat_template(messages,tokenize=True,add_generation_prompt=True,
                                                  return_dict=True,return_tensors='pt').to(self.device)
        inputs.pop('token_type_ids',None)
        if inputs['input_ids'].shape[1]>4096:
            raise ValueError('Inference context exceeds supported tokens')
        with torch.inference_mode():
            output=self.model.generate(**inputs,max_new_tokens=max_tokens,do_sample=False)
        if self.device=='cuda':
            torch.cuda.synchronize()
        generated=output[0][inputs['input_ids'].shape[1]:]
        text: str=self.processor.decode(generated,skip_special_tokens=True)
        psutil=importlib.import_module('psutil')
        self.measurements.append({'model':'Qwen3-VL-2B-Instruct','device':self.device,
            'load_seconds':round(self.load_seconds,3),'seconds':round(time.perf_counter()-started,3),
            'input_tokens':int(inputs['input_ids'].shape[1]),'output_tokens':len(generated),
            'peak_vram_bytes':int(torch.cuda.max_memory_allocated()) if self.device=='cuda' else 0,
            'rss_bytes':int(psutil.Process().memory_info().rss),'token_cap_reached':len(generated)>=max_tokens,
            'human_quality_validated':False})
        if len(generated)>=max_tokens:
            raise ValueError('Model output was truncated; review or use a smaller input')
        return text

    def json(self, system: str, source: str, *, validator: Callable[[dict[str,Any]],None] | None=None) -> dict[str,Any]:
        for attempt in range(2):
            try:
                raw=self.generate(system+(' Previous output was invalid. Return one complete JSON object following the requested schema. Use only supplied evidence and allowed citation indices. Every requested quote must be an EXACT contiguous source substring. Omit unsupported claims and keep the response concise.' if attempt else ''),source)
                value=json.loads(raw.removeprefix('```json').removeprefix('```').removesuffix('```').strip())
                if not isinstance(value,dict):
                    raise ValueError('Expected an object')
                if validator:
                    validator(value)
                return value
            except ValueError:
                if attempt:
                    raise
        raise ValueError('Invalid model output')


class SentenceEncoder:
    """Frozen pinned MiniLM CPU encoder, used only for advisory similarity."""
    def __init__(self) -> None:
        os.environ['HF_HUB_OFFLINE']='1'
        os.environ['TRANSFORMERS_OFFLINE']='1'
        transformers=importlib.import_module('transformers')
        self.torch=importlib.import_module('torch')
        self.torch.set_num_threads(2)
        artifact=MANIFEST['embedding']
        snapshot=CACHE/('models--'+artifact['id'].replace('/','--'))/'snapshots'/artifact['revision']
        if not snapshot.is_dir():
            raise ModelUnavailable('Pinned embedding snapshot is unavailable')
        self.tokenizer=transformers.AutoTokenizer.from_pretrained(str(snapshot),local_files_only=True)
        self.model=transformers.AutoModel.from_pretrained(str(snapshot),local_files_only=True).eval()

    def embed(self, text: str) -> list[float]:
        encoded=self.tokenizer([text],padding=True,truncation=True,max_length=384,return_tensors='pt')
        with self.torch.inference_mode():
            hidden=self.model(**encoded).last_hidden_state
            mask=encoded['attention_mask'].unsqueeze(-1)
            pooled=(hidden*mask).sum(1)/mask.sum(1).clamp(min=1)
            vector=self.torch.nn.functional.normalize(pooled,p=2,dim=1)[0]
        return list(vector.tolist())

    def cosine(self,question: str,answer: str) -> float:
        encoded=self.tokenizer([question,answer],padding=True,truncation=True,max_length=256,return_tensors='pt')
        with self.torch.inference_mode():
            hidden=self.model(**encoded).last_hidden_state
            mask=encoded['attention_mask'].unsqueeze(-1)
            pooled=(hidden*mask).sum(1)/mask.sum(1).clamp(min=1)
            normalized=self.torch.nn.functional.normalize(pooled,p=2,dim=1)
        return max(-1.,min(1.,float((normalized[0]*normalized[1]).sum())))


class IndicTranslator:
    """Pinned IndicTrans2 adapter; unavailable gates fail closed, never use paid translation."""
    def __init__(self) -> None:
        self.model: Any=None
        self.tokenizer: Any=None
        self.processor: Any=None

    def translate(self,text: str,source: Language,target: Language='en') -> str:
        if source==target:
            return text
        if source=='und' or target!='en' or len(text)>1200:
            raise ModelUnavailable('Translation language/length is unsupported')
        artifact=MANIFEST['indic_en']
        # The gated pinned repository's custom code cannot be reviewed without
        # access. No unreviewed trust_remote_code execution is permitted.
        review=ROOT/'models/indic-code-review.json'
        if not review.exists():
            raise ModelUnavailable('Pinned IndicTrans2 access/custom-code review is incomplete')
        reviewed=json.loads(review.read_text(encoding='utf-8'))
        if reviewed.get('revision')!=artifact['revision'] or not reviewed.get('sha256'):
            raise ModelUnavailable('IndicTrans2 custom-code review does not match the pinned revision')
        if self.model is None:
            hub=importlib.import_module('huggingface_hub')
            snapshot=Path(hub.snapshot_download(artifact['id'],revision=artifact['revision'],cache_dir=str(CACHE),local_files_only=True))
            import hashlib
            for name,digest in reviewed['sha256'].items():
                path=(snapshot/name).resolve()
                if not path.is_relative_to(CACHE.resolve()) or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
                    raise ModelUnavailable('IndicTrans2 code checksum differs')
            code_files={str(path.relative_to(snapshot)).replace('\\','/') for path in snapshot.rglob('*.py')}
            if code_files!=set(reviewed['sha256']):
                raise ModelUnavailable('All executable IndicTrans2 files must be reviewed')
            transformers=importlib.import_module('transformers')
            toolkit=importlib.import_module('IndicTransToolkit')
            self.processor=toolkit.IndicProcessor(inference=True)
            self.tokenizer=transformers.AutoTokenizer.from_pretrained(str(snapshot),trust_remote_code=True,local_files_only=True)
            self.model=transformers.AutoModelForSeq2SeqLM.from_pretrained(str(snapshot),trust_remote_code=True,
                local_files_only=True,dtype=importlib.import_module('torch').float32).eval()
        codes={'hi':'hin_Deva','mr':'mar_Deva','te':'tel_Telu','bn':'ben_Beng','or':'ory_Orya'}
        prepared=self.processor.preprocess_batch([text],src_lang=codes[source],tgt_lang='eng_Latn')
        encoded=self.tokenizer(prepared,return_tensors='pt',padding=True,truncation=False)
        if encoded['input_ids'].shape[1]>512:
            raise ModelUnavailable('Translation input exceeds token bound')
        torch=importlib.import_module('torch')
        with torch.inference_mode():
            output=self.model.generate(**encoded,max_new_tokens=256,num_beams=1)
        if output.shape[1]>=256:
            raise ModelUnavailable('Translation output truncated')
        decoded=self.tokenizer.batch_decode(output,skip_special_tokens=True)
        value: str=self.processor.postprocess_batch(decoded,lang='eng_Latn')[0]
        return value
