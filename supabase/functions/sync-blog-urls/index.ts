import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parse } from 'https://deno.land/std@0.224.0/csv/parse.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 설정(settings.blogSheet)이 비어 있을 때 사용할 기본 스프레드시트 ID
const DEFAULT_SPREADSHEET_ID = '1zlFFPQVJIbMvZqbFVVTZVx77F16sqrAp8D7PHBim39w';

// 시트명(탭) → 프로그램명 매핑
const SHEET_PROGRAM_MAP: Record<string, string> = {
  '이지캡쳐': '이지캡쳐',
  '이지집': '이지집',
  '이지파인더': '이지파인더',
  '이지메모': '이지메모',
  '이지캠': '이지캠',
  '이지리더': '이지리더',
};

// 열 문자(A, E, AA...) → 0-based 인덱스
function columnToIndex(col: string): number {
  const c = (col || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(c)) return -1;
  let idx = 0;
  for (let i = 0; i < c.length; i++) idx = idx * 26 + (c.charCodeAt(i) - 64);
  return idx - 1;
}

// URL에서 블로그 ID 추출
function extractBlogId(url: string): string | null {
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

// 공개(링크 공유) 구글 시트를 CSV로 읽는다. 서비스 계정/인증 불필요.
// 시트는 "링크가 있는 모든 사용자: 뷰어"로 공유돼 있어야 한다.
async function fetchSheetRowsCsv(spreadsheetId: string, sheetName: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    console.error(`Failed to fetch sheet ${sheetName}: ${res.status}`);
    return [];
  }
  const text = await res.text();
  // 비공개 시트면 구글이 로그인 HTML을 반환 → 감지
  if (text.trimStart().startsWith('<')) {
    console.error(`Sheet "${sheetName}" is not publicly accessible (got HTML, check link sharing)`);
    return [];
  }
  try {
    return parse(text) as string[][];
  } catch (e) {
    console.error(`CSV parse error for ${sheetName}:`, e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 설정(settings.blogSheet)에서 시트 ID/열 구성을 읽는다
    const { data: sheetSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'blogSheet')
      .single();
    const cfg = (sheetSetting?.value as { spreadsheetId?: string; urlColumn?: string; blogIdColumn?: string }) || {};
    const spreadsheetId = (cfg.spreadsheetId || '').trim() || DEFAULT_SPREADSHEET_ID;
    const urlIdx = columnToIndex(cfg.urlColumn || 'E');
    const blogIdIdx = columnToIndex(cfg.blogIdColumn || '');
    if (urlIdx < 0) throw new Error(`잘못된 URL 열 설정: ${cfg.urlColumn}`);

    // 모든 시트에서 URL 수집
    const allUrls: { program: string; blog_url: string; blog_id: string | null }[] = [];
    let sheetsRead = 0;

    for (const [sheetName, program] of Object.entries(SHEET_PROGRAM_MAP)) {
      const rows = await fetchSheetRowsCsv(spreadsheetId, sheetName);
      if (rows.length > 0) sheetsRead++;
      // 헤더 행 제외
      for (const row of rows.slice(1)) {
        const url = (row[urlIdx] || '').trim();
        if (!url.startsWith('http')) continue;
        const sheetBlogId = blogIdIdx >= 0 ? (row[blogIdIdx] || '').trim() : '';
        allUrls.push({
          program,
          blog_url: url,
          blog_id: sheetBlogId || extractBlogId(url),
        });
      }
    }

    if (sheetsRead === 0) {
      throw new Error('읽은 시트가 없습니다. 스프레드시트 ID와 "링크가 있는 모든 사용자: 뷰어" 공유 설정을 확인하세요.');
    }

    // 기존 데이터 삭제 후 새로 삽입
    await supabase.from('blog_urls').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (allUrls.length > 0) {
      for (let i = 0; i < allUrls.length; i += 500) {
        const batch = allUrls.slice(i, i + 500);
        const { error } = await supabase.from('blog_urls').insert(batch);
        if (error) console.error('Insert error:', error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: allUrls.length, sheetsRead }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
