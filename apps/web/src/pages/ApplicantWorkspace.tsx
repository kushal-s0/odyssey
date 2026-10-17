import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { apiRequest } from '../api/client'
import { SubmitIdea } from './SubmitIdea'
import { MySubmissions, type Submission } from './MySubmissions'

export function ApplicantWorkspace() {
  const { actor, session } = useAuth()
  if (!actor || !session) return null
  return <PrivateWorkspace key={actor.id} actor={actor} token={session.access_token} />
}

function PrivateWorkspace({ actor, token }: { actor: NonNullable<ReturnType<typeof useAuth>['actor']>; token: string }) {
  const [items, setItems] = useState<Submission[]>([])
  const [error, setError] = useState('')
  const key = `udyam:selected:${actor.id}`
  const [selectedId, setSelectedId] = useState<string | null>(() => { try { return sessionStorage.getItem(key) } catch { return null } })
  const [reload, setReload] = useState(0)
  const refresh = useCallback(() => setReload(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Submission[]>('/v1/submissions?limit=20' as `/v1/${string}`, { token, signal: controller.signal })
      .then(values => { if (!controller.signal.aborted) { setItems(values); setError('') } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Saved submissions could not be retrieved.') })
    return () => controller.abort()
  }, [token, reload])
  function select(id: string) {
    setSelectedId(id)
    try { sessionStorage.setItem(key, id) } catch { /* selection still works in memory */ }
  }
  return <><div className="workspace-heading"><span className="eyebrow">YOUR PRIVATE WORKSPACE</span><h1>Your idea,<br /><em>in your words.</em></h1><p>Share what you know. Keep the original story. Find the next useful question.</p></div>
    <SubmitIdea actor={actor} token={token} onAccepted={value => { select(value.submission_id); refresh() }} />
    {error && <p role="alert" className="form-error">{error} <button className="text-button" type="button" onClick={refresh}>Retry loading submissions</button></p>}
    <MySubmissions items={items} selectedId={selectedId} onSelect={select} token={token} refresh={refresh} />
  </>
}
