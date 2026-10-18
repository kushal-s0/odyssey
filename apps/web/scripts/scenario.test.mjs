import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateScenario } from '../src/domain/scenario.ts'

const base = { price: 20, unitCost: 8, unitsPerDay: 100, days: 25, fixedCost: 10000, startup: 40000 }
test('monthly totals, break-even and simple payback use consistent units', () => {
  const result = calculateScenario(base)
  assert.equal(result.revenue, 50000)
  assert.equal(result.cost, 30000)
  assert.equal(result.operatingSurplus, 20000)
  assert.equal(result.breakEvenUnits, 834)
  assert.equal(result.paybackMonths, 2)
  const stressed = calculateScenario({ ...base, unitsPerDay: 80 })
  assert.equal(stressed.operatingSurplus, 14000)
  assert.equal(stressed.operatingSurplus - result.operatingSurplus, -6000)
})
test('zero or negative unit margin cannot manufacture break-even or payback', () => {
  for (const price of [0, 8]) {
    const result = calculateScenario({ ...base, price })
    assert.equal(result.breakEvenUnits, null)
    assert.equal(result.paybackMonths, null)
    assert.ok(result.operatingSurplus < 0)
  }
  const noSales = calculateScenario({ ...base, unitsPerDay: 0, startup: null })
  assert.equal(noSales.operatingSurplus, -10000)
  assert.equal(noSales.paybackMonths, null)
})
test('missing, infinite, negative and impossible calendar inputs are rejected', () => {
  for (const patch of [{ price: NaN }, { unitCost: -1 }, { fixedCost: Infinity }, { days: 32 }, { days: 0 }, { days: 25.5 }, { startup: -1 }, { price: 1e10 }]) {
    assert.equal(calculateScenario({ ...base, ...patch }), null)
  }
  assert.equal(calculateScenario({ ...base, price: 1e9, unitsPerDay: 1e9 }), null)
  assert.equal(calculateScenario({ ...base, price: 5e-324, unitCost: 0 }), null)
})
