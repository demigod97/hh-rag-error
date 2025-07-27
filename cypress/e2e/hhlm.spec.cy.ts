describe('Town Planner Assistant - End to End Flow', () => {
  beforeEach(() => {
    // Visit the app with a test session ID
    cy.visit('/?sessionId=test-e2e-session');
  });

  it('should complete the full workflow: upload → ask → template', () => {
    // Step 1: Upload a PDF document
    cy.log('Step 1: Upload PDF document');
    
    // Check if sources sidebar is visible (desktop) or click mobile trigger
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="sources-sidebar"]').length === 0) {
        // Mobile: click sources trigger
        cy.get('button').contains('FileText').click();
      }
    });

    // Upload file via drag and drop area
    cy.get('[data-testid="dropzone"]').should('be.visible');
    
    // Create a test PDF file
    const fileName = 'test-planning-document.pdf';
    cy.fixture(fileName).then(fileContent => {
      cy.get('input[type="file"]').selectFile({
        contents: fileContent,
        fileName: fileName,
        mimeType: 'application/pdf'
      }, { force: true });
    });

    // Verify upload success
    cy.contains('Upload successful').should('be.visible');
    cy.get('[data-testid="uploaded-file"]').should('contain', fileName);

    // Step 2: Ask a question in the chat
    cy.log('Step 2: Ask question in chat');
    
    const testQuestion = 'What are the setback requirements for residential buildings?';
    
    // Type question in chat input
    cy.get('input[placeholder*="Ask"]').type(testQuestion);
    
    // Send the message
    cy.get('button').contains('Send').click();
    
    // Verify question appears in chat
    cy.contains(testQuestion).should('be.visible');
    
    // Wait for AI response (with loading indicator)
    cy.get('[data-testid="thinking-animation"]').should('be.visible');
    
    // Wait for response to complete
    cy.contains('setback', { timeout: 30000 }).should('be.visible');
    
    // Verify citations appear
    cy.get('[data-testid="citation-chip"]').should('exist');

    // Step 3: Generate permit template
    cy.log('Step 3: Generate permit template');
    
    // Check if permit drawer is visible (desktop) or click mobile trigger
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="permit-drawer"]').length === 0) {
        // Mobile: click actions trigger
        cy.get('button').contains('Settings').click();
      }
    });

    // Fill out permit form
    cy.get('[data-testid="permit-type-select"]').click();
    cy.contains('Building Permit').click();
    
    cy.get('input[placeholder*="applicant"]').type('John Doe');
    cy.get('input[placeholder*="address"]').type('123 Main Street, Anytown');

    // Generate template
    cy.get('button').contains('Generate Template').click();
    
    // Verify template generation
    cy.contains('Template generated').should('be.visible');
    
    // Verify download or preview functionality
    cy.get('[data-testid="template-preview"]').should('be.visible');

    // Step 4: Verify citation hover functionality
    cy.log('Step 4: Test citation hover');
    
    cy.get('[data-testid="citation-chip"]').first().trigger('mouseover');
    cy.get('[data-testid="citation-popover"]').should('be.visible');
    cy.contains('page excerpt').should('be.visible');

    // Step 5: Test settings functionality
    cy.log('Step 5: Test settings');
    
    cy.get('[data-testid="settings-button"]').click();
    cy.get('[data-testid="settings-modal"]').should('be.visible');
    
    // Test LLM provider toggle
    cy.contains('Ollama').click();
    cy.get('button').contains('Save Settings').click();
    
    cy.contains('Settings saved').should('be.visible');
  });

  it('should handle mobile navigation correctly', () => {
    // Test mobile sheet functionality
    cy.viewport('iphone-6');
    
    // Test sources sheet
    cy.get('[data-testid="mobile-sources-trigger"]').click();
    cy.get('[data-testid="sources-sidebar"]').should('be.visible');
    
    // Close sheet
    cy.get('[data-testid="sheet-close"]').click();
    cy.get('[data-testid="sources-sidebar"]').should('not.be.visible');
    
    // Test actions sheet
    cy.get('[data-testid="mobile-actions-trigger"]').click();
    cy.get('[data-testid="permit-drawer"]').should('be.visible');
  });

  it('should handle error scenarios gracefully', () => {
    // Test upload error
    cy.get('input[type="file"]').selectFile({
      contents: 'invalid content',
      fileName: 'invalid.txt',
      mimeType: 'text/plain'
    }, { force: true });
    
    cy.contains('Upload failed').should('be.visible');
    
    // Test empty chat submission
    cy.get('button').contains('Send').should('be.disabled');
    
    // Test network error scenarios
    cy.intercept('POST', '**/webhook/chat', { forceNetworkError: true }).as('chatError');
    
    cy.get('input[placeholder*="Ask"]').type('Test question');
    cy.get('button').contains('Send').click();
    
    cy.wait('@chatError');
    cy.contains('error', { matchCase: false }).should('be.visible');
  });
});