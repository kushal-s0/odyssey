import { useI18n } from '../i18n/I18nProvider'
import { useId, useState } from 'react'
import type { Assessment } from '../api/client'
import { AssessmentInsights } from './AssessmentInsights'
import { RubricGuide } from './RubricGuide'

const labels: Record<string, string> = { clarity: 'Business clarity', customer_need: 'Customer need', market_potential: 'Market potential',
  feasibility: 'Feasibility', competition: 'Competition', differentiation: 'Differentiation' }

function describe(value: unknown, t: (text: string) => string): string {
  if (value === null || value === undefined) return t('Not supplied')
  if (Array.isArray(value)) return value.map(item => describe(item, t)).join(', ')
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>
    if ('amount' in item) {
      const amount = Number(item.amount)
      const money = item.currency === 'INR' ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount) : String(item.amount)
      return `${money}${item.period && item.period !== 'unknown' ? ` / ${t(String(item.period))}` : ''}${item.unit ? ` / ${t(String(item.unit))}` : ''}`
    }
    return [item.locality, item.district, item.state].filter(Boolean).join(', ') || t('Location needs clarification')
  }
  return typeof value === 'boolean' ? t(value ? 'Yes' : 'No') : String(value)
}

export function AssessmentView({ value, idPrefix = '' }: { value: Assessment; idPrefix?: string }) {
  const { t, locale } = useI18n()
  const titleId = useId()
  const [selected, setSelected] = useState<string | null>(null)
  const scores = value.scores
  const evidence = value.evidence.find(item => item.id === selected)
  const gaps = value.gaps || []
  const risks = value.risks || []
  return <section className="assessment-view" aria-labelledby={titleId}>
    <details className="simple-disclosure assessment-details"><summary id={titleId}>{t('See all details and scores')}</summary>
    <p>{t('These details are for you and your mentor. The score is not a promise of success.')}</p>
    {locale === 'hi' && <p className="field-note">{t('Your words are shown as you sent them. English model notes are inside the detailed view.')}</p>}
    <section aria-labelledby={`${titleId}-facts`}><h3 id={`${titleId}-facts`}>{t("What we understood")}</h3><dl className="business-facts">{([
      ['business_type', t("Business type")], ['offer', t("Product or service")], ['target_customers', t("Customers")], ['problem', t("Customer problem")],
      ['location', t("Business location")], ['investment', t("Investment")], ['unit_price', t("Price")],
      ['revenue', t("Revenue")], ['expenses', t("Expenses")], ['profit', t("Profit")], ['own_funds', t("Own funds")], ['requested_loan', t("Requested loan")],
      ['market_research', t("Demand evidence")], ['raw_materials', t("Materials and equipment")], ['suppliers', t("Suppliers")],
      ['competition', t("Competition")], ['differentiation', t("What makes it different")], ['existing_business', t("Already operating")],
    ] as const).map(([key, label]) => {
      const field = value.business[key]
      return <div key={key} id={`${idPrefix}fact-${key}`}><dt>{label}</dt><dd>{field?.status === 'present' ? describe(field.value, t) : !field || field.status === 'missing' ? t("Not supplied") : t(field.status.replaceAll('_', ' '))}
        {(field?.source_segment_ids || []).map(id => <button className="text-button" type="button" key={id} onClick={() => setSelected(id)}>{t("View source")} {value.evidence.findIndex(item => item.id === id) + 1}</button>)}
      </dd></div>
    })}</dl></section>
    <div className="score-grid"><div><span>{t('Proposed rubric score')}</span><strong>{scores.headline_potential === null ? t("Clarification needed") : `${scores.headline_potential} / 100`}</strong>{scores.headline_potential === null && <small>{t("Provisional:")} {scores.provisional_potential === null ? t("Not assessable") : `${scores.provisional_potential} / 100`}{t(". Headline withheld:")} {scores.withheld_reason?.replaceAll('_', ' ')}.</small>}</div>
      <div><span>{t("Evidence coverage")}</span><strong>{(Number(scores.evidence_coverage) * 100).toFixed(0)}%</strong><small>{t("Weight of dimensions with usable evidence.")}</small></div>
      <div><span>{t("Information completeness")}</span><strong>{scores.completeness_percent}%</strong><small>{scores.usable_fields} {t("of")} {scores.applicable_fields} {t("applicable fields. Completeness is separate from potential.")}</small></div></div>
    <p className="field-note">{scores.ranking_eligible ? t("Complete domain coverage; comparison still requires authorized, comparable records.") : t("This assessment is not eligible for ranking.")} {t("Model judgments and the advisory relevance baseline are not independently validated.")}</p>
    <RubricGuide /><AssessmentInsights value={value} />
    <div className="domain-grid">{value.domains.map(domain => <article key={domain.domain} className="domain-card"><div><h3>{t(labels[domain.domain])}</h3><strong>{domain.rating === null ? t("Needs evidence") : `${domain.rating} / 4`}</strong></div><p lang="en">{domain.reason}</p><small>{domain.basis === 'insufficient' ? t("Insufficient evidence") : t("Self-reported source claims")}</small>
      <div className="domain-meter" aria-hidden="true"><span style={{ width: `${(domain.rating ?? 0) * 25}%` }} /></div>{(domain.source_segment_ids || []).map(id => <button className="text-button" type="button" key={id} onClick={() => setSelected(id)}>{t("View source")} {value.evidence.findIndex(item => item.id === id) + 1}</button>)}</article>)}</div>
    <section className="evidence-panel" aria-label={t("Original evidence")}><h3>{t("Follow the original evidence")}</h3><label>{t("Source segment")}<select value={selected || ''} onChange={event => setSelected(event.target.value || null)}><option value="">{t("Choose a source segment")}</option>{value.evidence.map((item, i) => <option key={item.id} value={item.id}>{t("Source")} {i + 1} · {item.kind}</option>)}</select></label>
      {evidence && <div className="source-detail" role="region" aria-label={t("Selected source")}><h4>{evidence.kind === 'pdf' && evidence.extraction_method === 'vision_ocr' ? t("Page transcription (unverified OCR)") : evidence.kind === 'audio' ? t("Source-language transcript (unverified ASR)") : t("Original words")}</h4><blockquote lang={evidence.language?.code || undefined}>{evidence.original_text}</blockquote>{evidence.kind === 'pdf' && evidence.extraction_uncertain && <p className="field-note">{t("Scan transcription needs review. Open the original PDF and check this page, including handwriting, blanks and overwritten amounts.")}</p>}{evidence.kind === 'audio' && <p className="field-note">{t("Listen to the original and verify the words and figures. Times identify audio chunks, not individual words.")}</p>}{evidence.origin_revision_id && <p className="field-note">{t("Preserved from input revision")} {evidence.origin_revision_id}{t(". The original file is available in version history.")}</p>}<h4>{t("English rendering")}</h4><blockquote lang="en">{evidence.english_text || t("Not translated yet.")}</blockquote><p>{evidence.language?.code || 'und'} · {evidence.language?.provenance || 'unknown'}{evidence.language?.needs_confirmation ? ' · language confirmation needed' : ''}{evidence.translation_uncertain ? ' · translation requires review' : ''}</p><small>{evidence.kind === 'text' ? `Characters ${evidence.start_character}–${evidence.end_character}` : evidence.kind === 'pdf' ? `Page ${evidence.page}` : `${evidence.start_seconds}–${evidence.end_seconds} seconds`}</small></div>}
    </section>
    {(value.strengths || []).length > 0 && <details><summary>{t("Strengths to validate (")}{value.strengths!.length})</summary><p className="field-note">{t("These are positive model judgments from the supplied claims. Validate them against original evidence and actual business research.")}</p><ul>{value.strengths!.map((strength, i) => <li key={i}>{strength}</li>)}</ul></details>}
    {gaps.length > 0 && <details><summary>{t("Information to clarify (")}{gaps.length})</summary><ul>{gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul></details>}
    {risks.length > 0 && <details><summary>{t("Limits and risks")}</summary><ul>{risks.map((risk, i) => <li key={i}>{risk}</li>)}</ul></details>}
    <p className="field-note">{t("Assessment version")} {value.version} · {value.scores.rubric_version} · {new Date(value.created_at).toLocaleString()}{t(". Original evidence is private.")}</p>
    </details>
  </section>
}
