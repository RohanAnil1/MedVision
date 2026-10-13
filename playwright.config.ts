import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', timeout: 60000, workers: 1,
  use: {baseURL: 'http://127.0.0.1:3000', viewport: {width: 1500, height: 960}, screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: {args: ['--enable-unsafe-swiftshader']}},
  webServer: {command: 'node scripts/test-server.mjs', url: 'http://127.0.0.1:8000/health', reuseExistingServer: false, timeout: 30000},
})
