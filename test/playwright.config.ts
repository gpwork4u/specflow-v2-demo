import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  outputDir: './screenshots',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: './reports/playwright-results.json' }],
    ['html', { outputFolder: './reports/html', open: 'never' }],
  ],
  projects: [
    {
      name: 'api',
      testDir: './e2e',
      testMatch: '*.spec.ts',
      use: {
        baseURL: process.env.API_BASE_URL || 'http://localhost:3001',
      },
    },
    {
      name: 'browser',
      testDir: './browser',
      testMatch: '*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.WEB_BASE_URL || 'http://localhost:3000',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
      },
    },
  ],
});
