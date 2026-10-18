import { useI18n } from '../i18n/I18nProvider'
import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

export function AudioRecorder({ onFile, disabled, onActivityChange, active = true }: {
  onFile: (file: File) => void; disabled: boolean; onActivityChange: (active: boolean) => void; active?: boolean
}) {
  const { t } = useI18n()
  const [recording, setRecording] = useState(false)
  const [message, setMessage] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const alive = useRef(true)
  const requesting = useRef(false)
  const visible = useRef(active)
  useEffect(() => {
    visible.current = active
    if (!active) {
      if (recorder.current?.state === 'recording') recorder.current.stop()
      stream.current?.getTracks().forEach(track => track.stop())
      onActivityChange(false)
    }
  }, [active, onActivityChange])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      onActivityChange(false)
      window.clearTimeout(timer.current)
      if (recorder.current?.state === 'recording') recorder.current.stop()
      stream.current?.getTracks().forEach(track => track.stop())
    }
  }, [onActivityChange])
  async function start() {
    if (recorder.current?.state === 'recording' || requesting.current) return
    requesting.current = true
    onActivityChange(true)
    setMessage('')
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported')
      const input = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!alive.current || !visible.current) { input.getTracks().forEach(track => track.stop()); return }
      stream.current = input
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
      if (!mime) throw new Error('unsupported')
      const capture = new MediaRecorder(input, { mimeType: mime })
      recorder.current = capture
      const chunks: Blob[] = []
      let bytes = 0
      let failed = false
      capture.ondataavailable = event => {
        bytes += event.data.size
        if (bytes > 25 * 1024 * 1024) {
          failed = true
          if (capture.state === 'recording') capture.stop()
          if (alive.current) setMessage(t("Recording reached the 25 MB limit. Make a shorter recording or upload a file."))
        } else chunks.push(event.data)
      }
      capture.onerror = () => {
        failed = true
        if (capture.state === 'recording') capture.stop()
        if (alive.current) setMessage(t("Recording failed. You can upload an existing audio file below."))
      }
      capture.onstop = () => {
        window.clearTimeout(timer.current)
        input.getTracks().forEach(track => track.stop())
        recorder.current = null
        onActivityChange(false)
        if (!alive.current) return
        setRecording(false)
        if (!failed && bytes > 0) {
          const type = mime.split(';')[0]
          const extension = type === 'audio/mp4' ? 'm4a' : type.split('/')[1]
          onFile(new File(chunks, `idea-recording.${extension}`, { type }))
          setMessage(t("Recording ready. Listen before submitting."))
        }
      }
      capture.start(1000)
      setRecording(true)
      setMessage(t("Recording. Maximum 10 minutes. Stop when you finish your idea."))
      timer.current = window.setTimeout(() => { if (capture.state === 'recording') capture.stop() }, 600_000)
    } catch {
      stream.current?.getTracks().forEach(track => track.stop())
      if (alive.current) { setRecording(false); setMessage(t("Microphone unavailable or permission denied. Upload an existing audio file below, or choose Text.")) }
    } finally {
      requesting.current = false
      if (recorder.current?.state !== 'recording') onActivityChange(false)
    }
  }
  return <div className="recorder">
    <button type="button" className="secondary-button" disabled={disabled} onClick={() => {
      if (recording) recorder.current?.stop(); else void start()
    }}>{recording ? <Square size={16} /> : <Mic size={16} />}{recording ? t("Stop recording") : t("Record your idea")}</button>
    <p role="status">{message || t("Record in your own words, or upload a recording. Maximum 10 minutes / 25 MB.")}</p>
    {recording && <p role="alert">{t("Stop recording before submitting.")}</p>}
  </div>
}
