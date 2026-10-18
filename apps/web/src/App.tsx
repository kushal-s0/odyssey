import { useI18n } from './i18n/I18nProvider'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AudioLines, FileText, ShieldCheck, Sprout } from 'lucide-react'
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
      <details className="language-note"><summary>{t('More options')}</summary><p>{t('Interface language changes menus and guidance. Original submissions and saved model text keep their own language.')}</p></details>
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
      <section className="welcome-simple" aria-labelledby="welcome-title">
        <h1 id="welcome-title">{t("Your idea,")}</h1>
        <p className="intro">{t("Write, speak, upload a plan, or let a few questions guide you.")}</p>
        <div className="simple-format-hints"><span><AudioLines size={26} />{t('Audio')}</span><span><FileText size={26} />{t('Text')}</span><span><ShieldCheck size={26} />{t('Private originals. Traceable insights.')}</span></div>
        <button type="button" className="primary-link" onClick={() => document.querySelector<HTMLDialogElement>('.login-dialog')?.showModal()}>{t('Get started')}</button>
        <p>{t('Use the account provided by your coordinator.')}</p>
        {health !== 'connected' && <p role="status" className="form-message">{t('The app cannot connect right now. Ask your coordinator for help.')}</p>}
      </section>
      </>}</Suspense>
    </main>
    <footer className="footer"><span>Udyam Saathi <span aria-hidden="true">/</span> {t("A first step, with context.")}</span><span>{t("Assessment support. Decisions stay with people.")}</span></footer>
  </>
}
