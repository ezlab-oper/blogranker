import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BlogUrl {
  id: string;
  program: string;
  blog_url: string;
  blog_id: string | null;
}

export function useBlogUrls() {
  return useQuery({
    queryKey: ['blog_urls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_urls')
        .select('*')
        .order('program');
      if (error) throw error;
      return data as BlogUrl[];
    },
  });
}

export function useSyncBlogUrls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-blog-urls');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['blog_urls'] });
      toast({
        title: '동기화 완료',
        description: `Google Sheets에서 ${data.count}개의 블로그 URL을 가져왔습니다.`,
      });
    },
    onError: (error) => {
      toast({
        title: '동기화 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Utility: Extract blog ID from a URL (same logic as edge function)
export function extractBlogId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'blog.naver.com' || u.hostname === 'm.blog.naver.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[0] || null;
    }
    if (u.hostname.endsWith('.tistory.com')) {
      return u.hostname.replace('.tistory.com', '');
    }
    if (u.hostname === 'velog.io') {
      const match = u.pathname.match(/^\/@([^/]+)/);
      return match ? match[1] : null;
    }
    return u.hostname;
  } catch {
    return null;
  }
}

// Normalize URL: strip mobile prefix for consistent matching
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Normalize m.blog.naver.com → blog.naver.com
    if (u.hostname === 'm.blog.naver.com') {
      u.hostname = 'blog.naver.com';
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Build lookup sets for fast matching
export function buildBlogUrlMatchers(blogUrls: BlogUrl[]) {
  // URL set for exact match
  const urlSet = new Set(blogUrls.map(b => b.blog_url));
  // Blog ID set for partial match (by program)
  const blogIdsByProgram = new Map<string, Set<string>>();
  const urlsByProgram = new Map<string, Set<string>>();

  for (const b of blogUrls) {
    // URLs by program (store both original and normalized)
    if (!urlsByProgram.has(b.program)) urlsByProgram.set(b.program, new Set());
    urlsByProgram.get(b.program)!.add(b.blog_url);
    urlsByProgram.get(b.program)!.add(normalizeUrl(b.blog_url));

    // Blog IDs by program
    if (b.blog_id) {
      if (!blogIdsByProgram.has(b.program)) blogIdsByProgram.set(b.program, new Set());
      blogIdsByProgram.get(b.program)!.add(b.blog_id);
    }
  }

  return { urlSet, blogIdsByProgram, urlsByProgram };
}

export type MatchType = 'exact_url' | 'same_blog_id' | 'none';

export function getMatchType(
  resultUrl: string,
  resultProgram: string | null,
  matchers: ReturnType<typeof buildBlogUrlMatchers>
): MatchType {
  const { urlsByProgram, blogIdsByProgram } = matchers;

  // Check exact URL match (within the same program), also try normalized URL
  if (resultProgram) {
    const programUrls = urlsByProgram.get(resultProgram);
    if (programUrls?.has(resultUrl) || programUrls?.has(normalizeUrl(resultUrl))) return 'exact_url';
  }

  // Check blog ID match (same blog author, different post)
  const resultBlogId = extractBlogId(resultUrl);
  if (resultBlogId && resultProgram) {
    const programBlogIds = blogIdsByProgram.get(resultProgram);
    if (programBlogIds?.has(resultBlogId)) return 'same_blog_id';
  }

  return 'none';
}
