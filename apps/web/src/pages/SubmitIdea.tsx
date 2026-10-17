import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Upload, Send } from 'lucide-react'
import { apiRequest, ApiError } from '../api/client'
import type { components } from '../api/generated/schema'
import { AudioRecorder } from '../components/AudioRecorder'

type Actor = components['schemas']['ActorView']
type Accepted = components['schemas']['SubmissionAccepted']
type UploadResult = components['schemas']['UploadInitiated']
type Mode = 'text' | 'pdf' | 'audio'
type Language = components['schemas']['SubmissionCreate']['preferred_language']
type Pending = { fingerprint: string; submitKey: string; uploadKey: string; attachmentId?: string }
const MAX_BYTES = 25 * 1024 * 1024
const mediaTypes: Record<string, string> = { pdf: 'application/pdf', wav: 'audio/wav', mp3: 'audio/mpeg',
  m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'audio/webm', ogg: 'audio/ogg' }

function upload(path: string, file: File, mime: string, token: string, signal: AbortSignal, progress: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const base = import.meta.env.VITE_API_BASE_URL as string | undefined
    if (!base) { reject(new Error('The workspace API is not configured.')); return }
    // Upload paths come from this API but must still remain under its origin.
    if (!/^\/v1\/uploads\/[a-f0-9-]+\/complete$/.test(path)) { reject(new Error('Invalid upload destination.')); return }
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    signal.addEventListener('abort', abort, { once: true })
    const cleanup = () => signal.removeEventListener('abort', abort)
    request.open('PUT', `${base.replace(/\/$/, '')}${path}`)
    request.timeout = 120_000
    request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.setRequestHeader('Content-Type', mime)
    request.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)) }
    request.onload = () => {
      cleanup()
      if (request.status >= 200 && request.status < 300) resolve()
      else {
        let message = 'Upload could not be saved. Check the file and try again.'
        try { message = (JSON.parse(request.responseText) as { message?: string }).message || message } catch { /* generic safe error */ }
        reject(new Error(message))
      }
    }
    request.onerror = request.ontimeout = () => { cleanup(); reject(new Error('Upload interrupted. Keep this file selected and retry.')) }
    request.onabort = () => { cleanup(); reject(new DOMException('Upload cancelled', 'AbortError')) }
    if (signal.aborted) { cleanup(); reject(new DOMException('Upload cancelled', 'AbortError')); return }
    request.send(file)
  })
}

