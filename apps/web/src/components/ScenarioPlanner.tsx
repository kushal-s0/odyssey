import { useI18n } from '../i18n/I18nProvider'
import { useId, useState } from 'react'
import { Calculator, RotateCcw } from 'lucide-react'
import type { Assessment } from '../api/client'
import { calculateScenario, type ScenarioInput } from '../domain/scenario'

const fields = [
  ['price', 'Selling price per unit (INR)', 'Amount charged per sale unit'],
  ['unitCost', 'Variable cost per unit (INR)', 'Materials and other costs for one sale unit'],
  ['unitsPerDay', 'Units sold per operating day', 'Use the same sale unit as the price'],
  ['days', 'Operating days per month', 'A whole number from 1 to 31'],
  ['fixedCost', 'Fixed costs per month (INR)', 'Costs not included in the per-unit cost'],
  ['startup', 'Startup cost (INR, optional)', 'For a simple payback estimate'],
] as const
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)

export function ScenarioPlanner({ value }: { value: Assessment }) {
  const { t } = useI18n()
  const titleId = useId()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [stress, setStress] = useState(false)
  const [baseline, setBaseline] = useState<ReturnType<typeof calculateScenario>>(null)
  const price = value.business.unit_price?.value
  const validPrice = value.business.unit_price?.status === 'present' && price?.currency === 'INR' && price.unit && ['unknown', 'once'].includes(price.period)
  const required = fields.filter(([key]) => key !== 'startup')
  const complete = required.every(([key]) => draft[key]?.trim())
  const parsed = Object.fromEntries(fields.map(([key]) => [key, draft[key]?.trim() ? Number(draft[key]) : key === 'startup' ? null : NaN])) as ScenarioInput
  const current = complete ? calculateScenario(parsed) : null
  const scenario = current && stress ? calculateScenario({ ...parsed, unitsPerDay: parsed.unitsPerDay * .8 }) : current
  return <section className="tool-panel scenario-planner" aria-labelledby={titleId}><div className="tool-heading"><Calculator size={20} /><h3 id={titleId}>{t("Try the numbers before you commit")}</h3><span className="badge">{t("What-if · not a forecast")}</span></div>
    <p className="field-note">{t("Enter your own assumptions in INR. This scratchpad stays in this open page; it does not change your submitted facts, score or explanation. All sales must use the same unit.")}</p>
    {validPrice && <button type="button" className="text-button" onClick={() => setDraft({ ...draft, price: String(price.amount) })}>{t("Use saved selling price:")} {money(Number(price.amount))} {t("per")} {price.unit}</button>}
    <div className="scenario-layout"><div className="scenario-inputs">{fields.map(([key, label, hint]) => <label key={key}>{t(label)}<input aria-label={t(label)} type="number" min={key === 'days' ? 1 : 0} max={key === 'days' ? 31 : 1e9} step={key === 'days' ? 1 : 'any'} inputMode="decimal" value={draft[key] || ''} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /><small>{t(hint)}</small></label>)}</div>
    <div className="scenario-output" aria-live="polite">{scenario ? <><span className="eyebrow">{t("MONTHLY OPERATING SCENARIO")}</span><strong className={scenario.operatingSurplus < 0 ? 'negative-value' : 'scenario-total'}>{money(scenario.operatingSurplus)}</strong><p>{t("Operating")} {scenario.operatingSurplus < 0 ? 'shortfall' : 'surplus'} {t("before tax, interest, depreciation and omitted costs")}</p>
      <div className="scenario-bars" aria-label={t("Monthly revenue and cost comparison")}>{([[t("Sales revenue"), scenario.revenue], [t("Operating costs"), scenario.cost]] as const).map(([label, amount]) => <div key={label}><span>{label}<b>{money(amount)}</b></span><div><i style={{ width: `${Math.max(scenario.revenue, scenario.cost) > 0 ? amount / Math.max(scenario.revenue, scenario.cost) * 100 : 0}%` }} /></div></div>)}</div>
      <dl className="scenario-facts"><div><dt>{t("Contribution per unit")}</dt><dd>{money(scenario.contribution)}</dd></div><div><dt>{t("Break-even sales / month")}</dt><dd>{scenario.breakEvenUnits === null ? t("No positive unit margin") : `${scenario.breakEvenUnits.toLocaleString('en-IN')} units`}</dd></div><div><dt>{t("Simple startup payback")}</dt><dd>{scenario.paybackMonths === null ? t("Not available") : `${scenario.paybackMonths.toFixed(1)} months`}</dd></div></dl>
      {baseline && <p className="scenario-difference">{t("Against pinned scenario:")} {money(scenario.operatingSurplus - baseline.operatingSurplus)} {t("/ month")}</p>}
      {scenario.contribution <= 0 && <p className="form-error">{t("The selling price does not cover variable cost. Selling more at these assumptions cannot cover fixed costs.")}</p>}
      {scenario.paybackMonths !== null && <p className="field-note">{t("Simple payback assumes the entire operating surplus is available to recover startup costs. It is not a cash-flow or loan repayment schedule.")}</p>}
    </> : <div className="scenario-placeholder"><Calculator size={30} /><h4>{t("Make the assumptions visible.")}</h4><p>{complete ? t("Check the inputs: use nonnegative amounts up to 1 billion and 1–31 whole operating days. Extremely large results or tiny unit margins exceed this calculator’s precision; use smaller amounts or a larger sale unit.") : t("Add the five operating assumptions to see revenue, costs and break-even sales. Zero is allowed; a blank stays unknown.")}</p></div>}</div></div>
    <div className="scenario-actions"><label className="inline-check"><input type="checkbox" checked={stress} onChange={event => setStress(event.target.checked)} />{t("Stress test: 20% fewer sales")}</label><button type="button" className="secondary-button" disabled={!scenario} onClick={() => setBaseline(scenario)}>{t("Pin scenario for comparison")}</button><button type="button" className="text-button" onClick={() => { setDraft({}); setBaseline(null); setStress(false) }}><RotateCcw size={14} />{t("Reset scratchpad")}</button></div>
    <p className="field-note">{t("Illustrative arithmetic: revenue = price × daily units × operating days. Costs = variable cost × units + fixed costs. Break-even rounds monthly units up. Demand, tax, financing and cash timing are not validated.")}</p>
  </section>
}
