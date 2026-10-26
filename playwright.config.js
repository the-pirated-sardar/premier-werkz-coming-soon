import { defineConfig } from '@playwright/test';

// The site is served under the same sub-path GitHub Pages uses for project
// sites, so broken root-relative paths would fail here before they reach Pages.
// Set BASE_URL to run the same tests against a deployed site instead, e.g.
//   BASE_URL=https://the-pirated-sardar.github.io/premier-werkz-coming-soon/ npm test
const BASE_PATH = '/premier-werkz-coming-soon/';
const PORT = 4174;
const LOCAL_URL = `http://localhost:${PORT}${BASE_PATH}`;
const BASE_URL = process.env.BASE_URL || LOCAL_URL;

export default defineConfig({
  testDir: 'tests',
  timeout: 45_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  // Builds for the same URL it serves, then serves it — tests always run against fresh output.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node scripts/build.mjs && node scripts/serve.mjs',
        env: { PORT: String(PORT), BASE_PATH, SITE_URL: LOCAL_URL },
        url: LOCAL_URL,
        reuseExistingServer: false,
      },
});
