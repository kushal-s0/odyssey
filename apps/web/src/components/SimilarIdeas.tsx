import { useEffect, useState } from 'react'
import { Layers3 } from 'lucide-react'
import { apiRequest, type Assessment } from '../api/client'
import type { components } from '../api/generated/schema'

export function SimilarIdeas({ value, token }: { value: Assessment; token: string }) {
  const [result, setResult] = useState<components['schemas']['SimilarResults'] | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<components['schemas']['SimilarResults']>(`/v1/submissions/${value.submission_id}/similar`, { token, signal: controller.signal })
      .then(setResult).catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Similar ideas are unavailable.') })
    return () => controller.abort()
  }, [token, value.id, value.submission_id, reload])
  return <section className="tool-panel"><div className="tool-heading"><Layers3 size={20} /><h3>Similar ideas in your workspace</h3></div><p className="field-note">Discover shared offers and customer needs among submissions you can access.</p>
    {error && <p role="alert" className="form-error">{error} <button className="text-button" onClick={() => { setError(''); setReload(n => n + 1) }}>Retry</button></p>}
    {!result && !error && <p role="status">Finding related ideas…</p>}
    {result?.status === 'not_indexed' && <p className="empty-state">A similarity index is not available for this revision yet. New assessments are indexed by the owned worker; existing assessments can be indexed by the coordinator.</p>}
    {result?.status === 'ready' && result.items.length === 0 && <p className="empty-state">No other indexed ideas are available within your access. More submissions will make this view useful.</p>}
    <div className="related-grid">{result?.items.map(item => <article className="related-card" key={item.submission_id}><span className="badge">{item.trade.replaceAll('_', ' ')}{item.synthetic ? ' · synthetic' : ''}</span><h4>{item.title}</h4>{item.customers && <p>{item.customers}</p>}<ul>{item.shared_traits.map(text => <li key={text}>{text}</li>)}</ul>{item.differences.length > 0 && <details><summary>How it differs</summary><ul>{item.differences.map(text => <li key={text}>{text}</li>)}</ul></details>}<small>Cosine similarity {item.cosine_similarity.toFixed(3)} · advisory match</small></article>)}</div>
    {result && <p className="field-note">{result.note} Model: {result.model}.</p>}
  </section>
}
