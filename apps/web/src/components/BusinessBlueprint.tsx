import { useId } from 'react'
import { Download, LayoutGrid, ArrowUpRight } from 'lucide-react'
import type { Assessment } from '../api/client'

const groups = [
  { title: 'Offer & value', fields: [['offer', 'Offer'], ['problem', 'Customer need'], ['differentiation', 'Your difference']] },
  { title: 'People & place', fields: [['target_customers', 'Customers'], ['location', 'Business area'], ['market_research', 'Demand evidence']] },
  { title: 'Delivery & resources', fields: [['business_type', 'Business type'], ['raw_materials', 'Inputs'], ['suppliers', 'Suppliers']] },
  { title: 'Funding the start', fields: [['investment', 'Startup investment'], ['own_funds', 'Own funds'], ['requested_loan', 'Requested loan']] },
  { title: 'Money in & out', fields: [['unit_price', 'Selling price'], ['revenue', 'Revenue'], ['expenses', 'Expenses'], ['profit', 'Profit']] },
  { title: 'Position & stage', fields: [['competition', 'Alternatives'], ['existing_business', 'Already operating']] },
] as const

function describe(value: unknown): string {
  if (value === null || value === undefined) return 'Unknown'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(describe).join(', ')
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if ('amount' in record) return `${record.currency === 'unknown' ? 'Currency unspecified' : record.currency} ${record.amount}${record.unit ? ` per ${record.unit}` : ''}${record.period !== 'unknown' ? ` / ${record.period}` : ''}`
    return [record.locality, record.district, record.state].filter(Boolean).join(', ') || 'Area unspecified'
  }
  return String(value)
}

export function BusinessBlueprint({ value, onQuestions }: { value: Assessment; onQuestions: () => void }) {
  const titleId = useId()
  const excluded = value.scores.excluded_fields || {}
  const unresolved = groups.reduce((total, group) => total + group.fields.filter(([key]) => !excluded[key] && value.business[key]?.status !== 'present').length, 0)
  function download() {
    const lines = ['# Business brief', `Assessment version: ${value.version}`, `Saved: ${new Date(value.created_at).toISOString()}`, '',
      'Self-reported business facts from the saved assessment. Not an independently verified business plan or funding recommendation.',
      'Unknowns and conflicts remain unresolved. What-if scratchpad assumptions are excluded.', '', ...groups.flatMap(group => [
        `## ${group.title}`, ...group.fields.map(([key, label]) => {
          const field = value.business[key]
          const sources = (field?.source_segment_ids || []).map(id => value.evidence.findIndex(source => source.id === id) + 1).filter(index => index > 0)
          return `- ${label}: ${excluded[key] ? `Reviewer excluded: ${excluded[key]}` : field?.status === 'present' ? describe(field.value) : `Unresolved (${field?.status || 'missing'})`}${sources.length ? ` [source ${sources.join(', ')}]` : ''}`
        }), '',
      ]), '## Original evidence', ...value.evidence.flatMap((source, index) => [`### Source ${index + 1} (${source.kind})`, source.original_text, source.english_text ? `English rendering: ${source.english_text}` : '', ''])]
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `business-brief-v${value.version}.md`; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="tool-panel business-blueprint" aria-labelledby={titleId}><div className="tool-heading"><LayoutGrid size={20} /><h3 id={titleId}>Your business, on one map</h3><button type="button" className="secondary-button" onClick={download}><Download size={15} />Download business brief</button></div><p className="field-note">A working map of your saved, self-reported facts. {unresolved} detail{unresolved === 1 ? '' : 's'} still need clarification. This checklist uses the project’s proposed rubric; it is not an official industry standard.</p>
    <div className="blueprint-grid">{groups.map((group, index) => <article key={group.title}><span className="eyebrow">0{index + 1}</span><h4>{group.title}</h4><dl>{group.fields.map(([key, label]) => {
      const field = value.business[key]
      return <div key={key}><dt>{label}</dt><dd className={field?.status === 'present' ? '' : 'unresolved-fact'}>{excluded[key] ? `Reviewer excluded: ${excluded[key]}` : field?.status === 'present' ? describe(field.value) : !field || field.status === 'missing' ? 'To explore' : `Needs clarification · ${field.status}`}{field?.status === 'present' && <small>Self-reported · source {(field.source_segment_ids || []).map(id => value.evidence.findIndex(source => source.id === id) + 1).filter(number => number > 0).join(', ')}</small>}</dd></div>
    })}</dl></article>)}</div>
    {unresolved > 0 && <button type="button" className="text-button" onClick={onQuestions}>Work on the next useful questions<ArrowUpRight size={15} /></button>}
  </section>
}
