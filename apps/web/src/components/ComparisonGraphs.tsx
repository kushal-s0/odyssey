import { useState } from 'react'
import type { components } from '../api/generated/schema'
import '../graphs.css'

type Group = components['schemas']['ComparisonGroup']
type Metric = 'mean_score' | 'mean_completeness' | 'mean_coverage'
const names: Record<Metric, string> = { mean_score: 'Potential / dimension rating', mean_completeness: 'Completeness', mean_coverage: 'Evidence coverage' }
const metrics = Object.keys(names) as Metric[]
const label = (group: Group) => group.label.replaceAll('_', ' ')
const display = (value: number | null) => value === null ? 'Unknown' : value.toFixed(1)

function download(groups: Group[]) {
  // Quote all cells and neutralize spreadsheet formulas in user-authored cohort names.
  const cell = (value: unknown) => '"' + String(value ?? '').replace(/^(?=\s*[=+@-]|[\t\r\n])/, "'").replaceAll('"', '""') + '"'
  const rows = [['Group', 'Records', 'Rated records', 'Mean potential or dimension rating / 100', 'Mean completeness / 100', 'Mean evidence coverage / 100', 'Contains synthetic examples'],
    ...groups.map(group => [group.label, group.count, group.rated_count, group.mean_score, group.mean_completeness, group.mean_coverage, group.synthetic])]
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'authorized-comparison.csv'; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ComparisonGraphs({ groups }: { groups: Group[] }) {
  const [mode, setMode] = useState<'bars' | 'scatter'>('bars')
  const [focus, setFocus] = useState<string | null>(null)
  const plotted = groups.filter(group => group.mean_score !== null && group.mean_completeness !== null)
  const selected = plotted.find(group => group.key === focus)
  return <div className="comparison-chart">
    <div className="graph-controls"><div className="view-tabs" role="group" aria-label="Comparison graph style"><button aria-pressed={mode === 'bars'} onClick={() => setMode('bars')}>Grouped bars</button><button aria-pressed={mode === 'scatter'} onClick={() => setMode('scatter')}>Completeness vs rating</button></div><button className="secondary-button" onClick={() => download(groups)}>Download CSV</button></div>
    <div className="graph-legend">{metrics.map(metric => <span key={metric}><i className={`metric-${metric}`} />{names[metric]}</span>)}</div>
    {mode === 'bars' ? groups.map(group => <article key={group.key} className="grouped-chart-row"><div className="chart-label"><strong>{label(group)}</strong>{group.synthetic && <span className="badge">Contains synthetic examples</span>}<small>{group.rated_count} rated / {group.count} records{group.small_sample ? ' · small scored sample' : ''}</small></div>
      <div className="metric-bars">{metrics.map(metric => <div key={metric} className="metric-row"><span className="metric-name">{names[metric]}</span><div className="chart-track" role="img" aria-label={`${label(group)}, ${names[metric]}: ${display(group[metric])}${group[metric] === null ? '' : ' out of 100'}`}><span className={`metric-${metric}`} style={{ width: `${group[metric] ?? 0}%` }} /></div><strong>{display(group[metric])}</strong></div>)}</div>
    </article>) : <>
      <p className="field-note">Each point is a group average. Horizontal: completeness; vertical: potential or dimension rating. This view does not show a causal relationship. Groups without both values are omitted ({groups.length - plotted.length}).</p>
      <svg className="comparison-scatter" viewBox="0 0 640 370" role="group" aria-label="Completeness versus rating scatter plot">
        {[0, 25, 50, 75, 100].map(tick => <g key={tick}><line className="radar-grid" x1={65} x2={590} y1={305 - tick * 2.55} y2={305 - tick * 2.55} /><text x={52} y={310 - tick * 2.55} textAnchor="end">{tick}</text><text x={65 + tick * 5.25} y={328} textAnchor="middle">{tick}</text></g>)}
        <text x={320} y={360} textAnchor="middle">Information completeness / 100</text><text x={16} y={180} textAnchor="middle" transform="rotate(-90 16 180)">Potential / dimension rating</text>
        {plotted.map(group => <circle key={group.key} className={`scatter-dot${group.synthetic ? ' synthetic-dot' : ''}`} cx={65 + group.mean_completeness! * 5.25} cy={305 - group.mean_score! * 2.55} r={7} tabIndex={0} role="img" aria-label={`${label(group)}: rating ${display(group.mean_score)}, completeness ${display(group.mean_completeness)}, ${group.rated_count} rated records${group.synthetic ? ', synthetic examples' : ''}`} onMouseEnter={() => setFocus(group.key)} onFocus={() => setFocus(group.key)}><title>{label(group)}: {group.rated_count} rated / {group.count} records</title></circle>)}
      </svg>
      <p className="scatter-detail" aria-live="polite">{selected ? `${label(selected)}: rating ${display(selected.mean_score)}, completeness ${display(selected.mean_completeness)}, coverage ${display(selected.mean_coverage)}; ${selected.rated_count} rated / ${selected.count} records${selected.small_sample ? '; small scored sample' : ''}${selected.synthetic ? '; contains synthetic examples' : ''}.` : 'Hover or focus a point for its figures. Overlapping points are listed separately in the data table.'}</p>
    </>}
    <details className="graph-table"><summary>Accessible data table ({groups.length} groups)</summary><div className="table-scroll"><table><caption>Means on a zero to one hundred scale; Unknown is excluded, never zero.</caption><thead><tr><th scope="col">Group</th><th scope="col">Rated / records</th><th scope="col">Rating</th><th scope="col">Completeness</th><th scope="col">Coverage</th></tr></thead><tbody>{groups.map(group => <tr key={group.key}><th scope="row">{label(group)}{group.synthetic ? ' (synthetic)' : ''}{group.small_sample ? ' (small scored sample)' : ''}</th><td>{group.rated_count} / {group.count}</td><td>{display(group.mean_score)}</td><td>{display(group.mean_completeness)}</td><td>{display(group.mean_coverage)}</td></tr>)}</tbody></table></div></details>
  </div>
}
