import { useI18n } from './i18n/I18nProvider'
import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowUpRight, AudioLines, FileText, Leaf, ShieldCheck, Sprout } from 'lucide-react'
import { AccountMenu } from './auth/AccountMenu'
import { useAuth } from './auth/AuthProvider'
import { ApplicantWorkspace } from './pages/ApplicantWorkspace'
import { ThemeToggle } from './components/ThemeToggle'
import { KeptPanel } from './components/KeptPanel'
import { LanguagePicker } from './components/LanguagePicker'

const AssessorWorkspace = lazy(() => import('./pages/AssessorWorkspace').then(module => ({ default: module.AssessorWorkspace })))
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })))

type Health = 'checking' | 'connected' | 'unavailable' | 'unconfigured'
const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined

export default function App() {
  const { t } = useI18n()
  const auth = useAuth()
  type Tab = 'ideas' | 'review' | 'analytics'
  const [navigation, setNavigation] = useState<{ actorId: string; tab: Tab }>({ actorId: '', tab: 'ideas' })
  const tab = navigation.actorId === auth.actor?.id ? navigation.tab : 'ideas'
  const accessKey = auth.actor ? JSON.stringify([auth.actor.id, auth.actor.role, auth.actor.cohorts]) : ''
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
  }, [auth.actor?.id])
  return <>
    <a className="skip-link" href="#main">{t("Skip to content")}</a>
    <header className="topbar">
      <a className="brand" href="/" aria-label={t("Udyam Saathi home")}><span className="brand-mark"><Sprout size={25} /></span><span>udyam<span className="brand-light">saathi</span><small>{t("IDEAS INTO LIVELIHOODS")}</small></span></a>
      <span className="topbar-label">{t("Entrepreneurship assessment workspace")}</span>
      <span className="status-chip"><span className={`status-dot ${health === 'connected' ? 'online' : ''}`} />{health === 'connected' ? t("Database connected") : health === 'checking' ? t("Checking connection") : t("Workspace unavailable")}</span>
      <LanguagePicker /><ThemeToggle /><AccountMenu />
    </header>
    <main id="main" className={auth.actor ? 'workspace-shell' : 'welcome'}>
      <p className="language-note">{t('Interface language changes menus and guidance. Original submissions and saved model text keep their own language.')}</p>
      {import.meta.env.VITE_FIXTURE_MODE === 'true' && <p className="form-message" role="note">Local verification fixture: synthetic account and input. Model/provider fixtures are identified in the verification report; API and database checks run locally.</p>}
      {auth.actor && <nav className="workspace-nav" aria-label={t("Workspace")}><button aria-current={tab !== 'analytics' && tab !== 'review' ? 'page' : undefined} onClick={() => setTab('ideas')}>{auth.actor.role === 'assessor' ? t("Review queue") : t("My ideas")}</button>{auth.actor.role === 'admin' && <button aria-current={tab === 'review' ? 'page' : undefined} onClick={() => setTab('review')}>{t("Review queue")}</button>}<button aria-current={tab === 'analytics' ? 'page' : undefined} onClick={() => setTab('analytics')}>{t("Comparisons")}</button></nav>}
      <Suspense fallback={<p role="status">{t("Opening workspace…")}</p>}>{auth.actor ? <div key={accessKey}>
        <KeptPanel active={tab === 'analytics'}><Dashboard /></KeptPanel>
        {['applicant', 'admin'].includes(auth.actor.role) && <KeptPanel active={tab === 'ideas'}><ApplicantWorkspace active={tab === 'ideas'} /></KeptPanel>}
        {['assessor', 'admin'].includes(auth.actor.role) && <KeptPanel active={auth.actor.role === 'assessor' ? tab === 'ideas' : tab === 'review'}><AssessorWorkspace active={auth.actor.role === 'assessor' ? tab === 'ideas' : tab === 'review'} /></KeptPanel>}
      </div> : auth.session ? <section className="submission-panel" aria-labelledby="workspace-access-heading">
        <h1 id="workspace-access-heading">{auth.loading ? t("Opening your workspace…") : auth.actor ? 'Assessor tools are still being implemented.' : t("Your workspace needs attention.")}</h1>
        <p role="status">{auth.loading ? t("Checking your signed-in account and program access.") : auth.message || 'Your login works. The assessor workspace is not available yet.'}</p>
        {!auth.loading && !auth.actor && <button className="primary-link" onClick={auth.retryWorkspace}>{t("Retry workspace connection")}</button>}
        {!auth.loading && !auth.actor && <p>{t("If access is not enabled, your coordinator must add your account to a program. You can also sign out using the button above.")}</p>}
      </section> : <>
      {auth.message && !auth.actor && <p className="auth-banner" role="status">{auth.message}</p>}
      <div className="eyebrow"><span /> {t("EVERY LIVELIHOOD STARTS WITH AN IDEA")}</div>
      <div className="welcome-grid">
        <div><h1>{t("See the potential.")}<br /><em>{t("Understand the story.")}</em></h1><p className="intro">{t("A thoughtful first step for every business idea. Understand submissions in the entrepreneur’s own words, follow the evidence, and make room for the next useful question.")}</p>
          <a className="primary-link" href="#workspace">{t("Explore the workspace")} <ArrowUpRight size={19} /></a>
          <div className="trust-line"><ShieldCheck size={17} /> {t("Original words preserved. Human judgment at the center.")}</div>
        </div>
        <div className="idea-illustration" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="paper paper-back" /><div className="paper paper-front"><span className="paper-tag">{t("A BUSINESS IDEA")}</span><Leaf className="paper-leaf" size={65} strokeWidth={1.2} /><div className="paper-lines"><i /><i /><i /></div><span className="paper-note">{t("Small beginnings.")}<br />{t("Meaningful possibilities.")}</span></div><span className="floating-note"><Sprout size={19} /> {t("A little clarity goes a long way.")}</span></div>
      </div>
      <section id="workspace" className="workspace-intro" aria-labelledby="workspace-heading"><div className="section-heading"><div><span className="eyebrow">{t("ONE WORKSPACE, EVERY FORMAT")}</span><h2 id="workspace-heading">{t("Start with the idea, however it’s shared.")}</h2></div><p>{t("Text, documents, and voice.")}<br />{t("A common view for careful assessment.")}</p></div>
        <div className="format-grid">{[{ icon: FileText, title: t("In their own words"), text: t("A written idea, without a formal business-plan template.") }, { icon: AudioLines, title: t("A voice that matters"), text: t("Regional-language recordings, with originals kept for review.") }, { icon: Leaf, title: t("Evidence you can follow"), text: t("Sources, explanations, and space for human judgment.") }].map(({icon: Icon, title, text}) => <article className="format-card" key={title}><Icon size={25} strokeWidth={1.5} /><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <aside className="setup-notice" role="status"><span className="notice-number">01</span><div><strong>{t("Sign in to submit your business idea.")}</strong><p>{health === 'connected' ? t("The application database is connected. Sign in above to open your submission form and saved results.") : health === 'unconfigured' ? 'Set VITE_API_BASE_URL in root .env.local to connect the API.' : t("The workspace connection is unavailable. Check start.cmd and the API log.")}</p></div></aside>
      </>}</Suspense>
    </main>
    <footer className="footer"><span>Udyam Saathi <span aria-hidden="true">/</span> {t("A first step, with context.")}</span><span>{t("Assessment support. Decisions stay with people.")}</span></footer>
  </>
}
