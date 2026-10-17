import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { apiRequest } from '../api/client'
import type { components } from '../api/generated/schema'
import { useAuth } from '../auth/AuthProvider'

type Result = components['schemas']['Analytics']
const labels: Record<string, string> = { domain: 'Assessment dimensions', trade: 'By trade', cohort: 'By cohort', across_cohort: 'Across cohorts · same trade', clarity: 'Business clarity', customer_need: 'Customer need', market_potential: 'Market potential' }
export function Dashboard() {
  const { actor, session } = useAuth()
  const [result, setResult] = useState<Result | null>(null)
  const [dimension, setDimension] = useState('domain')
  const [cohort, setCohort] = useState('')
  const [trade, setTrade] = useState('')
  const [synthetic, setSynthetic] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ include_synthetic: String(synthetic) })
    if (cohort) params.set('cohort_id', cohort)
    if (trade) params.set('trade', trade)
    apiRequest<Result>(`/v1/analytics?${params}`, { token: session?.access_token || '', signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setResult(value); setError('') } })
      .catch((e: unknown) => { if (!controller.signal.aborted) { setResult(null); setError(e instanceof Error ? e.message : 'Comparisons unavailable.') } })
    return () => controller.abort()
  }, [cohort, trade, synthetic, session?.access_token, reload])
  const view = result?.views.find(item => item.dimension === dimension)
  return <><div className="workspace-heading"><span className="eyebrow">THE BIGGER PICTURE</span><h1>Compare with context.</h1><p>Explore assessment dimensions, trades and programs. Every average comes with its sample size.</p></div>
    <section className="submission-panel"><div className="form-grid"><label>Program<select value={cohort} onChange={e => setCohort(e.target.value)}><option value="">All authorized programs</option>{actor?.cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Trade<select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{['tea_stall','tailoring','food_service','dairy','poultry','beauty_services','mobile_repair','agricultural_inputs','solar_services','packaged_water','bag_manufacturing','other','unknown'].map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}</select></label></div><label className="inline-check"><input type="checkbox" checked={synthetic} onChange={e => setSynthetic(e.target.checked)} />Include clearly labelled synthetic examples</label>
      {error && <p role="alert" className="form-error">{error} <button className="text-button" onClick={() => setReload(n => n + 1)}>Retry comparisons</button></p>}
      {result && <><div className="score-grid"><div><span>Current assessments</span><strong>{result.assessed_count}</strong><small>One representative per scenario family</small></div><div><span>Comparable potential scores</span><strong>{result.eligible_count}</strong><small>All six dimensions assessed · {result.rubric_version}</small></div><div><span>Excluded from this view</span><strong>{result.excluded_synthetic + result.excluded_repeated_family}</strong><small>{result.excluded_synthetic} synthetic · {result.excluded_repeated_family} repeated family</small></div></div>
        <div className="view-tabs" role="group" aria-label="Comparison view">{result.views.map(item => <button key={item.dimension} aria-pressed={dimension === item.dimension} onClick={() => setDimension(item.dimension)}>{labels[item.dimension]}</button>)}</div>
        <h2 className="chart-title"><BarChart3 size={20} />{labels[dimension]}</h2><p className="field-note">{dimension === 'domain' ? 'Average dimension ratings, displayed on a 0–100 scale (rating × 25). Each bar excludes missing ratings.' : 'Average potential among complete, eligible assessments only. Information completeness describes all records in each group.'}</p>
        {view?.groups.length ? <div className="comparison-chart">{view.groups.map(group => <article key={group.key} className="chart-row"><div className="chart-label"><strong>{labels[group.label] || group.label.replaceAll('_', ' ')}</strong>{group.synthetic && <span className="badge">Contains synthetic examples</span>}<small>{group.rated_count} rated / {group.count} records{group.small_sample ? ' · small sample' : ''}</small></div><div className="chart-track" role="img" aria-label={`${group.label}: ${group.mean_score === null ? 'No eligible score' : group.mean_score.toFixed(1) + ' out of 100'}`}><span style={{ width: `${group.mean_score ?? 0}%` }} /></div><strong>{group.mean_score === null ? '—' : group.mean_score.toFixed(1)}</strong><small className="chart-completeness">Completeness {group.mean_completeness?.toFixed(0) ?? '—'}%<br />Coverage {group.mean_coverage?.toFixed(0) ?? '—'}%</small></article>)}</div> : <p className="empty-state">No comparable records in this view. Try another program or include labelled examples.</p>}
        <p className="field-note">{result.note} These charts do not establish statistical significance or business success.</p></>}
    </section></>
}
