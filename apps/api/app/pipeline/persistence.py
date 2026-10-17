from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from psycopg import Connection
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb

from ..contracts.pipeline import EvidenceBundle, StructuredBundle
from ..repositories.idempotency import canonical_hash
from ..worker.manifest import MANIFEST, MANIFEST_HASH
from .normalize import numeric_tokens
from .structure import assemble


def persist_text_stage(c: Connection[DictRow], stage: DictRow, job: DictRow, payload: dict[str,Any]) -> None:
    """Lightweight API validation, in the same transaction as publication."""
    key=stage['stage_key']
    if job['pipeline_version']!='screening-v1' or key not in {'extract:text','extract:pdf','translate','structure'}:
        return
    try:
        bundle=EvidenceBundle.model_validate({key:payload[key] for key in ('schema_version','evidence','warnings')})
        if len({s.id for s in bundle.evidence})!=len(bundle.evidence):
            raise ValueError('Duplicate evidence identifiers')
        revision=c.execute('SELECT * FROM public.submission_versions WHERE id=%s',(job['input_revision_id'],)).fetchone()
        if not revision:
            raise ValueError('Revision unavailable')
        attachment=c.execute("SELECT id,pages FROM public.attachments WHERE input_revision_id=%s AND status='attached'",
                             (job['input_revision_id'],)).fetchone()
        for segment in bundle.evidence:
            if segment.submission_id!=job['submission_id'] or segment.input_revision_id!=job['input_revision_id']:
                raise ValueError('Unrelated evidence')
            if segment.kind=='text':
                if (not revision['source_text'] or revision['source_text'][segment.start_character:segment.end_character]!=segment.original_text):
                    raise ValueError('Original text differs')
            if segment.kind!=revision['input_kind']:
                raise ValueError('Evidence modality differs from its original')
            if segment.kind=='pdf':
                if not attachment or segment.attachment_id!=attachment['id'] or segment.page>(attachment['pages'] or 0):
                    raise ValueError('PDF evidence points outside its private attachment')
                if segment.extraction_method=='vision_ocr' and not segment.extraction_uncertain:
                    raise ValueError('Unreviewed OCR cannot claim certainty')
            if key.startswith('extract:') and segment.english_text is not None:
                raise ValueError('Extraction must preserve originals before translation')
        if key in {'translate','structure'}:
            prior_key='extract:'+revision['input_kind'] if key=='translate' else 'translate'
            prior=c.execute('''SELECT p.payload,p.model_manifest_hash FROM public.stage_publications p
                JOIN public.job_stages st ON st.id=p.stage_id WHERE st.job_id=%s AND st.stage_key=%s''',
                (job['id'],prior_key)).fetchone()
            if not prior or prior['model_manifest_hash']!=MANIFEST_HASH:
                raise ValueError('Prior pipeline manifest is unavailable or incompatible')
            previous=EvidenceBundle.model_validate(prior['payload'])
            if {s.id for s in previous.evidence}!={s.id for s in bundle.evidence}:
                raise ValueError('Translation cannot lose or replace evidence')
            lookup={s.id:s for s in previous.evidence}
            for segment in bundle.evidence:
                before=lookup[segment.id]
                changed={'english_text','translation_uncertain'} if key=='translate' else set()
                if segment.model_dump(exclude=changed)!=before.model_dump(exclude=changed):
                    raise ValueError('Evidence metadata/original changed')
                if (key=='translate' and segment.english_text is not None and not segment.translation_uncertain and
                        sorted(numeric_tokens(segment.original_text))!=sorted(numeric_tokens(segment.english_text))):
                    raise ValueError('Translation changed source numbers without uncertainty')
        if key=='translate':
            for ordinal,segment in enumerate(bundle.evidence):
                locator=segment.model_dump(mode='json',exclude={'id','submission_id','input_revision_id','original_text',
                    'english_text','language','translation_uncertain','kind','attachment_id'})
                c.execute('''INSERT INTO public.source_segments(id,submission_id,input_revision_id,attachment_id,ordinal,
                    kind,original_text,english_text,language,locator,translation_uncertain)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
                    (segment.id,job['submission_id'],job['input_revision_id'],getattr(segment,'attachment_id',None),ordinal,
                     segment.kind,segment.original_text,segment.english_text,Jsonb(segment.language.model_dump(mode='json')),
                     Jsonb(locator),segment.translation_uncertain))
        elif key=='structure':
            structured=StructuredBundle.model_validate(payload)
            if (structured.model_id,structured.model_revision)!=(MANIFEST['qwen']['id'],MANIFEST['qwen']['revision']):
                raise ValueError('Structured model differs from pinned artifact')
            rebuilt=assemble(bundle,structured.drafts)
            if canonical_hash(rebuilt.business.model_dump(mode='json'))!=canonical_hash(structured.business.model_dump(mode='json')):
                raise ValueError('Structured business differs from supported source quotes')
            c.execute('''INSERT INTO public.business_records(submission_id,input_revision_id,pipeline_version,schema_version,
                model_manifest_hash,payload,sector,trade) VALUES(%s,%s,%s,'1',%s,%s,%s,%s)''',
                (job['submission_id'],job['input_revision_id'],job['pipeline_version'],MANIFEST_HASH,
                 Jsonb(structured.business.model_dump(mode='json')),structured.business.sector,structured.business.trade))
    except (ValueError,KeyError,TypeError):
        raise HTTPException(422,'Stage evidence validation failed; review the source and pipeline version') from None
