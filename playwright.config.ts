import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/e2e.spec.ts','**/secure.e2e.spec.ts','**/parity.e2e.spec.ts','**/mobile-design.e2e.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:5273',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || (process.platform === 'linux' ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] },
    trace: 'retain-on-failure',
  },
  webServer: { command: 'npm exec vite -- preview --host 127.0.0.1 --port 5273 --strictPort', url: 'http://127.0.0.1:5273', reuseExistingServer: false },
});
