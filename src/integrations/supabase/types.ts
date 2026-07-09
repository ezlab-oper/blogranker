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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bloggers: {
        Row: {
          blog_grade: Database["public"]["Enums"]["blog_grade"] | null
          blog_id: string | null
          blog_url: string
          contract_end_date: string | null
          created_at: string
          email: string | null
          id: string
          is_influencer: boolean | null
          memo: string | null
          name: string
          requested_at: string | null
          status: Database["public"]["Enums"]["blogger_status"] | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          blog_grade?: Database["public"]["Enums"]["blog_grade"] | null
          blog_id?: string | null
          blog_url: string
          contract_end_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_influencer?: boolean | null
          memo?: string | null
          name: string
          requested_at?: string | null
          status?: Database["public"]["Enums"]["blogger_status"] | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          blog_grade?: Database["public"]["Enums"]["blog_grade"] | null
          blog_id?: string | null
          blog_url?: string
          contract_end_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_influencer?: boolean | null
          memo?: string | null
          name?: string
          requested_at?: string | null
          status?: Database["public"]["Enums"]["blogger_status"] | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      crawl_jobs: {
        Row: {
          completed_at: string | null
          crawl_date: string | null
          created_at: string
          error_message: string | null
          failed_keywords: number
          id: string
          processed_keyword_ids: string[]
          processed_keywords: number
          started_at: string | null
          status: string
          successful_keywords: number
          total_keywords: number
        }
        Insert: {
          completed_at?: string | null
          crawl_date?: string | null
          created_at?: string
          error_message?: string | null
          failed_keywords?: number
          id?: string
          processed_keyword_ids?: string[]
          processed_keywords?: number
          started_at?: string | null
          status?: string
          successful_keywords?: number
          total_keywords?: number
        }
        Update: {
          completed_at?: string | null
          crawl_date?: string | null
          created_at?: string
          error_message?: string | null
          failed_keywords?: number
          id?: string
          processed_keyword_ids?: string[]
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
          is_ai_briefing: boolean
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
          is_ai_briefing?: boolean
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
          is_ai_briefing?: boolean
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
          program: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          program?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          program?: string | null
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
      postings: {
        Row: {
          blog_id: string | null
          blogger_id: string | null
          created_at: string
          id: string
          posting_url: string
          program: string | null
          published_at: string | null
          target_keywords: string[] | null
          title: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          blog_id?: string | null
          blogger_id?: string | null
          created_at?: string
          id?: string
          posting_url: string
          program?: string | null
          published_at?: string | null
          target_keywords?: string[] | null
          title?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          blog_id?: string | null
          blogger_id?: string | null
          created_at?: string
          id?: string
          posting_url?: string
          program?: string | null
          published_at?: string | null
          target_keywords?: string[] | null
          title?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "postings_blogger_id_fkey"
            columns: ["blogger_id"]
            isOneToOne: false
            referencedRelation: "bloggers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      top_external_bloggers: {
        Row: {
          author_name: string | null
          avg_rank: number
          best_rank: number
          blog_id: string
          computed_at: string
          engines: string[]
          hit_keyword_count: number
          hit_keywords: string[]
          last_seen_at: string
          period_days: number
          platform: string | null
          program: string
          sample_post_url: string | null
          total_appearances: number
        }
        Insert: {
          author_name?: string | null
          avg_rank: number
          best_rank: number
          blog_id: string
          computed_at?: string
          engines?: string[]
          hit_keyword_count?: number
          hit_keywords?: string[]
          last_seen_at: string
          period_days: number
          platform?: string | null
          program?: string
          sample_post_url?: string | null
          total_appearances?: number
        }
        Update: {
          author_name?: string | null
          avg_rank?: number
          best_rank?: number
          blog_id?: string
          computed_at?: string
          engines?: string[]
          hit_keyword_count?: number
          hit_keywords?: string[]
          last_seen_at?: string
          period_days?: number
          platform?: string | null
          program?: string
          sample_post_url?: string | null
          total_appearances?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      detect_blog_platform: { Args: { url: string }; Returns: string }
      extract_blog_id_from_url: { Args: { url: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_editor: { Args: { _uid: string }; Returns: boolean }
      is_master: { Args: { _uid: string }; Returns: boolean }
      refresh_top_external_bloggers: {
        Args: never
        Returns: {
          period_days: number
          rows_inserted: number
        }[]
      }
      schedule_cron_job: {
        Args: {
          auth_token: string
          cron_secret?: string
          function_url: string
          job_name: string
          schedule: string
        }
        Returns: number
      }
      unschedule_cron_job: { Args: { job_name: string }; Returns: boolean }
    }
    Enums: {
      app_role: "master" | "admin" | "viewer"
      blog_grade:
        | "최적화3"
        | "최적화2"
        | "최적화1"
        | "준최적6"
        | "준최적5"
        | "준최적4"
        | "준최적3"
        | "준최적2"
        | "준최적1"
        | "일반"
        | "저품질"
      blogger_status: "협업 요청" | "협업 거절" | "계약됨" | "계약만료"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["master", "admin", "viewer"],
      blog_grade: [
        "최적화3",
        "최적화2",
        "최적화1",
        "준최적6",
        "준최적5",
        "준최적4",
        "준최적3",
        "준최적2",
        "준최적1",
        "일반",
        "저품질",
      ],
      blogger_status: ["협업 요청", "협업 거절", "계약됨", "계약만료"],
    },
  },
} as const
