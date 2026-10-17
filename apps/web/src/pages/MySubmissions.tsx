import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { apiRequest, ApiError, type Assessment, type JobView } from '../api/client'
import type { components } from '../api/generated/schema'
import { AssessmentView } from '../components/AssessmentView'
import { Clarifications } from '../components/Clarifications'
import { SimilarIdeas } from '../components/SimilarIdeas'
import { ExplanationPanel } from '../components/ExplanationPanel'
import { LocalContext } from '../components/LocalContext'
import { ArithmeticChecks } from '../components/ArithmeticChecks'
import { VersionHistory } from '../components/VersionHistory'

export type Submission = components['schemas']['SubmissionView']
const finished = new Set(['completed', 'partial', 'needs_review', 'failed', 'cancelled'])
const waiting = new Set(['waiting_for_worker', 'waiting_for_runtime', 'quota_exhausted'])
const names: Record<string, string> = { queued: 'Saved · queued', extracting: 'Reading the original', translating: 'Preparing the English rendering',
  structuring: 'Organizing business facts', assessing: 'Assessing the evidence', enriching: 'Adding context', completed: 'Assessment saved',
  partial: 'Partial result saved', needs_review: 'Needs review', waiting_for_worker: 'Waiting for the owned worker', waiting_for_runtime: 'Waiting for processing capacity',
  quota_exhausted: 'Processing allowance unavailable', failed: 'Processing stopped', cancelled: 'Processing cancelled' }

export function MySubmissions({ items, selectedId, onSelect, token, refresh }: {
  items: Submission[]; selectedId: string | null; onSelect: (id: string) => void; token: string; refresh: () => void
}) {
  return <section className="my-submissions" aria-labelledby="my-submissions-title"><div className="list-heading"><div><span className="eyebrow">SAVED IN YOUR WORKSPACE</span><h2 id="my-submissions-title">My submissions</h2></div><button type="button" className="secondary-button" onClick={refresh}><RefreshCw size={15} />Refresh list</button></div>
    <p className="field-note">Latest 20 submissions. Your accepted ideas and progress stay saved after refresh or sign-out.</p>
    {items.length === 0 ? <p className="empty-state">Your saved ideas will appear here.</p> : <div className="submission-list">{items.map(item => <button type="button" key={item.id} className={selectedId === item.id ? 'selected' : ''} aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}><strong>{item.input_kind === 'text' ? 'Written idea' : item.input_kind === 'pdf' ? 'PDF idea' : 'Audio idea'}</strong><span>{new Date(item.created_at).toLocaleString()}</span><small>{names[item.status] || 'Saved'} · {item.preferred_language}</small></button>)}</div>}
    {selectedId && <SubmissionDetail key={selectedId} id={selectedId} token={token} onFinished={refresh} />}
  </section>
}

