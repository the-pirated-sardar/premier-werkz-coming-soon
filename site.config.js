/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PREMIER WERKZ — SITE CONFIGURATION
 * ─────────────────────────────────────────────────────────────────────────────
 *  Everything a non-developer is likely to change lives in this one file:
 *  the Google Form, phone, email, address, social links and page wording.
 *
 *  After editing, commit and push to `main`. GitHub Actions rebuilds and
 *  redeploys the site automatically (about one minute). The build checks this
 *  file and fails with a clear message if something looks wrong, so a typo
 *  can't take the live site down. See README.md → "Updating content".
 *
 *  Leave a value as an empty string ('') to hide that item on the page.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export default {
  business: {
    name: 'Premier Werkz Auto Salon',
    // Shown above the headline and used in search results.
    locality: 'Modesto, California',
  },

  /**
   * GOOGLE FORM ("Get in Touch")
   *
   * Paste the form's responder link here. Either of these works:
   *   https://docs.google.com/forms/d/e/<ID>/viewform
   *   https://docs.google.com/forms/d/e/<ID>/viewform?embedded=true   (the iframe `src`)
   * The embed and "open in a new tab" links are both derived from it.
   *
   * Do NOT use the editor link (…/forms/d/<ID>/edit) or a forms.gle short link.
   *
   * `height` values are the form's rendered height in pixels. They only need
   * changing if the replacement form has different questions — run
   * `npm run measure-form` to get new numbers (see README.md).
   */
  form: {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSf5uZ27z2AGOZRJ_pwo73I2V9BZLcmPHyRjS1lFLXRDelb51g/viewform?embedded=true',
    height: {
      desktop: 819, // iframe ≥ 640px wide (matches Google's own embed code)
      mobile: 900,  // narrow screens, where text wraps more
    },
  },

  contact: {
    // Display format, as customers should see it.
    phone: '(408) 981-2902',
    email: 'premierwerkz@gmail.com',
    address: {
      street: '4629 Spyres Way',
      unit: 'Suite F',
      city: 'Modesto',
      region: 'CA',
      postalCode: '95356',
    },
    // Short note shown with the address. '' to hide.
    availability: 'By appointment only',
  },

  // Order here = order on the page. Remove an entry to hide it.
  social: [
    { network: 'Instagram', handle: '@premierwerkz', url: 'https://www.instagram.com/premierwerkz/' },
    { network: 'Facebook', handle: 'PremierWerkz', url: 'https://www.facebook.com/PremierWerkz' },
  ],

  // One discreet line under the intro. [] to hide.
  services: [
    'Detailing',
    'Paint Correction',
    'Ceramic Coating',
    'Paint Protection Film',
    'Window Tint',
    'Vinyl Wraps',
  ],

  copy: {
    headline: 'Website Coming Soon',
    intro:
      'A new Premier Werkz website is on its way. In the meantime, we’re just a call or message away — leave your details and we’ll get back to you.',
    formHeading: 'Get in Touch',
    formIntro: 'Tell us about your vehicle and what you have in mind. We’ll reply by phone or email.',
  },

  seo: {
    title: 'Premier Werkz Auto Salon | Modesto, CA — Website Coming Soon',
    description:
      'Premier Werkz Auto Salon in Modesto, California: detailing, paint correction, ceramic coating, paint protection film, window tint and vinyl wraps. Get in touch today.',
    /**
     * Search engines are always told NOT to index the temporary
     * *.github.io preview address. On a custom domain (e.g. premierwerkz.com)
     * the page is indexable while this is true.
     */
    allowIndexing: true,
  },

  images: {
    // Describes the hero photograph for screen-reader users.
    heroAlt: 'Lowered Audi S4 in a violet-to-blue color-shift finish, parked on a dirt lot under a dramatic evening sky',
  },
};
