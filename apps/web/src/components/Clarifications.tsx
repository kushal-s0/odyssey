import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { apiRequest, type Assessment } from '../api/client'
import type { components } from '../api/generated/schema'

type Question = components['schemas']['ClarificationQuestion']
export function Clarifications({ value, token, onReassess }: { value: Assessment; token: string; onReassess: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const pending = useRef<{ body: string; key: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Question[]>(`/v1/submissions/${value.submission_id}/questions`, { token, signal: controller.signal })
      .then(setQuestions).catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load questions.') })
    return () => controller.abort()
  }, [value.submission_id, value.id, token, reload])
  async function submit(event: FormEvent) {
    event.preventDefault()
    const supplied = Object.fromEntries(Object.entries(answers).filter(([, text]) => text.trim()))
    if (!Object.keys(supplied).length || busy) return
    setBusy(true); setError('')
    const body = { expected_revision_id: value.input_revision_id, answers: supplied }
    const encoded = JSON.stringify(body)
    if (pending.current?.body !== encoded) pending.current = { body: encoded, key: crypto.randomUUID() }
    try {
      await apiRequest(`/v1/submissions/${value.submission_id}/clarifications`, { token, method: 'POST', body, idempotencyKey: pending.current.key })
      setAnswers({}); pending.current = null; onReassess()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your answers.') }
    finally { setBusy(false) }
  }
  return <section className="tool-panel"><div className="tool-heading"><MessageCircle size={20} /><h3>Make your next version stronger</h3></div>
    <p className="field-note">Up to three useful questions at a time. Answer what you know, in your preferred language. We keep the previous version and its original evidence, then assess your updated idea.</p>
    {error && <p role="alert" className="form-error">{error} <button className="text-button" onClick={() => { setError(''); setReload(n => n + 1) }}>Retry questions</button></p>}
    {questions.length > 0 ? <form onSubmit={event => { void submit(event) }}><fieldset disabled={busy}>
      {questions.map((question, index) => <details key={question.id} open={index < 2}><summary>{question.label}<span className="badge">{question.status}</span></summary>
        <label>{question.question}<textarea rows={2} maxLength={1500} value={answers[question.field] || ''} onChange={event => setAnswers(previous => ({ ...previous, [question.field]: event.target.value }))} /></label></details>)}
      <button type="submit" className="primary-link" disabled={busy || !Object.values(answers).some(text => text.trim())}><Send size={16} />{busy ? 'Saving new version…' : 'Save answers & reassess'}</button>
    </fieldset></form> : !error && <p className="field-note">No unresolved rubric fields were found in this assessment.</p>}
  </section>
}
