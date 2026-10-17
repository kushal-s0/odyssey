import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const output = resolve('../../.local/browser-smoke')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' })
const results = []
try {
  for (const [label, width, height] of [['desktop', 1440, 1050], ['mobile', 390, 1000]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    const errors = []
    page.on('pageerror', error => errors.push(error.name))
    const response = await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: /See the potential/ }).waitFor()
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
    await page.screenshot({ path: resolve(output, `${label}.png`), fullPage: true })
    if (response?.status() !== 200 || errors.length || dimensions.content > dimensions.viewport) {
      throw new Error(`${label} failed: ${JSON.stringify({ status: response?.status(), errors, dimensions })}`)
    }
    results.push({ label, width, height, httpStatus: response.status(), pageErrors: errors, dimensions })
    await page.close()
  }
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2) + '\n')
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
