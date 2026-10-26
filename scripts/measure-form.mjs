/**
 * Measures the configured Google Form at the widths the site displays it, and
 * suggests `form.height` values for site.config.js.
 *
 *   npm run measure-form
 *
 * Only needed when the form's questions change (a different form with the same
 * four questions renders at the same height). It measures the normal state and
 * the taller "required field" error state (by pressing Submit on the empty
 * form — Google blocks that in the browser, so nothing is ever submitted).
 */
import { chromium } from 'playwright';
import config from '../site.config.js';

// The site switches between the two heights where the form's container is 600px wide
// (see `.form-frame` in src/styles.css).
const BREAKPOINT = 600;
// Representative iframe widths: phones…tablets, then the desktop form column (1024px → 1920px windows).
const WIDTHS = [288, 328, 358, 398, 470, 503, 530, 552, 600, 624, 640];
const SLACK = 8; // px of breathing room below Google's footer

const base = config.form.url.split('?')[0];
const url = `${base}?embedded=true`;
const browser = await chromium.launch();
const rows = [];

try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    if (page.url().includes('accounts.google.com')) {
      throw new Error('The form redirects to Google sign-in. In Google Forms: Published → Manage → General access → "Anyone with the link".');
    }
    const submit = page.getByRole('button', { name: /submit/i }).first();
    await submit.waitFor({ timeout: 15000 });
    const normal = await page.evaluate(() => document.documentElement.scrollHeight);
    await submit.click();
    await page.waitForTimeout(700);
    const withErrors = await page.evaluate(() => document.documentElement.scrollHeight);
    rows.push({ width, normal, withErrors });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log('\n iframe width   normal   with errors');
for (const r of rows) console.log(` ${String(r.width).padStart(6)}px  ${String(r.normal).padStart(7)}px  ${String(r.withErrors).padStart(9)}px`);

const max = (list) => Math.max(...list.map((r) => r.withErrors)) + SLACK;
const narrow = max(rows.filter((r) => r.width < BREAKPOINT));
const wide = max(rows.filter((r) => r.width >= BREAKPOINT));
console.log(`\nSuggested site.config.js values (tallest state + ${SLACK}px):\n  height: { desktop: ${wide}, mobile: ${narrow} }`);
console.log(`Currently configured:\n  height: { desktop: ${config.form.height.desktop}, mobile: ${config.form.height.mobile} }\n`);
