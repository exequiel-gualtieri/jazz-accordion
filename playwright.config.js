import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4791',
    // Uses the locally installed Chrome: no browser download needed.
    channel: 'chrome',
  },
  webServer: {
    command: 'node scripts/serve.mjs 4791',
    port: 4791,
    reuseExistingServer: true,
  },
});
