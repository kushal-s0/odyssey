import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { apiRequest } from '../api/client'
import { SubmitIdea } from './SubmitIdea'
import { MySubmissions, type Submission } from './MySubmissions'
import { ArrowUpRight, FolderOpen, Plus, Sparkles, ShieldCheck, Clock3 } from 'lucide-react'

export function ApplicantWorkspace({ active = true }: { active?: boolean }) {
  const { actor, session } = useAuth()
  if (!actor || !session) return null
  return <PrivateWorkspace key={actor.id} actor={actor} token={session.access_token} active={active} />
}

function PrivateWorkspace({ actor, token, active }: { actor: NonNullable<ReturnType<typeof useAuth>['actor']>; token: string; active: boolean }) {
  const [items, setItems] = useState<Submission[]>([])
  const [error, setError] = useState('')
  const key = `udyam:selected:${actor.id}`
  const [selectedId, setSelectedId] = useState<string | null>(() => { try { return sessionStorage.getItem(key) } catch { return null } })
  const [reload, setReload] = useState(0)
  const [view, setView] = useState<'saved' | 'create'>('saved')
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
  const ready = items.filter(item => ['completed', 'partial'].includes(item.status)).length
  const processing = items.filter(item => !['completed', 'partial', 'failed', 'cancelled', 'needs_review'].includes(item.status)).length
  return <div className="idea-workspace"><div className="workspace-heading workspace-hero"><div><span className="eyebrow"><Sparkles size={14} /> YOUR ENTREPRENEURSHIP STUDIO</span><h1>Your idea,<br /><em>with a way forward.</em></h1><p>Turn what you know into a clearer business plan. See the evidence, explore the numbers, and find your next useful step.</p></div><div className="hero-path" aria-label="Your idea journey"><span><i>01</i>Share your story</span><span><i>02</i>Understand the evidence</span><span><i>03</i>Build your next version <ArrowUpRight size={17} /></span><p><ShieldCheck size={15} /> Private originals. Traceable insights.</p></div></div>
    <div className="workspace-metrics" aria-label="Latest saved idea activity"><article><FolderOpen size={20} /><div><strong>{items.length}</strong><span>Saved ideas</span></div></article><article><Sparkles size={20} /><div><strong>{ready}</strong><span>Results available</span></div></article><article><Clock3 size={20} /><div><strong>{processing}</strong><span>Queued or processing</span></div></article><p>Activity in your latest 20 submissions. Assessment supports human review.</p></div>
    <div className="studio-toolbar"><div className="studio-switch" role="group" aria-label="Idea workspace view"><button type="button" aria-pressed={view === 'saved'} onClick={() => setView('saved')}><FolderOpen size={17} />Saved ideas</button><button type="button" aria-pressed={view === 'create'} onClick={() => setView('create')}><Plus size={17} />New idea</button></div><span className="field-note">A business plan can begin with a question.</span></div>
    <div hidden={view !== 'create'}><SubmitIdea actor={actor} token={token} active={active && view === 'create'} onAccepted={value => { select(value.submission_id); setView('saved'); refresh() }} /></div>
    {error && <p role="alert" className="form-error">{error} <button className="text-button" type="button" onClick={refresh}>Retry loading submissions</button></p>}
    <div hidden={view !== 'saved'}>{items.length === 0 && !error && <aside className="start-card"><Sparkles size={28} /><div><h2>Small beginnings. A clearer next step.</h2><p>Write, speak, upload a plan, or let a few questions guide you.</p></div><button className="primary-link" type="button" onClick={() => setView('create')}>Create your first idea<ArrowUpRight size={16} /></button></aside>}<MySubmissions items={items} selectedId={selectedId} onSelect={select} token={token} refresh={refresh} active={active && view === 'saved'} /></div>
  </div>
}
