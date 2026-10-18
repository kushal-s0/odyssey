import { useEffect, useRef, useState } from 'react'
import { History, Printer, Download, X } from 'lucide-react'
import { apiRequest, type Assessment } from '../api/client'
import type { components } from '../api/generated/schema'
import { AssessmentView } from './AssessmentView'

type Revision = components['schemas']['RevisionView']
export function VersionHistory({ id, current, token }: { id: string; current: Assessment | null; token: string }) {
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [version, setVersion] = useState('')
  const [previous, setPrevious] = useState<Assessment | null>(null)
  const [html, setHtml] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Revision[]>(`/v1/submissions/${id}/history`, { token, signal: controller.signal }).then(setRevisions)
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Version history unavailable.') })
    return () => controller.abort()
  }, [id, current?.id, token, reload])
  useEffect(() => {
    if (!version) return
    const controller = new AbortController()
    apiRequest<Assessment>(`/v1/submissions/${id}/assessment?version=${version}`, { token, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setPrevious(data); setError('') } })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Historical assessment unavailable.') })
    return () => controller.abort()
  }, [version, id, token])
  const selected = version ? previous : current
  const selectedRevision = revisions.find(r => r.assessment_version === selected?.version)
  async function downloadOriginal() {
    if (!selectedRevision?.attachment_id || busy) return
    setBusy(true); setError('')
    try {
      const base = import.meta.env.VITE_API_BASE_URL as string | undefined
      if (!base) throw new Error('Workspace API unavailable.')
      const response = await fetch(`${base.replace(/\/$/,'')}/v1/uploads/${selectedRevision.attachment_id}/content`, {
        headers:{ Authorization:`Bearer ${token}` }, signal:AbortSignal.timeout(30000) })
      if (!response.ok) throw new Error('Could not retrieve this version’s private original.')
      const url = URL.createObjectURL(await response.blob())
      const link=document.createElement('a');link.href=url;link.download=`idea-original-revision-${selectedRevision.revision_number}${selectedRevision.input_kind === 'pdf' ? '.pdf' : '-audio'}`;link.click()
      window.setTimeout(() => URL.revokeObjectURL(url),1000)
    } catch (e) { setError(e instanceof Error ? e.message : 'Original download unavailable.') }
    finally { setBusy(false) }
  }
  async function report() {
    if (!selected || busy) return
    setBusy(true); setError('')
    try {
      const base = import.meta.env.VITE_API_BASE_URL as string | undefined
      if (!base) throw new Error('Workspace API unavailable.')
      const response = await fetch(`${base.replace(/\/$/,'')}/v1/submissions/${id}/report?version=${selected.version}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) })
      if (!response.ok) throw new Error('Could not retrieve this report. Check your session and retry.')
      setHtml(await response.text())
    } catch (e) { setError(e instanceof Error ? e.message : 'Report unavailable.') }
    finally { setBusy(false) }
  }
  const changes = current && previous ? Object.entries(current.business).filter(([key, field]) => {
    if (!field || typeof field !== 'object' || !('status' in field)) return false
    const old = previous.business[key as keyof typeof previous.business]
    return JSON.stringify(field) !== JSON.stringify(old)
  }).map(([key]) => key.replaceAll('_',' ')) : []
  return <section className="tool-panel"><div className="tool-heading"><History size={20} /><h3>Versions & report</h3></div><p className="field-note">Every revision keeps its original evidence and earlier decisions. Choose a saved assessment to inspect or export it.</p>
    <div className="version-toolbar"><label>Assessment version<select aria-label="Assessment version" value={version} onChange={e => { setPrevious(null); setVersion(e.target.value) }}><option value="">{current ? `Current assessment · v${current.version}` : 'Select a saved assessment'}</option>{revisions.filter(r => r.assessment_version !== null && r.assessment_version !== current?.version).map(r => <option key={r.id} value={r.assessment_version!}>v{r.assessment_version} · input revision {r.revision_number} · {new Date(r.created_at).toLocaleDateString()}</option>)}</select></label><button disabled={!selected || busy} className="secondary-button" onClick={() => { void report() }}><Printer size={16} />{busy ? 'Preparing report…' : 'View & print report'}</button></div>
    {selectedRevision?.attachment_id && <button className="secondary-button" disabled={busy} onClick={() => { void downloadOriginal() }}><Download size={16} />Download original for selected version</button>}
    {error && <p role="alert" className="form-error">{error}<button className="text-button" onClick={() => setReload(n => n + 1)}>Retry history</button></p>}
    {revisions.length > 0 && <small>{revisions.length} input revision(s) · {revisions.filter(r => r.assessment_version !== null).length} saved assessment(s). Versions still processing are not shown as completed assessments.</small>}
    {version && previous && <><div className="version-diff"><strong>Historical version {previous.version}</strong><p>Created {new Date(previous.created_at).toLocaleString()}. This is a saved earlier result.</p>{current && <><dl><div><dt>Potential</dt><dd>{previous.scores.headline_potential ?? 'Withheld'} → {current.scores.headline_potential ?? 'Withheld'}</dd></div><div><dt>Completeness</dt><dd>{previous.scores.completeness_percent}% → {current.scores.completeness_percent}%</dd></div><div><dt>Coverage</dt><dd>{(Number(previous.scores.evidence_coverage)*100).toFixed(0)}% → {(Number(current.scores.evidence_coverage)*100).toFixed(0)}%</dd></div></dl><p>Fields with changed values, status or evidence: {changes.length ? changes.join(', ') : 'None'}.</p></>}</div><details><summary>Inspect this historical assessment</summary><AssessmentView value={previous} idPrefix="historical-" /></details></>}
    {html && selected && <ReportPreview html={html} version={selected.version} onClose={() => setHtml('')} />}
  </section>
}

function ReportPreview({ html, version, onClose }: { html: string; version: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close() }, [])
  function download() {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `udyam-saathi-assessment-v${version}.html`; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <dialog ref={dialog} className="report-dialog" onCancel={event => { event.preventDefault(); onClose() }} aria-label={`Assessment report version ${version}`}><div className="report-actions"><strong>Assessment report · v{version}</strong><button className="secondary-button" onClick={() => frame.current?.contentWindow?.print()}><Printer size={16} />Print / save PDF</button><button className="secondary-button" onClick={download}><Download size={16} />HTML</button><button className="secondary-button" onClick={onClose} aria-label="Close report"><X size={18} /></button></div><iframe ref={frame} title="Printable assessment report" srcDoc={html} sandbox="allow-same-origin allow-modals" /></dialog>
}
