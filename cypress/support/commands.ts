/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>
      drag(subject: string, target: string): Chainable<Element>
      dismissServiceWorker(): Chainable<void>
      getBySel(dataTestAttribute: string, args?: any): Chainable<JQuery<HTMLElement>>
      getBySelLike(dataTestPrefixAttribute: string, args?: any): Chainable<JQuery<HTMLElement>>
    }
  }
}

// -- This is a parent command --
Cypress.Commands.add('login', (email, password) => {
  console.log('Custom command example: Login', email, password)
})

// -- This is a child command --
Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, target) => {
  console.log('Custom command example: Drag', subject, target)
})

// -- This is a dual command --
Cypress.Commands.add('dismissServiceWorker', { prevSubject: 'optional'}, (subject) => {
  console.log('Custom command example: Dismiss notification', subject)
})

// Custom command for data-testid
Cypress.Commands.add('getBySel', (selector, ...args) => {
  return cy.get(`[data-testid="${selector}"]`, ...args)
})

Cypress.Commands.add('getBySelLike', (selector, ...args) => {
  return cy.get(`[data-testid*="${selector}"]`, ...args)
})
