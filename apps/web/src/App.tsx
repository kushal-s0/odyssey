import { useEffect, useState } from 'react'
import { ArrowUpRight, AudioLines, FileText, Leaf, ShieldCheck, Sprout } from 'lucide-react'

type Health = 'checking' | 'connected' | 'unavailable' | 'unconfigured'
const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined

export default function App() {
  const [health, setHealth] = useState<Health>(apiBase ? 'checking' : 'unconfigured')
  useEffect(() => {
    if (!apiBase) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    fetch(`${apiBase}/health/live`, { signal: controller.signal })
      .then(response => { setHealth(response.ok ? 'connected' : 'unavailable') })
      .catch(() => { setHealth('unavailable') })
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [])
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="topbar">
      <a className="brand" href="/" aria-label="Udyam Saathi home"><span className="brand-mark"><Sprout size={25} /></span><span>udyam<span className="brand-light">saathi</span><small>IDEAS INTO LIVELIHOODS</small></span></a>
      <span className="topbar-label">Entrepreneurship assessment workspace</span>
      <span className="status-chip"><span className={`status-dot ${health === 'connected' ? 'online' : ''}`} />{health === 'connected' ? 'API connected' : health === 'checking' ? 'Checking connection' : 'Local development'}</span>
    </header>
    <main id="main" className="welcome">
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
      <aside className="setup-notice" role="status"><span className="notice-number">01</span><div><strong>Workspace foundation is ready.</strong><p>Submission and assessment tools are being connected. {health === 'connected' ? 'The API process is reachable; data and model readiness are checked separately.' : health === 'unconfigured' ? 'Set VITE_API_BASE_URL in the frontend environment to connect the API.' : 'The API is not reachable yet; check its startup and URL.'}</p></div></aside>
    </main>
    <footer className="footer"><span>Udyam Saathi <span aria-hidden="true">/</span> A first step, with context.</span><span>Assessment support. Decisions stay with people.</span></footer>
  </>
}
