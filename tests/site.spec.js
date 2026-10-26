import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import config from '../site.config.js';

const formBase = config.form.url.split('?')[0];
const telHref = `tel:+1${config.contact.phone.replace(/\D/g, '')}`;

const DESKTOP = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
];
const ALL_VIEWPORTS = [
  ...DESKTOP,
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 740 },
  { width: 320, height: 640 },
  { width: 844, height: 390 },
];

/**
 * Collects same-origin failures and page errors while a test runs.
 * `expectedStatusUrl`: a document deliberately served with an error status (the 404 page),
 * whose own "Failed to load resource" console message is expected.
 */
function watchForErrors(page, { expectedStatusUrl } = {}) {
  const problems = [];
  const sameOrigin = (url) => url.startsWith('http://localhost');
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    const url = msg.location().url || 'http://localhost';
    if (expectedStatusUrl && url.endsWith(expectedStatusUrl) && msg.text().startsWith('Failed to load resource')) return;
    if (msg.type() === 'error' && sameOrigin(url)) problems.push(`console: ${msg.text()}`);
  });
  page.on('requestfailed', (req) => {
    if (sameOrigin(req.url())) problems.push(`request failed: ${req.url()}`);
  });
  page.on('response', (res) => {
    if (sameOrigin(res.url()) && res.status() >= 400 && res.request().resourceType() !== 'document') {
      problems.push(`HTTP ${res.status()}: ${res.url()}`);
    }
  });
  return problems;
}

test.describe('page basics', () => {
  test('loads without errors and every image renders', async ({ page }) => {
    const problems = watchForErrors(page);
    const res = await page.goto('./', { waitUntil: 'load' });
    expect(res.status()).toBe(200);
    const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
    expect(broken).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('SEO and metadata', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle(config.seo.title);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(new RegExp(config.copy.headline.replace(/\s+/g, '\\s+'), 'i'));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', config.seo.description);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https?:\/\//);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https?:\/\/.+og-image\.jpg$/);
    // Local/preview hosts must never be indexed.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    expect(ld.name).toBe(config.business.name);
    expect(ld.telephone).toBe(telHref.replace('tel:', ''));
  });

  test('unknown paths (old site links) show the page with working assets', async ({ page }) => {
    const problems = watchForErrors(page, { expectedStatusUrl: '/services/ceramic-coating' });
    const res = await page.goto('./services/ceramic-coating', { waitUntil: 'load' });
    expect(res.status()).toBe(404);
    await expect(page.locator('h1')).toBeVisible();
    const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => i.naturalWidth === 0).length);
    expect(broken).toBe(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    expect(problems).toEqual([]);
  });
});

test.describe('contact details and form wiring', () => {
  test('contact links match site.config.js', async ({ page }) => {
    await page.goto('./');
    const contact = page.locator('.contact');
    await expect(contact.locator(`a[href="${telHref}"]`)).toHaveText(config.contact.phone);
    await expect(contact.locator(`a[href="mailto:${config.contact.email}"]`)).toHaveText(config.contact.email);
    const maps = contact.locator('a[href^="https://www.google.com/maps/search/"]');
    await expect(maps).toContainText(config.contact.address.street);
    expect(decodeURIComponent(await maps.getAttribute('href'))).toContain(config.contact.address.postalCode);
    for (const s of config.social) {
      await expect(contact.locator(`a[href="${s.url}"]`)).toHaveCount(1);
    }
    // Every new-tab link is protected and announced.
    for (const link of await page.locator('a[target="_blank"]').all()) {
      expect(await link.getAttribute('rel')).toContain('noopener');
      expect(await link.evaluate((a) => a.textContent + (a.getAttribute('aria-label') || ''))).toMatch(/opens in a new tab/);
    }
  });

  test('form embed and fallback point at the configured Google Form', async ({ page }) => {
    await page.goto('./');
    const iframe = page.locator('iframe.form-frame__iframe');
    await expect(iframe).toHaveAttribute('src', `${formBase}?embedded=true`);
    await expect(iframe).toHaveAttribute('title', /.+/);
    const fallback = page.locator('.form-fallback a');
    await expect(fallback).toHaveAttribute('href', formBase);
    await expect(fallback).toHaveAttribute('target', '_blank');
  });

  test('Google Form loads publicly and its Submit button fits inside the frame', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    const iframe = page.locator('iframe.form-frame__iframe');
    const submit = page.frameLocator('iframe.form-frame__iframe').getByRole('button', { name: 'Submit' });
    await expect(submit, 'form should be public (no Google sign-in) and show a Submit button').toBeVisible({ timeout: 20_000 });
    const frameBox = await iframe.boundingBox();
    const btnBox = await submit.boundingBox();
    expect(btnBox.y + btnBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height);
  });
});

