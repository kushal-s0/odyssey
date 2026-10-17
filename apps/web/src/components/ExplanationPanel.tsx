import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { apiRequest, type Assessment } from '../api/client'
import type { components } from '../api/generated/schema'

type Explanation = components['schemas']['Explanation']
const domainLabels: Record<string, string> = { clarity: 'Business clarity', customer_need: 'Customer need', market_potential: 'Market potential' }
export function ExplanationPanel({ value, token }: { value: Assessment; token: string }) {
  const [result, setResult] = useState<Explanation | null>(null)
  const [language, setLanguage] = useState<'en' | 'hi'>('en')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Explanation>(`/v1/submissions/${value.submission_id}/explanation?language=${language}`, { token, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setResult(data); setError('') } })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Explanation unavailable.') })
    return () => controller.abort()
  }, [value.id, value.submission_id, token, language, reload])
  async function generate() {
    if (busy) return
    setBusy(true); setError('')
    try {
      setResult(await apiRequest<Explanation>(`/v1/submissions/${value.submission_id}/explanation`, { token, method: 'POST',
        body: { expected_assessment_id: value.id, language } }))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare an explanation.') }
    finally { setBusy(false) }
  }
  return <section className="tool-panel explanation-panel"><div className="tool-heading"><Sparkles size={21} /><h3>Understand your results</h3><span className="badge">{result?.provider === 'groq' ? 'Groq explanation' : 'Assessment guide'}</span></div>
    <div className="explanation-controls"><label>Explanation language<select disabled={busy} value={language} onChange={e => { setResult(null); setLanguage(e.target.value as 'en' | 'hi') }}><option value="en">English</option><option value="hi">हिन्दी / Hindi</option></select></label><button className="primary-link" disabled={busy || result?.status === 'not_configured' || result?.provider === 'groq'} onClick={() => { void generate() }}><Sparkles size={16} />{busy ? 'Preparing explanation…' : result?.provider === 'groq' ? 'Explanation saved' : 'Explain with Groq'}</button></div>
    <p className="field-note">Groq explains the saved assessment using business facts and ratings. Requesting it shares those details with Groq. It does not change your scores.</p>
    {result?.status === 'not_configured' && <p className="form-message">The assessment guide is available below. Your coordinator can enable additional AI explanations.</p>}
    {error && <p className="form-error" role="alert">{error} <button className="text-button" onClick={() => setReload(n => n + 1)}>Retry saved explanation</button></p>}
    {result && <div lang={result.language}><p className="explanation-summary">{result.summary}</p><div className="explanation-notes">{result.domain_notes.map(note => <details key={note.domain}><summary>{domainLabels[note.domain] || note.domain.replaceAll('_', ' ')}</summary><p>{note.explanation}</p><div className="field-links">{(note.evidence_fields || []).map(field => <a key={field} href={`#fact-${field}`}>{field.replaceAll('_', ' ')} ↗</a>)}</div></details>)}</div>
      <h4>{result.language === 'hi' ? 'अगले उपयोगी कदम' : 'Your next useful steps'}</h4><ol className="next-steps">{result.next_steps.map((step, i) => <li key={i}>{step.action}</li>)}</ol><small>{result.note}{result.model ? ` Model: ${result.model}.` : ''}</small></div>}
  </section>
}
