import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import config from '../site.config.js';
import { fetchFormQuestions, formUrls } from '../scripts/google-form.mjs';

const { viewUrl, submitUrl } = formUrls(config.form.url);
const fields = config.form.fields;
const telHref = `tel:+1${config.contact.phone.replace(/\D/g, '')}`;
const SUBMIT_PATTERN = '**/formResponse';

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
  const origin = new URL(process.env.BASE_URL || 'http://localhost').origin;
  const sameOrigin = (url) => url.startsWith(origin);
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    const url = msg.location().url || origin;
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

const fieldByLabel = (page, f) => page.getByLabel(f.label, { exact: false }).and(page.locator(`[name="${f.entry}"]`));

/** Sample answers keyed by field type. */
const SAMPLE = { text: 'Test Person', email: 'test.person@example.com', tel: '(209) 555-0100', textarea: 'Ceramic coating for a 2012 Audi S4.' };

async function fillValid(page) {
  for (const f of fields) await fieldByLabel(page, f).fill(SAMPLE[f.type]);
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

  test('no em or en dashes in the visible copy or metadata', async ({ page }) => {
    await page.goto('./');
    const text = await page.evaluate(() => {
      const metas = [...document.querySelectorAll('meta[content], [aria-label], [placeholder], [alt], title')].map(
        (el) => `${el.getAttribute('content') ?? ''} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('placeholder') ?? ''} ${el.getAttribute('alt') ?? ''} ${el.tagName === 'TITLE' ? el.textContent : ''}`,
      );
      return `${document.body.innerText} ${metas.join(' ')}`;
    });
    expect(text.match(/[—–]/g) ?? []).toEqual([]);
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

test.describe('contact details', () => {
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
});

test.describe('contact form', () => {
  test('is wired to the configured Google Form', async ({ page }) => {
    await page.goto('./');
    const form = page.locator('form[data-gform]');
    await expect(form).toHaveAttribute('action', submitUrl);
    await expect(form).toHaveAttribute('method', /post/i);
    for (const f of fields) {
      const input = fieldByLabel(page, f);
      await expect(input, f.label).toHaveCount(1);
      if (f.required) await expect(input).toHaveAttribute('required', '');
      if (f.autocomplete) await expect(input).toHaveAttribute('autocomplete', f.autocomplete);
    }
    await expect(page.locator('.gform__alt a')).toHaveAttribute('href', viewUrl);
  });

  test('empty submit shows errors on required fields and sends nothing', async ({ page }) => {
    let sent = 0;
    await page.route(SUBMIT_PATTERN, (route) => {
      sent++;
      return route.fulfill({ status: 200, body: '' });
    });
    await page.goto('./');
    await page.getByRole('button', { name: config.copy.formSubmit }).click();
    const required = fields.filter((f) => f.required);
    for (const f of required) {
      const input = fieldByLabel(page, f);
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator(`#${await input.getAttribute('id')}-error`)).toBeVisible();
    }
    await expect(fieldByLabel(page, required[0])).toBeFocused();
    expect(sent).toBe(0);

    // Errors clear as the visitor fixes them.
    await fieldByLabel(page, required[0]).fill('Test Person');
    await expect(fieldByLabel(page, required[0])).toHaveAttribute('aria-invalid', 'false');
  });

  test('rejects an invalid email address', async ({ page }) => {
    const email = fields.find((f) => f.type === 'email');
    test.skip(!email, 'form has no email field');
    await page.route(SUBMIT_PATTERN, (route) => route.fulfill({ status: 200, body: '' }));
    await page.goto('./');
    await fillValid(page);
    await fieldByLabel(page, email).fill('not-an-email@nowhere');
    await page.getByRole('button', { name: config.copy.formSubmit }).click();
    await expect(fieldByLabel(page, email)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });

  test('a valid submission posts every answer to Google and confirms in place', async ({ page }) => {
    let body = null;
    await page.route(SUBMIT_PATTERN, async (route) => {
      body = new URLSearchParams(route.request().postData());
      await route.fulfill({ status: 200, body: '' });
    });
    await page.goto('./');
    await fillValid(page);
    await page.getByRole('button', { name: config.copy.formSubmit }).click();

    const success = page.locator('[data-gform-success]');
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
    await expect(success).toContainText(config.copy.formSuccess);
    await expect(page.locator('form[data-gform]')).toBeHidden();
    expect(body, 'a request was sent').not.toBeNull();
    for (const f of fields) expect(body.get(f.entry), f.label).toBe(SAMPLE[f.type]);
    expect([...body.keys()].sort()).toEqual(fields.map((f) => f.entry).sort()); // nothing extra (e.g. the bot trap)

    await page.getByRole('button', { name: 'Send another message' }).click();
    await expect(page.locator('form[data-gform]')).toBeVisible();
    await expect(fieldByLabel(page, fields[0])).toHaveValue('');
  });

  test('a network failure keeps the answers and offers alternatives', async ({ page }) => {
    await page.route(SUBMIT_PATTERN, (route) => route.abort('internetdisconnected'));
    await page.goto('./');
    await fillValid(page);
    await page.getByRole('button', { name: config.copy.formSubmit }).click();
    const error = page.locator('[data-gform-error]');
    await expect(error).toBeVisible();
    await expect(error.locator(`a[href="${telHref}"]`)).toBeVisible();
    await expect(error.locator(`a[href="${viewUrl}"]`)).toBeVisible();
    await expect(fieldByLabel(page, fields[0])).toHaveValue(SAMPLE[fields[0].type]);
    await expect(page.getByRole('button', { name: config.copy.formSubmit })).toBeEnabled();
  });

  test('bots that fill the hidden field are silently dropped', async ({ page }) => {
    let sent = 0;
    await page.route(SUBMIT_PATTERN, (route) => {
      sent++;
      return route.fulfill({ status: 200, body: '' });
    });
    await page.goto('./');
    await fillValid(page);
    await page.locator('[data-gform-trap]').evaluate((el) => (el.value = 'https://spam.example'));
    await page.getByRole('button', { name: config.copy.formSubmit }).click();
    await expect(page.locator('[data-gform-success]')).toBeVisible();
    expect(sent).toBe(0);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('the form still posts straight to Google Forms', async ({ page }) => {
      let body = null;
      await page.route(SUBMIT_PATTERN, async (route) => {
        body = new URLSearchParams(route.request().postData());
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Your response has been recorded.</p>' });
      });
      await page.goto('./');
      await fillValid(page);
      await page.getByRole('button', { name: config.copy.formSubmit }).click();
      await expect(page.getByText('Your response has been recorded.')).toBeVisible();
      for (const f of fields) expect(body.get(f.entry)).toBe(SAMPLE[f.type]);
    });
  });

  // Network check against the real Google Form (read-only; nothing is submitted).
  test('site.config.js matches the live Google Form', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'one run is enough');
    const { questions } = await fetchFormQuestions(viewUrl);
    const live = new Map(questions.map((q) => [q.entry, q]));
    for (const f of fields) {
      expect(live.has(f.entry), `${f.entry} ("${f.label}") exists on the Google Form`).toBe(true);
      expect(Boolean(f.required), `"${f.label}" required matches Google`).toBe(live.get(f.entry).required);
    }
    // A required Google question missing from the site would make every submission fail.
    const missing = questions.filter((q) => q.required && !fields.some((f) => f.entry === q.entry));
    expect(missing.map((q) => q.title)).toEqual([]);
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
    test(`desktop ${vp.width}×${vp.height}: logo, headline, form and contact details all on screen`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('./');
      const targets = {
        logo: page.locator('.hero__logo'),
        headline: page.locator('h1'),
        locality: page.locator('.hero__locality'),
        intro: page.locator('.hero__intro'),
        formHeading: page.locator('#enquiry-title'),
        firstField: fieldByLabel(page, fields[0]),
        submit: page.getByRole('button', { name: config.copy.formSubmit }),
        phone: page.locator(`.contact a[href="${telHref}"]`),
        email: page.locator('.contact a[href^="mailto:"]'),
        address: page.locator('.contact a[href^="https://www.google.com/maps/"]'),
      };
      for (const [name, loc] of Object.entries(targets)) {
        await expect(loc, name).toBeVisible();
        const box = await loc.boundingBox();
        expect(box.y, `${name} top`).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, `${name} bottom`).toBeLessThanOrEqual(vp.height);
      }
    });
  }

  test('desktop: the photo panel holds still if the page scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto('./');
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    for (const sel of ['.hero__logo', 'h1']) {
      const box = await page.locator(sel).boundingBox();
      expect(box.y, sel).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, sel).toBeLessThanOrEqual(640);
    }
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
    const small = await page.$$eval('a, button, input, textarea', (els) =>
      els
        .filter((el) => el.offsetParent !== null && !el.classList.contains('skip-link') && !el.matches('[data-gform-trap]'))
        .map((el) => ({ el: el.tagName, text: (el.textContent || el.name).trim().slice(0, 40), h: el.getBoundingClientRect().height }))
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
      const scan = async (label) => {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();
        return results.violations.map((v) => `${label}: ${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      };
      const initial = await scan('initial');
      // Also scan the error state.
      await page.getByRole('button', { name: config.copy.formSubmit }).click();
      const withErrors = await scan('with errors');
      expect([...initial, ...withErrors]).toEqual([]);
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

  test('keyboard: the form can be completed and sent without a mouse', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit only tabs to links when "Tab highlights each item" is enabled');
    let sent = false;
    await page.route(SUBMIT_PATTERN, (route) => {
      sent = true;
      return route.fulfill({ status: 200, body: '' });
    });
    await page.goto('./');
    await fieldByLabel(page, fields[0]).focus();
    for (const f of fields) {
      await expect(fieldByLabel(page, f)).toBeFocused();
      await page.keyboard.type(SAMPLE[f.type]);
      await page.keyboard.press('Tab');
    }
    await expect(page.getByRole('button', { name: config.copy.formSubmit })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-gform-success]')).toBeFocused();
    expect(sent).toBe(true);
  });

  test('keyboard: every link and control shows a visible focus indicator', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit only tabs to links when "Tab highlights each item" is enabled');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    const count = await page.locator('a:visible, button:visible, input:visible, textarea:visible').count();
    for (let i = 0; i < count + 2; i++) {
      await page.keyboard.press('Tab');
      const visible = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
        const ring = s.boxShadow !== 'none';
        return outline || ring;
      });
      if (visible !== null) expect(visible).toBe(true);
    }
  });

  test('reduced motion disables smooth scrolling', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  });
});
