import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowUpRight, AudioLines, FileText, Leaf, ShieldCheck, Sprout } from 'lucide-react'
import { AccountMenu } from './auth/AccountMenu'
import { useAuth } from './auth/AuthProvider'
import { ApplicantWorkspace } from './pages/ApplicantWorkspace'
import { ThemeToggle } from './components/ThemeToggle'

const AssessorWorkspace = lazy(() => import('./pages/AssessorWorkspace').then(module => ({ default: module.AssessorWorkspace })))
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })))

type Health = 'checking' | 'connected' | 'unavailable' | 'unconfigured'
const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined

export default function App() {
  const auth = useAuth()
  type Tab = 'ideas' | 'review' | 'analytics'
  const [navigation, setNavigation] = useState<{ actorId: string; tab: Tab }>({ actorId: '', tab: 'ideas' })
  const tab = navigation.actorId === auth.actor?.id ? navigation.tab : 'ideas'
  function setTab(next: Tab) { setNavigation({ actorId: auth.actor?.id || '', tab: next }) }
  const [health, setHealth] = useState<Health>(apiBase ? 'checking' : 'unconfigured')
  useEffect(() => {
    if (!apiBase) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    fetch(`${apiBase}/health/workspace`, { signal: controller.signal })
      .then(response => { setHealth(response.ok ? 'connected' : 'unavailable') })
      .catch(() => { setHealth('unavailable') })
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [auth.actor])
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="topbar">
      <a className="brand" href="/" aria-label="Udyam Saathi home"><span className="brand-mark"><Sprout size={25} /></span><span>udyam<span className="brand-light">saathi</span><small>IDEAS INTO LIVELIHOODS</small></span></a>
      <span className="topbar-label">Entrepreneurship assessment workspace</span>
      <span className="status-chip"><span className={`status-dot ${health === 'connected' ? 'online' : ''}`} />{health === 'connected' ? 'Database connected' : health === 'checking' ? 'Checking connection' : 'Workspace unavailable'}</span>
      <ThemeToggle /><AccountMenu />
    </header>
    <main id="main" className={auth.actor ? 'workspace-shell' : 'welcome'}>
      {import.meta.env.VITE_FIXTURE_MODE === 'true' && <p className="form-message" role="note">Local verification fixture: synthetic account and input. Model/provider fixtures are identified in the verification report; API and database checks run locally.</p>}
      {auth.actor && <nav className="workspace-nav" aria-label="Workspace"><button aria-current={tab !== 'analytics' && tab !== 'review' ? 'page' : undefined} onClick={() => setTab('ideas')}>{auth.actor.role === 'assessor' ? 'Review queue' : 'My ideas'}</button>{auth.actor.role === 'admin' && <button aria-current={tab === 'review' ? 'page' : undefined} onClick={() => setTab('review')}>Review queue</button>}<button aria-current={tab === 'analytics' ? 'page' : undefined} onClick={() => setTab('analytics')}>Comparisons</button></nav>}
      <Suspense fallback={<p role="status">Opening workspace…</p>}>{auth.actor && tab === 'analytics' ? <Dashboard /> : auth.actor && (auth.actor.role === 'assessor' || (auth.actor.role === 'admin' && tab === 'review')) ? <AssessorWorkspace /> : auth.actor && ['applicant', 'admin'].includes(auth.actor.role) ? <ApplicantWorkspace /> : auth.session ? <section className="submission-panel" aria-labelledby="workspace-access-heading">
        <h1 id="workspace-access-heading">{auth.loading ? 'Opening your workspace…' : auth.actor ? 'Assessor tools are still being implemented.' : 'Your workspace needs attention.'}</h1>
        <p role="status">{auth.loading ? 'Checking your signed-in account and program access.' : auth.message || 'Your login works. The assessor workspace is not available yet.'}</p>
        {!auth.loading && !auth.actor && <button className="primary-link" onClick={auth.retryWorkspace}>Retry workspace connection</button>}
        {!auth.loading && !auth.actor && <p>If access is not enabled, your coordinator must add your account to a program. You can also sign out using the button above.</p>}
      </section> : <>
      {auth.message && !auth.actor && <p className="auth-banner" role="status">{auth.message}</p>}
      <div className="eyebrow"><span /> EVERY LIVELIHOOD STARTS WITH AN IDEA</div>
      <div className="welcome-grid">
        <div><h1>See the potential.<br /><em>Understand the story.</em></h1><p className="intro">A thoughtful first step for every business idea. Understand submissions in the entrepreneur’s own words, follow the evidence, and make room for the next useful question.</p>
          <a className="primary-link" href="#workspace">Explore the workspace <ArrowUpRight size={19} /></a>
          <div className="trust-line"><ShieldCheck size={17} /> Original words preserved. Human judgment at the center.</div>
        </div>
        <div className="idea-illustration" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="paper paper-back" /><div className="paper paper-front"><span className="paper-tag">A BUSINESS IDEA</span><Leaf className="paper-leaf" size={65} strokeWidth={1.2} /><div className="paper-lines"><i /><i /><i /></div><span className="paper-note">Small beginnings.<br />Meaningful possibilities.</span></div><span className="floating-note"><Sprout size={19} /> A little clarity goes a long way.</span></div>
      </div>
      <section id="workspace" className="workspace-intro" aria-labelledby="workspace-heading"><div className="section-heading"><div><span className="eyebrow">ONE WORKSPACE, EVERY FORMAT</span><h2 id="workspace-heading">Start with the idea, however it’s shared.</h2></div><p>Text, documents, and voice.<br />A common view for careful assessment.</p></div>
        <div className="format-grid">{[{ icon: FileText, title: 'In their own words', text: 'A written idea, without a formal business-plan template.' }, { icon: AudioLines, title: 'A voice that matters', text: 'Regional-language recordings, with originals kept for review.' }, { icon: Leaf, title: 'Evidence you can follow', text: 'Sources, explanations, and space for human judgment.' }].map(({icon: Icon, title, text}) => <article className="format-card" key={title}><Icon size={25} strokeWidth={1.5} /><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <aside className="setup-notice" role="status"><span className="notice-number">01</span><div><strong>Sign in to submit your business idea.</strong><p>{health === 'connected' ? 'The application database is connected. Sign in above to open your submission form and saved results.' : health === 'unconfigured' ? 'Set VITE_API_BASE_URL in root .env.local to connect the API.' : 'The workspace connection is unavailable. Check start.cmd and the API log.'}</p></div></aside>
      </>}</Suspense>
    </main>
    <footer className="footer"><span>Udyam Saathi <span aria-hidden="true">/</span> A first step, with context.</span><span>Assessment support. Decisions stay with people.</span></footer>
  </>
}
