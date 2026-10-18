import { Languages } from 'lucide-react'
import { useI18n, type Locale } from '../i18n/I18nProvider'

export function LanguagePicker() {
  const { locale, setLocale } = useI18n()
  return <label className="language-control"><Languages size={17} aria-hidden="true" /><span className="sr-only">Interface language / भाषा</span>
    <select aria-label="Interface language / भाषा" value={locale} onChange={event => setLocale(event.target.value as Locale)}>
      <option value="en" lang="en">English</option><option value="hi" lang="hi">हिन्दी</option>
    </select>
  </label>
}
