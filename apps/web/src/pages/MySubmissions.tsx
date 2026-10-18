import { useI18n } from '../i18n/I18nProvider'
import { useEffect, useRef, useState } from 'react'
import { RefreshCw, ChartNoAxesCombined, LayoutGrid, MapPin, MessageCircle, History, FileText, AudioLines, File } from 'lucide-react'
import { apiRequest, ApiError, type Assessment, type JobView } from '../api/client'
import type { components } from '../api/generated/schema'
import { AssessmentView } from '../components/AssessmentView'
import { Clarifications } from '../components/Clarifications'
import { SimilarIdeas } from '../components/SimilarIdeas'
import { ExplanationPanel } from '../components/ExplanationPanel'
import { LocalContext } from '../components/LocalContext'
import { ArithmeticChecks } from '../components/ArithmeticChecks'
import { VersionHistory } from '../components/VersionHistory'
import { DeleteSubmission } from '../components/DeleteSubmission'
import { BusinessBlueprint } from '../components/BusinessBlueprint'
import { ScenarioPlanner } from '../components/ScenarioPlanner'
import { KeptPanel } from '../components/KeptPanel'
import { ScreeningBrief } from '../components/ScreeningBrief'

export type Submission = components['schemas']['SubmissionView']
const finished = new Set(['completed', 'partial', 'needs_review', 'failed', 'cancelled'])
const waiting = new Set(['waiting_for_worker', 'waiting_for_runtime', 'quota_exhausted'])
const stageNames: Record<string, string> = { 'extract:pdf': 'Reading the original', translate: 'Preparing the English rendering', structure: 'Organizing business facts', assess: 'Assessing the evidence' }
const names: Record<string, string> = { queued: 'Saved · queued', extracting: 'Reading the original', translating: 'Preparing the English rendering',
  structuring: 'Organizing business facts', assessing: 'Assessing the evidence', enriching: 'Adding context', completed: 'Assessment saved',
  partial: 'Partial result saved', needs_review: 'Needs review', waiting_for_worker: 'Waiting for the owned worker', waiting_for_runtime: 'Waiting for processing capacity',
  quota_exhausted: 'Processing allowance unavailable', failed: 'Processing stopped', cancelled: 'Processing cancelled' }

export function MySubmissions({ items, selectedId, onSelect, token, refresh, active = true }: {
  items: Submission[]; selectedId: string | null; onSelect: (id: string) => void; token: string; refresh: () => void; active?: boolean
}) {
  const { t } = useI18n()
  const [recent, setRecent] = useState<string[]>(selectedId ? [selectedId] : [])
  if (selectedId && recent[0] !== selectedId) setRecent([selectedId, ...recent.filter(id => id !== selectedId)].slice(0, 3))
  return <section className="my-submissions" aria-labelledby="my-submissions-title"><div className="list-heading"><div><span className="eyebrow">{t("SAVED IN YOUR WORKSPACE")}</span><h2 id="my-submissions-title">{t("My submissions")}</h2></div><button type="button" className="secondary-button" onClick={refresh}><RefreshCw size={15} />{t("Refresh list")}</button></div>
    <p className="field-note">{t("Latest 20 submissions. Your accepted ideas and progress stay saved after refresh or sign-out.")}</p>
    {items.length === 0 ? <p className="empty-state">{t("Your saved ideas will appear here.")}</p> : <div className="submission-list">{items.map(item => { const Icon = item.input_kind === 'text' ? FileText : item.input_kind === 'pdf' ? File : AudioLines; return <button type="button" key={item.id} data-submission-id={item.id} className={selectedId === item.id ? 'selected' : ''} aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}><Icon size={21} /><strong>{item.input_kind === 'text' ? t("Written idea") : item.input_kind === 'pdf' ? t("PDF idea") : t("Audio idea")}</strong><span>{new Date(item.created_at).toLocaleString()}</span><small>{t(names[item.status] || t("Saved"))} · {item.preferred_language}{item.synthetic ? ' · Rehearsal' : ''}</small></button> })}</div>}
    {selectedId && items.find(item => item.id === selectedId)?.synthetic && <p className="form-message" role="note">{t("Synthetic rehearsal input. This fictional example is excluded from ordinary population comparisons.")}</p>}
    {recent.map(id => <div key={id} hidden={id !== selectedId}><SubmissionDetail id={id} token={token} onFinished={refresh} active={active && id === selectedId} /></div>)}
  </section>
}