export function SubmitIdea({ actor, token, onAccepted }: { actor: Actor; token: string; onAccepted: (value: Accepted) => void }) {
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('')
  const [language, setLanguage] = useState<Language>('en')
  const [cohort, setCohort] = useState('')
  const [location, setLocation] = useState('')
  const [consent, setConsent] = useState(false)
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
    if (next && (next.size === 0 || next.size > MAX_BYTES)) { setError('Choose a nonempty file smaller than 25 MB.'); return }
    if (next) {
      const mime = next.type.split(';')[0] || mediaTypes[next.name.split('.').pop()?.toLowerCase() || '']
      if (mode === 'pdf' ? mime !== 'application/pdf' : !Object.values(mediaTypes).filter(value => value !== 'application/pdf').includes(mime)) {
        setError(mode === 'pdf' ? 'Choose a PDF document.' : 'Choose WAV, MP3, M4A, MP4, OGG or WebM audio.'); return
      }
    }
    setFile(next)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    if (recordingActive.current) { setError('Finish microphone permission or stop recording before submitting.'); return }
    if (!consent || (mode === 'text' ? !text.trim() : !file)) { setError('Add your idea and give consent before submitting.'); return }
    lock.current = true; setBusy(true); setError(''); setMessage('Preparing your private submission…'); setProgress(null)
    const controller = new AbortController()
    operation.current = controller
    try {
      const mime = file ? (file.type.split(';')[0] || mediaTypes[file.name.split('.').pop()?.toLowerCase() || '']) : ''
      const sourceHash = file && mode !== 'text' ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(n => n.toString(16).padStart(2, '0')).join('') : text
      const fingerprintInput = JSON.stringify({ mode, sourceHash, language, cohort, location, filename: file?.name })
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
        setMessage('Uploading your original file…'); setProgress(0)
        await upload(result.upload_path, file, mime, token, controller.signal, setProgress)
        intent.attachmentId = result.attachment_id
        remember()
      }
      setMessage('Saving your idea and processing request…')
      const accepted = await apiRequest<Accepted>('/v1/submissions', { token, method: 'POST', idempotencyKey: intent.submitKey, signal: controller.signal,
        body: { ...(mode === 'text' ? { text } : { attachment_ids: [intent.attachmentId] }), preferred_language: language,
          cohort_id: cohort || null, declared_location: location.trim() ? { locality: location.trim(), precision: 'locality', applicant_confirmed: true } : null, consent: true } })
      if (controller.signal.aborted) return
      try { sessionStorage.removeItem(storageKey) } catch { /* private storage disabled */ }
      pending.current = null
      setMessage(mode === 'text' ? 'Your idea is saved. Follow its progress below.' : 'Your original upload is saved. Follow its progress below.'); setText(''); setFile(null); setConsent(false)
      onAccepted(accepted)
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Submission interrupted. Try again with the same idea.')
        if (failure instanceof ApiError && failure.status === 410) {
          pending.current = null
          try { sessionStorage.removeItem(storageKey) } catch { /* storage disabled */ }
        }
      }
    } finally {
      lock.current = false
      if (!controller.signal.aborted) { setBusy(false); setProgress(null) }
    }
  }
  return <section className="submission-panel" aria-labelledby="submit-title">
    <div className="panel-heading"><span className="eyebrow">A LITTLE CONTEXT GOES A LONG WAY</span><h2 id="submit-title">Share your business idea</h2><p>Tell us what you offer, who it helps, and what you already know. Unknown details can stay unknown.</p></div>
    <div className="input-modes" role="group" aria-label="Idea format">{(['text', 'pdf', 'audio'] as const).map(value => <button type="button" aria-pressed={mode === value} disabled={busy} key={value} onClick={() => { setMode(value); setFile(null); setError('') }}>{value === 'text' ? 'Text' : value === 'pdf' ? 'PDF' : 'Audio'}</button>)}</div>
    <form onSubmit={event => { void submit(event) }}>
      <fieldset disabled={busy}>
        {mode === 'text' ? <label>Your idea<textarea required maxLength={30000} rows={7} value={text} onChange={event => setText(event.target.value)} placeholder="I plan to sell… My customers are…" /><small>{text.length.toLocaleString()} / 30,000 characters</small></label> : <>
          {mode === 'audio' && <AudioRecorder onFile={pickFile} disabled={busy} onActivityChange={onRecordingActivity} />}
          <label className="file-picker"><Upload size={20} />{mode === 'pdf' ? 'Choose a PDF' : 'Upload an audio file'}<input ref={fileInput} aria-label={mode === 'pdf' ? 'PDF file' : 'Audio file'} type="file" accept={mode === 'pdf' ? 'application/pdf,.pdf' : 'audio/*,video/mp4,.m4a,.mp4,.ogg,.webm,.wav,.mp3'} onChange={event => pickFile(event.target.files?.[0] || null)} /></label>
          <p className="field-note">{mode === 'pdf' ? 'Maximum 20 pages and 25 MB. Digital PDFs are processed by the owned worker; scanned handwriting needs human review.' : 'Maximum 10 minutes and 25 MB. The owned speech worker transcribes supported languages after model provisioning. For Odia, select Odia explicitly; it uses a separate model. All transcriptions need review.'} Your file is saved privately. Uploading does not mean assessment is complete.</p>
          {file && <p className="selected-file">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
          {playback && <audio controls src={playback} aria-label="Recording playback" />}
        </>}
        <div className="form-grid"><label>Preferred language<select value={language} onChange={event => setLanguage(event.target.value as Language)}>{[['en', 'English'], ['hi', 'Hindi — translation review pending'], ['mr', 'Marathi — unvalidated'], ['te', 'Telugu — unvalidated'], ['bn', 'Bengali — unvalidated'], ['or', 'Odia — unvalidated']].map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <label>Program / cohort<select value={cohort} onChange={event => setCohort(event.target.value)}><option value="">Personal submission</option>{actor.cohorts.filter(value => value.role === 'applicant' || actor.role === 'admin').map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label></div>
        <label>Known business location <span className="optional">(optional)</span><input maxLength={200} value={location} onChange={event => setLocation(event.target.value)} placeholder="Village, locality or district you know" /></label>
        <p className="field-note">Regional text uses an owned translation model when provisioned. Originals remain available for review. Language and transcription quality must be checked before decisions.</p>
        <label className="consent"><input type="checkbox" checked={consent} required onChange={event => setConsent(event.target.checked)} /><span>I consent to my idea and original file being stored privately and used for this assessment and authorized human review.</span></label>
        <button className="primary-link submit-button" type="submit"><Send size={16} />{busy ? 'Saving…' : 'Submit idea'}</button>
      </fieldset>
      {progress !== null && <div className="upload-progress"><label htmlFor="upload-progress">Upload {progress}% — waiting for server validation</label><progress id="upload-progress" value={progress} max={100} /></div>}
      {message && !error && <p role="status" className="form-message">{message}</p>}
      {error && <p role="alert" className="form-error">{error} Your submitted work can be recovered from My submissions. Keep the same input to retry safely.</p>}
    </form>
  </section>
}
