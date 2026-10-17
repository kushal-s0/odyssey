from __future__ import annotations

import re
from collections.abc import Callable
from uuid import UUID, uuid5

from ..contracts.models import Evidence, Language, LanguageResult, TextEvidence
from ..contracts.pipeline import EvidenceBundle

LanguageDetector = Callable[[str, Language], LanguageResult]


def normalize_text(text: str, submission_id: UUID, revision_id: UUID, preferred: Language,
                   detector: LanguageDetector, *, max_chars: int = 1200) -> EvidenceBundle:
    """Keep exact offsets/bytes: normalization is segmentation, not rewriting."""
    if not text.strip() or len(text)>30000 or max_chars<100:
        raise ValueError('Text exceeds supported bounds or is empty')
    segments: list[Evidence]=[]
    # Sentence/newline boundaries retain original offsets; long sentences are
    # bounded again. Script is never used as a Hindi/Marathi detector.
    for match in re.finditer(r'.+?(?:\n+|(?<!\b[Rr]s)[.!?](?=\s|$)|।|$)',text,re.DOTALL):
        cursor=match.start()
        while cursor<match.end():
            stop=min(cursor+max_chars,match.end())
            if stop<match.end():
                space=text.rfind(' ',cursor+max_chars//2,stop)
                if space>cursor:
                    stop=space
            original=text[cursor:stop]
            left=len(original)-len(original.lstrip())
            right=len(original.rstrip())
            if right>left:
                start,end=cursor+left,cursor+right
                value=text[start:end]
                language=detector(value,preferred)
                segments.append(TextEvidence(id=uuid5(revision_id,f'text-evidence-v1:{start}:{end}'),
                    submission_id=submission_id,input_revision_id=revision_id,original_text=value,
                    language=language,start_character=start,end_character=end))
            cursor=stop
    if len(segments)>200:
        raise ValueError('Too many text segments; split the submission')
    return EvidenceBundle(evidence=segments)


def numeric_tokens(text: str) -> list[str]:
    # Unicode decimal digits normalize across Indic/Latin scripts without
    # rounding, grouping changes or model-derived arithmetic.
    return [''.join(str(int(c)) if c.isdecimal() else c for c in token).replace(',','')
            for token in re.findall(r'\d+(?:[,\.]\d+)*',text)]
