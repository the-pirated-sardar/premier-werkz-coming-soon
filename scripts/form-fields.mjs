/**
 * Prints a ready-to-paste `form: { … }` block for site.config.js from a Google Form.
 *
 *   npm run form-fields                         # the form currently in site.config.js
 *   npm run form-fields -- <responder link>     # a different (e.g. business-owned) form
 *
 * The form must be published with "Anyone with the link" access.
 */
import config from '../site.config.js';
import { fetchFormQuestions, formUrls } from './google-form.mjs';

const input = process.argv[2] || config.form.url;
const urls = formUrls(input);
if (!urls) {
  console.error(`Not a Google Form responder link: ${input}\nExpected https://docs.google.com/forms/d/e/<ID>/viewform`);
  process.exit(1);
}

const { title, questions } = await fetchFormQuestions(urls.viewUrl).catch((err) => {
  console.error(err.message);
  process.exit(1);
});

const SUPPORTED = ['short answer', 'paragraph'];
const unsupported = questions.filter((q) => !SUPPORTED.includes(q.kind));
const fields = questions
  .filter((q) => SUPPORTED.includes(q.kind))
  .map((q) => {
    const t = q.title.toLowerCase();
    const type = q.kind === 'paragraph' ? 'textarea' : q.isEmail || /e-?mail/.test(t) ? 'email' : /phone|mobile|cell/.test(t) ? 'tel' : 'text';
    const autocomplete = { email: 'email', tel: 'tel' }[type] ?? (/^(full )?name$/.test(t) ? 'name' : undefined);
    return { entry: q.entry, label: q.title, type, ...(q.required && { required: true }), ...(autocomplete && { autocomplete }) };
  });

// Pair consecutive short fields after the first one, e.g. Email + Phone on one row.
const short = fields.filter((f) => f.type !== 'textarea').slice(1);
for (let i = 0; i + 1 < short.length; i += 2) short[i].half = short[i + 1].half = true;

const literal = (obj) =>
  `{ ${Object.entries(obj)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : v}`)
    .join(', ')} }`;

console.log(`\nGoogle Form: "${title}" — ${questions.length} question(s)\n`);
console.log('Paste this over the `form: { … }` block in site.config.js:\n');
console.log(`  form: {\n    url: '${urls.viewUrl}',\n    fields: [\n${fields.map((f) => `      ${literal(f)},`).join('\n')}\n    ],\n  },\n`);
if (unsupported.length) {
  console.warn(`⚠ Skipped ${unsupported.length} question(s) the site form doesn't support (only short answer and paragraph):`);
  for (const q of unsupported) console.warn(`   • "${q.title}" (${q.kind})${q.required ? ' — REQUIRED: submissions will fail until it is removed or made optional' : ''}`);
}
