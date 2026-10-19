import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3199",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:3199",
    reuseExistingServer: false,
    env: { PORT: "3199", DATA_DIR: `./data/e2e/run-${Date.now()}` },
  },
  reporter: "list",
});
