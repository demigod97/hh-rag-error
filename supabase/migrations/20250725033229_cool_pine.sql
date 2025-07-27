/*
  # Add Missing Database Functions

  1. New Functions
    - `get_or_create_default_notebook(user_uuid)` - Gets or creates a default notebook for a user
    - `create_chat_session(user_uuid, notebook_uuid, session_title)` - Creates a new chat session

  2. Security
    - Functions use SECURITY DEFINER to run with elevated privileges
    - Input validation and error handling included
    - Proper return types defined

  3. Functionality
    - get_or_create_default_notebook: Returns existing default notebook or creates one
    - create_chat_session: Creates new chat session and returns the session ID
*/

-- Function to get or create default notebook for a user
CREATE OR REPLACE FUNCTION public.get_or_create_default_notebook(user_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notebook_id UUID;
BEGIN
    -- Input validation
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'user_uuid cannot be null';
    END IF;

    -- Try to find existing default notebook
    SELECT id INTO notebook_id
    FROM public.notebooks
    WHERE user_id = user_uuid
      AND (name = 'Default Notebook' OR name ILIKE '%default%')
      AND project_status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;

    -- If no default notebook exists, create one
    IF notebook_id IS NULL THEN
        INSERT INTO public.notebooks (
            user_id,
            name,
            description,
            project_type,
            project_status,
            created_at,
            updated_at
        ) VALUES (
            user_uuid,
            'Default Notebook',
            'Default notebook for general planning documents',
            'general',
            'active',
            NOW(),
            NOW()
        )
        RETURNING id INTO notebook_id;
    END IF;

    RETURN notebook_id;
END;
$$;

-- Function to create a new chat session
CREATE OR REPLACE FUNCTION public.create_chat_session(
    user_uuid UUID,
    notebook_uuid UUID,
    session_title TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    session_id UUID;
    final_title TEXT;
BEGIN
    -- Input validation
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'user_uuid cannot be null';
    END IF;

    IF notebook_uuid IS NULL THEN
        RAISE EXCEPTION 'notebook_uuid cannot be null';
    END IF;

    -- Verify notebook exists and belongs to user
    IF NOT EXISTS (
        SELECT 1 FROM public.notebooks 
        WHERE id = notebook_uuid AND user_id = user_uuid
    ) THEN
        RAISE EXCEPTION 'Notebook not found or access denied';
    END IF;

    -- Set default title if not provided
    IF session_title IS NULL OR session_title = '' THEN
        final_title := 'Chat - ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI');
    ELSE
        final_title := session_title;
    END IF;

    -- Create new chat session
    INSERT INTO public.chat_sessions (
        user_id,
        notebook_id,
        title,
        total_messages,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        user_uuid,
        notebook_uuid,
        final_title,
        0,
        true,
        NOW(),
        NOW()
    )
    RETURNING id INTO session_id;

    RETURN session_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_default_notebook(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_chat_session(UUID, UUID, TEXT) TO authenticated;

-- Grant execute permissions to anon users (for public access if needed)
GRANT EXECUTE ON FUNCTION public.get_or_create_default_notebook(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.create_chat_session(UUID, UUID, TEXT) TO anon;