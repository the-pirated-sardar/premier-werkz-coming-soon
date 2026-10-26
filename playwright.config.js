import { defineConfig } from '@playwright/test';

// The site is served under the same sub-path GitHub Pages uses for project
// sites, so broken root-relative paths would fail here before they reach Pages.
const BASE_PATH = '/premier-werkz-coming-soon/';
const PORT = 4174;

export default defineConfig({
  testDir: 'tests',
  timeout: 45_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  // Builds for the same URL it serves, then serves it — tests always run against fresh output.
  webServer: {
    command: 'node scripts/build.mjs && node scripts/serve.mjs',
    env: { PORT: String(PORT), BASE_PATH, SITE_URL: `http://localhost:${PORT}${BASE_PATH}` },
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: false,
  },
});