export function SubmissionDetail({ id, token, onFinished, canClarify = true }: { id: string; token: string; onFinished: () => void; canClarify?: boolean }) {
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [job, setJob] = useState<JobView | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const operation = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined
    let disposed = false
    const started = Date.now()
    setError(''); setAssessment(null); setNote('Checking saved processing state…')
    async function check() {
      if (!disposed) setChecking(true)
      try {
        if (document.hidden || Date.now() - started > 300_000) {
          if (!disposed) setNote('Automatic updates paused. Use Refresh status when you are ready.')
          return
        }
        const current = await apiRequest<Submission>(`/v1/submissions/${id}`, { token, signal: controller.signal })
        const state = await apiRequest<JobView>(`/v1/jobs/${current.job_id}`, { token, signal: controller.signal })
        if (disposed) return
        setSubmission(current); setJob(state)
        if (finished.has(state.status)) {
          onFinished()
          if (['completed', 'partial'].includes(state.status)) {
            try {
              const result = await apiRequest<Assessment>(`/v1/submissions/${id}/assessment`, { token, signal: controller.signal })
              if (!disposed) setAssessment(result)
            } catch (failure) {
              if (!(failure instanceof ApiError && failure.status === 404)) throw failure
              if (!disposed) setNote('No assessment is available for this revision yet.')
              return
            }
          }
          if (!disposed) setNote(state.status === 'needs_review' ? 'Your original is saved. Processing needs review; retry may still require human help.' : 'Saved state retrieved from your workspace.')
          return
        }
        if (waiting.has(state.status)) { setNote(`${current.input_kind === 'pdf' ? 'Your original upload is saved.' : 'Your idea is safely queued.'} Start or resume the owned worker, then refresh status. Automatic updates are paused.`); return }
        setNote(state.status === 'queued'
          ? 'Saved and queued. The laptop processes one idea at a time. You can return later; your work stays saved.'
          : 'Processing on the local worker. Model results can take several minutes. Automatic updates pause after five minutes or when this page is hidden; use Refresh status to continue.')
        timer = window.setTimeout(() => { void check() }, Math.min(30, Math.max(3, state.retry_after_seconds || 3)) * 1000)
      } catch (failure) {
        if (!disposed && !controller.signal.aborted) { setError(failure instanceof Error ? failure.message : 'Could not retrieve saved state.'); setNote('Use Refresh status to try again. Your saved submission is unchanged.') }
      } finally { if (!disposed) setChecking(false) }
    }
    void check()
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer) }
  }, [id, token, refresh, onFinished])
  useEffect(() => () => operation.current?.abort(), [])
  async function control(resume: boolean) {
    if (!submission || busy) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(true); setError('')
    try {
      const value = await apiRequest<JobView>(`/v1/jobs/${submission.job_id}/${resume ? 'resume' : 'cancel'}`, { token, method: 'POST', signal: controller.signal,
        ...(resume ? { body: { expected_revision_id: submission.revision_id } } : {}) })
      if (!controller.signal.aborted) { setJob(value); setRefresh(value => value + 1) }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not update processing state.') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  async function download() {
    if (!submission?.attachment_id || busy) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(true); setError('')
    try {
      const base = import.meta.env.VITE_API_BASE_URL as string | undefined
      if (!base) throw new Error('The workspace API is not configured.')
      const response = await fetch(`${base.replace(/\/$/, '')}/v1/uploads/${submission.attachment_id}/content`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      if (!response.ok) throw new Error('The original could not be retrieved. Check your session and retry.')
      const url = URL.createObjectURL(await response.blob())
      if (!controller.signal.aborted) {
        const link = document.createElement('a')
        link.href = url; link.download = submission.input_kind === 'pdf' ? 'idea-original.pdf' : 'idea-original-audio'
        link.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Download failed.') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <div className="submission-detail"><div className="detail-heading"><h3>Saved processing status</h3><button className="secondary-button" type="button" disabled={busy || checking} onClick={() => setRefresh(value => value + 1)}>Refresh status</button></div>
    <p className="processing-status" role="status">{job ? names[job.status] || job.status : 'Loading…'}</p>
    {job && <><progress aria-label="Completed processing stages" value={job.completed_stages} max={job.total_stages} /><p className="field-note">{job.completed_stages} of {job.total_stages} processing stages saved. {job.error?.message}</p></>}
    <p className="field-note">{note}</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {submission && job && <div className="job-actions">{!finished.has(job.status) && <button className="secondary-button" type="button" disabled={busy} onClick={() => { void control(false) }}>Cancel processing</button>}
      {(['failed', 'cancelled', 'needs_review'].includes(job.status) || waiting.has(job.status)) && <button className="secondary-button" type="button" disabled={busy} onClick={() => { void control(true) }}>Resume processing</button>}
      {submission.attachment_id && <button className="secondary-button" type="button" disabled={busy} onClick={() => { void download() }}>Download original</button>}</div>}
    {submission?.source_text && <details><summary>Your original submitted text</summary><p className="original-text">{submission.source_text}</p></details>}
    {assessment && <><AssessmentView key={assessment.id} value={assessment} /><ExplanationPanel key={`explain:${assessment.id}`} value={assessment} token={token} /><ArithmeticChecks key={`math:${assessment.id}`} value={assessment} token={token} /><SimilarIdeas key={`similar:${assessment.id}`} value={assessment} token={token} /><LocalContext key={`local:${assessment.id}`} value={assessment} token={token} />{canClarify && <Clarifications value={assessment} token={token} onReassess={() => { setAssessment(null); setRefresh(n => n + 1); onFinished() }} />}</>}
    {submission && <VersionHistory key={`history:${submission.revision_id}`} id={id} current={assessment} token={token} />}
  </div>
}
