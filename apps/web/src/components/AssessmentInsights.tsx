import { useI18n } from '../i18n/I18nProvider'
import { useId, useState } from 'react'
import type { Assessment } from '../api/client'
import '../graphs.css'

const labels: Record<string, string> = { clarity: 'Clarity', customer_need: 'Customer need', market_potential: 'Market', feasibility: 'Feasibility', competition: 'Competition', differentiation: 'Difference' }

export function AssessmentInsights({ value }: { value: Assessment }) {
  const { t } = useI18n()
  const title = useId()
  const [mode, setMode] = useState<'bars' | 'radar'>('bars')
  const statuses = Object.values(value.business).flatMap(item => item && typeof item === 'object' && 'status' in item ? [item.status] : [])
  const present = statuses.filter(status => status === 'present').length
  const unresolved = statuses.filter(status => ['ambiguous', 'unreadable'].includes(status)).length
  const uncertain = value.evidence.filter(source => source.translation_uncertain || source.language?.needs_confirmation ||
    (source.kind === 'audio' && source.transcription_uncertain) || (source.kind === 'pdf' && source.extraction_uncertain)).length
  const point = (index: number, radius: number) => {
    const angle = index * Math.PI / 3 - Math.PI / 2
    return [180 + Math.cos(angle) * radius, 150 + Math.sin(angle) * radius]
  }
  const complete = value.domains.every(domain => domain.rating !== null)
  return <section className="tool-panel assessment-insights" aria-labelledby={title}>
    <h3 id={title}>{t("Ratings and evidence confidence")}</h3>
    <p className="field-note">{t("Confidence here describes the supplied evidence. These ratings are model judgments, not probabilities of success or independently verified business facts.")}</p>
    <div className="view-tabs" role="group" aria-label={t("Assessment graph style")}>
      <button aria-pressed={mode === 'bars'} onClick={() => setMode('bars')}>{t("Rating bars")}</button>
      <button aria-pressed={mode === 'radar'} onClick={() => setMode('radar')}>{t("Rating radar")}</button>
    </div>
    {mode === 'bars' ? <div className="rating-bars">{value.domains.map(domain => <div className="rating-bar-row" key={domain.domain}>
      <span>{t(labels[domain.domain])}</span><meter min={0} max={4} value={domain.rating ?? 0} aria-label={`${t(labels[domain.domain])}: ${domain.rating === null ? 'not assessable' : domain.rating + ' out of 4'}`} />
      <strong>{domain.rating === null ? t("Unknown") : `${domain.rating} / 4`}</strong>
    </div>)}</div> : <>
      <svg className="rating-radar" viewBox="0 0 360 300" role="img" aria-label={t("Six dimension ratings on a zero to four scale. Missing ratings are omitted; exact values follow below.")}>
        {[1, 2, 3, 4].map(level => <polygon className="radar-grid" key={level} points={value.domains.map((_, i) => point(i, level * 24).join(',')).join(' ')} />)}
        {value.domains.map((domain, i) => { const edge = point(i, 96); const label = point(i, 128); return <g key={domain.domain}><line className="radar-grid" x1={180} y1={150} x2={edge[0]} y2={edge[1]} /><text x={label[0]} y={label[1]} textAnchor="middle" dominantBaseline="middle">{t(labels[domain.domain])}</text></g> })}
        {complete && <polygon className="radar-area" points={value.domains.map((domain, i) => point(i, Number(domain.rating) * 24).join(',')).join(' ')} />}
        {value.domains.map((domain, i) => { if (domain.rating === null) return null; const p = point(i, domain.rating * 24); return <circle className="radar-dot" key={domain.domain} cx={p[0]} cy={p[1]} r={4}><title>{t(labels[domain.domain])}: {domain.rating} / 4</title></circle> })}
      </svg>
      <p className="field-note">{complete ? t("Each ring is one rating point; outer ring = 4.") : t("Missing dimensions have no point. A filled shape requires all six ratings.")}</p>
      <ul className="radar-values">{value.domains.map(domain => <li key={domain.domain}>{t(labels[domain.domain])}: {domain.rating === null ? t("Unknown") : `${domain.rating} / 4`}</li>)}</ul>
    </>}
    <dl className="confidence-facts"><div><dt>{t("Grounded fields")}</dt><dd>{present} {t("supplied with source references")}</dd></div><div><dt>{t("Unresolved source facts")}</dt><dd>{unresolved} {t("ambiguous or unreadable")}</dd></div><div><dt>{t("Source review flags")}</dt><dd>{uncertain} {t("of")} {value.evidence.length} {t("segments need language, translation or transcription review")}</dd></div><div><dt>{t("Comparison eligibility")}</dt><dd>{value.scores.ranking_eligible ? t("Eligible under the current rubric") : `Withheld: ${value.scores.withheld_reason?.replaceAll('_', ' ') || 'incomplete domain evidence'}`}</dd></div></dl>
    <p className="field-note">{t("Source references establish traceability. They do not independently confirm applicant claims. Unknown values remain unknown.")}</p>
  </section>
}
