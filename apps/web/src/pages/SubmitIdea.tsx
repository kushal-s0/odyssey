import { useI18n } from '../i18n/I18nProvider'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Upload, Send, FileText, AudioLines, WandSparkles } from 'lucide-react'
import { apiRequest, ApiError } from '../api/client'
import type { components } from '../api/generated/schema'
import { upload } from '../api/uploads'
import { AudioRecorder } from '../components/AudioRecorder'
import { GuidedIdea, guidedSource, type GuidedAnswers } from '../components/GuidedIdea'
import { ReadAloud } from '../components/ReadAloud'

type Actor = components['schemas']['ActorView']
type Accepted = components['schemas']['SubmissionAccepted']
type UploadResult = components['schemas']['UploadInitiated']
type Mode = 'text' | 'pdf' | 'audio'
type Language = components['schemas']['SubmissionCreate']['preferred_language']
type Pending = { fingerprint: string; submitKey: string; uploadKey: string; uploadId?: string; attachmentId?: string }
const MAX_BYTES = 25 * 1024 * 1024
const mediaTypes: Record<string, string> = { pdf: 'application/pdf', wav: 'audio/wav', mp3: 'audio/mpeg',
  m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'audio/webm', ogg: 'audio/ogg' }


export function SubmitIdea({ actor, token, onAccepted, active = true }: { actor: Actor; token: string; onAccepted: (value: Accepted) => void; active?: boolean }) {
  const { t, locale } = useI18n()
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('')
  const [guided, setGuided] = useState(false)
  const [guidedAnswers, setGuidedAnswers] = useState<GuidedAnswers>({})
  const sourceText = guided ? guidedSource(guidedAnswers) : text
  const [language, setLanguage] = useState<Language>(locale)
  const [cohort, setCohort] = useState('')
  const [location, setLocation] = useState('')
  const [consent, setConsent] = useState(false)
  const [synthetic, setSynthetic] = useState(false)
  const [family, setFamily] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [playback, setPlayback] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const lock = useRef(false)
  const operation = useRef<AbortController | null>(null)
  const recordingActive = useRef(false)
  const onRecordingActivity = useCallback((active: boolean) => { recordingActive.current = active }, [])
  const fileInput = useRef<HTMLInputElement>(null)
  const pending = useRef<Pending | null>(null)
  const storageKey = `udyam:pending:${actor.id}`
  useEffect(() => () => operation.current?.abort(), [])
  useEffect(() => { if (!file && fileInput.current) fileInput.current.value = '' }, [file])
  useEffect(() => {
    if (!file || mode !== 'audio') { setPlayback(''); return }
    const url = URL.createObjectURL(file)
    setPlayback(url)
    return () => URL.revokeObjectURL(url)
  }, [file, mode])
  function pickFile(next: File | null) {
    setError(''); setFile(null)
    if (next && (next.size === 0 || next.size > MAX_BYTES)) { setError(t("Choose a nonempty file smaller than 25 MB.")); return }
    if (next) {
      const mime = next.type.split(';')[0] || mediaTypes[next.name.split('.').pop()?.toLowerCase() || '']
      if (mode === 'pdf' ? mime !== 'application/pdf' : !Object.values(mediaTypes).filter(value => value !== 'application/pdf').includes(mime)) {
        setError(mode === 'pdf' ? t("Choose a PDF document.") : t("Choose WAV, MP3, M4A, MP4, OGG or WebM audio.")); return
      }
    }
    setFile(next)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    if (recordingActive.current) { setError(t("Finish microphone permission or stop recording before submitting.")); return }
    if (!consent || (mode === 'text' ? !sourceText.trim() : !file)) { setError(t("Add your idea and give consent before submitting.")); return }
    lock.current = true; setBusy(true); setError(''); setMessage(t("Preparing your private submission…")); setProgress(null)
    const controller = new AbortController()
    operation.current = controller
    try {
      const mime = file ? (file.type.split(';')[0] || mediaTypes[file.name.split('.').pop()?.toLowerCase() || '']) : ''
      const sourceHash = file && mode !== 'text' ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(n => n.toString(16).padStart(2, '0')).join('') : sourceText
      const fingerprintInput = JSON.stringify({ mode, sourceHash, language, cohort, location, synthetic, family, filename: file?.name })
      const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintInput)))).map(n => n.toString(16).padStart(2, '0')).join('')
      let saved = pending.current
      try { saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as Pending | null } catch { /* storage may be disabled */ }
      const intent = saved?.fingerprint === fingerprint ? saved : { fingerprint, submitKey: crypto.randomUUID(), uploadKey: crypto.randomUUID() }
      pending.current = intent
      const remember = () => { try { sessionStorage.setItem(storageKey, JSON.stringify(intent)) } catch { /* in-memory retry remains */ } }
      remember()
      if (controller.signal.aborted) return
      if (mode !== 'text' && file && !intent.attachmentId) {
        const result = await apiRequest<UploadResult>('/v1/uploads', { token, method: 'POST',
          body: { filename: file.name, media_type: mime, bytes: file.size }, idempotencyKey: intent.uploadKey, signal: controller.signal })
        intent.uploadId = result.attachment_id
        remember()
        setMessage(t("Uploading your original file…")); setProgress(0)
        await upload(result.upload_path, file, mime, token, controller.signal, setProgress)
        intent.attachmentId = result.attachment_id
        remember()
      }
      setMessage(t("Saving your idea and processing request…"))
      const accepted = await apiRequest<Accepted>('/v1/submissions', { token, method: 'POST', idempotencyKey: intent.submitKey, signal: controller.signal,
        body: { ...(mode === 'text' ? { text: sourceText } : { attachment_ids: [intent.attachmentId] }), preferred_language: language,
          synthetic, scenario_family: synthetic && family.trim() ? family.trim() : null,
          cohort_id: cohort || null, declared_location: location.trim() ? { locality: location.trim(), precision: 'locality', applicant_confirmed: true } : null, consent: true } })
      if (controller.signal.aborted) return
      try { sessionStorage.removeItem(storageKey) } catch { /* private storage disabled */ }
      pending.current = null
      setMessage(mode === 'text' ? t("Your idea is saved. Follow its progress below.") : t("Your original upload is saved. Follow its progress below.")); setText(''); setGuidedAnswers({}); setFile(null); setConsent(false)
      onAccepted(accepted)
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : t("Submission interrupted. Try again with the same idea."))
        if (failure instanceof ApiError && failure.status === 410) {
          pending.current = null
          try { sessionStorage.removeItem(storageKey) } catch { /* storage disabled */ }
        }
      }
    } finally {
      lock.current = false
      setBusy(false); setProgress(null)
    }
  }
  function stopWaiting() {
    operation.current?.abort()
    setMessage(t('Transfer stopped in this browser. Your file stays selected. A request already received by the server may still be saved; check Saved ideas before retrying with the same input.'))
  }
  async function discardUpload() {
    const draft = pending.current
    if (busy || !draft?.uploadId) return
    setBusy(true); setError('')
    try {
      await apiRequest<void>(`/v1/uploads/${draft.uploadId}`, { token, method: 'DELETE' })
      pending.current = null
      try { sessionStorage.removeItem(storageKey) } catch { /* storage optional */ }
      setMessage(t('Unsubmitted upload removed. Your local file is unchanged; sending it again creates a fresh upload.'))
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 409
        ? t('This original is already attached to a saved idea. Open Saved ideas; it was not deleted.')
        : failure instanceof Error ? failure.message : t('Could not discard the upload. Try again.'))
    } finally { setBusy(false) }
  }
  return <section className="submission-panel" aria-labelledby="submit-title">
    <div className="panel-heading"><h2 id="submit-title">{t("Share your business idea")}</h2><p>{t("Tell us what you offer, who it helps, and what you already know. Unknown details can stay unknown.")}</p><ReadAloud active={active} text={t('Tell us what you will sell, who will buy it, and how much it may cost. You can speak instead of typing.')} /></div>
    <div className="format-choices" role="group" aria-label={t("Idea format")}>{[
      { id: 'audio', icon: AudioLines, title: t("Audio"), detail: t("Speak or upload a recording") },
      { id: 'guided', icon: WandSparkles, title: t("Guide me"), detail: t("Build it with questions") },
      { id: 'text', icon: FileText, title: t("Text"), detail: t("Write in your own words") },
      { id: 'pdf', icon: Upload, title: 'PDF', detail: t("Bring your business plan") },
    ].map(({ id, icon: Icon, title, detail }) => <button key={id} type="button" aria-pressed={id === 'guided' ? mode === 'text' && guided : mode === id && !guided} disabled={busy} onClick={() => { setMode(id === 'guided' ? 'text' : id as Mode); setGuided(id === 'guided'); setFile(null); setError('') }}><Icon size={22} /><strong>{title}</strong><span>{detail}</span></button>)}</div>
    <form onSubmit={event => { void submit(event) }}>
      <fieldset disabled={busy}>
        {mode === 'text' ? guided ? <GuidedIdea answers={guidedAnswers} onChange={setGuidedAnswers} active={active} /> : <label>{t("Your idea")}<textarea aria-label={t("Your idea")} required maxLength={30000} rows={5} value={text} onChange={event => setText(event.target.value)} placeholder={t('I plan to sell… My customers are…')} /></label> : <>
          {mode === 'audio' && <AudioRecorder onFile={pickFile} disabled={busy} onActivityChange={onRecordingActivity} active={active} />}
          <label className="file-picker"><Upload size={20} />{mode === 'pdf' ? t("Choose a PDF") : t("Upload an audio file")}<input ref={fileInput} aria-label={mode === 'pdf' ? t("PDF file") : t("Audio file")} type="file" accept={mode === 'pdf' ? 'application/pdf,.pdf' : 'audio/*,video/mp4,.m4a,.mp4,.ogg,.webm,.wav,.mp3'} onChange={event => pickFile(event.target.files?.[0] || null)} /></label>
          <p className="field-note">{mode === 'pdf' ? t("Maximum 20 pages and 25 MB. Digital PDFs are processed by the owned worker; scanned handwriting needs human review.") : t("Maximum 10 minutes and 25 MB. The owned speech worker transcribes supported languages after model provisioning. For Odia, select Odia explicitly; it uses a separate model. All transcriptions need review.")} {t("Your file is saved privately. Uploading does not mean assessment is complete.")}</p>
          {file && <p className="selected-file">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
          {playback && <audio controls src={playback} aria-label={t("Recording playback")} />}
        </>}
        <label>{t("Preferred language")}<select value={language} onChange={event => setLanguage(event.target.value as Language)}>{[['en', t("English")], ['hi', 'हिन्दी'], ['mr', 'मराठी'], ['te', 'తెలుగు'], ['bn', 'বাংলা'], ['or', 'ଓଡ଼ିଆ']].map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
        <label>{t("Known business location")} <span className="optional">{t("(optional)")}</span><input maxLength={200} value={location} onChange={event => setLocation(event.target.value)} placeholder={t("Village, locality or district you know")} /></label>
        <details className="simple-disclosure"><summary>{t('More options')}</summary>
          <label>{t("Program / cohort")}<select value={cohort} onChange={event => setCohort(event.target.value)}><option value="">{t("Personal submission")}</option>{actor.cohorts.filter(value => value.role === 'applicant' || actor.role === 'admin').map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
        <p className="field-note">{t("Regional text uses an owned translation model when provisioned. Originals remain available for review. Language and transcription quality must be checked before decisions.")}</p>
        <label className="inline-check"><input type="checkbox" checked={synthetic} onChange={event => setSynthetic(event.target.checked)} />{t("Synthetic rehearsal input")}</label>
        {synthetic && <><p className="field-note">{t("This fictional example is excluded from ordinary population charts. Enable labelled examples in Comparisons to show it.")}</p><label>{t("Scenario family (optional)")}<input value={family} maxLength={100} pattern="[a-zA-Z0-9_-]+" onChange={event => setFamily(event.target.value)} placeholder="tea-001" /><small>{t("Use the same identifier for text, PDF and audio versions of this fictional idea.")}</small></label></>}
        </details>
        <label className="consent"><input type="checkbox" checked={consent} required onChange={event => setConsent(event.target.checked)} /><span>{t("I consent to my idea and original file being stored privately and used for this assessment and authorized human review.")}</span></label>
        <button className="primary-link submit-button" type="submit"><Send size={16} />{busy ? t("Saving…") : t("Submit idea")}</button>
      </fieldset>
      {busy && <button type="button" className="secondary-button" onClick={stopWaiting}>{t('Stop waiting / pause transfer')}</button>}
      {!busy && pending.current?.uploadId && error && <button type="button" className="secondary-button" onClick={() => { void discardUpload() }}>{t('Discard unsubmitted upload')}</button>}
      {progress !== null && <div className="upload-progress"><label htmlFor="upload-progress">{t("Upload")} {progress}{t("% — waiting for server validation")}</label><progress id="upload-progress" value={progress} max={100} /></div>}
      {message && !error && <p role="status" className="form-message">{message}</p>}
      {error && <p role="alert" className="form-error">{error} {t("Your submitted work can be recovered from My submissions. Keep the same input to retry safely.")}</p>}
    </form>
  </section>
}
