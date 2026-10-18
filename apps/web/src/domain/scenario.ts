export type ScenarioInput = { price: number; unitCost: number; unitsPerDay: number; days: number; fixedCost: number; startup: number | null }

/** Explicit INR assumptions only; never used to modify an assessment or persist business facts. */
export function calculateScenario(input: ScenarioInput) {
  const values = [input.price, input.unitCost, input.unitsPerDay, input.days, input.fixedCost]
  if (values.some(value => !Number.isFinite(value) || value < 0 || value > 1e9)
    || input.days < 1 || input.days > 31 || !Number.isInteger(input.days)
    || (input.startup !== null && (!Number.isFinite(input.startup) || input.startup < 0 || input.startup > 1e9))) return null
  const units = input.unitsPerDay * input.days
  const revenue = units * input.price
  const variableCost = units * input.unitCost
  const cost = variableCost + input.fixedCost
  const operatingSurplus = revenue - cost
  const contribution = input.price - input.unitCost
  // Keep displayed money within a range where whole paise remain representable.
  if ([units, revenue, variableCost, cost, operatingSurplus, contribution].some(value =>
    !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100)) return null
  const breakEvenUnits = contribution > 0 ? Math.ceil(input.fixedCost / contribution) : null
  const paybackMonths = input.startup !== null && input.startup > 0 && operatingSurplus > 0 ? input.startup / operatingSurplus : null
  if ((breakEvenUnits !== null && !Number.isSafeInteger(breakEvenUnits))
    || (paybackMonths !== null && !Number.isFinite(paybackMonths))) return null
  return { units, revenue, variableCost, cost, operatingSurplus, contribution, breakEvenUnits, paybackMonths }
}
