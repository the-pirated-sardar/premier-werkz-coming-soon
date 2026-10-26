/**
 * Page template. Pure function: (site data) → HTML string.
 * All content comes from site.config.js via scripts/build.mjs — edit wording there, not here.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESC[c]);

const NEW_TAB = '<span class="visually-hidden"> (opens in a new tab)</span>';

// Simple 24×24 line icons, decorative only (aria-hidden).
const ICONS = {
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
  email: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/>',
  location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>',
  facebook: '<path d="M15 8h-2a1.5 1.5 0 0 0-1.5 1.5V21M9 13h6"/><rect x="3" y="3" width="18" height="18" rx="5"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
const icon = (name, cls = 'icon') =>
  `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

function srcset(prefix, widths, ext) {
  return widths.map((w) => `images/${prefix}-${w}.${ext} ${w}w`).join(', ');
}

function heroPicture({ images, alt }) {
  const d = images.hero.desktop;
  const p = images.hero.portrait;
  const desktopMedia = '(min-width: 1024px)';
  const desktopSizes = '(min-width: 1715px) calc(100vw - 720px), (min-width: 1240px) 58vw, calc(100vw - 520px)';
  const portraitSizes = '(orientation: landscape) and (max-height: 540px) 50vw, 100vw';
  const fallbackW = p.widths[Math.min(2, p.widths.length - 1)];
  return `<picture class="hero__media">
        <source media="${desktopMedia}" type="image/avif" srcset="${srcset('hero-desktop', d.widths, 'avif')}" sizes="${desktopSizes}" width="${d.width}" height="${d.height}">
        <source media="${desktopMedia}" type="image/webp" srcset="${srcset('hero-desktop', d.widths, 'webp')}" sizes="${desktopSizes}" width="${d.width}" height="${d.height}">
        <source media="${desktopMedia}" srcset="${srcset('hero-desktop', d.widths, 'jpg')}" sizes="${desktopSizes}" width="${d.width}" height="${d.height}">
        <source type="image/avif" srcset="${srcset('hero-portrait', p.widths, 'avif')}" sizes="${portraitSizes}">
        <source type="image/webp" srcset="${srcset('hero-portrait', p.widths, 'webp')}" sizes="${portraitSizes}">
        <img src="images/hero-portrait-${fallbackW}.jpg" srcset="${srcset('hero-portrait', p.widths, 'jpg')}" sizes="${portraitSizes}" width="${p.width}" height="${p.height}" alt="${esc(alt)}" fetchpriority="high" decoding="async">
      </picture>`;
}

function logoPicture({ images, alt }) {
  const { widths, aspect } = images.logo;
  const sizes = '(min-width: 1024px) clamp(150px, 12vw, 230px), 150px';
  return `<picture>
          <source type="image/avif" srcset="${srcset('logo', widths, 'avif')}" sizes="${sizes}">
          <source type="image/webp" srcset="${srcset('logo', widths, 'webp')}" sizes="${sizes}">
          <img class="hero__logo" src="images/logo-480.png" sizes="${sizes}" width="480" height="${Math.round(480 / aspect)}" alt="${esc(alt)}">
        </picture>`;
}

function contactItems(site) {
  const { contact, social, links } = site;
  const items = [];
  if (contact.phone) {
    items.push(`<li class="contact__item">
          ${icon('phone')}
          <span class="contact__label">Call</span>
          <a class="contact__value" href="${esc(links.tel)}">${esc(contact.phone)}</a>
        </li>`);
  }
  if (contact.email) {
    items.push(`<li class="contact__item">
          ${icon('email')}
          <span class="contact__label">Email</span>
          <a class="contact__value" href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>
        </li>`);
  }
  if (site.addressLines.length) {
    const note = contact.availability ? `<span class="contact__note">${esc(contact.availability)}</span>` : '';
    items.push(`<li class="contact__item">
          ${icon('location')}
          <span class="contact__label">Visit</span>
          <a class="contact__value" href="${esc(links.maps)}" target="_blank" rel="noopener">${site.addressLines.map(esc).join('<br>')}${NEW_TAB}</a>
          ${note}
        </li>`);
  }
  if (social.length) {
    const socialLinks = social
      .map(
        (s) => `<a class="contact__social" href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(`${s.network}: ${s.handle}`)} (opens in a new tab)">${icon(s.network.toLowerCase() in ICONS ? s.network.toLowerCase() : 'external', 'icon icon--social')}<span>${esc(s.network)}</span></a>`,
      )
      .join('');
    items.push(`<li class="contact__item contact__item--social">
          <span class="contact__label">Follow</span>
          <span class="contact__socials">${socialLinks}</span>
        </li>`);
  }
  return items.join('\n        ');
}

export function render(site) {
  const { config, form, images, page } = site;
  const { copy, business, seo } = config;
  const year = new Date().getFullYear();

  const services = config.services.length
    ? `<ul class="hero__services" aria-label="Services">${config.services.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`
    : '';

  const callAction = config.contact.phone
    ? `<a class="button button--primary" href="${esc(site.links.tel)}">${icon('phone')}<span>Call ${esc(config.contact.phone)}</span></a>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${page.baseHref ? `\n  <base href="${esc(page.baseHref)}">` : ''}
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(seo.description)}">${page.indexable ? '' : '\n  <meta name="robots" content="noindex, nofollow">'}
  <link rel="canonical" href="${esc(site.siteUrl)}">
  <meta name="theme-color" content="#0a0b0e">
  <meta name="color-scheme" content="dark">
  <meta name="format-detection" content="telephone=no">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(business.name)}">
  <meta property="og:title" content="${esc(`${business.name} — ${copy.headline}`)}">
  <meta property="og:description" content="${esc(seo.description)}">
  <meta property="og:url" content="${esc(site.siteUrl)}">
  <meta property="og:image" content="${esc(site.siteUrl + images.og.file)}">
  <meta property="og:image:width" content="${images.og.width}">
  <meta property="og:image:height" content="${images.og.height}">
  <meta property="og:image:alt" content="${esc(`${business.name} logo over an Audi S4`)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="favicon.ico" sizes="any">
  <link rel="icon" href="favicon-48.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <link rel="preload" href="fonts/archivo-latin-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preconnect" href="https://docs.google.com">
  <style>${site.css}</style>
  <script type="application/ld+json">${site.jsonLd}</script>
</head>
<body>
  <a class="skip-link" href="#get-in-touch">Skip to the contact form</a>
  <main class="page">
    <section class="hero" aria-labelledby="hero-title">
      ${heroPicture({ images, alt: config.images.heroAlt })}
      <div class="hero__inner">
        ${logoPicture({ images, alt: business.name })}
        <div class="hero__copy">
          <p class="eyebrow">${esc(business.locality)}</p>
          <h1 class="hero__title" id="hero-title">${site.headlineHtml}</h1>
          <p class="hero__intro">${esc(copy.intro)}</p>
          ${services}
          <div class="hero__actions">
            ${callAction}
            <a class="button button--ghost" href="#get-in-touch">${icon('arrowDown')}<span>Send a message</span></a>
          </div>
        </div>
      </div>
    </section>

    <section class="enquiry" id="get-in-touch" aria-labelledby="enquiry-title" tabindex="-1">
      <div class="enquiry__head">
        <h2 class="section-title" id="enquiry-title">${esc(copy.formHeading)}</h2>
        <p class="enquiry__intro">${esc(copy.formIntro)}</p>
      </div>
      <div class="form-frame" style="--form-h-wide: ${form.height.desktop}px; --form-h-narrow: ${form.height.mobile}px">
        <p class="form-frame__loading" aria-hidden="true">Loading form…</p>
        <iframe class="form-frame__iframe" src="${esc(form.embedUrl)}" title="${esc(`${copy.formHeading} — ${business.name} contact form`)}" loading="lazy"></iframe>
      </div>
      <p class="form-fallback">
        Form not loading?
        <a href="${esc(form.publicUrl)}" target="_blank" rel="noopener">Open it in a new tab${icon('external', 'icon icon--inline')}${NEW_TAB}</a>
      </p>
    </section>

    <section class="contact" aria-labelledby="contact-title">
      <h2 class="contact__title" id="contact-title">Contact</h2>
      <address class="contact__address">
        <ul class="contact__list" role="list">
        ${contactItems(site)}
        </ul>
      </address>
      <p class="contact__legal">© ${year} ${esc(business.name)}</p>
    </section>
  </main>
</body>
</html>
`;
}
