// Real Supabase login/storage and owned-model verification; credentials stay in an ignored file.
import { chromium, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const fixture = JSON.parse(await readFile(process.env.LIVE_UI_FIXTURE, 'utf8'))
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const checks = []
async function waitAssessment(page) {
  const deadline = Date.now() + 600000
  while (Date.now() < deadline) {
    if (await page.getByRole('heading', { name: 'A clearer view of your idea' }).count()) return
    if (await page.locator('.processing-status').filter({ hasText: /Processing stopped|Needs review/ }).count()) {
      throw new Error('Model processing needs review; inspect the saved job error')
    }
    await page.waitForTimeout(5000)
    const refresh = page.getByRole('button', { name: 'Refresh status', exact: true })
    const paused = page.locator('.submission-detail .field-note').filter({
      hasText: /Automatic updates paused|Automatic updates are paused|Use Refresh status to try again/,
    })
    if (await paused.count() && await refresh.isVisible() && await refresh.isEnabled()) await refresh.click()
  }
  throw new Error('Assessment did not complete within the bounded ten-minute queue check')
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.name))
  // Exercise recovery from an API outage; Auth itself is never mocked.
  let failWorkspace = true
  await page.route('**/v1/me', route => failWorkspace
    ? route.fulfill({ status: 503, json: { code: 'http_503', message: 'Workspace storage is unavailable; try again shortly', retryable: true } })
    : route.continue())
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(fixture.email)
  await page.getByLabel('Password', { exact: true }).fill(fixture.password)
  await page.getByRole('button', { name: 'Sign in to workspace' }).click()
  await page.getByRole('heading', { name: 'Your workspace needs attention.' }).waitFor({ timeout: 30000 })
  failWorkspace = false
  await page.getByRole('button', { name: 'Retry workspace connection' }).click()
  await page.getByRole('heading', { name: /Your idea,/ }).waitFor({ timeout: 30000 })
  checks.push('Real Supabase password login, ES256 session verification, profile/cohort access and workspace retry.')
  console.log('PASS live login and workspace recovery')
  if (!fixture.pdfOnly) {
  await page.getByLabel('Your idea', { exact: false }).fill('I plan to sell tea to office workers near the bus stop. Tea costs INR 10 per cup. Investment is INR 30000. My costs and profit are not known yet.')
  await page.getByLabel('Program / cohort').selectOption({ label: 'Live verification cohort' })
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Submit idea', exact: true }).click()
  await expect(page.getByText('Your idea is saved.', { exact: false })).toBeVisible({ timeout: 30000 })
  await waitAssessment(page)
  await page.getByRole('button', { name: 'View source 1', exact: true }).first().click()
  await expect(page.getByRole('region', { name: 'Selected source' })).toContainText('office workers')
  checks.push('Browser text submission reaches a real GPU assessment persisted in Supabase; source evidence opens.')
  console.log('PASS live text assessment and evidence')
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'A clearer view of your idea' }).waitFor({ timeout: 30000 })
  checks.push('Reload restores real authenticated session, submission and assessment.')
  }
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  await page.getByLabel('PDF file', { exact: true }).setInputFiles(resolve(fixture.directory, 'synthetic.pdf'))
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Submit idea', exact: true }).click()
  await expect(page.getByText('Your original upload is saved.', { exact: false })).toBeVisible({ timeout: 45000 })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download original' }).click()
  await (await download).saveAs(resolve(fixture.directory, 'downloaded.pdf'))
  const digest = async name => createHash('sha256').update(await readFile(resolve(fixture.directory, name))).digest('hex')
  if (await digest('synthetic.pdf') !== await digest('downloaded.pdf')) throw new Error('Original PDF differs')
  await waitAssessment(page)
  checks.push('Private Supabase PDF upload/download preserves bytes and real digital-PDF assessment completes.')
  console.log('PASS live PDF storage and assessment')
  await page.screenshot({ path: resolve(fixture.directory, 'live-assessment.png'), fullPage: true })
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
  if (errors.length) throw new Error(`Browser errors: ${errors.join(', ')}`)
  checks.push('Sign-out clears private workspace; no browser page errors.')
  await writeFile(resolve(fixture.directory, 'result.json'), JSON.stringify({ checks, pageErrors: errors }, null, 2))
} catch (error) {
  console.error('Live browser check failed:', error.name, String(error.message).split('\n')[0])
  process.exitCode = 1
} finally {
  await writeFile(resolve(fixture.directory, 'result.json'), JSON.stringify({ checks, passed: !process.exitCode }, null, 2))
  await browser.close()
}
