"""Rebind stored parent evidence for clarification only; never trust worker ancestry."""
from uuid import uuid5

from psycopg import Connection
from psycopg.rows import DictRow

from ..contracts.models import Assessment, Evidence


def inherited_evidence(c: Connection[DictRow], revision: DictRow) -> list[Evidence]:
    if not revision['parent_revision_id']:
        return []
    linked = c.execute('''SELECT 1 FROM public.clarifications WHERE answer_revision_id=%s
        AND input_revision_id=%s AND submission_id=%s LIMIT 1''',
        (revision['id'], revision['parent_revision_id'], revision['submission_id'])).fetchone()
    if not linked:
        return []
    parent = c.execute('SELECT payload FROM public.assessments WHERE input_revision_id=%s AND submission_id=%s',
        (revision['parent_revision_id'],revision['submission_id'])).fetchone()
    if not parent:
        raise ValueError('Clarification parent assessment is unavailable')
    previous = Assessment.model_validate(parent['payload'])
    if len(previous.evidence) > 180:
        raise ValueError('Parent evidence exceeds follow-up budget; source review is required')
    return [segment.model_copy(update={'id':uuid5(revision['id'],'inherited:'+str(segment.id)),
        'input_revision_id':revision['id'], 'origin_revision_id':segment.origin_revision_id or previous.input_revision_id,
        'origin_segment_id':segment.origin_segment_id or segment.id}) for segment in previous.evidence]
