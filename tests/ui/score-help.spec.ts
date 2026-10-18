import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mockWorkspace} from './fixtures';
import {SIMPLE_ENGLISH} from '../../client/src/simple-copy';
import {DIMENSION_HELP,SCORE_HELP} from '../../shared/score-help';

test('every automatic rating explains its meaning, current value and distinct scale',async({page})=>{
 const {records}=await mockWorkspace(page,'assessor');await page.goto(`/submissions/${records[0]!.id}`);
 const group=page.locator('.friendly-detail-group').filter({has:page.locator('.dimension-list')});await group.locator(':scope > summary').click();
 for(const d of records[0]!.assessment!.dimensions){
 const row=page.locator('.dimension-row').filter({hasText:SIMPLE_ENGLISH[d.label]??d.label});
 await row.locator('.value-help-trigger').hover();
 const tip=page.locator('.friendly-help-portal');await expect(tip).toContainText(DIMENSION_HELP[d.key]!);await expect(tip).toContainText(`Current value: ${d.score} / 4`);
 if(d.key==='completeness')await expect(tip).toContainText('14 main');else{await expect(tip).toContainText('does not give 4');await expect(tip).toContainText(`Share of the total: ${d.weight}%`);}
 }
 await page.screenshot({path:'.planning/screenshots/rating-hover-help-desktop.png',fullPage:false});
});
test('value help escapes table clipping and never changes a score',async({page})=>{
 const {records}=await mockWorkspace(page,'assessor');await page.goto('/comparisons');
 const value=page.locator('.comparison-score').first();await value.hover();const tip=page.locator('.friendly-help-portal');await expect(tip).toContainText('middle score');
 const box=await tip.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(1440);
 await value.locator('..').press('Escape');await expect(tip).toHaveCount(0);
 await page.goto(`/submissions/${records[0]!.id}`);await expect(page.locator('.score-number')).toContainText(String(records[0]!.assessment!.score));
});
test('all six languages explain ratings on tap, preserve originals and fit a small screen',async({page})=>{
 const {records}=await mockWorkspace(page,'entrepreneur');await page.setViewportSize({width:390,height:844});await page.goto(`/submissions/${records[0]!.id}?view=full`);
 const group=page.locator('.friendly-detail-group').filter({has:page.locator('.dimension-list')});await group.locator(':scope > summary').click();
 for(const code of ['en','hi','mr','te','bn','od']){
 const dict=JSON.parse(readFileSync(new URL(`../../client/src/locales/${code}.json`,import.meta.url),'utf8'));
 await page.getByRole('combobox',{name:'Website language'}).selectOption(`${code}-IN`);
 await page.locator('.dimension-row').first().locator('.value-help-trigger').click();
 const tip=page.locator('.friendly-help-portal');await expect(tip).toContainText(dict[DIMENSION_HELP.clarity!]??DIMENSION_HELP.clarity!);
 const box=await tip.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);
 await tip.getByRole('button').click();await expect(tip).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.getByRole('combobox',{name:'Website language'}).selectOption('en-IN');await page.getByRole('button',{name:'Open sources',exact:true}).click();
 await expect(page.locator('.source-segment').first()).toContainText(records[0]!.assessment!.segments[0]!.originalText);
});
test('money concerns and model tests use their own help, rather than a business-success claim',async({page})=>{
 const {records}=await mockWorkspace(page,'assessor');await page.goto(`/submissions/${records[0]!.id}`);
 await page.locator('.risk-summary .value-help-trigger').first().hover();await expect(page.locator('.friendly-help-portal')).toContainText(SCORE_HELP.risk.text);
 await page.mouse.move(0,0);
 await page.locator('.support-metrics .value-help-trigger').first().hover();await expect(page.locator('.friendly-help-portal')).toContainText('Tax, your own pay and loan payments');
 await page.route('**/api/training/model',route=>route.fulfill({json:{ready:true,modelVersion:'synthetic',metrics:{macroF1:0.8,offTopicRecall:0.9,evaluationCoverage:0.85,abstentionRate:0.15,rows:30,groups:6,evaluation:'Synthetic test'}}}));
 await page.goto('/model');await page.locator('.model-evaluation .value-help-trigger').first().hover();await expect(page.locator('.friendly-help-portal')).toContainText(SCORE_HELP.macroF1.text);
});
