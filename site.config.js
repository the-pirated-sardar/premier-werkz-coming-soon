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
   * The page shows its own styled form; each field is sent to the matching
   * question of this Google Form, so responses, the linked Sheet and email
   * notifications all keep working in Google Forms.
   *
   * To switch forms, run `npm run form-fields -- <responder link>` and paste
   * what it prints over this whole `form: { … }` block (see README.md).
   *
   * url    — the form's responder link: https://docs.google.com/forms/d/e/<ID>/viewform
   *          (not the …/edit link, not a forms.gle short link)
   * fields — one entry per question, in display order:
   *          entry        Google's question ID ("entry.<number>")
   *          label        text shown above the field
   *          type         'text' | 'email' | 'tel' | 'textarea'
   *          required     true if the Google question is required
   *          autocomplete browser autofill hint (name, email, tel, …) — optional
   *          half         true to share a row with the next half-width field (desktop)
   *          placeholder  optional hint shown inside an empty field
   */
  form: {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSf5uZ27z2AGOZRJ_pwo73I2V9BZLcmPHyRjS1lFLXRDelb51g/viewform',
    fields: [
      { entry: 'entry.205625071', label: 'Name', type: 'text', required: true, autocomplete: 'name' },
      { entry: 'entry.677626947', label: 'Email', type: 'email', required: true, autocomplete: 'email', half: true },
      { entry: 'entry.895985407', label: 'Phone', type: 'tel', autocomplete: 'tel', half: true },
      {
        entry: 'entry.160600044',
        label: 'How can we help?',
        type: 'textarea',
        placeholder: 'Your vehicle, the service you’re interested in, a good time to call…',
      },
    ],
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

  /**
   * Old addresses (e.g. pages of the previous premierwerkz.com website) that
   * should send visitors straight to this homepage. Paths only, starting with "/".
   * Anything not listed here shows this page as a "not found" (404) page instead.
   */
  redirects: ['/work-request'],

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
      'A new Premier Werkz website is on its way. In the meantime, we’re just a call or message away. Leave your details and we’ll get back to you.',
    formHeading: 'Get in Touch',
    formIntro: 'Tell us about your vehicle and what you have in mind. We’ll reply by phone or email.',
    formSubmit: 'Send message',
    formSuccessHeading: 'Message sent',
    formSuccess: 'Thanks, we’ve received your message and will be in touch soon.',
  },

  seo: {
    title: 'Premier Werkz Auto Salon | Modesto, CA | Website Coming Soon',
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
