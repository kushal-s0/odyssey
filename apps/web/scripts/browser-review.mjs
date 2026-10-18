import { chromium, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '../../..')
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(pathToFileURL(resolve(root, '.local/review/index.html')).href)
  await expect(page.locator('#record option')).toHaveCount(55)
  await page.locator('#reviewed').click()
  await expect(page.locator('#reviewed')).not.toBeChecked()
  await expect(page.locator('#status')).toContainText('Reviewed sources need')
  await page.locator('#reviewer').fill('Synthetic browser check only')
  await page.locator('#language').selectOption('en')
  await page.locator('#family_id').fill('synthetic-not-human-ground-truth')
  await page.locator('#reference').fill('Synthetic UI reference only, not a source transcription.')
  await page.locator('#fields').fill('{"price":"10"}')
  await page.locator('#reviewed').check()
  await expect(page.locator('#status')).toContainText('1 / 55 reviewed')
  await page.locator('#next').click()
  await page.locator('#prev').click()
  await expect(page.locator('#reference')).toHaveValue('Synthetic UI reference only, not a source transcription.')
  const pending = page.waitForEvent('download')
  await page.locator('#export').click()
  const download = await pending
  const output = JSON.parse(await readFile(await download.path(), 'utf8'))
  expect(output.records).toHaveLength(55)
  expect(output.records[0].fields.price).toBe('10')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(errors).toEqual([])
  // Context is ephemeral; synthetic labels are never saved as human annotations.
  const report = { scope: 'Local Edge/private review screen; synthetic form values only', inputs: 55,
    checks: ['Missing review prerequisites denied', 'Navigation preserves private form state',
      'Export includes complete JSON and expected fields', 'Mobile has no horizontal overflow'],
    javascript_errors: errors.length, human_labels_created: false, passed: true, deployed: false }
  await writeFile(resolve(root, 'evals/reports/review-ui.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report))
} finally {
  await browser.close()
}
