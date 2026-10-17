"""Pinned specialized OCR on owned hardware; no remote-code execution or API calls."""
from __future__ import annotations

import importlib
import time
from typing import Any

from .local_models import CACHE, ModelUnavailable
from ..worker.manifest import MANIFEST


class DocumentOCR:
    def __init__(self) -> None:
        torch=importlib.import_module('torch')
        transformers=importlib.import_module('transformers')
        self.torch=torch
        torch.set_num_threads(2)
        self.device='cuda' if torch.cuda.is_available() else 'cpu'
        artifact=MANIFEST['ocr']
        snapshot=CACHE/('models--'+artifact['id'].replace('/','--'))/'snapshots'/artifact['revision']
        if not snapshot.is_dir() or not (snapshot/'model.safetensors').exists():
            raise ModelUnavailable('Pinned OCR snapshot is unavailable; provision model weights')
        started=time.perf_counter()
        self.model=transformers.AutoModelForImageTextToText.from_pretrained(str(snapshot),
            local_files_only=True,trust_remote_code=False,use_safetensors=True,
            dtype=torch.bfloat16 if self.device=='cuda' else torch.float32,
            attn_implementation='sdpa').to(self.device).eval()
        self.processor=transformers.AutoProcessor.from_pretrained(str(snapshot),
            local_files_only=True,trust_remote_code=False)
        self.load_seconds=time.perf_counter()-started
        self.measurements: list[dict[str,str|float|int|bool]]=[]

    def transcribe(self, image: Any) -> str:
        if image.width*image.height>1_600_000:
            raise ValueError('OCR image exceeds pixel budget')
        torch=self.torch
        if self.device=='cuda':
            torch.cuda.reset_peak_memory_stats()
        started=time.perf_counter()
        messages=[{'role':'user','content':[{'type':'image','image':image},{'type':'text','text':'OCR:'}]}]
        inputs=self.processor.apply_chat_template(messages,tokenize=True,add_generation_prompt=True,
            return_dict=True,return_tensors='pt', images_kwargs={'size':{
                'shortest_edge':self.processor.image_processor.min_pixels,'longest_edge':1_200_000}}).to(self.device)
        if inputs['input_ids'].shape[1]>4096:
            raise ValueError('OCR page exceeds context budget')
        with torch.inference_mode():
            # The upstream checkpoint defaults use_cache=False (training).
            # Recomputing the full vision/text prefix for every output token is
            # unusably slow for full forms; native DynamicCache is supported.
            output=self.model.generate(**inputs,max_new_tokens=2048,do_sample=False,use_cache=True)
        if self.device=='cuda':
            torch.cuda.synchronize()
        generated=output[0][inputs['input_ids'].shape[1]:]
        text: str=self.processor.decode(generated,skip_special_tokens=True)
        psutil=importlib.import_module('psutil')
        self.measurements.append({'model':'PaddleOCR-VL-1.5','device':self.device,
            'load_seconds':round(self.load_seconds,3),'seconds':round(time.perf_counter()-started,3),
            'input_tokens':int(inputs['input_ids'].shape[1]),'output_tokens':len(generated),
            'peak_vram_bytes':int(torch.cuda.max_memory_allocated()) if self.device=='cuda' else 0,
            'rss_bytes':int(psutil.Process().memory_info().rss),'token_cap_reached':len(generated)>=2048,
            'human_quality_validated':False})
        if len(generated)>=2048:
            raise ValueError('OCR output was truncated; page requires review')
        return text