export function SubmissionDetail({ id, token, onFinished, canClarify = true, active = true }: { id: string; token: string; onFinished: () => void; canClarify?: boolean; active?: boolean }) {
  const { t } = useI18n()
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [job, setJob] = useState<JobView | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [numbers, setNumbers] = useState<components['schemas']['Economics'] | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [removed, setRemoved] = useState(false)
  const [tool, setTool] = useState('overview')
  const operation = useRef<AbortController | null>(null)
  const previousState = useRef<string | null>(null)
  useEffect(() => {
    if (!active || removed) return
    const controller = new AbortController()
    let timer: number | undefined
    let disposed = false
    let inFlight = false
    const started = Date.now()
    setError(''); setNote(t("Checking for saved updates…"))
    async function check() {
      if (disposed || inFlight) return
      inFlight = true
      if (!disposed) setChecking(true)
      try {
        if (document.hidden || Date.now() - started > 30 * 60_000) {
          if (!disposed) setNote(t("Automatic updates paused. Use Refresh status when you are ready."))
          return
        }
        const snapshot = await apiRequest<components['schemas']['SubmissionWorkspace']>(`/v1/submissions/${id}/workspace`, { token, signal: controller.signal })
        if (disposed) return
        const current = snapshot.submission
        const stateKey = `${current.revision_id}:${current.status}`
        const changed = previousState.current !== null && previousState.current !== stateKey
        previousState.current = stateKey
        setSubmission(current)
        setAssessment(previous => previous?.id === snapshot.assessment?.id ? previous : snapshot.assessment)
        setNumbers(snapshot.economics || null)
        if (finished.has(current.status)) {
          setJob(null)
          if (changed) onFinished()
          setNote(current.status === 'needs_review' ? t("Your original is saved. Processing needs review.") : snapshot.assessment ? t("Saved result retrieved. No model processing is needed to open it.") : `No assessment is saved for this revision. ${names[current.status] || t("Check the processing state")}.`)
          return
        }
        const state = await apiRequest<JobView>(`/v1/jobs/${current.job_id}`, { token, signal: controller.signal })
        if (disposed) return
        setSubmission(current); setJob(state)
        if (finished.has(state.status)) {
          // Publication may have completed after the snapshot; fetch its coherent result.
          timer = window.setTimeout(() => { void check() }, 0)
          return
        }
        if (waiting.has(state.status)) { setNote(`${current.input_kind === 'pdf' ? t("Your original upload is saved.") : t("Your idea is safely queued.")} Start or resume the owned worker, then refresh status. Automatic updates are paused.`); return }
        setNote(state.status === 'queued'
          ? t("Saved and queued. The laptop processes one idea at a time; queue wait is additional. Recent measured short text examples took about 1½–2½ minutes. You can return later.")
          : t("Local models are reading and assessing your idea. Recent measured short text examples took about 1½–2½ minutes; audio, scans, translation and longer inputs can take longer. You can use other tabs while work continues."))
        timer = window.setTimeout(() => { void check() }, Math.min(30, Math.max(3, state.retry_after_seconds || 3)) * 1000)
      } catch (failure) {
        if (!disposed && !controller.signal.aborted) {
          if (failure instanceof ApiError && [401, 403, 404].includes(failure.status || 0)) { setAssessment(null); setSubmission(null) }
          setError(failure instanceof Error ? failure.message : t("Could not retrieve saved state.")); setNote(t("Use Refresh status to try again. Your saved submission is unchanged."))
        }
      } finally { inFlight = false; if (!disposed) setChecking(false) }
    }
    void check()
    // Returning to a browser tab resumes status checks without discarding the page.
    const visible = () => { if (!document.hidden) { window.clearTimeout(timer); void check() } }
    document.addEventListener('visibilitychange', visible)
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer); document.removeEventListener('visibilitychange', visible) }
  }, [id, token, refresh, onFinished, active, removed])
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
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : t("Could not update processing state.")) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  async function download() {
    if (!submission?.attachment_id || busy) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(true); setError('')
    try {
      const base = import.meta.env.VITE_API_BASE_URL as string | undefined
      if (!base) throw new Error(t("The workspace API is not configured."))
      const response = await fetch(`${base.replace(/\/$/, '')}/v1/uploads/${submission.attachment_id}/content`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      if (!response.ok) throw new Error(t("The original could not be retrieved. Check your session and retry."))
      const url = URL.createObjectURL(await response.blob())
      if (!controller.signal.aborted) {
        const link = document.createElement('a')
        link.href = url; link.download = submission.input_kind === 'pdf' ? 'idea-original.pdf' : 'idea-original-audio'
        link.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : t("Download failed.")) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  if (removed) return <p role="status" className="form-message">{t("Idea deleted. Its originals and all derived versions have been removed.")}</p>
  return <div className="submission-detail"><details className="processing-disclosure" open={!assessment}><summary>{t("Saved processing status ·")} {job ? t(names[job.status] || job.status) : submission ? t(names[submission.status] || submission.status) : t("Loading…")}</summary><div className="detail-heading"><h3>{t("Processing journey")}</h3><button className="secondary-button" type="button" disabled={busy || checking} onClick={() => setRefresh(value => value + 1)}>{t("Refresh status")}</button></div>
    <p className="processing-status" role="status">{job ? t(names[job.status] || job.status) : t("Loading…")}</p>
    {job && <><progress aria-label={t("Completed processing stages")} value={job.completed_stages} max={job.total_stages} /><p className="field-note">{job.completed_stages} {t("of")} {job.total_stages} {t("processing stages saved.")} {job.error?.message}</p></>}
    {job?.stage_progress && <div className="stage-progress" role="status"><strong>{t(stageNames[job.stage_progress.stage] || job.stage_progress.stage)}</strong><p>{job.stage_progress.completed}{job.stage_progress.total ? ` / ${job.stage_progress.total}` : ''} {t(job.stage_progress.unit)} {t('saved within this stage')}. {t('Steps take different amounts of time. The counter advances after a safe checkpoint, not every generated word.')}</p></div>}
    {job && <p className="field-note">{t('Time since saved, including queue')}: {Math.floor((job.elapsed_seconds ?? 0) / 60)}m {(job.elapsed_seconds ?? 0) % 60}s. {t('Digital PDFs with many short lines can require more model batches than plain text. Scans require extra OCR time per page.')}</p>}
    <p className="field-note">{note}</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {submission && <div className="job-actions">{!finished.has(job?.status || submission.status) && <button className="secondary-button" type="button" disabled={busy} onClick={() => { void control(false) }}>{t("Cancel processing")}</button>}
      {(['failed', 'cancelled', 'needs_review'].includes(job?.status || submission.status) || waiting.has(job?.status || submission.status)) && <button className="secondary-button" type="button" disabled={busy} onClick={() => { void control(true) }}>{t("Resume processing")}</button>}
      {submission.attachment_id && <button className="secondary-button" type="button" disabled={busy} onClick={() => { void download() }}>{t("Download original")}</button>}</div>}
    </details>
    {assessment && <><nav className="idea-tool-nav" aria-label={t("Idea tools")}>{[
      { id: 'overview', label: t("Assessment"), icon: ChartNoAxesCombined },
      { id: 'plan', label: t("Business plan"), icon: LayoutGrid },
      { id: 'market', label: t("Explore market"), icon: MapPin },
      ...(canClarify ? [{ id: 'questions', label: t("Next steps"), icon: MessageCircle }] : []),
      { id: 'history', label: t("Versions & privacy"), icon: History },
    ].map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={tool === id} onClick={() => setTool(id)}><Icon size={17} />{label}</button>)}</nav>
      <KeptPanel key={`overview:${assessment.id}`} active={tool === 'overview'}><ScreeningBrief value={assessment} numbers={numbers?.assessment_id === assessment.id ? numbers : null} idPrefix={`${id}-`} onNext={() => setTool(canClarify ? 'questions' : 'plan')} /><AssessmentView value={assessment} idPrefix={`${id}-`} /><ExplanationPanel value={assessment} token={token} idPrefix={`${id}-`} /></KeptPanel>
      <KeptPanel key={`plan:${assessment.id}`} active={tool === 'plan'}><BusinessBlueprint value={assessment} onQuestions={() => setTool(canClarify ? 'questions' : 'overview')} /><ScenarioPlanner value={assessment} /><ArithmeticChecks value={assessment} token={token} /></KeptPanel>
      <KeptPanel key={`market:${assessment.id}`} active={tool === 'market'}><SimilarIdeas value={assessment} token={token} /><LocalContext value={assessment} token={token} /></KeptPanel>
      {canClarify && <KeptPanel key={`questions:${assessment.id}`} active={tool === 'questions'}><Clarifications value={assessment} token={token} preferredLanguage={submission?.preferred_language} active={active && tool === 'questions'} onReassess={() => { setTool('history'); setAssessment(null); setRefresh(n => n + 1); onFinished() }} /></KeptPanel>}
    </>}
    <KeptPanel active={!!submission && (!assessment || tool === 'history')}>{submission?.source_text && <details><summary>{t("Your original submitted text")}</summary><p className="original-text">{submission.source_text}</p></details>}
      {submission?.attachment_id && <button className="secondary-button" type="button" disabled={busy} onClick={() => { void download() }}>{t("Download original")}</button>}
      {submission && <VersionHistory key={`history:${submission.revision_id}`} id={id} current={assessment} token={token} />}
      {canClarify && submission && <DeleteSubmission id={id} revision={submission.revision_id} token={token} onDeleted={() => { setRemoved(true); setAssessment(null); setSubmission(null); setJob(null); onFinished() }} />}
    </KeptPanel>
  </div>
}
