import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5178', browserName: 'chromium', ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}), trace: 'retain-on-failure' },
  webServer: [
    { command: 'node e2e/mock-server.mjs', port: 5179, reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort', port: 5178, env: { HOLMES_PROXY_TARGET: 'http://127.0.0.1:5179' }, reuseExistingServer: false },
  ],
})
