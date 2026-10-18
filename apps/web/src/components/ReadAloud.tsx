import { useEffect, useRef, useState } from 'react'
import { Volume2, Square } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'

/** User-started, language-matched device speech. Never use a remote fallback. */
export function ReadAloud({ text, active = true, language, label = 'Listen' }: {
  text: string; active?: boolean; language?: string; label?: string
}) {
  const { t, locale } = useI18n()
  const lang = language || locale
  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [failed, setFailed] = useState(false)
  const current = useRef<SpeechSynthesisUtterance | null>(null)
  const voice = voices.find(item => item.localService && item.lang.toLowerCase().replace('_', '-').split('-')[0] === lang.split('-')[0])
  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const update = () => setVoices(synth.getVoices())
    update()
    synth.addEventListener('voiceschanged', update)
    return () => synth.removeEventListener('voiceschanged', update)
  }, [supported])
  useEffect(() => {
    const stop = () => {
      if (!current.current) return
      const utterance = current.current
      current.current = null
      utterance.onend = null; utterance.onerror = null
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }
    const hidden = () => { if (document.hidden) stop() }
    window.addEventListener('udyam:stop-speech', stop)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      stop()
      window.removeEventListener('udyam:stop-speech', stop)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [active, lang, text])
  function toggle() {
    const wasSpeaking = !!current.current
    window.dispatchEvent(new Event('udyam:stop-speech'))
    if (wasSpeaking || !voice || !active) return
    setFailed(false)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.85
    utterance.onend = () => { current.current = null; setSpeaking(false) }
    utterance.onerror = event => {
      current.current = null; setSpeaking(false)
      if (event.error !== 'canceled' && event.error !== 'interrupted') setFailed(true)
    }
    current.current = utterance
    setSpeaking(true)
    try { window.speechSynthesis.speak(utterance) } catch { current.current = null; setSpeaking(false); setFailed(true) }
  }
  return <div className="read-aloud">
    <button type="button" className="secondary-button" disabled={!supported || !voice || !active || !text.trim()} onClick={toggle} aria-pressed={speaking}>
      {speaking ? <Square size={19} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}{t(speaking ? 'Stop listening' : label)}
    </button>
    {(!supported || !voice) && <small>{t('Reading aloud is not available in this language on this device. You can still record your idea.')}</small>}
    {failed && <small role="status">{t('Could not play the voice. Try again or ask someone to read with you.')}</small>}
  </div>
}
