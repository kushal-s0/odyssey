import { useI18n } from '../i18n/I18nProvider'
import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

type Theme = 'system' | 'light' | 'dark'
export function ThemeToggle() {
  const { t } = useI18n()
  const [theme, setTheme] = useState<Theme>(() => {
    try { const saved = localStorage.getItem('udyam:theme'); if (saved === 'light' || saved === 'dark') return saved } catch { /* browser storage optional */ }
    return 'system'
  })
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme }
    apply(); media.addEventListener('change', apply)
    try { localStorage.setItem('udyam:theme', theme) } catch { /* theme still works */ }
    return () => media.removeEventListener('change', apply)
  }, [theme])
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  return <label className="theme-control"><Icon size={17} aria-hidden="true" /><span className="sr-only">{t("Color theme")}</span><select aria-label={t("Color theme")} value={theme} onChange={e => setTheme(e.target.value as Theme)}><option value="system">{t("System")}</option><option value="light">{t("Light")}</option><option value="dark">{t("Dark")}</option></select></label>
}
