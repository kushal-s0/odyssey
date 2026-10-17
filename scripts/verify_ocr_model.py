"""Direct OCR smoke on an entirely synthetic image; no organizer text is logged."""
# ruff: noqa: E402
import json
import os
import sys
import time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
os.environ['HF_HUB_OFFLINE']='1'
os.environ['TRANSFORMERS_OFFLINE']='1'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS']='1'
from PIL import Image, ImageDraw, ImageFont
from app.providers.document_ocr import DocumentOCR

started=time.perf_counter()
result={'scope':'Actual pinned OCR on a synthetic English image; not handwriting/language validation'}
try:
    image=Image.new('RGB',(1000,500),'white')
    draw=ImageDraw.Draw(image)
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',36)
    draw.multiline_text((50,50),'Business idea: Tea for office workers.\nPrice: INR 10 per cup.\nStartup investment: INR 20000.',fill='black',font=font,spacing=20)
    model=DocumentOCR()
    text=model.transcribe(image)
    result.update(text=text,measurements=model.measurements,status='passed' if '10' in text and 'tea' in text.lower() else 'needs_review')
    image.close()
except Exception as error:
    result.update(status='failed',error_type=type(error).__name__,synthetic_diagnostic=str(error)[:600])
result['seconds']=round(time.perf_counter()-started,3)
(ROOT/'evals/reports/owned-ocr-synthetic.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=True))
if result['status'] != 'passed':
    raise SystemExit(1)
