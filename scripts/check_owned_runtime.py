"""Measure current hardware/CUDA/detector; never overwrite historical laptop evidence."""
# ruff: noqa: E402 -- repository path bootstrap.
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
import torch
import psutil
from app.providers.local_models import LanguageIdentifier

report={'torch':torch.__version__,'cuda_available':torch.cuda.is_available(),
        'physical_ram_bytes':psutil.virtual_memory().total,'scope':'Current owned hardware/detector execution only; not quality validation'}
if torch.cuda.is_available():
    matrix=torch.ones((256,256),dtype=torch.float16,device='cuda')
    result=matrix@matrix
    torch.cuda.synchronize()
    report.update(device=torch.cuda.get_device_name(),vram_bytes=torch.cuda.get_device_properties(0).total_memory,
                  cuda_arithmetic_passed=bool(torch.all(result==256).item()))
detector=LanguageIdentifier()
report['language_examples']=[{'case':label,**detector(text,language).model_dump(mode='json')} for label,text,language in [
    ('english','I plan to sell tea to office workers near the bus stop.','en'),
    ('hindi','मुझे चाय का व्यवसाय शुरू करना है।','hi'),
    ('marathi','मला चहाचा व्यवसाय सुरू करायचा आहे.','mr')]]
(ROOT/'evals/reports/feasibility/owned-hardware.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=True),flush=True)
