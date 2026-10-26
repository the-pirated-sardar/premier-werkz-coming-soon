/**
 * Builds the static site into dist/. Zero dependencies — runs on plain Node ≥ 20.
 *
 *   npm run build                                   # local (http://localhost:4173/)
 *   SITE_URL=https://premierwerkz.com/ npm run build
 *
 * In GitHub Actions, SITE_URL comes from actions/configure-pages, so the same
 * build works on the *.github.io preview path and on a custom domain.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import config from '../site.config.js';
import { render } from '../src/template.mjs';
import { formUrls } from './google-form.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const images = JSON.parse(readFileSync(join(ROOT, 'src/images.json'), 'utf8'));

// ── Validate site.config.js ──────────────────────────────────────────────────
const errors = [];
const fail = (msg) => errors.push(msg);

const rawFormUrl = String(config.form?.url ?? '');
const urls = formUrls(rawFormUrl);
if (!urls) {
  if (/forms\.gle/.test(rawFormUrl)) fail('form.url is a forms.gle short link. Open it in a browser and paste the full docs.google.com/forms/d/e/…/viewform address instead.');
  else if (/\/forms\/d\/[\w-]+\/edit/.test(rawFormUrl)) fail('form.url is the form EDITOR link. In Google Forms use Published → Copy responder link (…/forms/d/e/…/viewform).');
  else fail(`form.url must look like https://docs.google.com/forms/d/e/<ID>/viewform — got "${rawFormUrl}"`);
}

const FIELD_TYPES = ['text', 'email', 'tel', 'textarea'];
const formFields = Array.isArray(config.form?.fields) ? config.form.fields : [];
if (!formFields.length) fail('form.fields is empty — run `npm run form-fields` and paste its output into site.config.js.');
const seenEntries = new Set();
formFields.forEach((f, i) => {
  const where = `form.fields[${i}]${f?.label ? ` ("${f.label}")` : ''}`;
  if (!/^entry\.\d+$/.test(f?.entry ?? '')) fail(`${where}: entry must look like 'entry.123456789' (got ${JSON.stringify(f?.entry)}).`);
  if (seenEntries.has(f?.entry)) fail(`${where}: entry ${f.entry} is used twice.`);
  seenEntries.add(f?.entry);
  if (!f?.label) fail(`${where}: label is empty.`);
  if (!FIELD_TYPES.includes(f?.type)) fail(`${where}: type must be one of ${FIELD_TYPES.join(', ')} (got ${JSON.stringify(f?.type)}).`);
});
const form = { ...urls, fields: formFields };

const { contact = {}, social = [], services = [], copy = {}, seo = {}, business = {} } = config;

let tel = '';
if (contact.phone) {
  const digits = contact.phone.replace(/\D/g, '');
  if (digits.length === 10) tel = `tel:+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) tel = `tel:+${digits}`;
  else fail(`contact.phone "${contact.phone}" doesn't look like a 10-digit US number.`);
}
if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) fail(`contact.email "${contact.email}" isn't a valid email address.`);
for (const s of social) {
  if (!s.network || !s.url || !/^https:\/\//.test(s.url)) fail(`Each social entry needs a network name and an https:// url (problem: ${JSON.stringify(s)}).`);
}
if (!Array.isArray(services)) fail('services must be a list, e.g. [\'Detailing\', \'Window Tint\'] (or [] to hide).');
for (const key of ['headline', 'intro', 'formHeading', 'formIntro', 'formSubmit', 'formSuccessHeading', 'formSuccess']) {
  if (!copy[key]) fail(`copy.${key} is empty.`);
}
for (const key of ['title', 'description']) if (!seo[key]) fail(`seo.${key} is empty.`);
if (!business.name) fail('business.name is empty.');

if (errors.length) {
  console.error('\n✖ site.config.js has problems — nothing was built:\n');
  for (const e of errors) console.error(`  • ${e}`);
  console.error('');
  process.exit(1);
}

// ── Derived values ───────────────────────────────────────────────────────────
const siteUrl = new URL(process.env.SITE_URL || 'http://localhost:4173/');
if (!siteUrl.pathname.endsWith('/')) siteUrl.pathname += '/';
const host = siteUrl.hostname;
const isPreviewHost = host.endsWith('.github.io') || host === 'localhost' || host === '127.0.0.1';
const indexable = Boolean(seo.allowIndexing) && !isPreviewHost;

const a = contact.address ?? {};
const addressLines = [
  [a.street, a.unit].filter(Boolean).join(', '),
  [[a.city, a.region].filter(Boolean).join(', '), a.postalCode].filter(Boolean).join(' '),
].filter(Boolean);
const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([business.name, ...addressLines].join(', '))}`;

// "Website Coming Soon" → line 1 "Website", line 2 "Coming Soon".
const [firstWord, ...restWords] = copy.headline.trim().split(/\s+/);
const escHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const headlineHtml = restWords.length
  ? `<span class="hero__title-line">${escHtml(firstWord)}</span> <span class="hero__title-line hero__title-line--strong">${escHtml(restWords.join(' '))}</span>`
  : escHtml(firstWord);

const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'AutomotiveBusiness',
  name: business.name,
  url: siteUrl.href,
  logo: `${siteUrl.href}images/logo-480.png`,
  image: `${siteUrl.href}${images.og.file}`,
  ...(contact.phone && { telephone: tel.replace('tel:', '') }),
  ...(contact.email && { email: contact.email }),
  ...(a.street && {
    address: {
      '@type': 'PostalAddress',
      streetAddress: [a.street, a.unit].filter(Boolean).join(', '),
      addressLocality: a.city,
      addressRegion: a.region,
      postalCode: a.postalCode,
      addressCountry: 'US',
    },
  }),
  ...(social.length && { sameAs: social.map((s) => s.url) }),
}).replace(/</g, '\\u003c');

/** Strip comments and collapse whitespace — enough for a small hand-written stylesheet. */
const minifyCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();

const site = {
  config,
  form,
  images,
  siteUrl: siteUrl.href,
  addressLines,
  headlineHtml,
  jsonLd,
  links: { tel, maps },
  contact,
  social,
  css: minifyCss(readFileSync(join(ROOT, 'src/styles.css'), 'utf8')),
  // Small enough to inline; strip comment lines only (keeps it readable in view-source).
  js: readFileSync(join(ROOT, 'src/form.js'), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*\*?|\*)/.test(line))
    .join('\n')
    .trim(),
};

// ── Write dist/ ──────────────────────────────────────────────────────────────
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, 'public'), DIST, { recursive: true });

writeFileSync(join(DIST, 'index.html'), render({ ...site, page: { title: seo.title, indexable } }));

// 404s (e.g. old premierwerkz.com/services/… links) show the same page. <base> makes
// relative asset paths resolve from the site root at any URL depth.
writeFileSync(
  join(DIST, '404.html'),
  render({ ...site, page: { title: seo.title, indexable: false, baseHref: siteUrl.pathname } }),
);

writeFileSync(
  join(DIST, 'robots.txt'),
  indexable ? `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl.href}sitemap.xml\n` : 'User-agent: *\nDisallow: /\n',
);
if (indexable) {
  writeFileSync(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl.href}</loc></url>\n</urlset>\n`,
  );
}

if (!existsSync(join(DIST, 'index.html'))) throw new Error('Build produced no index.html');
console.log(`✔ Built dist/ for ${siteUrl.href} (${indexable ? 'indexable' : 'noindex — preview/local'})`);
