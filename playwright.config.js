import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: [['list'],['html',{open:'never',outputFolder:'playwright-report'}]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run admin',
    url: 'http://127.0.0.1:4173/admin/',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
