// UI-only HTTP fixtures. These checks do not verify a hosted Auth provider.
import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.name))
  const user = '00000000-0000-4000-8000-000000000001'
  const exp = Math.floor(Date.now() / 1000) + 3600
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const token = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub: user, exp, iat: exp - 3600, aud: 'authenticated', role: 'authenticated' })}.fixture`
  let rejectPassword = true
  let expired = false
  await page.route('https://identity.example.test/**', async route => {
    if (route.request().url().includes('/token')) {
      if (rejectPassword) return route.fulfill({ status: 400, json: { code: 'invalid_credentials', msg: 'Invalid login credentials' } })
      return route.fulfill({ json: { access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600,
        expires_at: exp, token_type: 'bearer', user: { id: user, aud: 'authenticated', role: 'authenticated',
          email: 'judge@example.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } } })
    }
    return route.fulfill({ status: 204 })
  })
  await page.route('**/v1/me', route => route.fulfill({ status: expired ? 401 : 200,
    json: expired ? { code: 'http_401', message: 'Your session is invalid or expired; sign in again', retryable: false }
      : { id: user, role: 'assessor', display_name: null, cohorts: [] } }))
  await page.goto(process.env.AUTH_PREVIEW_URL || 'http://127.0.0.1:5174/', { waitUntil: 'networkidle' })
  async function login() {
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByLabel('Email', { exact: true }).fill('judge@example.test')
    await page.getByLabel('Password', { exact: true }).fill('fixture-password')
    await page.getByRole('button', { name: 'Sign in to workspace' }).click()
  }
  await login()
  await page.getByRole('alert').filter({ hasText: 'Sign-in failed.' }).waitFor()
  rejectPassword = false
  await page.getByRole('button', { name: 'Sign in to workspace' }).click()
  await page.getByRole('button', { name: 'Sign out' }).waitFor()
  await page.locator('.account-role').filter({ hasText: 'assessor' }).waitFor({ state: 'attached' })
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
  await login()
  await page.getByRole('button', { name: 'Sign out' }).waitFor()
  expired = true
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
  if (errors.length) throw new Error(`Page errors: ${errors.join(', ')}`)
  console.log('PASS: fixture invalid-password, sign-in, trusted API role, sign-out, expired API session; no page errors. Not hosted Auth evidence.')
} finally { await browser.close() }