test.describe('layout', () => {
  for (const vp of ALL_VIEWPORTS) {
    test(`no horizontal overflow at ${vp.width}×${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('./');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  for (const vp of DESKTOP) {
    test(`desktop ${vp.width}×${vp.height}: logo, headline, intro, form and contact details are all on screen`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('./');
      const targets = {
        logo: page.locator('.hero__logo'),
        headline: page.locator('h1'),
        intro: page.locator('.hero__intro'),
        formHeading: page.locator('#enquiry-title'),
        formTop: page.locator('iframe.form-frame__iframe'),
        phone: page.locator(`.contact a[href="${telHref}"]`),
        email: page.locator('.contact a[href^="mailto:"]'),
        address: page.locator('.contact a[href^="https://www.google.com/maps/"]'),
      };
      for (const [name, loc] of Object.entries(targets)) {
        await expect(loc, name).toBeVisible();
        const box = await loc.boundingBox();
        expect(box.y, `${name} top`).toBeGreaterThanOrEqual(0);
        // The form itself may continue below the fold; everything else must be fully visible.
        const bottom = name === 'formTop' ? box.y + 200 : box.y + box.height;
        expect(bottom, `${name} bottom`).toBeLessThanOrEqual(vp.height);
      }
    });
  }

  test('desktop: hero and contact stay in view while the form column scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./');
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    for (const sel of ['.hero__logo', 'h1', `.contact a[href="${telHref}"]`]) {
      const box = await page.locator(sel).boundingBox();
      expect(box.y, sel).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, sel).toBeLessThanOrEqual(768);
    }
    // Fallback link under the form is reachable.
    await expect(page.locator('.form-fallback a')).toBeInViewport();
  });

  test('mobile: logo, headline and Call button are visible without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    await expect(page.locator('.hero__logo')).toBeInViewport();
    await expect(page.locator('h1')).toBeInViewport();
    const call = page.locator(`.hero__actions a[href="${telHref}"]`);
    await expect(call).toBeInViewport();
    const box = await call.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('mobile: interactive targets are at least 44px tall', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    const small = await page.$$eval('a, button', (els) =>
      els
        .filter((el) => el.offsetParent !== null && !el.classList.contains('skip-link'))
        .map((el) => ({ text: el.textContent.trim().slice(0, 40), h: el.getBoundingClientRect().height }))
        .filter((t) => t.h < 44),
    );
    expect(small).toEqual([]);
  });
});

test.describe('accessibility', () => {
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`axe: no WCAG 2.2 AA violations at ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('./');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .exclude('iframe.form-frame__iframe') // Google's own markup; not ours to change
        .analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      expect(summary).toEqual([]);
    });
  }

  test('keyboard: skip link appears on first Tab and jumps to the form', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit only tabs to links when "Tab highlights each item" is enabled');
    await page.goto('./');
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('#get-in-touch')).toBeFocused();
  });

  test('keyboard: every link shows a visible focus indicator', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit only tabs to links when "Tab highlights each item" is enabled');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    const links = await page.locator('a:visible').count();
    for (let i = 0; i < links + 2; i++) {
      await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el.tagName !== 'A') return null;
        const s = getComputedStyle(el);
        return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
      });
      if (outline !== null) expect(outline).toBe(true);
    }
  });

  test('reduced motion disables smooth scrolling', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  });
});
