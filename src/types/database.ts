// Database types for the blog rank tracker

export interface KeywordCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: string;
  keyword: string;
  program: string | null;
  category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: KeywordCategory;
}

export interface SearchEngine {
  id: string;
  name: string;
  base_url: string;
  is_active: boolean;
  created_at: string;
}

export interface CrawlJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_keywords: number;
  processed_keywords: number;
  successful_keywords: number;
  failed_keywords: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface CrawlResult {
  id: string;
  job_id: string | null;
  keyword_id: string;
  search_engine_id: string;
  rank: number;
  blog_title: string;
  blog_author: string | null;
  blog_url: string;
  snippet: string | null;
  published_date: string | null;
  blog_platform: string | null;
  thumbnail_url: string | null;
  is_ai_briefing: boolean;
  crawled_at: string;
  created_at: string;
  keyword?: Keyword;
  search_engine?: SearchEngine;
}

export interface DashboardStats {
  totalKeywords: number;
  activeKeywords: number;
  totalResults: number;
  lastCrawlDate: string | null;
  todayResults: number;
}