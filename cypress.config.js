import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'https://4733e71b-3a14-4f8b-aed1-3e72f92774e4.lovableproject.com',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
  },

  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
})