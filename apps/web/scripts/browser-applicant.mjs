// Auth responses and microphone input are explicit fixtures. API/PG/model are real and local.
import { chromium, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const fixture = JSON.parse(await readFile(process.env.APPLICANT_UI_FIXTURE, 'utf8'))
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const checks = []
let page
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.grantPermissions(['microphone'], { origin: fixture.web })
  page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.name))
  const user = { id: fixture.user, aud: 'authenticated', role: 'authenticated', email: 'applicant@example.test',
    app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  await page.route('https://identity.example.test/**', route => {
    if (route.request().url().includes('/token')) return route.fulfill({ json: { access_token: fixture.token,
      refresh_token: 'synthetic-refresh-only', expires_in: 3600, expires_at: fixture.expires, token_type: 'bearer', user } })
    if (route.request().url().includes('/user')) return route.fulfill({ json: user })
    return route.fulfill({ status: 204 })
  })
  await page.goto(fixture.web, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill('applicant@example.test')
  await page.getByLabel('Password', { exact: true }).fill('synthetic-fixture-password')
  await page.getByRole('button', { name: 'Sign in to workspace' }).click()
  await page.getByRole('heading', { name: /Your idea,/ }).waitFor()
  await expect(page.getByRole('note')).toContainText('Local verification fixture')
  checks.push('Signed-in applicant uses actual signature verification, trusted profile/cohort and API (fixture Auth issuer).')
  const idea = 'I plan to sell tea to office workers near the bus stop. Tea costs INR 10 per cup. Investment is INR 30000. My costs and profit are not known yet.'
  await page.getByLabel('Your idea', { exact: false }).fill(idea)
  await page.getByLabel('Program / cohort').selectOption({ label: 'Synthetic test cohort' })
  await page.getByLabel('Known business location').fill('Synthetic test locality')
  await page.getByRole('checkbox').check()
  let loseSubmit = true
  let posts = 0
  const submissionRoute = `${fixture.origin}/v1/submissions`
  await page.route(submissionRoute, async route => {
    if (route.request().method() !== 'POST') return route.continue()
    posts += 1
    if (loseSubmit) { loseSubmit = false; await route.fetch(); return route.abort('failed') }
    return route.continue()
  })
  await page.locator('.submission-panel form').evaluate(form => { form.requestSubmit(); form.requestSubmit() })
  await expect(page.getByRole('alert')).toContainText('Connection interrupted')
  const saved = page.waitForResponse(response => response.url() === submissionRoute && response.request().method() === 'POST' && response.status() === 202)
  await page.getByRole('button', { name: 'Submit idea', exact: true }).click()
  const accepted = await (await saved).json()
  await expect(page.getByText('Your idea is saved.', { exact: false })).toBeVisible()
  if (posts !== 2) throw new Error('Double submission or lost-response retry did not behave as expected')
  checks.push('Lost accepted response + double submit recover with one idempotent text submission.')
  const deadline = Date.now() + 200_000
  while (Date.now() < deadline && !(await page.getByRole('heading', { name: 'A clearer view of your idea' }).count())) {
    await page.waitForTimeout(2500)
    const refresh = page.getByRole('button', { name: 'Refresh status', exact: true })
    if (await refresh.isEnabled()) await refresh.click()
  }
  await page.getByRole('heading', { name: 'A clearer view of your idea' }).waitFor({ timeout: 1000 })
  await expect(page.getByText('Clarification needed', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View source 1', exact: true }).first().click()
  await expect(page.getByRole('region', { name: 'Selected source' })).toContainText('office workers')
  checks.push('Actual owned Qwen text pipeline persists assessment; UI shows withheld headline, domain reasoning and original/English evidence.')
  await page.screenshot({ path: resolve(fixture.directory, 'desktop-assessment.png'), fullPage: true })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'A clearer view of your idea' }).waitFor()
  checks.push('Refresh restores authenticated saved submission, processing status and real assessment.')
  const listing = await page.request.get(`${fixture.origin}/v1/submissions`, { headers: { Authorization: `Bearer ${fixture.token}` } })
  const rows = await listing.json()
  if (rows.filter(row => row.id === accepted.submission_id).length !== 1) throw new Error('Accepted text is missing from real API listing')

  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  await page.getByLabel('PDF file', { exact: true }).setInputFiles(resolve(fixture.directory, 'synthetic.pdf'))
  await page.getByRole('checkbox').check()
  let failUpload = true
  await page.route(`${fixture.origin}/v1/uploads/*/complete`, route => {
    if (failUpload) { failUpload = false; return route.abort('failed') }
    return route.continue()
  })
  await page.getByRole('button', { name: 'Submit idea', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Upload interrupted')
  const pdfSaved = page.waitForResponse(response => response.url() === submissionRoute && response.request().method() === 'POST' && response.status() === 202)
  await page.getByRole('button', { name: 'Submit idea', exact: true }).click()
  await pdfSaved
  await expect(page.getByText('Your original upload is saved.', { exact: false })).toBeVisible()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download original' }).click()
  await (await downloaded).saveAs(resolve(fixture.directory, 'downloaded.pdf'))
  const digest = async name => createHash('sha256').update(await readFile(resolve(fixture.directory, name))).digest('hex')
  if (await digest('synthetic.pdf') !== await digest('downloaded.pdf')) throw new Error('Saved original PDF differs')
  checks.push('Real PDF upload retry/progress and authenticated original download preserve bytes; processing explicitly pending.')

  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await page.evaluate(() => {
    window.__udyamGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Synthetic denied permission', 'NotAllowedError') }
  })
  await page.getByRole('button', { name: 'Record your idea' }).click()
  await expect(page.getByText('Microphone unavailable or permission denied.', { exact: false })).toBeVisible()
  await page.getByLabel('Audio file', { exact: true }).setInputFiles(resolve(fixture.directory, 'synthetic.wav'))
  await expect(page.getByLabel('Recording playback')).toBeVisible()
  await page.getByRole('checkbox').check()
  const audioSaved = page.waitForResponse(response => response.url() === submissionRoute && response.request().method() === 'POST' && response.status() === 202)
  await page.getByRole('button', { name: 'Submit idea', exact: true }).click()
  await audioSaved
  await expect(page.getByText('Your original upload is saved.', { exact: false })).toBeVisible()
  checks.push('Denied microphone has working real audio-upload/playback fallback; audio processing remains pending.')

  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = window.__udyamGetUserMedia })
  await page.getByRole('button', { name: 'Record your idea' }).click()
  await page.getByRole('button', { name: 'Stop recording' }).waitFor()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByText('Recording ready.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Recording playback')).toBeVisible()
  await page.getByRole('checkbox').check()
  const recordedSaved = page.waitForResponse(response => response.url() === submissionRoute && response.request().method() === 'POST' && response.status() === 202)
  await page.getByRole('button', { name: 'Submit idea', exact: true }).click()
  await recordedSaved
  await expect(page.getByText('Your original upload is saved.', { exact: false })).toBeVisible()
  checks.push('Real MediaRecorder encodes synthetic browser microphone input; playback and actual private WebM upload succeed.')

  await page.setViewportSize({ width: 390, height: 1000 })
  const textMode = page.getByRole('button', { name: 'Text', exact: true })
  await textMode.focus(); await page.keyboard.press('Enter')
  await page.getByLabel('Your idea', { exact: false }).fill('चाय का व्यापार — माझा व्यवसाय')
  await page.getByLabel('Your idea', { exact: false }).focus(); await page.keyboard.press('Tab')
  await expect(page.getByLabel('Preferred language')).toBeFocused()
  await page.getByLabel('Preferred language').selectOption('hi')
  const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }))
  if (dimensions.content > dimensions.viewport) throw new Error('Mobile horizontal overflow')
  await page.screenshot({ path: resolve(fixture.directory, 'mobile-workspace.png'), fullPage: true })
  checks.push('390px mobile fits without overflow; keyboard format control/tab order and regional-script input work.')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
  await expect(page.getByRole('heading', { name: 'My submissions' })).toHaveCount(0)
  if (errors.length) throw new Error(`Browser page errors: ${errors.join(', ')}`)
  checks.push('Sign-out removes private submission/assessment UI; no browser page errors.')
  await writeFile(resolve(fixture.directory, 'browser-results.json'), JSON.stringify(checks, null, 2))
  console.log(JSON.stringify({ passed: checks.length, scope: 'Synthetic Auth/microphone fixtures, actual local API/PG/model' }))
} catch (failure) {
  if (page) await page.screenshot({ path: resolve(fixture.directory, 'failure.png'), fullPage: true }).catch(() => undefined)
  throw failure
} finally { await browser.close() }
