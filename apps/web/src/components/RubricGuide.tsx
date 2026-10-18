import { useI18n } from '../i18n/I18nProvider'

const dimensions = [['Business clarity', 15], ['Customer need', 20], ['Market potential', 20], ['Feasibility', 25], ['Competition', 10], ['Differentiation', 10]] as const
const anchors = ['0 — supplied evidence shows a weakness', '1 — weak support', '2 — plausible, limited evidence', '3 — well supported in the proposal', '4 — concrete validation; verify the claim']

export function RubricGuide() {
  const { t } = useI18n()
  return <details className="rubric-guide"><summary>{t('What do these ratings mean?')}</summary>
    <p>{t('T03 defines the rubric: a proposed checklist for consistent first review, not an official Tata STRIVE formula or a trained success predictor.')}</p>
    <div className="rubric-table"><table><caption>{t('Six dimensions and their weights')}</caption><thead><tr><th>{t('Assessment dimension')}</th><th>{t('Weight')}</th></tr></thead><tbody>{dimensions.map(([name, weight]) => <tr key={name}><th scope="row">{t(name)}</th><td>{weight}%</td></tr>)}</tbody></table></div>
    <ul>{anchors.map(anchor => <li key={anchor}>{t(anchor)}</li>)}</ul>
    <p>{t('Unknown or conflicting information stays unrated. It is never automatically a zero. A score of 50/100 is not a 50% chance of success.')}</p>
    <p>{t('The total is the weighted average of assessed ratings, scaled from 0–4 to 0–100. Coverage below 70%, critical conflicts or unreviewed sources can withhold the headline. Information completeness is a separate checklist.')}</p>
  </details>
}
