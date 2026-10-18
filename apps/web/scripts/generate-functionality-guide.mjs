// Standalone local documentation render. No app, Auth, model or provider calls.
// Run from the repository: node apps/web/scripts/generate-functionality-guide.mjs
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const source = resolve(root, 'docs/UDYAM_SAATHI_FUNCTIONALITY_GUIDE.html')
const target = resolve(root, 'docs/UDYAM_SAATHI_FUNCTIONALITY_GUIDE.pdf')
const preview = resolve(root, '.local/functionality-guide')
await mkdir(preview, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' })
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } })
  const errors = []
  const externalRequests = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(/^https?:/, route => {
    externalRequests.push(route.request().url())
    return route.abort()
  })
  await page.goto(pathToFileURL(source).href)
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => document.fonts.ready)
  const sections = await page.locator('.sheet').evaluateAll(sheets => sheets.map(sheet => ({
    id: sheet.id,
    width: sheet.getBoundingClientRect().width,
    height: sheet.getBoundingClientRect().height,
    scrollWidth: sheet.scrollWidth,
  })))
  const availableHeight = (297 - 14 - 16) * 96 / 25.4
  if (sections.length !== 15) throw new Error(`Expected 15 pages; found ${sections.length}`)
  const overflow = sections.filter(section => section.height > availableHeight - 2 || section.scrollWidth > section.width + 2)
  if (overflow.length) throw new Error(`Page overflow: ${JSON.stringify(overflow)}`)
  if (errors.length || externalRequests.length) throw new Error('Document must render without errors or network')
  await page.pdf({
    path: target,
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-family:Arial,sans-serif;font-size:8px;width:100%;padding:0 13mm;color:#607085;display:flex;justify-content:space-between"><span>UDYAM SAATHI · FUNCTIONALITY &amp; PRESENTER GUIDE · 18 OCT 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    tagged: true,
    outline: true,
  })
  for (const id of ['cover', 'finance', 'models', 'demo']) {
    await page.locator(`#${id}`).screenshot({ path: resolve(preview, `${id}.png`) })
  }
  const verification = { source: 'docs/UDYAM_SAATHI_FUNCTIONALITY_GUIDE.html', pdf: 'docs/UDYAM_SAATHI_FUNCTIONALITY_GUIDE.pdf', sections, external_requests: externalRequests.length, page_errors: errors, scope: 'Local document rendering only; no application or model evaluation' }
  await writeFile(resolve(preview, 'render-check.json'), JSON.stringify(verification, null, 2) + '\n')
  console.log(JSON.stringify({ pdf: verification.pdf, expected_pages: sections.length, external_requests: externalRequests.length, page_errors: errors.length }))
} finally {
  await browser.close()
}
