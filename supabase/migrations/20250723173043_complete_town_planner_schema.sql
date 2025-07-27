-- =====================================================
-- Town Planning RAG System - Complete Database Schema
-- Version: 2.0 - Fresh Start with Enhanced Features
-- =====================================================

-- Drop existing tables if starting fresh (BE CAREFUL!)
-- Uncomment these lines only if you want to completely reset
/*
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users and Authentication (extends Supabase auth)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    organization TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'viewer')),
    preferences JSONB DEFAULT '{"llm_provider": "ollama", "llm_model": "qwen3:8b-q4_K_M"}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects/Notebooks for organizing documents
CREATE TABLE IF NOT EXISTS notebooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    -- Enhanced fields for town planning
    client_name TEXT,
    project_type TEXT DEFAULT 'general' CHECK (project_type IN ('general', 'heritage', 'development', 'planning', 'environmental')),
    address TEXT,
    lot_details TEXT,
    council_area TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    project_status TEXT DEFAULT 'active' CHECK (project_status IN ('active', 'completed', 'archived', 'on_hold')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document sources (PDFs, etc.)
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    display_name TEXT,
    -- Processing status tracking
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_error TEXT,
    -- Metadata extraction
    metadata_extracted BOOLEAN DEFAULT FALSE,
    chunk_count INTEGER DEFAULT 0,
    embedding_count INTEGER DEFAULT 0,
    -- File information
    file_hash TEXT, -- For deduplication
    page_count INTEGER,
    -- Extracted metadata storage
    extracted_metadata JSONB DEFAULT '{}',
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- METADATA MANAGEMENT SYSTEM
-- =====================================================

-- Dynamic metadata schema discovery
CREATE TABLE IF NOT EXISTS metadata_schema (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_name TEXT UNIQUE NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'date', 'number', 'boolean', 'array', 'object')),
    field_category TEXT DEFAULT 'general' CHECK (field_category IN ('general', 'client', 'project', 'location', 'regulatory', 'technical')),
    field_description TEXT,
    display_name TEXT,
    -- Extraction patterns and rules
    extraction_patterns JSONB DEFAULT '[]', -- Array of regex patterns
    extraction_rules JSONB DEFAULT '{}', -- AI extraction rules
    validation_rules JSONB DEFAULT '{}', -- Validation rules
    -- Usage statistics
    occurrence_count INTEGER DEFAULT 0,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    -- Configuration
    is_required BOOLEAN DEFAULT FALSE,
    is_searchable BOOLEAN DEFAULT TRUE,
    is_displayable BOOLEAN DEFAULT TRUE,
    default_value TEXT,
    -- Quality metrics
    average_confidence DECIMAL(3,2) DEFAULT 0.00,
    extraction_success_rate DECIMAL(3,2) DEFAULT 0.00,
    -- Metadata
    example_values JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PDF metadata storage
CREATE TABLE IF NOT EXISTS pdf_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    -- Extraction metadata
    extraction_method TEXT DEFAULT 'ai' CHECK (extraction_method IN ('ai', 'pattern', 'manual', 'hybrid')),
    extraction_model TEXT, -- Which AI model was used
    overall_confidence DECIMAL(3,2),
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    -- Raw extraction results
    raw_extraction JSONB DEFAULT '{}', -- Raw AI extraction output
    -- Processing metadata
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'needs_review', 'rejected')),
    validated_by UUID REFERENCES auth.users(id),
    validated_at TIMESTAMPTZ,
    validation_notes TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dynamic metadata field values
CREATE TABLE IF NOT EXISTS pdf_metadata_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pdf_metadata_id UUID REFERENCES pdf_metadata(id) ON DELETE CASCADE,
    schema_field_id UUID REFERENCES metadata_schema(id) ON DELETE CASCADE,
    -- Value storage
    field_value TEXT,
    field_value_normalized TEXT, -- Normalized for searching
    -- Extraction details
    confidence_score DECIMAL(3,2),
    extraction_method TEXT CHECK (extraction_method IN ('ai', 'pattern', 'manual', 'inferred')),
    extraction_context TEXT, -- Surrounding text that led to extraction
    page_number INTEGER,
    -- Validation
    is_validated BOOLEAN DEFAULT FALSE,
    validation_notes TEXT,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pdf_metadata_id, schema_field_id)
);

-- =====================================================
-- DOCUMENT PROCESSING & CHUNKING
-- =====================================================

-- Document chunks for vector search
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    -- Chunk content
    content TEXT NOT NULL,
    content_hash TEXT, -- For deduplication
    -- Chunk metadata
    chunk_index INTEGER NOT NULL,
    start_page INTEGER,
    end_page INTEGER,
    -- Semantic information
    section_title TEXT,
    subsection_title TEXT,
    hierarchy_level INTEGER DEFAULT 0,
    chunk_type TEXT DEFAULT 'text' CHECK (chunk_type IN ('text', 'table', 'list', 'heading', 'caption')),
    -- Relationships
    parent_chunk_id UUID REFERENCES document_chunks(id),
    related_chunks UUID[] DEFAULT '{}',
    -- Statistics
    word_count INTEGER,
    char_count INTEGER,
    -- Embedding status
    embedding_generated BOOLEAN DEFAULT FALSE,
    embedding_model TEXT,
    embedding_generated_at TIMESTAMPTZ,
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    -- Search optimization
    search_text tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunk metadata associations
CREATE TABLE IF NOT EXISTS chunk_metadata_associations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
    schema_field_id UUID REFERENCES metadata_schema(id) ON DELETE CASCADE,
    relevance_score DECIMAL(3,2) DEFAULT 0.50,
    association_type TEXT DEFAULT 'content' CHECK (association_type IN ('content', 'context', 'section', 'document')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chunk_id, schema_field_id)
);

-- Vector embeddings for chunks
CREATE TABLE IF NOT EXISTS chunk_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    -- Embedding data
    embedding vector(1536), -- Adjust dimension based on your model
    embedding_model TEXT NOT NULL,
    embedding_dimension INTEGER NOT NULL,
    -- Metadata for filtering
    metadata JSONB DEFAULT '{}',
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chunk_id, embedding_model)
);

-- =====================================================
-- CHAT & CONVERSATION MANAGEMENT
-- =====================================================

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    title TEXT,
    -- LLM Configuration for this session
    llm_provider TEXT DEFAULT 'ollama',
    llm_model TEXT,
    llm_config JSONB DEFAULT '{}',
    -- Session metadata
    source_ids UUID[] DEFAULT '{}',
    total_messages INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    -- RAG metadata
    chunks_retrieved UUID[] DEFAULT '{}',
    sources_cited UUID[] DEFAULT '{}',
    retrieval_metadata JSONB DEFAULT '{}',
    -- LLM metadata
    llm_provider TEXT,
    llm_model TEXT,
    completion_tokens INTEGER,
    prompt_tokens INTEGER,
    total_tokens INTEGER,
    -- Response metadata
    response_time_ms INTEGER,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REPORT GENERATION
-- =====================================================

-- Report templates
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    -- Template structure
    structure JSONB NOT NULL, -- Sections, subsections, queries
    default_config JSONB DEFAULT '{}',
    -- Usage
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report generation jobs
CREATE TABLE IF NOT EXISTS report_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id),
    -- Report details
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    address TEXT,
    additional_context TEXT,
    -- LLM Configuration
    llm_provider TEXT NOT NULL,
    llm_model TEXT NOT NULL,
    llm_config JSONB DEFAULT '{}',
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    -- Output
    generated_content TEXT,
    file_path TEXT,
    file_format TEXT DEFAULT 'markdown',
    file_size BIGINT,
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report sections
CREATE TABLE IF NOT EXISTS report_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_generation_id UUID REFERENCES report_generations(id) ON DELETE CASCADE,
    -- Section information
    section_name TEXT NOT NULL,
    subsection_name TEXT,
    section_order INTEGER NOT NULL,
    -- Query and retrieval
    query_used TEXT,
    chunks_retrieved UUID[] DEFAULT '{}',
    retrieval_scores DECIMAL[] DEFAULT '{}',
    -- Generation
    generated_content TEXT,
    word_count INTEGER,
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    error_message TEXT,
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PROCESSING JOBS & QUEUES
-- =====================================================

-- Background processing jobs
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type TEXT NOT NULL CHECK (job_type IN ('pdf_processing', 'embedding_generation', 'report_generation', 'metadata_extraction')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    -- Related entities
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Job configuration
    config JSONB DEFAULT '{}',
    -- Progress tracking
    progress INTEGER DEFAULT 0,
    total_steps INTEGER,
    current_step TEXT,
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    -- Timing
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Metadata
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Text search indexes
CREATE INDEX idx_chunks_search_text ON document_chunks USING GIN (search_text);
CREATE INDEX idx_chunks_content_trgm ON document_chunks USING GIN (content gin_trgm_ops);

-- Foreign key indexes
CREATE INDEX idx_sources_notebook_id ON sources(notebook_id);
CREATE INDEX idx_sources_user_id ON sources(user_id);
CREATE INDEX idx_chunks_source_id ON document_chunks(source_id);
CREATE INDEX idx_chunks_notebook_id ON document_chunks(notebook_id);
CREATE INDEX idx_embeddings_chunk_id ON chunk_embeddings(chunk_id);
CREATE INDEX idx_embeddings_notebook_id ON chunk_embeddings(notebook_id);

-- Status indexes
CREATE INDEX idx_sources_processing_status ON sources(processing_status);
CREATE INDEX idx_jobs_status ON processing_jobs(status, job_type);

-- Metadata indexes
CREATE INDEX idx_metadata_schema_field_name ON metadata_schema(field_name);
CREATE INDEX idx_metadata_values_pdf_id ON pdf_metadata_values(pdf_metadata_id);

-- Vector similarity search index (for each embedding model if needed)
CREATE INDEX idx_embeddings_vector ON chunk_embeddings USING ivfflat (embedding vector_cosine_ops);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_metadata_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Notebooks policies
CREATE POLICY "Users can view own notebooks" ON notebooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create notebooks" ON notebooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notebooks" ON notebooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notebooks" ON notebooks FOR DELETE USING (auth.uid() = user_id);

-- Sources policies
CREATE POLICY "Users can view own sources" ON sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create sources" ON sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON sources FOR DELETE USING (auth.uid() = user_id);

-- Chunks policies (inherit from sources)
CREATE POLICY "Users can view chunks from own sources" ON document_chunks FOR SELECT 
    USING (EXISTS (SELECT 1 FROM sources WHERE sources.id = document_chunks.source_id AND sources.user_id = auth.uid()));

-- Chat policies
CREATE POLICY "Users can view own chat sessions" ON chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create chat sessions" ON chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat sessions" ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own messages" ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Report generation policies
CREATE POLICY "Users can view own reports" ON report_generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create reports" ON report_generations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notebooks_updated_at BEFORE UPDATE ON notebooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_metadata_schema_updated_at BEFORE UPDATE ON metadata_schema FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pdf_metadata_updated_at BEFORE UPDATE ON pdf_metadata FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_chunks_updated_at BEFORE UPDATE ON document_chunks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_generations_updated_at BEFORE UPDATE ON report_generations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processing_jobs_updated_at BEFORE UPDATE ON processing_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_embeddings(
    query_embedding vector(1536),
    match_count INT DEFAULT 10,
    filter_notebook_id UUID DEFAULT NULL,
    filter_source_ids UUID[] DEFAULT NULL,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    chunk_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id as chunk_id,
        dc.content,
        1 - (ce.embedding <=> query_embedding) as similarity,
        dc.metadata
    FROM chunk_embeddings ce
    JOIN document_chunks dc ON ce.chunk_id = dc.id
    WHERE 
        (filter_notebook_id IS NULL OR ce.notebook_id = filter_notebook_id)
        AND (filter_source_ids IS NULL OR dc.source_id = ANY(filter_source_ids))
        AND (1 - (ce.embedding <=> query_embedding)) > similarity_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to get metadata field statistics
CREATE OR REPLACE FUNCTION get_metadata_field_stats()
RETURNS TABLE (
    field_id UUID,
    field_name TEXT,
    occurrence_count BIGINT,
    avg_confidence DECIMAL,
    unique_values_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ms.id,
        ms.field_name,
        COUNT(pmv.id) as occurrence_count,
        AVG(pmv.confidence_score) as avg_confidence,
        COUNT(DISTINCT pmv.field_value_normalized) as unique_values_count
    FROM metadata_schema ms
    LEFT JOIN pdf_metadata_values pmv ON ms.id = pmv.schema_field_id
    GROUP BY ms.id, ms.field_name
    ORDER BY occurrence_count DESC;
END;
$$;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default report templates
INSERT INTO report_templates (name, description, category, structure) VALUES
('Heritage Impact Statement', 'Standard heritage impact assessment report', 'heritage', 
'{
  "sections": [
    {
      "name": "Executive Summary",
      "title": "Executive Summary",
      "order": 1,
      "subsections": []
    },
    {
      "name": "Site Description",
      "title": "Site Description and Context",
      "order": 2,
      "subsections": [
        {"name": "Location", "title": "Location and Setting"},
        {"name": "Heritage Significance", "title": "Statement of Heritage Significance"},
        {"name": "Physical Description", "title": "Physical Description"}
      ]
    },
    {
      "name": "Proposal",
      "title": "Description of Proposal",
      "order": 3,
      "subsections": [
        {"name": "Works Description", "title": "Proposed Works"},
        {"name": "Justification", "title": "Justification"}
      ]
    },
    {
      "name": "Heritage Impact",
      "title": "Assessment of Heritage Impact",
      "order": 4,
      "subsections": [
        {"name": "Impact Analysis", "title": "Impact on Heritage Significance"},
        {"name": "Mitigation", "title": "Mitigation Measures"}
      ]
    },
    {
      "name": "Conclusion",
      "title": "Conclusion and Recommendations",
      "order": 5,
      "subsections": []
    }
  ]
}'::jsonb),

('Planning Proposal Report', 'Standard planning proposal assessment', 'planning',
'{
  "sections": [
    {
      "name": "Introduction",
      "title": "Introduction",
      "order": 1,
      "subsections": []
    },
    {
      "name": "Site Analysis",
      "title": "Site Analysis",
      "order": 2,
      "subsections": [
        {"name": "Site Description", "title": "Site Description"},
        {"name": "Planning Controls", "title": "Current Planning Controls"},
        {"name": "Constraints", "title": "Site Constraints and Opportunities"}
      ]
    },
    {
      "name": "Proposal Details",
      "title": "Proposal Details",
      "order": 3,
      "subsections": [
        {"name": "Development Description", "title": "Development Description"},
        {"name": "Design Response", "title": "Design Response"}
      ]
    },
    {
      "name": "Planning Assessment",
      "title": "Planning Assessment",
      "order": 4,
      "subsections": [
        {"name": "Zoning", "title": "Zoning Compliance"},
        {"name": "Development Standards", "title": "Development Standards"},
        {"name": "DCP Compliance", "title": "DCP Compliance"}
      ]
    },
    {
      "name": "Environmental Impact",
      "title": "Environmental Impact",
      "order": 5,
      "subsections": [
        {"name": "Traffic", "title": "Traffic and Parking"},
        {"name": "Amenity", "title": "Residential Amenity"},
        {"name": "Environment", "title": "Environmental Considerations"}
      ]
    },
    {
      "name": "Conclusion",
      "title": "Conclusion",
      "order": 6,
      "subsections": []
    }
  ]
}'::jsonb);

-- Insert common metadata fields
INSERT INTO metadata_schema (field_name, field_type, field_category, display_name, field_description, extraction_patterns) VALUES
('client_name', 'text', 'client', 'Client Name', 'Name of the client or organization', '["(?:prepared for|client|for):?\\s*([^\\n]+)", "client\\s*name:?\\s*([^\\n]+)"]'::jsonb),
('prepared_by', 'text', 'client', 'Prepared By', 'Author or consultant who prepared the document', '["(?:prepared by|author|consultant):?\\s*([^\\n]+)"]'::jsonb),
('address', 'text', 'location', 'Property Address', 'Subject property address', '["(?:address|property|site|location):?\\s*([^\\n]+)", "\\d+\\s+[^,\\n]+(?:street|road|avenue|drive|lane)[^,\\n]*,\\s*[^,\\n]+"]'::jsonb),
('lot_details', 'text', 'location', 'Lot Details', 'Lot and DP numbers', '["(?:lot|dp):?\\s*(\\d+[^\\n]+)", "lot\\s*(\\d+)\\s*dp\\s*(\\d+)"]'::jsonb),
('council_area', 'text', 'location', 'Council Area', 'Local government area', '["(?:council|lga|municipality):?\\s*([^\\n]+)"]'::jsonb),
('report_date', 'date', 'project', 'Report Date', 'Date the report was issued', '["(?:date|issued):?\\s*(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})"]'::jsonb),
('report_type', 'text', 'project', 'Report Type', 'Type of planning report', '["(?:report type|type):?\\s*([^\\n]+)"]'::jsonb),
('project_description', 'text', 'project', 'Project Description', 'Brief description of the project', '["(?:project|proposal|description):?\\s*([^\\n]+)"]'::jsonb),
('heritage_listing', 'text', 'regulatory', 'Heritage Listing', 'Heritage listing status', '["(?:heritage item|listing|scheduled):?\\s*([^\\n]+)"]'::jsonb),
('zoning', 'text', 'regulatory', 'Zoning', 'Property zoning classification', '["(?:zoning|zone):?\\s*([^\\n]+)", "\\b[A-Z]\\d+(?:\\([a-z]\\))?\\b"]'::jsonb),
('planning_controls', 'array', 'regulatory', 'Planning Controls', 'Applicable planning instruments', '["(?:planning controls|instruments):?\\s*([^\\n]+)"]'::jsonb),
('author_qualifications', 'text', 'technical', 'Author Qualifications', 'Professional qualifications of the author', '["(?:qualifications|credentials):?\\s*([^\\n]+)"]'::jsonb);

-- Create storage buckets (Run these after table creation)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES 
('sources', 'sources', false, false, 104857600, '{"application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"}'), -- 100MB limit
('reports', 'reports', false, false, 52428800, '{"application/pdf","text/markdown","application/vnd.openxmlformats-officedocument.wordprocessingml.document"}') -- 50MB limit
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload to sources bucket" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'sources' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view own sources" ON storage.objects
    FOR SELECT USING (bucket_id = 'sources' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own sources" ON storage.objects
    FOR DELETE USING (bucket_id = 'sources' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own reports" ON storage.objects
    FOR SELECT USING (bucket_id = 'reports' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View for active processing jobs
CREATE OR REPLACE VIEW v_active_jobs AS
SELECT 
    pj.*,
    s.file_name,
    n.name as notebook_name,
    u.email as user_email
FROM processing_jobs pj
LEFT JOIN sources s ON pj.source_id = s.id
LEFT JOIN notebooks n ON pj.notebook_id = n.id
LEFT JOIN auth.users u ON pj.user_id = u.id
WHERE pj.status IN ('pending', 'processing')
ORDER BY pj.created_at ASC;

-- View for document statistics
CREATE OR REPLACE VIEW v_document_stats AS
SELECT 
    n.id as notebook_id,
    n.name as notebook_name,
    COUNT(DISTINCT s.id) as source_count,
    COUNT(DISTINCT dc.id) as chunk_count,
    COUNT(DISTINCT ce.id) as embedding_count,
    SUM(s.file_size) as total_file_size,
    MAX(s.created_at) as last_upload
FROM notebooks n
LEFT JOIN sources s ON n.id = s.notebook_id
LEFT JOIN document_chunks dc ON s.id = dc.source_id
LEFT JOIN chunk_embeddings ce ON dc.id = ce.chunk_id
GROUP BY n.id, n.name;

-- Grant permissions for views
GRANT SELECT ON v_active_jobs TO authenticated;
GRANT SELECT ON v_document_stats TO authenticated;