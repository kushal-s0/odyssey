"""Prepare source-linked positive auxiliary pairs; no local model is used."""
import hashlib
import json
import urllib.request
from pathlib import Path
DATASET='isaidchia/sharktank_pitches'
REVISION='3ccc6b50b06a93d7cb68a55f7baf8391fd3431b8'
HASHES={'train':'27e35f7ad27bc5e4570310d497e6093b0e409e0d4f0c721ff595a42b1c267766',
        'test':'873d56d2fa8f7fc783f66c4e3f46ee8b0affcaf5e839b516c078e4bcf605dee3'}
FIELDS=[('product_solution.product_category','What product or service category is described?'),
        ('problem_story.persona','Who experiences the problem described?'),
        ('problem_story.core_problem','What customer problem is described?'),
        ('product_solution.key_differentiator','What distinguishes the product or service?')]

def company_key(value): return ' '.join(value.casefold().split())

def convert_pitches(records, split, maximum_companies=30, excluded_companies=None):
    excluded_companies=set(excluded_companies or [])
    companies={company_key(str(row.get('input',{}).get('company_name',''))) for row in records}
    companies.discard('')
    companies=sorted(companies-excluded_companies,key=lambda name:hashlib.sha256(name.encode()).hexdigest())[:maximum_companies]
    selected=set(companies); result=[]; seen=set()
    for row in records:
        source=row.get('input',{}); company=str(source.get('company_name','')).strip()
        if company_key(company) not in selected: continue
        for path,question in FIELDS:
            value=source
            for part in path.split('.'):
                value=value.get(part) if isinstance(value,dict) else None
            if not isinstance(value,str) or len(value.strip())<3 or len(value)>2000 or value.strip().casefold() in {'unknown','none','not specified','n/a'}: continue
            answer=value.strip(); signature=(company_key(company),question,company_key(answer))
            if signature in seen: continue
            seen.add(signature)
            result.append({'businessContext':company,'question':question,'answer':answer,'label':0,'language':'en-IN',
                           'groupId':'sharktank-'+hashlib.sha256(company_key(company).encode()).hexdigest()[:16],
                           'sourceDataset':DATASET,'sourceRevision':REVISION,'sourceSplit':split,'sourceRowId':row['id'],
                           'sourceField':'input.'+path,'sourceStructuredValue':value,
                           'sourceLabel':'schema-derived relevant positive','weakAuxiliary':True,'humanReviewed':False,
                           'transcriptQuoteMatched':answer in str(row.get('output','')),'sourceLicense':'MIT declared by dataset publisher'})
    return result,selected

def prepare_sharktank(output='data/training', maximum_companies=30, test_companies=10):
    output=Path(output); cache=output/'external-cache'; cache.mkdir(parents=True,exist_ok=True)
    datasets={}
    for split in ['train','test']:
        path=cache/f'sharktank-{REVISION}-{split}.jsonl'
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=HASHES[split]:
            request=urllib.request.Request(f'https://huggingface.co/datasets/{DATASET}/resolve/{REVISION}/{split}.jsonl',headers={'User-Agent':'STRIVE-research-dataset-preparation/1.0'})
            with urllib.request.urlopen(request,timeout=60) as response: content=response.read(5*1024*1024)
            if hashlib.sha256(content).hexdigest()!=HASHES[split]: raise ValueError('Shark Tank source checksum mismatch.')
            path.write_bytes(content)
        datasets[split]=[json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]
    train,companies=convert_pitches(datasets['train'],'train',maximum_companies)
    # Exclude every official training company, even if not selected for our smaller budget.
    all_train_companies={company_key(str(row['input'].get('company_name',''))) for row in datasets['train']}
    test,_=convert_pitches(datasets['test'],'test',test_companies,all_train_companies)
    manifest={'dataset':DATASET,'revision':REVISION,'license':'MIT (dataset publisher declaration)',
              'datasetCard':f'https://huggingface.co/datasets/{DATASET}/blob/{REVISION}/README.md',
              'sourceRows':{split:len(rows) for split,rows in datasets.items()},'sourceSha256':HASHES,
              'labelMeaning':'Positive-only question/structured-field mapping; no off-topic, funding-success or readiness labels.',
              'limitations':'Structured values may be paraphrases of the pitch. They are not called transcript quotations unless an exact match is present. These are not independently reviewed labels.',
              'files':{}}
    for split,rows in [('train',train),('test',test)]:
        content=''.join(json.dumps(row,ensure_ascii=False)+'\n' for row in rows)
        path=output/f'external-sharktank-{split}.jsonl'; path.write_bytes(content.encode('utf-8'))
        manifest['files'][split]={'path':path.as_posix(),'rows':len(rows),'groups':len({row['groupId'] for row in rows}),
                                  'preparedSha256':hashlib.sha256(content.encode()).hexdigest()}
    (output/'sharktank-data-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,indent=2))
    return train,test,manifest

if __name__=='__main__': prepare_sharktank()
