"""Prepare reusable question translations using only generic application copy, never applicant data."""
# ruff: noqa: E402
import json
import sys
from pathlib import Path

import httpx
from pydantic import TypeAdapter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.config import get_settings
from app.domain.questions import QUESTIONS


def main():
    settings = get_settings()
    if not settings.groq_api_key:
        raise SystemExit('Configure the optional Groq key privately before preparing translations.')
    source = {field:{'label':label,'question':question} for field,(label,question,_) in QUESTIONS.items()}
    source['_status'] = {'ambiguous':'The original is conflicting or unclear. Explain which figure or statement applies.',
        'irrelevant':'The previous answer did not address this topic.', 'unreadable':'This part could not be read reliably.'}
    target = ROOT/'data/localization/questions.json'
    target.parent.mkdir(parents=True,exist_ok=True)
    payload = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {
        'source':'Generic application questions only; no applicant or organizer content',
        'provider':'Groq','model':settings.groq_model,'human_validated':False,'translations':{}}
    for code,name in [('hi','Hindi'),('mr','Marathi'),('te','Telugu'),('bn','Bengali'),('or','Odia')]:
        if code in payload['translations']:
            continue
        try:
            with httpx.Client(timeout=30) as client:
                response=client.post('https://api.groq.com/openai/v1/chat/completions',
                    headers={'Authorization':'Bearer '+settings.groq_api_key.get_secret_value()},
                    json={'model':settings.groq_model,'temperature':0,'max_completion_tokens':6000,
                        'response_format':{'type':'json_object'},
                        **({'reasoning_effort':'low','include_reasoning':False} if settings.groq_model.startswith('openai/gpt-oss-') else {}),
                        'messages':[{'role':'system','content':f'Translate this business application copy to natural simple {name}, in its native script. Preserve every JSON object key and nesting exactly. Translate only string values; preserve meanings, currency/unit/period requests and unknown states. Never add financial advice. Return only the translated JSON object.'},
                            {'role':'user','content':json.dumps(source)}]})
            if response.status_code != 200:
                raise ValueError('Provider status '+str(response.status_code))
            choice=response.json()['choices'][0]
            if choice.get('finish_reason') != 'stop':
                raise ValueError('Incomplete generation')
            translated=TypeAdapter(dict[str,dict[str,str]]).validate_json(choice['message']['content'])
            if set(translated)!=set(source) or any(set(translated[key])!=set(source[key]) for key in source):
                raise ValueError('Translation keys differ')
            if any(not text.strip() or len(text)>1200 for item in translated.values() for text in item.values()):
                raise ValueError('Translation text bounds')
            payload['translations'][code]=translated
            target.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            print('Prepared '+code+'; human review remains pending',flush=True)
        except (httpx.HTTPError,ValueError,KeyError,IndexError) as error:
            print('Preparation failed for '+code+' ('+type(error).__name__+'); no private data or key printed')
            raise SystemExit(1) from None


if __name__=='__main__':
    main()
