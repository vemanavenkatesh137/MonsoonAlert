import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:3050',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run backend:dev',
      cwd: '../',
      port: 3051,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run frontend:dev',
      cwd: '../',
      port: 3050,
      reuseExistingServer: !process.env.CI,
    }
  ]
});
