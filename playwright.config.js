'use strict';

// Browser tests for the outline's keyboard interactions.
//
// They drive the Chrome already installed on the machine (`channel: 'chrome'`),
// so no Playwright browser download is needed, and they configure themselves:
// the application is started by the spec itself, in the test process, against a
// throwaway data directory (see test/e2e/reindent.spec.js).
//
// One worker only: the application listens on a fixed port inside that process
// and the tests share a single account and session.

const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT || 3499);

module.exports = defineConfig({
  testDir: './test/e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  expect: { timeout: 5000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    headless: true,
  },
});
