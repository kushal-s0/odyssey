from datetime import datetime, timezone
from html import escape
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from ..auth.access import ActorDep, DatabaseDep, submission_access
from ..contracts.models import Assessment
from ..domain.economics import economics

router = APIRouter(tags=['reports'])


def text(value: object) -> str:
    return escape(str(value), quote=True)


def render_report(value: Assessment, reviews: list[dict[str, Any]], context: dict[str, Any] | None,
                  similar_items: list[dict[str, Any]] | None = None) -> str:
    def section(title: str, body: str) -> str:
        return '<section><h2>' + text(title) + '</h2>' + body + '</section>'
    def listing(items: list[str]) -> str:
        return '<ul>' + ''.join('<li>' + text(item) + '</li>' for item in items) + '</ul>' if items else '<p>None recorded.</p>'
    facts = []
    payload = value.business.model_dump(mode='json')
    for key, field in payload.items():
        if not isinstance(field, dict) or 'status' not in field:
            continue
        raw = field['value'] if field['status'] == 'present' else field['status']
        if isinstance(raw, dict):
            if 'amount' in raw:
                raw = str(raw['currency']) + ' ' + str(raw['amount']) + (' per ' + str(raw['unit']) if raw.get('unit') else '') + (
                    ' / ' + str(raw['period']) if raw.get('period') not in {None,'unknown','once'} else '')
            else:
                raw = ', '.join(str(raw[key]) for key in ('locality','block','district','state','pin') if raw.get(key))
        elif isinstance(raw, list):
            raw = ', '.join(map(str,raw))
        refs = ', '.join(str(i+1) for i,segment in enumerate(value.evidence) if str(segment.id) in field.get('source_segment_ids', []))
        facts.append('<tr><th>' + text(key.replace('_',' ')) + '</th><td>' + text(raw) + ('<small>Sources: ' + text(refs) + '</small>' if refs else '') + '</td></tr>')
    scores = value.scores
    headline = str(scores.headline_potential) + ' / 100' if scores.headline_potential is not None else 'Withheld — clarification needed'
    body = section('Assessment summary', '<div class="metrics"><p><b>Potential</b><br>' + text(headline) + '</p><p><b>Evidence coverage</b><br>' + text(scores.evidence_coverage*100) + '%</p><p><b>Completeness</b><br>' + text(scores.completeness_percent) + '% (' + text(scores.usable_fields) + '/' + text(scores.applicable_fields) + ' fields)</p></div><p>' + text('Headline reason: ' + (scores.withheld_reason or 'Sufficient evidence for a provisional headline')) + '</p><p>Self-reported business claims and automated suggestions require human review. This is not a funding decision or prediction of success.</p>')
    body += section('Business facts', '<table>' + ''.join(facts) + '</table>')
    body += section('Assessment dimensions', ''.join('<article><h3>' + text(d.domain.value.replace('_',' ')) + ' — ' + text(str(d.rating) + '/4' if d.rating is not None else 'Needs evidence') + '</h3><p>' + text(d.reason) + '</p><small>Basis: ' + text(d.basis) + '</small></article>' for d in value.domains))
    body += section('Strengths', listing(value.strengths)) + section('Gaps and questions', listing(value.gaps)) + section('Limits and risks', listing(value.risks))
    body += section('Financial checks', ''.join('<article><h3>' + text(check.title) + ' — ' + text(check.status.replace('_',' ')) + '</h3><p>' + text(check.explanation) + '</p>' + ('<p><code>' + text(check.formula) + '</code></p>' if check.formula else '') + listing(check.assumptions) + '</article>' for check in economics(value).checks))
    body += section('Similar submitted ideas', listing([str(item.get('title','Related idea')) + ' — ' + '; '.join(map(str,item.get('shared_traits',[]))) for item in similar_items]) if similar_items else '<p>No authorized similarity results were included for this version. Similarity is advisory and never a plagiarism finding.</p>')
    local = '<p>No sourced local-business snapshot was recorded for this input revision.</p>'
    if context:
        local = '<p>Area: ' + text(context.get('area_label')) + ' · Radius: ' + text(context.get('radius_m')) + ' m · Retrieved: ' + text(context.get('retrieved_at')) + '</p>'
        local += listing([str(item.get('name','Unnamed business')) + ' — ' + str(item.get('category','')) + ' · OSM ' + str(item.get('osm_type','')) + '/' + str(item.get('osm_id','')) for item in context.get('items',[]) if isinstance(item,dict)])
        local += '<p>© OpenStreetMap contributors · ODbL. Listings may be incomplete/outdated; empty results do not mean no competition.</p>'
    body += section('Local business context', local)
    body += section('Human review', ''.join('<article><h3>' + text(review['outcome']) + '</h3><p>' + text(review['reason']) + '</p><small>' + text(review['created_at']) + '</small></article>' for review in reviews) or '<p>No human decision is recorded for this revision.</p>')
    body += section('Original and English evidence', ''.join('<article><h3>Source ' + str(i+1) + ' · ' + text(segment.kind) + '</h3><small>' + text('Page ' + str(segment.page) if segment.kind == 'pdf' else f'{segment.start_seconds}–{segment.end_seconds} seconds' if segment.kind == 'audio' else f'Characters {segment.start_character}–{segment.end_character}') + ' · ' + text(segment.language.code) + (' · needs review' if segment.translation_uncertain or segment.language.needs_confirmation or (segment.kind=='pdf' and segment.extraction_uncertain) or segment.kind=='audio' else '') + '</small><h4>' + ('Source-language transcript (unverified ASR)' if segment.kind=='audio' else 'Original / source transcription') + '</h4><pre>' + text(segment.original_text) + '</pre><h4>English rendering</h4><pre>' + text(segment.english_text or 'Not available') + '</pre></article>' for i,segment in enumerate(value.evidence)))
    body += section('Provenance', '<p>Assessment version ' + text(value.version) + ' · Created ' + text(value.created_at.isoformat()) + ' · ' + text(value.scores.rubric_version) + '</p><p>Input revision: ' + text(value.input_revision_id) + '<br>Parent revision: ' + text(value.parent_revision_id or 'Original') + '<br>Pipeline: ' + text(value.pipeline_version) + '<br>Model manifest SHA256: ' + text(value.model_manifest_hash) + '</p>')
    return '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Udyam Saathi assessment report</title><style>
    *{box-sizing:border-box}body{font:14px/1.7 system-ui,sans-serif;color:#18372b;max-width:900px;margin:35px auto;padding:0 25px}h1{font:40px Georgia,serif}h2{font-size:22px;border-bottom:1px solid #ced9d0;padding-bottom:8px;margin-top:32px}h3{font-size:15px}h4{font-size:12px;margin-bottom:5px}small{display:block;color:#506357;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ced9d0;padding:10px;text-align:left;vertical-align:top}th{width:28%;text-transform:capitalize}pre{font:13px/1.8 system-ui,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f5ee;padding:12px;border-left:3px solid #417659}article{break-inside:avoid;padding:10px 0}p,li,td{overflow-wrap:anywhere}.metrics{display:flex;gap:30px;flex-wrap:wrap}code{white-space:normal}@page{size:A4;margin:16mm}@media print{body{margin:0;padding:0;font-size:11px}h1{font-size:30px}h2{font-size:18px}pre{font-size:10px}th,td{padding:7px}.print-note{display:none}}</style></head><body><header><small>UDYAM SAATHI · PRIVATE ASSESSMENT REPORT</small><h1>Understand the idea.<br>Follow the evidence.</h1><p>Generated ''' + text(datetime.now(timezone.utc).isoformat()) + '''</p><p class="print-note">Use your browser’s Print command to save this version as a PDF. Keep this report private.</p></header>''' + body + '</body></html>'


@router.get('/v1/submissions/{submission_id}/report', response_class=HTMLResponse)
def report(submission_id: UUID, actor: ActorDep, database: DatabaseDep,
           version: Annotated[int | None, Query(ge=1)] = None) -> HTMLResponse:
    current = submission_access(database, actor, submission_id)
    with database.transaction(actor.id, read_scoped=True) as c:
        row = c.execute('''SELECT payload FROM public.assessments WHERE submission_id=%s
            AND (%s::int IS NULL OR version=%s::int) ORDER BY version DESC LIMIT 1''', (submission_id,version,version)).fetchone()
        if not row:
            raise HTTPException(404, 'A report is not available for this assessment version')
        value = Assessment.model_validate(row['payload'])
        reviews = c.execute('''SELECT outcome,reason,created_at FROM public.review_actions
            WHERE submission_id=%s AND input_revision_id=%s ORDER BY created_at''', (submission_id,value.input_revision_id)).fetchall()
        context = c.execute('''SELECT result FROM public.location_queries WHERE submission_id=%s
            AND input_revision_id=%s AND source='overpass' ORDER BY retrieved_at DESC LIMIT 1''', (submission_id,value.input_revision_id)).fetchone()
    similar_items = None
    if value.input_revision_id == current['current_revision_id']:
        from .similar import similar
        similar_items = [item.model_dump(mode='json') for item in similar(submission_id, actor, database).items]
    return HTMLResponse(render_report(value,reviews,context['result'] if context else None,similar_items), headers={
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
        'X-Content-Type-Options':'nosniff'})
