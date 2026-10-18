import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { hindi } from './hi'
import { simpleEnglish, simpleHindi } from './simple'

export type Locale = 'en' | 'hi'
type I18n = { locale: Locale; setLocale: (locale: Locale) => void; t: (source: string) => string }
const Context = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    try { return localStorage.getItem('udyam:language') === 'hi' ? 'hi' : 'en' } catch { return 'en' }
  })
  useEffect(() => {
    document.documentElement.lang = locale
    try { localStorage.setItem('udyam:language', locale) } catch { /* language still works */ }
  }, [locale])
  const t = useCallback((source: string) => locale === 'hi' ? simpleHindi[source] ?? hindi[source] ?? simpleEnglish[source] ?? source : simpleEnglish[source] ?? source, [locale])
  return <Context.Provider value={{ locale, setLocale, t }}>{children}</Context.Provider>
}

export function useI18n(): I18n {
  const value = useContext(Context)
  if (!value) throw new Error('I18nProvider is required')
  return value
}
