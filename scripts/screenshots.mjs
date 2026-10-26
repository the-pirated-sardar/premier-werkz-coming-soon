/**
 * Captures screenshots of the built site at the target viewports into reports/screenshots/.
 *
 *   npm run screenshots                       # starts a local server on :4173
 *   BASE_URL=https://… npm run screenshots    # capture a deployed site instead
 *
 * Optional: ONLY=desktop-1366x768,mobile-390x844 to capture a subset.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const VIEWPORTS = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-1366x768', width: 1366, height: 768 },
  { name: 'laptop-1280x720', width: 1280, height: 720 },
  { name: 'tablet-landscape-1024x768', width: 1024, height: 768, mobile: true },
  { name: 'tablet-portrait-768x1024', width: 768, height: 1024, mobile: true },
  { name: 'mobile-390x844', width: 390, height: 844, mobile: true, scale: 3 },
  { name: 'mobile-360x740', width: 360, height: 740, mobile: true, scale: 3 },
  { name: 'mobile-landscape-844x390', width: 844, height: 390, mobile: true, scale: 3 },
];

const OUT = 'reports/screenshots';
const only = process.env.ONLY?.split(',');
let server;
let base = process.env.BASE_URL;
if (!base) {
  server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '4173' }, stdio: 'ignore' });
  base = 'http://localhost:4173/';
  await new Promise((r) => setTimeout(r, 600));
}

mkdirSync(OUT, { recursive: true });
const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch();
try {
  for (const vp of VIEWPORTS.filter((v) => !only || only.includes(v.name))) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.scale ?? 1,
      isMobile: engine === chromium && Boolean(vp.mobile),
      hasTouch: Boolean(vp.mobile),
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${vp.name}.png` });
    await page.screenshot({ path: `${OUT}/${vp.name}-full.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`${vp.name.padEnd(28)} page height ${String(height).padStart(5)}px  horizontal overflow ${overflow}px`);
    await context.close();
  }
} finally {
  await browser.close();
  server?.kill();
}
