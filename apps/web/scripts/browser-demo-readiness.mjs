// Software/UI checks only: Auth/API are intercepted fixtures. Replays saved model
// outputs from the previous evaluation; never starts inference or accesses user data.
import { chromium, expect } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const root = resolve(import.meta.dirname, '../../..')
const web = process.env.DEMO_WEB_URL || 'http://127.0.0.1:5173'
const directory = resolve(root, '.local/simple-ui')
await mkdir(directory, { recursive: true })
const samples = await Promise.all(['N01', 'N03', 'U01', 'P01'].map(async key => ({ key, ...JSON.parse(await readFile(resolve(root, `evals/reports/comprehensive/cases/${key}.json`), 'utf8')) })))
const translations = JSON.parse(await readFile(resolve(root, 'data/localization/questions.json'), 'utf8')).translations
const submissions = samples.map(sample => ({ id: sample.assessment.submission_id, revision_id: sample.assessment.input_revision_id,
  revision_number: 1, input_kind: 'text', preferred_language: 'en', source_text: sample.assessment.evidence.map(item => item.original_text).join('\n'),
  attachment_id: null, cohort_id: null, synthetic: true, job_id: randomUUID(), status: 'completed', created_at: sample.assessment.created_at }))
const actor = { id: randomUUID(), role: 'admin', display_name: 'Synthetic UI reviewer', cohorts: [] }
const processing = { ...submissions[0], id: randomUUID(), revision_id: randomUUID(), job_id: randomUUID(), status: 'structuring', source_text: 'Synthetic processing example' }
submissions.push(processing)
const checks = [], errors = [], initKeys = [], submitKeys = [], originals = new Map()
let putCount = 0, deleteCount = 0, submissionCount = 0, releasePaused
let processingReads = 0
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.addInitScript(() => {
    const events = new EventTarget()
    window.__spoken = []
    window.__cancelled = 0
    window.__voices = [
      { name: 'Fixture English', lang: 'en-IN', localService: true },
      { name: 'Fixture Hindi', lang: 'hi-IN', localService: true },
    ]
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text } } })
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => window.__voices,
      speak: utterance => window.__spoken.push({ text: utterance.text, lang: utterance.lang, local: utterance.voice.localService }),
      cancel: () => ++window.__cancelled,
      addEventListener: (...args) => events.addEventListener(...args),
      removeEventListener: (...args) => events.removeEventListener(...args),
      dispatchEvent: (...args) => events.dispatchEvent(...args),
    } })
  })
  await page.clock.install()
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path.startsWith('/auth/v1/')) {
      const user = { id: actor.id, aud: 'authenticated', role: 'authenticated', email: 'demo@example.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
      if (path.includes('/token')) {
        const payload = Buffer.from(JSON.stringify({ sub: actor.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
        return route.fulfill({ json: { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic`, refresh_token: 'synthetic-only', token_type: 'bearer', expires_in: 3600, user } })
      }
      return path.includes('/user') ? route.fulfill({ json: user }) : route.fulfill({ status: 204 })
    }
    if (path.startsWith('/health/')) return route.fulfill({ json: { database: 'ready', status: 'ok' } })
    if (path === '/v1/me') return route.fulfill({ json: actor })
    if (path === '/v1/uploads' && request.method() === 'POST') {
      const key = request.headers()['idempotency-key']; initKeys.push(key)
      if (!originals.has(key)) originals.set(key, randomUUID())
      const id = originals.get(key)
      return route.fulfill({ status: 201, json: { attachment_id: id, upload_path: `/v1/uploads/${id}/complete`, expires_in_seconds: 86400 } })
    }
    if (/^\/v1\/uploads\/[^/]+\/complete$/.test(path)) {
      ++putCount
      if (putCount === 1) return route.fulfill({ status: 410, json: { message: 'Synthetic expired upload', code: 'expired' } })
      if (putCount === 2) { await new Promise(resolve => { releasePaused = resolve }); return route.fulfill({ status: 200, json: {} }).catch(() => {}) }
      if (putCount === 3) return route.fulfill({ status: 503, json: { message: 'Synthetic interrupted transfer', code: 'interrupted' } })
      return route.fulfill({ status: 200, json: {} })
    }
    if (path.startsWith('/v1/uploads/') && request.method() === 'DELETE') { ++deleteCount; return route.fulfill({ status: 204 }) }
    if (path === '/v1/submissions' && request.method() === 'POST') {
      submitKeys.push(request.headers()['idempotency-key']); ++submissionCount
      if (submissionCount === 1) return route.abort('failed') // response lost after sending a request
      const saved = { ...submissions[0], id: randomUUID(), revision_id: randomUUID(), status: 'needs_review', input_kind: 'pdf', source_text: null }
      submissions.unshift(saved)
      return route.fulfill({ status: 202, json: { submission_id: saved.id, revision_id: saved.revision_id, job_id: saved.job_id, status: saved.status } })
    }
    if (path === '/v1/submissions') return route.fulfill({ json: submissions })
    const match = /^\/v1\/submissions\/([^/]+)(?:\/(.*))?$/.exec(path)
    if (match) {
      const item = submissions.find(item => item.id === match[1]), sample = samples.find(sample => sample.assessment.submission_id === match[1])
      if (match[2] === 'workspace') {
        if (match[1] === processing.id) ++processingReads
        return route.fulfill({ json: { submission: item, assessment: sample?.assessment || null, economics: sample?.economics || null } })
      }
      if (match[2] === 'economics') return route.fulfill({ json: sample?.economics })
      if (match[2] === 'questions') {
        const language = url.searchParams.get('language') || 'en'
        const localized = translations[language]?.offer
        return route.fulfill({ json: [{ id: 'synthetic-offer-question', field: 'offer', label: localized?.label || 'Product or service',
          question: localized?.question || 'What exactly will you sell or provide?', status: 'missing', priority: 0,
          reason: 'The offer is needed before the idea can be assessed fairly.', answer_hint: 'Name the product or service and what a customer receives.',
          source_segment_ids: [], source_note: null, language, english_question: localized ? 'What exactly will you sell or provide?' : null,
          localization_note: localized ? 'Prepared translation; review pending.' : null }] })
      }
      if (match[2] === 'reviews' || match[2] === 'history') return route.fulfill({ json: [] })
      if (match[2] === 'explanation') return route.fulfill({ json: { assessment_id: sample?.assessment.id, provider: 'rule_based', status: 'not_configured', language: 'en', summary: 'Saved synthetic assessment guide.', domain_notes: [], next_steps: [], note: 'UI fixture only.' } })
      if (!match[2]) return route.fulfill({ json: item })
    }
    if (path === `/v1/jobs/${processing.job_id}`) return route.fulfill({ json: {
      id: processing.job_id, submission_id: processing.id, status: 'structuring', backend: 'owned_worker',
      completed_stages: 2, total_stages: 4, attempt: 1, elapsed_seconds: 180,
      stage_progress: { stage: 'structure', completed: 2, total: 7, unit: 'batches' }, retry_after_seconds: 10, error: null } })
    if (path === '/v1/review-queue') return route.fulfill({ json: { items: [], next_cursor: null, total: 0 } })
    if (path === '/v1/analytics') return route.fulfill({ json: { rubric_version: 'rubric-v1', assessed_count: 4, eligible_count: 0, excluded_synthetic: 4, excluded_repeated_family: 0, views: ['domain', 'trade', 'cohort', 'across_cohort'].map(dimension => ({ dimension, groups: [] })) } })
    if (path.startsWith('/v1/')) throw new Error(`Unexpected fixture endpoint: ${path}`)
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return route.abort('blockedbyclient')
    return route.continue()
  })
  const picker = () => page.getByLabel('Interface language / भाषा')
  async function selectIdea(id) {
    const target = page.locator(`[data-submission-id="${id}"]`)
    if (!await target.isVisible()) await page.locator('.saved-picker:visible').click()
    await target.click()
  }
  await page.goto(web, { waitUntil: 'networkidle' })
  await picker().selectOption('hi')
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
  await expect(page.getByRole('heading', { name: 'अपना विचार बताएँ।' })).toBeVisible()
  await page.reload({ waitUntil: 'networkidle' })
  await expect(picker()).toHaveValue('hi')
  await page.getByRole('button', { name: 'साइन इन', exact: true }).click()
  await page.getByLabel('ईमेल', { exact: true }).fill('demo@example.test')
  await page.getByLabel('पासवर्ड', { exact: true }).fill('synthetic-password')
  await page.getByRole('button', { name: 'कार्यक्षेत्र में साइन इन करें' }).click()
  await page.getByRole('button', { name: 'नया विचार', exact: true }).click()
  await page.getByLabel('आपका विचार', { exact: true }).fill('मेरा चाय का व्यवसाय। यह मूल पाठ सुरक्षित रहना चाहिए।')
  await picker().selectOption('en')
  await expect(page.getByLabel('Your idea', { exact: true })).toHaveValue('मेरा चाय का व्यवसाय। यह मूल पाठ सुरक्षित रहना चाहिए।')
  await page.getByRole('button', { name: /Help me answer/ }).click()
  await page.getByLabel('Guided product or service').fill('हिन्दी में ग्राहक का अपना जवाब')
  await picker().selectOption('hi')
  await expect(page.getByLabel('मार्गदर्शक सवाल: आप क्या बेचेंगे')).toHaveValue('हिन्दी में ग्राहक का अपना जवाब')
  await expect(page.getByPlaceholder('आप क्या बेचेंगे या कौन-सी सेवा देंगे?')).toBeVisible()
  checks.push('English/Hindi menus, localized sign-in, persistent locale, unchanged text/guided drafts and translated question hints.')
  await picker().selectOption('en')
  await page.getByRole('button', { name: 'Saved ideas', exact: true }).click()
  await selectIdea(samples[0].assessment.submission_id)
  await expect(page.getByRole('heading', { name: 'Check the money first' })).toBeVisible()
  await expect(page.getByText('Your costs are higher than your sales', { exact: true })).toBeVisible()
  await expect(page.locator('.risk-amount')).toContainText('8,000')
  await expect(page.locator('.assessment-details:visible')).not.toHaveAttribute('open', '')
  await expect(page.locator('.score-grid:visible')).toHaveCount(0)
  await expect(page.locator('.extra-tools:visible')).not.toHaveAttribute('open', '')
  await expect(page.getByRole('button', { name: 'Plan the money', exact: true })).toHaveCount(0)
  await page.getByText('See all details and scores', { exact: true }).click()
  await page.getByText('What do these ratings mean?', { exact: true }).click()
  await expect(page.getByText('A score of 50/100 is not a 50% chance of success.', { exact: false })).toBeVisible()
  await picker().selectOption('hi')
  await expect(page.getByRole('heading', { name: 'पहले पैसे का हिसाब देखें' })).toBeVisible()
  await expect(page.getByText('खर्च, बिक्री की कमाई से ज़्यादा है', { exact: true })).toBeVisible()
  await page.getByText('पूरी जानकारी और अंक देखें', { exact: true }).click()
  await page.screenshot({ path: resolve(directory, 'hindi-risk-desktop.png'), fullPage: true })
  await page.locator('.screening-brief:visible').getByRole('button', { name: 'सुनें', exact: true }).click()
  let spoken = await page.evaluate(() => window.__spoken)
  expect(spoken.at(-1).lang).toBe('hi-IN')
  expect(spoken.at(-1).local).toBe(true)
  expect(spoken.at(-1).text).toContain('खर्च')
  const cancelBeforeLocale = await page.evaluate(() => window.__cancelled)
  await picker().selectOption('en')
  expect(await page.evaluate(() => window.__cancelled)).toBeGreaterThan(cancelBeforeLocale)
  await page.locator('.screening-brief:visible').getByRole('button', { name: 'Listen', exact: true }).click()
  spoken = await page.evaluate(() => window.__spoken)
  expect(spoken.at(-1).lang).toBe('en-IN')
  const cancelBeforeNavigation = await page.evaluate(() => window.__cancelled)
  await page.getByRole('button', { name: 'Answer the next questions', exact: true }).click()
  expect(await page.evaluate(() => window.__cancelled)).toBeGreaterThan(cancelBeforeNavigation)
  await page.getByRole('button', { name: 'Your result', exact: true }).click()
  await picker().selectOption('hi')
  await page.getByRole('button', { name: 'अगले सवालों के जवाब दें', exact: true }).click()
  await expect(page.getByLabel('बताएँ कि ग्राहकों को क्या बेचेंगे या कौन-सी सेवा देंगे।')).toBeVisible()
  await page.getByLabel('बताएँ कि ग्राहकों को क्या बेचेंगे या कौन-सी सेवा देंगे।').fill('अपना मूल जवाब')
  await page.getByRole('button', { name: 'सवाल सुनें', exact: true }).click()
  expect((await page.evaluate(() => window.__spoken)).at(-1).lang).toBe('hi-IN')
  await picker().selectOption('en')
  await expect(page.getByLabel('What exactly will you sell or provide?')).toHaveValue('अपना मूल जवाब')
  await page.getByRole('button', { name: 'Your result', exact: true }).click()
  await picker().selectOption('hi')
  checks.push('Next questions follow English/Hindi interface language until explicitly chosen, use simple Hindi guidance, preserve typed answers on language change, and read the displayed question in its own language.')
  await page.evaluate(() => {
    window.__voices = [{ name: 'Remote Hindi must not be used', lang: 'hi-IN', localService: false }, { name: 'English only', lang: 'en-IN', localService: true }]
    window.speechSynthesis.dispatchEvent(new Event('voiceschanged'))
  })
  await expect(page.locator('.screening-brief:visible').getByRole('button', { name: 'सुनें', exact: true })).toBeDisabled()
  await expect(page.getByText('इस डिवाइस में इस भाषा की आवाज़ उपलब्ध नहीं है। आप फिर भी अपना विचार रिकॉर्ड कर सकते हैं।', { exact: true }).filter({ visible: true })).toBeVisible()
  await page.evaluate(() => {
    window.__voices = [{ name: 'Fixture Hindi', lang: 'hi-IN', localService: true }, { name: 'Fixture English', lang: 'en-IN', localService: true }]
    window.speechSynthesis.dispatchEvent(new Event('voiceschanged'))
  })
  checks.push('Simple result keeps scores/tools collapsed, loss first; local English/Hindi speech chooses the matching language, cancels on locale/navigation, and refuses remote/wrong-language fallback. Speech is a fixture, not a listening-quality evaluation.')
  await page.locator('.screening-brief:visible').screenshot({ path: resolve(directory, 'hindi-risk-panel.png') })
  checks.push('Previously recorded N01: the existing INR 8,000 loss is prominent ahead of unchanged model scores, in both interface languages; rubric explained inline.')
  await picker().selectOption('en')
  await selectIdea(samples[1].assessment.submission_id)
  await expect(page.getByText('You need more money to start', { exact: true })).toBeVisible()
  await expect(page.locator('.risk-amount:visible')).toContainText('49,000')
  await selectIdea(samples[2].assessment.submission_id)
  await expect(page.getByText('Tell us a little more', { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText('Your costs are higher than your sales', { exact: true }).filter({ visible: true })).toHaveCount(0)
  checks.push('Previously recorded N03/U01: funding shortage displayed; unknown information is clarification, not an invented negative business rating.')
  await selectIdea(processing.id)
  await expect(page.locator('.stage-progress:visible')).toContainText('2 / 7 batches')
  const readsBefore = processingReads
  await page.clock.fastForward(6 * 60_000)
  await expect.poll(() => processingReads).toBeGreaterThan(readsBefore)
  checks.push('2/4 processing view shows current batch counts and elapsed time; visible-page polling continues past the former five-minute freeze cutoff.')
  await page.setViewportSize({ width: 390, height: 844 })
  await picker().selectOption('hi')
  await selectIdea(samples[0].assessment.submission_id)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: resolve(directory, 'hindi-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'तुलना', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'संदर्भ के साथ तुलना करें।' })).toBeVisible()
  checks.push('Hindi mobile at 390px fits without horizontal overflow; comparisons are localized.')
  await picker().selectOption('en')
  await page.getByRole('button', { name: 'My ideas', exact: true }).click()
  await page.getByRole('button', { name: 'New idea', exact: true }).click()
  await page.getByRole('button', { name: /^PDF/ }).click()
  await page.getByLabel('PDF file', { exact: true }).setInputFiles(resolve(root, 'input/pdf/positive-tea-en.pdf'))
  await page.getByRole('checkbox', { name: /I agree/ }).check()
  const send = () => page.getByRole('button', { name: 'Send my idea', exact: true })
  await send().click()
  await expect(page.getByRole('alert')).toContainText('Synthetic expired upload')
  await send().click()
  await expect.poll(() => putCount).toBe(2)
  await page.getByRole('button', { name: 'Stop waiting / pause transfer' }).click()
  releasePaused()
  await expect(send()).toBeEnabled()
  await expect(page.locator('.selected-file')).toContainText('positive-tea-en.pdf')
  await send().click()
  await expect(page.getByRole('alert')).toContainText('Synthetic interrupted transfer')
  await page.getByRole('button', { name: 'Discard unsubmitted upload' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Unsubmitted upload removed.' })).toBeVisible()
  expect(deleteCount).toBe(1)
  await send().click()
  await expect(page.getByRole('alert')).toContainText('Connection interrupted')
  await send().click()
  await expect(page.getByRole('heading', { name: 'Your saved ideas', exact: true })).toBeVisible()
  await expect(page.locator('.saved-picker:visible')).toHaveAttribute('aria-expanded', 'false')
  expect(initKeys[0]).not.toBe(initKeys[1])
  expect(initKeys[1]).toBe(initKeys[2])
  expect(submitKeys).toHaveLength(2)
  expect(submitKeys[0]).toBe(submitKeys[1])
  expect(errors).toEqual([])
  checks.push('T06 browser recovery: expired intent replaced; paused transfer releases form and retains file; retry reuses intent; discard handles HTTP 204; lost submit response reuses the same idempotency key.')
  const voiceContext = await browser.newContext()
  const voicePage = await voiceContext.newPage()
  const deviceVoices = await voicePage.evaluate(() => new Promise(resolve => {
    const synth = window.speechSynthesis
    if (!synth) return resolve({ supported: false, local_languages: [] })
    const finish = () => resolve({ supported: true, local_languages: [...new Set(synth.getVoices().filter(voice => voice.localService).map(voice => voice.lang))] })
    synth.addEventListener('voiceschanged', finish, { once: true })
    setTimeout(finish, 1000)
  }))
  await voiceContext.close()
  await writeFile(resolve(root, 'evals/reports/simple-ui.json'), JSON.stringify({ date: new Date().toISOString(), scope: 'Software checks only; intercepted Auth/API, replayed existing saved synthetic model outputs; no new model inference, hosted writes or model accuracy measurement. Speech behavior uses fixtures; device voice inventory is a separate real headless-browser capability probe, not a listening-quality test.', checks, device_voice_probe: deviceVoices, page_errors: errors, put_attempts: putCount, discarded_uploads: deleteCount, status: 'pass' }, null, 2) + '\n')
  console.log(JSON.stringify({ status: 'pass', checks: checks.length, page_errors: errors.length }))
} finally { await browser.close() }
