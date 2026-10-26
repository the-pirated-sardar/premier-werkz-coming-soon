/**
 * Reads a published Google Form's questions from its public responder page.
 * Used by `npm run form-fields` and by the test that checks site.config.js still
 * matches the live form. Never used at build/deploy time.
 */

/** "https://docs.google.com/forms/d/e/<ID>/viewform…" → { viewUrl, submitUrl } or null. */
export function formUrls(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return null;
  }
  const match = url.hostname === 'docs.google.com' && url.pathname.match(/^\/forms(?:\/u\/\d+)?\/d\/e\/([\w-]+)\/(?:viewform|formResponse)\/?$/);
  if (!match) return null;
  const base = `https://docs.google.com/forms/d/e/${match[1]}`;
  return { viewUrl: `${base}/viewform`, submitUrl: `${base}/formResponse` };
}

const TYPE_NAMES = { 0: 'short answer', 1: 'paragraph', 2: 'multiple choice', 3: 'dropdown', 4: 'checkboxes', 5: 'linear scale', 7: 'grid', 9: 'date', 10: 'time' };
const EMAIL_VALIDATION = 102; // Google's "Text → Email address" response validation

/** Fetches the form and returns { title, questions: [{ entry, title, kind, required, isEmail }] }. */
export async function fetchFormQuestions(viewUrl) {
  const res = await fetch(viewUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
  if (res.status === 401 || res.status === 302 || res.headers.get('location')?.includes('accounts.google.com')) {
    throw new Error('The form requires Google sign-in. In Google Forms: Published → Manage → General access → "Anyone with the link".');
  }
  if (!res.ok) throw new Error(`Couldn't load the form (HTTP ${res.status}). Is it published?`);
  const html = await res.text();
  const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/);
  if (!match) throw new Error('Couldn’t find the form’s question data — Google may have changed the page format.');
  const data = JSON.parse(match[1]);
  const questions = [];
  for (const item of data[1][1] ?? []) {
    const [, title, , kind, answers] = item;
    if (!Array.isArray(answers)) continue; // section headers, images, etc.
    for (const answer of answers) {
      const validation = answer[4]?.[0];
      questions.push({
        entry: `entry.${answer[0]}`,
        title,
        kind: TYPE_NAMES[kind] ?? `type ${kind}`,
        required: Boolean(answer[2]),
        isEmail: Array.isArray(validation) && validation[1] === EMAIL_VALIDATION,
      });
    }
  }
  return { title: data[1][8] ?? data[3], questions };
}
