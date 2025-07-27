export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          chunks_used: Json | null
          citations: Json | null
          content: string
          created_at: string | null
          id: string
          message_type: string
          model_used: string | null
          processing_time_ms: number | null
          session_id: string | null
          sources_used: Json | null
          token_count: number | null
        }
        Insert: {
          chunks_used?: Json | null
          citations?: Json | null
          content: string
          created_at?: string | null
          id?: string
          message_type: string
          model_used?: string | null
          processing_time_ms?: number | null
          session_id?: string | null
          sources_used?: Json | null
          token_count?: number | null
        }
        Update: {
          chunks_used?: Json | null
          citations?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          message_type?: string
          model_used?: string | null
          processing_time_ms?: number | null
          session_id?: string | null
          sources_used?: Json | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          active_report_id: string | null
          context_type: string | null
          created_at: string | null
          id: string
          model_settings: Json | null
          notebook_id: string | null
          session_name: string | null
          updated_at: string | null
        }
        Insert: {
          active_report_id?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          model_settings?: Json | null
          notebook_id?: string | null
          session_name?: string | null
          updated_at?: string | null
        }
        Update: {
          active_report_id?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          model_settings?: Json | null
          notebook_id?: string | null
          session_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_active_report_id_fkey"
            columns: ["active_report_id"]
            isOneToOne: false
            referencedRelation: "report_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks_metadata: {
        Row: {
          chunk_id: number | null
          confidence_score: number | null
          content_type: string | null
          created_at: string | null
          hierarchy_level: number | null
          id: string
          metadata: Json | null
          page_numbers: number[] | null
          paragraph_index: number | null
          parent_chunk_id: number | null
          pdf_metadata_id: string | null
          section_title: string | null
          source_id: string | null
          subsection_title: string | null
          updated_at: string | null
        }
        Insert: {
          chunk_id?: number | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string | null
          hierarchy_level?: number | null
          id?: string
          metadata?: Json | null
          page_numbers?: number[] | null
          paragraph_index?: number | null
          parent_chunk_id?: number | null
          pdf_metadata_id?: string | null
          section_title?: string | null
          source_id?: string | null
          subsection_title?: string | null
          updated_at?: string | null
        }
        Update: {
          chunk_id?: number | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string | null
          hierarchy_level?: number | null
          id?: string
          metadata?: Json | null
          page_numbers?: number[] | null
          paragraph_index?: number | null
          parent_chunk_id?: number | null
          pdf_metadata_id?: string | null
          section_title?: string | null
          source_id?: string | null
          subsection_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chunks_metadata_pdf_metadata_id_fkey"
            columns: ["pdf_metadata_id"]
            isOneToOne: false
            referencedRelation: "pdf_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_metadata_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          address: string | null
          client_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          project_status: string | null
          project_type: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          client_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_status?: string | null
          project_type?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          client_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_status?: string | null
          project_type?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pdf_metadata: {
        Row: {
          address: string | null
          authors: Json | null
          confidence_score: number | null
          created_at: string | null
          document_title: string | null
          document_type: string | null
          extracted_at: string | null
          extraction_method: string | null
          id: string
          keywords: Json | null
          notebook_id: string | null
          page_count: number | null
          prepared_by: string | null
          prepared_for: string | null
          raw_metadata: Json | null
          report_issued_date: string | null
          sections: Json | null
          source_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          authors?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          document_title?: string | null
          document_type?: string | null
          extracted_at?: string | null
          extraction_method?: string | null
          id?: string
          keywords?: Json | null
          notebook_id?: string | null
          page_count?: number | null
          prepared_by?: string | null
          prepared_for?: string | null
          raw_metadata?: Json | null
          report_issued_date?: string | null
          sections?: Json | null
          source_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          authors?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          document_title?: string | null
          document_type?: string | null
          extracted_at?: string | null
          extraction_method?: string | null
          id?: string
          keywords?: Json | null
          notebook_id?: string | null
          page_count?: number | null
          prepared_by?: string | null
          prepared_for?: string | null
          raw_metadata?: Json | null
          report_issued_date?: string | null
          sections?: Json | null
          source_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_metadata_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_metadata_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      report_generations: {
        Row: {
          additional_context: string | null
          address: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          file_format: string | null
          file_path: string | null
          file_size: number | null
          generated_content: string | null
          id: string
          notebook_id: string | null
          progress: number | null
          queries_generated: Json | null
          sections_completed: Json | null
          started_at: string | null
          status: string | null
          template_id: string | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          additional_context?: string | null
          address?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_format?: string | null
          file_path?: string | null
          file_size?: number | null
          generated_content?: string | null
          id?: string
          notebook_id?: string | null
          progress?: number | null
          queries_generated?: Json | null
          sections_completed?: Json | null
          started_at?: string | null
          status?: string | null
          template_id?: string | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          additional_context?: string | null
          address?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_format?: string | null
          file_path?: string | null
          file_size?: number | null
          generated_content?: string | null
          id?: string
          notebook_id?: string | null
          progress?: number | null
          queries_generated?: Json | null
          sections_completed?: Json | null
          started_at?: string | null
          status?: string | null
          template_id?: string | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_generations_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_generations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_sections: {
        Row: {
          chunks_retrieved: Json | null
          completed_at: string | null
          created_at: string | null
          generated_content: string | null
          id: string
          query_used: string | null
          report_generation_id: string | null
          section_name: string
          section_order: number | null
          started_at: string | null
          status: string | null
          subsection_name: string | null
          word_count: number | null
        }
        Insert: {
          chunks_retrieved?: Json | null
          completed_at?: string | null
          created_at?: string | null
          generated_content?: string | null
          id?: string
          query_used?: string | null
          report_generation_id?: string | null
          section_name: string
          section_order?: number | null
          started_at?: string | null
          status?: string | null
          subsection_name?: string | null
          word_count?: number | null
        }
        Update: {
          chunks_retrieved?: Json | null
          completed_at?: string | null
          created_at?: string | null
          generated_content?: string | null
          id?: string
          query_used?: string | null
          report_generation_id?: string | null
          section_name?: string
          section_order?: number | null
          started_at?: string | null
          status?: string | null
          subsection_name?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "report_sections_report_generation_id_fkey"
            columns: ["report_generation_id"]
            isOneToOne: false
            referencedRelation: "report_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          name: string
          structure: Json
          updated_at: string | null
          version: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          name: string
          structure: Json
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          structure?: Json
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      sources: {
        Row: {
          chunk_count: number | null
          created_at: string | null
          display_name: string
          document_type: string | null
          error_message: string | null
          extracted_metadata: Json | null
          file_hash: string | null
          file_path: string | null
          file_size: number | null
          id: string
          metadata_extracted: boolean | null
          notebook_id: string | null
          processed_at: string | null
          processing_status: string | null
          updated_at: string | null
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string | null
          display_name: string
          document_type?: string | null
          error_message?: string | null
          extracted_metadata?: Json | null
          file_hash?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata_extracted?: boolean | null
          notebook_id?: string | null
          processed_at?: string | null
          processing_status?: string | null
          updated_at?: string | null
        }
        Update: {
          chunk_count?: number | null
          created_at?: string | null
          display_name?: string
          document_type?: string | null
          error_message?: string | null
          extracted_metadata?: Json | null
          file_hash?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata_extracted?: boolean | null
          notebook_id?: string | null
          processed_at?: string | null
          processing_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const