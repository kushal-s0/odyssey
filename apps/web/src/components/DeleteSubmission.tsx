import { useI18n } from '../i18n/I18nProvider'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { apiRequest } from '../api/client'

export function DeleteSubmission({ id, revision, token, onDeleted }: { id:string; revision:string; token:string; onDeleted:()=>void }) {
  const { t } = useI18n()
  const [confirmed,setConfirmed]=useState(false)
  const [busy,setBusy]=useState(false)
  const [pending,setPending]=useState(false)
  const [error,setError]=useState('')
  async function remove() {
    if (busy || (!confirmed && !pending)) return
    setBusy(true);setError('')
    try {
      const result=await apiRequest<{status:'deleted'|'cleanup_pending'}>(`/v1/submissions/${id}`, {
        token,method:'DELETE',body:{expected_revision_id:revision} })
      if (result.status==='deleted') onDeleted()
      else setPending(true)
    } catch (e) { setError(e instanceof Error ? e.message : t("Deletion could not finish. Retry shortly.")) }
    finally { setBusy(false) }
  }
  return <details className="tool-panel"><summary>{t("Delete this idea and its private data")}</summary>
    <p>{t("Delete the original files, all versions, extracted facts, assessments, reviews and saved context. This permanently removes the idea from your workspace.")}</p>
    {!pending && <label className="consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} /><span>{t("I want to permanently delete this idea and all its versions.")}</span></label>}
    {pending && <p role="status">{t("Access is removed and processing is cancelled. Private file cleanup is still pending; retry to finish it.")}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="secondary-button" disabled={busy || (!confirmed && !pending)} onClick={()=>{void remove()}}><Trash2 size={16} />{busy ? t("Removing private data…") : pending ? t("Retry private file cleanup") : t("Permanently delete idea")}</button>
  </details>
}
