import { useI18n } from '../i18n/I18nProvider'
import { useEffect, useState } from 'react'
import { Calculator } from 'lucide-react'
import { apiRequest, type Assessment } from '../api/client'
import type { components } from '../api/generated/schema'

export function ArithmeticChecks({ value, token }: { value: Assessment; token: string }) {
  const { t } = useI18n()
  const [result, setResult] = useState<components['schemas']['Economics'] | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<components['schemas']['Economics']>(`/v1/submissions/${value.submission_id}/economics`, { token, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { if (data.assessment_id !== value.id) { setError('A newer assessment is available. Refresh the processing status.'); return } setResult(data); setError('') } })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : t("Financial checks unavailable.")) })
    return () => controller.abort()
  }, [value.submission_id, value.id, token, reload])
  return <section className="tool-panel"><div className="tool-heading"><Calculator size={20} /><h3>{t("Check the business numbers")}</h3><span className="badge">{t("Calculated from supplied figures")}</span></div>
    {error && <p role="alert" className="form-error">{error} <button className="text-button" onClick={() => setReload(n => n + 1)}>{t("Retry")}</button></p>}
    <div className="economics-list">{result?.checks.map(check => <article key={check.kind} className={`economics-check ${check.status === 'discrepancy' ? 'warning' : ''}`}><strong>{check.title}</strong><span className="badge">{check.status.replaceAll('_', ' ')}</span><p>{check.explanation}</p>{check.formula && <p><code>{check.formula}</code> {check.currency} {check.period === 'once' ? '· one-time' : ` / ${check.period}`}</p>}{check.stated_amount && check.status === 'discrepancy' && <p>{t("Stated:")} {check.stated_amount} {check.currency}{t(". Calculated:")} {check.calculated_amount}.</p>}{check.assumptions.length > 0 && <details><summary>{t("Sources & assumptions")}</summary><ul>{check.assumptions.map(text => <li key={text}>{text}</li>)}</ul><small>{t("Sources:")} {check.source_segment_ids.map(id => value.evidence.findIndex(s => s.id === id) + 1).join(', ') || t("No compatible source figures")}</small></details>}</article>)}</div>
    {result && <p className="field-note">{result.note}</p>}
  </section>
}
