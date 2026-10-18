import { useI18n } from '../i18n/I18nProvider'
import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { apiRequest } from '../api/client'
import type { components } from '../api/generated/schema'
import { useAuth } from '../auth/AuthProvider'
import { ComparisonGraphs } from '../components/ComparisonGraphs'

type Result = components['schemas']['Analytics']
const labels: Record<string, string> = { domain: 'Assessment dimensions', trade: 'By trade', cohort: 'By cohort', across_cohort: 'Across cohorts · same trade', clarity: 'Business clarity', customer_need: 'Customer need', market_potential: 'Market potential' }
export function Dashboard() {
  const { t } = useI18n()
  const { actor, session } = useAuth()
  const [result, setResult] = useState<Result | null>(null)
  const [dimension, setDimension] = useState('domain')
  const [cohort, setCohort] = useState('')
  const [trade, setTrade] = useState('')
  const [synthetic, setSynthetic] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    const params = new URLSearchParams({ include_synthetic: String(synthetic) })
    if (cohort) params.set('cohort_id', cohort)
    if (trade) params.set('trade', trade)
    apiRequest<Result>(`/v1/analytics?${params}`, { token: session?.access_token || '', signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setResult(value); setError(''); setLoading(false) } })
      .catch((e: unknown) => { if (!controller.signal.aborted) { setResult(null); setError(e instanceof Error ? e.message : t("Comparisons unavailable.")); setLoading(false) } })
    return () => controller.abort()
  }, [cohort, trade, synthetic, session?.access_token, reload])
  const view = result?.views.find(item => item.dimension === dimension)
  return <><div className="workspace-heading"><span className="eyebrow">{t("THE BIGGER PICTURE")}</span><h1>{t("Compare with context.")}</h1><p>{t("Explore assessment dimensions, trades and programs. Every average comes with its sample size.")}</p></div>
    <section className="submission-panel"><div className="form-grid"><label>{t("Program")}<select value={cohort} onChange={e => setCohort(e.target.value)}><option value="">{t("All authorized programs")}</option>{actor?.cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>{t("Trade")}<select value={trade} onChange={e => setTrade(e.target.value)}><option value="">{t("All trades")}</option>{['tea_stall','tailoring','food_service','dairy','poultry','beauty_services','mobile_repair','agricultural_inputs','solar_services','packaged_water','bag_manufacturing','other','unknown'].map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}</select></label></div><label className="inline-check"><input type="checkbox" checked={synthetic} onChange={e => setSynthetic(e.target.checked)} />{t("Include clearly labelled synthetic examples")}</label>
      {error && <p role="alert" className="form-error">{error} <button className="text-button" onClick={() => setReload(n => n + 1)}>{t("Retry comparisons")}</button></p>}
      {loading && <p role="status">{t("Loading current comparisons…")}</p>}
      {!loading && result && <><div className="score-grid"><div><span>{t("Current assessments")}</span><strong>{result.assessed_count}</strong><small>{t("One representative per scenario family")}</small></div><div><span>{t("Comparable potential scores")}</span><strong>{result.eligible_count}</strong><small>{t("All six dimensions assessed ·")} {result.rubric_version}</small></div><div><span>{t("Excluded from this view")}</span><strong>{result.excluded_synthetic + result.excluded_repeated_family}</strong><small>{result.excluded_synthetic} {t("synthetic ·")} {result.excluded_repeated_family} {t("repeated family")}</small></div></div>
        <div className="view-tabs" role="group" aria-label={t("Comparison view")}>{result.views.map(item => <button key={item.dimension} aria-pressed={dimension === item.dimension} onClick={() => setDimension(item.dimension)}>{t(labels[item.dimension])}</button>)}</div>
        <h2 className="chart-title"><BarChart3 size={20} />{t(labels[dimension])}</h2><p className="field-note">{dimension === 'domain' ? t("Average dimension ratings, displayed on a 0–100 scale (rating × 25). Each bar excludes missing ratings.") : t("Average potential among complete, eligible assessments only. Information completeness describes all records in each group.")}</p>
        {view?.groups.length ? <ComparisonGraphs key={dimension} groups={view.groups.map(group => ({ ...group, label: labels[group.label] || group.label }))} /> : <p className="empty-state">{t("No comparable records in this view. Try another program or include labelled examples.")}</p>}
        <p className="field-note">{result.note} {t("These charts do not establish statistical significance or business success.")}</p></>}
    </section></>
}
