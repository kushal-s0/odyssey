import { AlertTriangle, ClipboardCheck, ArrowRight } from 'lucide-react'
import type { Assessment } from '../api/client'
import { screeningFindings, type Economics, type Finding } from '../domain/screening'
import { useI18n } from '../i18n/I18nProvider'

const messages: Record<Finding['code'], [string, string]> = {
  loss: ['Operating loss in the supplied figures', 'Check costs and selling price with the entrepreneur before discussing funding. This calculation is not verified net profit.'],
  funding_gap: ['Startup funding is short', 'Confirm the missing funding or reduce the proposed startup cost. A requested loan is not approved funding.'],
  number_conflict: ['The financial figures do not reconcile', 'Review the linked amounts, units and time periods. Keep the original claim visible while asking for a correction.'],
  source_review: ['Check the original before relying on this assessment', 'A translation, transcription or language flag remains. Compare the original and ask the entrepreneur to confirm important words and amounts.'],
  weak_dimension: ['A supplied business assumption needs work', 'At least one model-rated dimension has weak support. Check its reason and evidence; do not reject an applicant because information is missing.'],
  missing_information: ['Ask for the missing information', 'Unknown is different from a weak business. Ask a useful follow-up question before interpreting the total.'],
}

export function ScreeningBrief({ value, numbers, idPrefix, onNext }: { value: Assessment; numbers: Economics | null; idPrefix: string; onNext: () => void }) {
  const { t, locale } = useI18n()
  const findings = screeningFindings(value, numbers)
  const financialRisk = findings.some(item => ['loss', 'funding_gap', 'number_conflict'].includes(item.code))
  const title = financialRisk ? 'Resolve the financial risk first' : findings.length ? 'Clarify and verify before deciding' : 'Ready for a mentor’s deeper review'
  return <section className={`screening-brief ${financialRisk ? 'financial-risk' : ''}`} aria-label={t('First review summary')}>
    <div className="tool-heading">{financialRisk ? <AlertTriangle size={23} /> : <ClipboardCheck size={23} />}<span className="eyebrow">{t('YOUR NEXT USEFUL STEP')}</span></div>
    <h3>{t(title)}</h3><p>{t('This review summary uses the saved evidence and arithmetic. It does not approve funding or predict business success.')}</p>
    {!numbers && <p className="field-note">{t('Financial checks are not available in this saved view yet. Open Business plan to check the numbers; do not interpret this as a clean financial result.')}</p>}
    <ul>{findings.map((finding, index) => <li key={`${finding.code}-${index}`}><strong>{t(messages[finding.code][0])}</strong>
      {finding.amount && <span className="risk-amount">{new Intl.NumberFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(finding.amount))}{finding.period && <small> / {t(finding.period)}</small>}</span>}
      <p>{t(messages[finding.code][1])}</p><div className="field-links">{finding.fields.map(field => <a key={field} href={`#${idPrefix}fact-${field}`}>{t(field.replaceAll('_', ' '))} ↗</a>)}</div>
    </li>)}</ul>
    {!findings.length && <p>{t('Use the original evidence, demand checks and local context to choose mentoring, skilling or deeper evaluation. A lack of flagged arithmetic is not proof that the business will succeed.')}</p>}
    <p className="field-note">{t('The model has previously overrated weak business cases. Financial warnings take priority over an attractive score; a human reviewer must check demand and feasibility.')}</p>
    <button type="button" className="secondary-button" onClick={onNext}>{t('Work on the next useful questions')}<ArrowRight size={15} /></button>
  </section>
}
