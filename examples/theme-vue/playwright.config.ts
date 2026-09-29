import { defineConfig, devices } from '@playwright/test'

// Smoke tests for the islands, run against a running `npm run dev` preview (see e2e/README.md).
// They need a store and the Shopify CLI's login, so they aren't part of `npm run check` or CI.
export default defineConfig({
  testDir: 'e2e',
  // every test gets a new browser context, so a cart of its own; one worker keeps the store's load low
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: process.env.THEME_URL ?? 'http://127.0.0.1:9292',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
