import { useId, useState } from 'react'
import type { Assessment } from '../api/client'

const labels: Record<string, string> = { clarity: 'Business clarity', customer_need: 'Customer need', market_potential: 'Market potential',
  feasibility: 'Feasibility', competition: 'Competition', differentiation: 'Differentiation' }

function describe(value: unknown): string {
  if (value === null || value === undefined) return 'Not supplied'
  if (Array.isArray(value)) return value.map(describe).join(', ')
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>
    if ('amount' in item) {
      const amount = Number(item.amount)
      const money = item.currency === 'INR' ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount) : String(item.amount)
      return `${money}${item.period && item.period !== 'unknown' ? ` / ${String(item.period)}` : ''}${item.unit ? ` per ${String(item.unit)}` : ''}`
    }
    return [item.locality, item.district, item.state].filter(Boolean).join(', ') || 'Location needs clarification'
  }
  return typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)
}

export function AssessmentView({ value, idPrefix = '' }: { value: Assessment; idPrefix?: string }) {
  const titleId = useId()
  const [selected, setSelected] = useState<string | null>(null)
  const scores = value.scores
  const evidence = value.evidence.find(item => item.id === selected)
  const gaps = value.gaps || []
  const risks = value.risks || []
  return <section className="assessment-view" aria-labelledby={titleId}>
    <div className="panel-heading"><span className="eyebrow">AUTOMATED FIRST-LEVEL ASSESSMENT</span><h2 id={titleId}>A clearer view of your idea</h2><p>Source-backed suggestions for authorized human review. This is not a funding decision or a prediction of business success.</p></div>
    <section aria-labelledby="business-facts-title"><h3 id="business-facts-title">What we understood</h3><dl className="business-facts">{([
      ['business_type', 'Business type'], ['offer', 'Product or service'], ['target_customers', 'Customers'], ['problem', 'Customer problem'],
      ['location', 'Business location'], ['investment', 'Investment'], ['unit_price', 'Price'],
      ['revenue', 'Revenue'], ['expenses', 'Expenses'], ['profit', 'Profit'], ['own_funds', 'Own funds'], ['requested_loan', 'Requested loan'],
      ['market_research', 'Demand evidence'], ['raw_materials', 'Materials and equipment'], ['suppliers', 'Suppliers'],
      ['competition', 'Competition'], ['differentiation', 'What makes it different'], ['existing_business', 'Already operating'],
    ] as const).map(([key, label]) => {
      const field = value.business[key]
      return <div key={key} id={`${idPrefix}fact-${key}`}><dt>{label}</dt><dd>{field?.status === 'present' ? describe(field.value) : !field || field.status === 'missing' ? 'Not supplied' : field.status.replaceAll('_', ' ')}
        {(field?.source_segment_ids || []).map(id => <button className="text-button" type="button" key={id} onClick={() => setSelected(id)}>View source {value.evidence.findIndex(item => item.id === id) + 1}</button>)}
      </dd></div>
    })}</dl></section>
    <div className="score-grid"><div><span>Potential</span><strong>{scores.headline_potential === null ? 'Clarification needed' : `${scores.headline_potential} / 100`}</strong>{scores.headline_potential === null && <small>Provisional: {scores.provisional_potential === null ? 'Not assessable' : `${scores.provisional_potential} / 100`}. Headline withheld: {scores.withheld_reason?.replaceAll('_', ' ')}.</small>}</div>
      <div><span>Evidence coverage</span><strong>{(Number(scores.evidence_coverage) * 100).toFixed(0)}%</strong><small>Weight of dimensions with usable evidence.</small></div>
      <div><span>Information completeness</span><strong>{scores.completeness_percent}%</strong><small>{scores.usable_fields} of {scores.applicable_fields} applicable fields. Completeness is separate from potential.</small></div></div>
    <p className="field-note">{scores.ranking_eligible ? 'Complete domain coverage; comparison still requires authorized, comparable records.' : 'This assessment is not eligible for ranking.'} Model judgments and the advisory relevance baseline are not independently validated.</p>
    <div className="domain-grid">{value.domains.map(domain => <article key={domain.domain} className="domain-card"><div><h3>{labels[domain.domain]}</h3><strong>{domain.rating === null ? 'Needs evidence' : `${domain.rating} / 4`}</strong></div><p>{domain.reason}</p><small>{domain.basis === 'insufficient' ? 'Insufficient evidence' : 'Self-reported source claims'}</small>
      <div className="domain-meter" aria-hidden="true"><span style={{ width: `${(domain.rating ?? 0) * 25}%` }} /></div>{(domain.source_segment_ids || []).map(id => <button className="text-button" type="button" key={id} onClick={() => setSelected(id)}>View source {value.evidence.findIndex(item => item.id === id) + 1}</button>)}</article>)}</div>
    <section className="evidence-panel" aria-label="Original evidence"><h3>Follow the original evidence</h3><label>Source segment<select value={selected || ''} onChange={event => setSelected(event.target.value || null)}><option value="">Choose a source segment</option>{value.evidence.map((item, i) => <option key={item.id} value={item.id}>Source {i + 1} · {item.kind}</option>)}</select></label>
      {evidence && <div className="source-detail" role="region" aria-label="Selected source"><h4>{evidence.kind === 'pdf' && evidence.extraction_method === 'vision_ocr' ? 'Page transcription (unverified OCR)' : evidence.kind === 'audio' ? 'Source-language transcript (unverified ASR)' : 'Original words'}</h4><blockquote>{evidence.original_text}</blockquote>{evidence.kind === 'pdf' && evidence.extraction_uncertain && <p className="field-note">Scan transcription needs review. Open the original PDF and check this page, including handwriting, blanks and overwritten amounts.</p>}{evidence.kind === 'audio' && <p className="field-note">Listen to the original and verify the words and figures. Times identify audio chunks, not individual words.</p>}<h4>English rendering</h4><blockquote>{evidence.english_text || 'Not translated yet.'}</blockquote><p>{evidence.language?.code || 'und'} · {evidence.language?.provenance || 'unknown'}{evidence.language?.needs_confirmation ? ' · language confirmation needed' : ''}{evidence.translation_uncertain ? ' · translation requires review' : ''}</p><small>{evidence.kind === 'text' ? `Characters ${evidence.start_character}–${evidence.end_character}` : evidence.kind === 'pdf' ? `Page ${evidence.page}` : `${evidence.start_seconds}–${evidence.end_seconds} seconds`}</small></div>}
    </section>
    {gaps.length > 0 && <details><summary>Information to clarify ({gaps.length})</summary><ul>{gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul></details>}
    {risks.length > 0 && <details><summary>Limits and risks</summary><ul>{risks.map((risk, i) => <li key={i}>{risk}</li>)}</ul></details>}
    <p className="field-note">Assessment version {value.version} · {value.scores.rubric_version} · {new Date(value.created_at).toLocaleString()}. Original evidence is private.</p>
  </section>
}
