import { useI18n } from '../i18n/I18nProvider'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { apiRequest, type Assessment } from '../api/client'
import type { components } from '../api/generated/schema'
import { AudioRecorder } from './AudioRecorder'
import { upload } from '../api/uploads'

type Question = components['schemas']['ClarificationQuestion']
type Language = components['schemas']['LanguageResult']['code']
export function Clarifications({ value, token, onReassess, preferredLanguage = 'en', active = true }: { value: Assessment; token: string; onReassess: () => void; preferredLanguage?: Language; active?: boolean }) {
  const { t } = useI18n()
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [language, setLanguage] = useState<Language>(preferredLanguage === 'und' ? 'en' : preferredLanguage)
  const [mode, setMode] = useState<'text' | 'audio'>('text')
  const [file, setFile] = useState<File | null>(null)
  const [playback, setPlayback] = useState('')
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const audioIntent = useRef<{ fingerprint: string; key: string; attachmentId?: string } | null>(null)
  const operation = useRef<AbortController | null>(null)
  const recordingChange = useCallback((active: boolean) => setRecording(active), [])
  useEffect(() => () => operation.current?.abort(), [])
  useEffect(() => {
    if (!file) { setPlayback(''); return }
    const url = URL.createObjectURL(file); setPlayback(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const pending = useRef<{ body: string; key: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Question[]>(`/v1/submissions/${value.submission_id}/questions?language=${language}`, { token, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setQuestions(data); setError('') } }).catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : t("Could not load questions.")) })
    return () => controller.abort()
  }, [value.submission_id, value.id, token, reload, language])
  async function submit(event: FormEvent) {
    event.preventDefault()
    const supplied = Object.fromEntries(Object.entries(answers).filter(([, text]) => text.trim()))
    if (busy || recording || (mode === 'text' ? !Object.keys(supplied).length : !file)) return
    setBusy(true); setError('')
    const controller = new AbortController(); operation.current = controller
    try {
      let attachmentId: string | undefined
      if (mode === 'audio' && file) {
        const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(n => n.toString(16).padStart(2, '0')).join('')
        if (audioIntent.current?.fingerprint !== fingerprint) audioIntent.current = { fingerprint, key: crypto.randomUUID() }
        const intent = audioIntent.current
        if (!intent.attachmentId) {
          const ext = file.name.split('.').pop()?.toLowerCase() || ''
          const mime = file.type.split(';')[0] || ({ wav:'audio/wav',mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'video/mp4',ogg:'audio/ogg',webm:'audio/webm' } as Record<string,string>)[ext]
          if (!mime) throw new Error(t("Choose a supported audio file."))
          const initiated = await apiRequest<components['schemas']['UploadInitiated']>('/v1/uploads', { token, method: 'POST', signal: controller.signal,
            idempotencyKey: intent.key, body: { filename:file.name, media_type:mime, bytes:file.size } })
          setProgress(0)
          await upload(initiated.upload_path,file,mime,token,controller.signal,setProgress)
          intent.attachmentId = initiated.attachment_id
        }
        attachmentId = intent.attachmentId
      }
      const body = { expected_revision_id:value.input_revision_id, answer_language:language,
        ...(mode === 'text' ? { answers:supplied } : { audio_attachment_id:attachmentId, audio_fields:questions.map(q => q.field) }) }
      const encoded = JSON.stringify(body)
      if (pending.current?.body !== encoded) pending.current = { body:encoded, key:crypto.randomUUID() }
      await apiRequest(`/v1/submissions/${value.submission_id}/clarifications`, { token, method: 'POST', body, signal:controller.signal, idempotencyKey: pending.current.key })
      setAnswers({}); pending.current = null; onReassess()
    } catch (e) { setError(e instanceof Error ? e.message : t("Could not save your answers.")) }
    finally { setBusy(false); setProgress(null) }
  }
  return <section className="tool-panel"><div className="tool-heading"><MessageCircle size={20} /><h3>{t("Make your next version stronger")}</h3></div>
    <p className="field-note">{t("Up to three useful questions at a time. Answer what you know, in your preferred language. We keep the previous version and its original evidence, then assess your updated idea.")}</p>
    <label>{t("Question and answer language")}<select aria-label={t("Question and answer language")} disabled={busy || recording} value={language} onChange={e => setLanguage(e.target.value as Language)}>{[['en',t("English")],['hi','हिन्दी / Hindi'],['mr','मराठी / Marathi'],['te','తెలుగు / Telugu'],['bn','বাংলা / Bengali'],['or','ଓଡ଼ିଆ / Odia']].map(([code,label]) => <option key={code} value={code}>{label}</option>)}</select></label>
    {error && <p role="alert" className="form-error">{error} <button className="text-button" onClick={() => { setError(''); setReload(n => n + 1) }}>{t("Retry questions")}</button></p>}
    {questions.length > 0 ? <form onSubmit={event => { void submit(event) }}><fieldset disabled={busy}>
      <div className="mode-switch" role="group" aria-label={t("Follow-up answer format")}><button type="button" className="secondary-button" aria-pressed={mode === 'text'} disabled={recording} onClick={() => setMode('text')}>{t("Type answers")}</button><button type="button" className="secondary-button" aria-pressed={mode === 'audio'} disabled={recording} onClick={() => setMode('audio')}>{t("Record or upload answers")}</button></div>
      {questions.map((question, index) => <details key={question.id} open={index < 2}><summary>{question.label}<span className="badge">{question.status}</span></summary>
        <label lang={question.language}>{question.question}{mode === 'text' && <textarea rows={2} maxLength={1500} value={answers[question.field] || ''} onChange={event => setAnswers(previous => ({ ...previous, [question.field]: event.target.value }))} />}</label>
        <div className="question-guidance" lang="en"><p><strong>{t("Why this matters")}{question.language !== 'en' ? ' (English)' : ''}</strong> {question.reason}</p><p>{question.answer_hint}</p>
          {question.source_note && <p>{t("Previous assessment:")} {question.source_note}</p>}
          {question.source_segment_ids?.map(id => { const source = value.evidence.find(item => item.id === id); return source ? <blockquote key={id}>{source.original_text.slice(0, 400)}{source.original_text.length > 400 ? '…' : ''}<cite>{t("Original source")} {value.evidence.findIndex(item => item.id === id) + 1}</cite></blockquote> : null })}
        </div>{question.english_question && <p className="field-note" lang="en">{t("English original:")} {question.english_question}</p>}</details>)}
      {questions.some(q => q.localization_note) && <p className="field-note">{t("Prepared translations; human language review is pending. Compare the English originals if anything is unclear.")}</p>}
      {mode === 'audio' && <><p className="field-note">{t("Say which question you are answering before each answer. Answer any of the questions above in one recording. Transcription needs review and cannot guarantee a higher score. Maximum 10 minutes / 25 MB.")}</p><AudioRecorder onFile={setFile} disabled={busy} onActivityChange={recordingChange} active={active} /><label>{t("Audio follow-up file")}<input type="file" accept="audio/*,video/mp4" disabled={recording} onChange={e => { const selected=e.target.files?.[0] || null; if (selected && (selected.size === 0 || selected.size > 25*1024*1024)) { setError(t("Choose nonempty audio smaller than 25 MB.")); setFile(null) } else { setFile(selected); setError('') } }} /></label>{playback && <audio controls src={playback} aria-label={t("Listen to follow-up answers")} />}{progress !== null && <progress value={progress} max={100} aria-label={t("Follow-up upload progress")} />}</>}
      <button type="submit" className="primary-link" disabled={busy || recording || (mode === 'text' ? !Object.values(answers).some(text => text.trim()) : !file)}><Send size={16} />{busy ? t("Saving new version…") : t("Save answers & reassess")}</button>
    </fieldset></form> : !error && <p className="field-note">{t("No unresolved rubric fields were found in this assessment.")}</p>}
  </section>
}
