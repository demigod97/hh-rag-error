// Add these functions to your existing src/lib/api.ts file

// =====================================================
// Compatibility Functions for Existing Components
// =====================================================

// For ChatStream.tsx
export async function sendChat(sessionId: string, message: string) {
  try {
    // First, ensure we have a valid session
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    // Send the message
    const response = await sendChatMessage(sessionId, message);
    
    // Return in the format expected by ChatStream component
    return {
      userMessage: {
        id: Date.now().toString(),
        content: message
      },
      aiMessage: {
        id: (Date.now() + 1).toString(),
        content: response.content
      }
    };
  } catch (error) {
    console.error('sendChat error:', error);
    throw error;
  }
}

// For PermitDrawer.tsx
export async function template() {
  // This function seems to fetch templates - implement as needed
  const { data, error } = await supabase
    .from('report_templates')
    .select('*')
    .eq('is_active', true);
  
  if (error) throw error;
  return data;
}

export async function genTemplate(params: {
  permitType: string;
  address: string;
  applicant: string;
  sessionId: string;
}) {
  try {
    // Generate a report using the report generation system
    const reportId = await generateReport({
      notebookId: 'default', // You might want to get this from context
      templateId: params.permitType, // Map permit type to template ID
      topic: `Permit Application - ${params.permitType}`,
      address: params.address,
      additionalContext: `Applicant: ${params.applicant}`
    });

    // Wait for report generation to complete
    let report;
    let attempts = 0;
    while (attempts < 30) { // 30 seconds timeout
      report = await getReportStatus(reportId);
      if (report.status === 'completed') {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (report?.status !== 'completed') {
      throw new Error('Report generation timed out');
    }

    // Get the download URL
    const downloadUrl = await downloadReport(reportId);

    return {
      docx_url: downloadUrl,
      preview_url: downloadUrl // For now, same URL
    };
  } catch (error) {
    console.error('genTemplate error:', error);
    throw error;
  }
}

// For SourcesSidebar.tsx
export async function uploadFile(file: File, notebookId: string) {
  try {
    const result = await uploadAndProcessFile(file, notebookId);
    
    // Return in the format expected by SourcesSidebar
    return {
      id: result.uploadId,
      display_name: file.name,
      file_size: file.size,
      processing_status: 'processing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('uploadFile error:', error);
    throw error;
  }
}

// =====================================================
// Helper Functions
// =====================================================

// Get or create default notebook
export async function getDefaultNotebook(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check for existing default notebook
  const { data: notebooks } = await supabase
    .from('notebooks')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', 'Default Notebook')
    .single();

  if (notebooks?.id) {
    return notebooks.id;
  }

  // Create default notebook
  return await createNotebook('Default Notebook', 'general');
}

// Initialize chat session with default notebook
export async function initializeChatSession(sourceIds?: string[]): Promise<string> {
  const notebookId = await getDefaultNotebook();
  return await createChatSession(notebookId, sourceIds);
}