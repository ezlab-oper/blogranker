export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      crawl_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_keywords: number
          id: string
          processed_keywords: number
          started_at: string | null
          status: string
          successful_keywords: number
          total_keywords: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_keywords?: number
          id?: string
          processed_keywords?: number
          started_at?: string | null
          status?: string
          successful_keywords?: number
          total_keywords?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_keywords?: number
          id?: string
          processed_keywords?: number
          started_at?: string | null
          status?: string
          successful_keywords?: number
          total_keywords?: number
        }
        Relationships: []
      }
      crawl_results: {
        Row: {
          blog_author: string | null
          blog_platform: string | null
          blog_title: string
          blog_url: string
          crawled_at: string
          created_at: string
          id: string
          job_id: string | null
          keyword_id: string
          published_date: string | null
          rank: number
          search_engine_id: string
          snippet: string | null
          thumbnail_url: string | null
        }
        Insert: {
          blog_author?: string | null
          blog_platform?: string | null
          blog_title: string
          blog_url: string
          crawled_at?: string
          created_at?: string
          id?: string
          job_id?: string | null
          keyword_id: string
          published_date?: string | null
          rank: number
          search_engine_id: string
          snippet?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          blog_author?: string | null
          blog_platform?: string | null
          blog_title?: string
          blog_url?: string
          crawled_at?: string
          created_at?: string
          id?: string
          job_id?: string | null
          keyword_id?: string
          published_date?: string | null
          rank?: number
          search_engine_id?: string
          snippet?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "crawl_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_results_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_results_search_engine_id_fkey"
            columns: ["search_engine_id"]
            isOneToOne: false
            referencedRelation: "search_engines"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      keywords: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "keywords_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "keyword_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      search_engines: {
        Row: {
          base_url: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          base_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          base_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
