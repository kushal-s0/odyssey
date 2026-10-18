// Read-only check of the standalone local report. No app, provider or model calls.
import { chromium, expect } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve('../..')
const target = resolve(root, 'evals/reports/comprehensive/IMPLEMENTATION_AND_MODEL_EVALUATION.html')
const report = JSON.parse(await readFile(resolve(root, 'evals/reports/comprehensive/summary.json'), 'utf8'))
const output = resolve(root, '.local/comprehensive-report-preview')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  const network = []
  page.on('pageerror', error => errors.push(error.name))
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()) })
  await page.goto(pathToFileURL(target).href)
  await expect(page.getByRole('heading', { name: /Implementation and model evaluation/ })).toBeVisible()
  await expect(page.locator('body')).toContainText('89/99')
  await expect(page.locator('body')).toContainText('making a loss')
  if (report.business_cases_measured !== 14 || report.business_assertions_total !== 99) throw new Error('Incomplete report')
  const tables = await page.locator('table').count()
  if (tables < 25) throw new Error('Expected detailed task/model/case tables')
  await page.locator('#search').fill('N03')
  const visibleRows = await page.locator('tbody tr:visible').count()
  const hiddenRows = await page.locator('tbody tr[hidden]').count()
  if (!visibleRows || !hiddenRows) throw new Error('Table search did not filter')
  await page.locator('#search').fill('')
  await page.screenshot({ path: resolve(output, 'desktop.png') })
  await page.setViewportSize({ width: 390, height: 1000 })
  const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }))
  if (dimensions.content > dimensions.viewport) throw new Error('Report has mobile page overflow')
  await page.screenshot({ path: resolve(output, 'mobile.png') })
  if (errors.length || network.length) throw new Error('Standalone report must have no JS errors or external requests')
  const result = { scope: 'Local standalone report only; no model or application interaction', tables, search_filters_rows: true,
    page_errors: errors, external_requests: network.length, mobile_dimensions: dimensions, passed: true }
  await writeFile(resolve(root, 'evals/reports/comprehensive/report-browser-check.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
} finally { await browser.close() }
