import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const host = "127.0.0.1";
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: "./playwright",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    browserName: "chromium",
    baseURL,
    headless: true,
    viewport: {
      width: 1440,
      height: 900
    },
    screenshot: "only-on-failure",
    trace: "off",
    video: "off"
  },
  webServer: {
    command: `npm run dev -- --host ${host} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_APP_MODE: "menu",
      VITE_RENDERER: "webgl"
    }
  }
});
