import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ClipboardCheck, Search } from 'lucide-react'
import { apiRequest } from '../api/client'
import type { components } from '../api/generated/schema'
import { useAuth } from '../auth/AuthProvider'
import { SubmissionDetail } from './MySubmissions'

type Queue = components['schemas']['QueuePage']
type Review = components['schemas']['ReviewView']
type Outcome = components['schemas']['ReviewInput']['outcome']
export function AssessorWorkspace({ active = true }: { active?: boolean }) {
  const { actor, session } = useAuth()
  const token = session?.access_token || ''
  const [page, setPage] = useState<Queue | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detailEpoch, setDetailEpoch] = useState(0)
  const [status, setStatus] = useState('')
  const [cohort, setCohort] = useState('')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [unreviewed, setUnreviewed] = useState(false)
  const [offset, setOffset] = useState(0)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(() => setReload(n => n + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ limit: '12', offset: String(offset), unreviewed: String(unreviewed) })
    if (status) params.set('status', status)
    if (cohort) params.set('cohort_id', cohort)
    if (search) params.set('search', search)
    apiRequest<Queue>(`/v1/review-queue?${params}`, { token, signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setPage(value); setError(''); setLoading(false) } })
      .catch((e: unknown) => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Could not load the review queue.'); setLoading(false) } })
    return () => controller.abort()
  }, [token, offset, status, cohort, search, unreviewed, reload])
  function filter(update: () => void) { update(); setOffset(0); setLoading(true) }
  return <><div className="workspace-heading"><span className="eyebrow">ASSESSOR WORKSPACE</span><h1>Every idea deserves<br /><em>a closer look.</em></h1><p>Review the evidence, understand the gaps, and choose a useful next step.</p></div>
    <section className="submission-panel"><div className="list-heading"><div><span className="eyebrow">YOUR AUTHORIZED PROGRAMS</span><h2>Review queue <span className="count-pill">{page?.total ?? '…'}</span></h2></div><button className="secondary-button" onClick={refresh}>Refresh queue</button></div>
      <div className="queue-filters"><form onSubmit={e => { e.preventDefault(); filter(() => setSearch(query)) }}><label className="sr-only" htmlFor="queue-search">Search business ideas</label><div className="search-box"><Search size={17} /><input id="queue-search" value={query} maxLength={120} onChange={e => setQuery(e.target.value)} placeholder="Search product or service" /><button className="secondary-button" type="submit">Search</button></div></form>
        <label>Status<select value={status} onChange={e => filter(() => setStatus(e.target.value))}><option value="">All statuses</option>{['queued', 'extracting', 'translating', 'structuring', 'assessing', 'completed', 'partial', 'needs_review', 'failed', 'cancelled', 'waiting_for_worker'].map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></label>
        <label>Program<select value={cohort} onChange={e => filter(() => setCohort(e.target.value))}><option value="">All authorized programs</option>{actor?.cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="inline-check"><input type="checkbox" checked={unreviewed} onChange={e => filter(() => setUnreviewed(e.target.checked))} />Not reviewed</label></div>
      {error && <p role="alert" className="form-error">{error}</p>}{loading && <p role="status">Loading ideas…</p>}
      {page && !loading && <><div className="queue-list">{page.items.map(item => <button key={item.id} data-submission-id={item.id} className={`queue-row ${selected === item.id ? 'selected' : ''}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><span className="queue-icon"><ClipboardCheck size={21} /></span><span className="queue-title"><strong>{item.title}</strong><small>{item.cohort_name || 'Personal idea'}{item.synthetic ? ' · synthetic example' : ''} · {item.input_kind} · {item.language.toUpperCase()}</small></span><span><span className="badge">{item.status.replaceAll('_', ' ')}</span><small>{item.reviewed ? 'Review recorded' : 'Awaiting review'}</small></span><span className="queue-score"><strong>{item.potential === null ? '—' : item.potential}</strong><small>{item.potential === null ? 'No headline' : '/ 100 potential'}</small></span></button>)}</div>
        {page.items.length === 0 && <p className="empty-state">No ideas match these filters. New submissions in your programs will appear here.</p>}
        <div className="pagination"><span>{page.total ? `${offset + 1}–${Math.min(offset + 12, page.total)} of ${page.total}` : '0 ideas'}</span><button className="secondary-button" disabled={offset === 0} onClick={() => { setOffset(n => Math.max(0, n - 12)); setLoading(true) }}><ArrowLeft size={15} />Previous</button><button className="secondary-button" disabled={offset + 12 >= page.total} onClick={() => { setOffset(n => n + 12); setLoading(true) }}>Next<ArrowRight size={15} /></button></div></>}
    </section>
    {selected && <section className="submission-panel"><SubmissionDetail key={`${selected}:${detailEpoch}`} id={selected} token={token} onFinished={refresh} canClarify={false} active={active} /><ReviewForm key={selected} id={selected} token={token} onSaved={() => { refresh(); setDetailEpoch(n => n + 1) }} /></section>}
  </>
}

function ReviewForm({ id, token, onSaved }: { id: string; token: string; onSaved: () => void }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [outcome, setOutcome] = useState<Outcome>('reviewed')
  const [reason, setReason] = useState('')
  const [correction, setCorrection] = useState('')
  const [sourceVerified, setSourceVerified] = useState(false)
  const [transcriptLanguage,setTranscriptLanguage]=useState('en')
  const [replaceTranscript, setReplaceTranscript] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [expectedRevision, setExpectedRevision] = useState<string | null>(null)
  const pending = useRef<{ body: string; key: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Review[]>(`/v1/submissions/${id}/reviews`, { token, signal: controller.signal }).then(setReviews)
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load reviews.') })
    apiRequest<components['schemas']['SubmissionView']>(`/v1/submissions/${id}`, { token, signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setExpectedRevision(previous => previous || value.revision_id) })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load the revision to review.') })
    return () => controller.abort()
  }, [id, token])
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !expectedRevision) return
    setBusy(true); setError(''); setSaved('')
    try {
      const body = { expected_revision_id: expectedRevision, outcome, reason, correction_text: correction.trim() || null,
        source_verified: sourceVerified, replace_transcript: replaceTranscript, ...(sourceVerified ? { transcript_language:transcriptLanguage } : {}) }
      // Keep a failed write's exact expected revision for safe retry.
      const serialized = JSON.stringify(body)
      if (pending.current?.body !== serialized) pending.current = { body: serialized, key: crypto.randomUUID() }
      const result = await apiRequest<Review>(`/v1/submissions/${id}/reviews`, { token, method: 'POST', body, idempotencyKey: pending.current.key })
      setReviews(items => [result, ...items.filter(item => item.id !== result.id)]); setReason(''); setCorrection(''); pending.current = null
      setSourceVerified(false); setReplaceTranscript(false)
      if (result.correction_revision_id) setExpectedRevision(result.correction_revision_id)
      setSaved(result.correction_revision_id ? 'Correction saved as a new revision. A fresh assessment is queued.' : 'Review saved.'); onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the review.') }
    finally { setBusy(false) }
  }
  return <section className="tool-panel"><div className="tool-heading"><ClipboardCheck size={20} /><h3>Your review</h3></div><form onSubmit={e => { void submit(e) }}><fieldset disabled={busy}>
    <label>Recommended next step<select value={outcome} onChange={e => setOutcome(e.target.value as Outcome)}>{[['reviewed', 'Review complete'], ['needs_clarification', 'Ask for clarification'], ['deeper_evaluation', 'Deeper evaluation'], ['mentoring', 'Business mentoring'], ['skilling', 'Skills support']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Reason<textarea required minLength={5} maxLength={4000} rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain your decision using the original evidence." /></label>
    <details><summary>Check or correct the transcript</summary><p className="field-note">Compare every relevant answer and figure with the original file. A correction or transcript verification creates a new revision for reassessment; previous results and decisions remain in history.</p><label>Correction or complete corrected business transcript<textarea minLength={5} maxLength={6000} rows={4} value={correction} onChange={e => setCorrection(e.target.value)} /></label>
      <label className="consent"><input type="checkbox" checked={sourceVerified} onChange={e => { setSourceVerified(e.target.checked); if (!e.target.checked) setReplaceTranscript(false) }} /><span>I checked the complete business transcript against the original, including language, financial figures and overwritten answers. This verifies the transcription, not the business claims.</span></label>
      <label>Reviewed transcript language<select aria-label="Reviewed transcript language" disabled={!sourceVerified} value={transcriptLanguage} onChange={e=>setTranscriptLanguage(e.target.value)}>{[["en","English"],["hi","Hindi"],["mr","Marathi ? fluent reviewer required"],["te","Telugu ? fluent reviewer required"],["bn","Bengali ? fluent reviewer required"],["or","Odia ? fluent reviewer required"]].map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label><label className="consent"><input type="checkbox" disabled={!sourceVerified || correction.trim().length < 5} checked={replaceTranscript} onChange={e => setReplaceTranscript(e.target.checked)} /><span>Use my correction as the complete business transcript for the new version. Keep the original in history.</span></label></details>
    <button className="primary-link" type="submit" disabled={!expectedRevision}>{busy ? 'Saving review…' : 'Save review'}</button></fieldset></form>
    {error && <p role="alert" className="form-error">{error}</p>}{saved && <p role="status" className="form-message">{saved}</p>}
    {reviews.length > 0 && <details><summary>Review history ({reviews.length})</summary>{reviews.map(review => <article key={review.id} className="review-entry"><strong>{review.outcome.replaceAll('_', ' ')}</strong><p>{review.reason}</p><small>{new Date(review.created_at).toLocaleString()}{review.correction_revision_id ? ' · correction revision created' : ''}</small></article>)}</details>}
  </section>
}
