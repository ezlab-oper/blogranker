import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// 함수 timeout(~400초)을 고려한 청크 크기.
// 키워드 1개 = 네이버+구글 = 2 operations × (firecrawl ~5초 + 딜레이 1~3초) ≈ 16초.
// 15개 × 16초 = 240초 → 함수 timeout 마진 충분.
const CHUNK_SIZE = 15;

interface ScheduleSettings {
  enabled: boolean;
  time: string; // "HH:MM" KST
  interval: number;
}

interface NotificationSettings {
  slackWebhook: string;
  onComplete: boolean;
  onError: boolean;
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function shuffleArray<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// KST 오늘(YYYY-MM-DD) + KST HH:MM 반환
function nowKst() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const iso = kst.toISOString();
  return { date: iso.slice(0, 10), hhmm: iso.slice(11, 16) };
}

async function sendSlack(url: string, message: string, isError = false) {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${isError ? '❌' : '✅'} [블로그 순위 추적기] ${message}`,
      }),
    });
  } catch (e) {
    console.error('Slack 전송 실패:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // ===== 1) X-Cron-Secret 검증 =====
  const expectedSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret') || '';
  if (!expectedSecret) {
    return new Response(JSON.stringify({ success: false, error: 'Server misconfiguration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ success: false, error: 'Forbidden' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { date: today, hhmm: nowHHMM } = nowKst();
    console.log(`scheduled-crawl invoked (KST ${today} ${nowHHMM})`);

    // ===== 2) 설정 조회 =====
    const { data: scheduleRow } = await supabase
      .from('settings').select('value').eq('key', 'schedule').single();
    const sched: ScheduleSettings = scheduleRow?.value || { enabled: false, time: '09:00', interval: 5 };

    if (!sched.enabled) {
      return new Response(JSON.stringify({ success: true, message: '비활성화됨' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== 3) 오늘 작업 조회 =====
    const { data: todayJobs } = await supabase
      .from('crawl_jobs')
      .select('*')
      .eq('crawl_date', today)
      .order('started_at', { ascending: false })
      .limit(1);
    let job = todayJobs?.[0] ?? null;

    // 오늘 작업이 이미 완료
    if (job?.status === 'completed') {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: '오늘 작업 완료됨', job_id: job.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (job?.status === 'failed' || job?.status === 'cancelled') {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: `오늘 작업 ${job.status}`, job_id: job.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== 4) 새 작업이 필요한지 판정 =====
    if (!job) {
      // 아직 설정 시각 전이면 skip
      if (nowHHMM < sched.time) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: `설정 시각(${sched.time}) 전` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // 활성 키워드 수 미리 카운트해서 새 job 생성
      const { count: kwCount } = await supabase
        .from('keywords').select('id', { count: 'exact', head: true }).eq('is_active', true);
      const total = kwCount || 0;
      if (total === 0) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: '활성 키워드 없음' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: newJob, error: insErr } = await supabase
        .from('crawl_jobs')
        .insert({
          status: 'running',
          total_keywords: total,
          started_at: new Date().toISOString(),
          crawl_date: today,
          processed_keyword_ids: [],
        })
        .select().single();
      if (insErr || !newJob) {
        return new Response(JSON.stringify({ success: false, error: '작업 생성 실패' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      job = newJob;
    }

    // ===== 5) 미처리 키워드 선별 후 청크 처리 =====
    const processedIds = new Set<string>((job.processed_keyword_ids as string[]) || []);

    const { data: keywords } = await supabase
      .from('keywords').select('*').eq('is_active', true);
    const { data: engines } = await supabase
      .from('search_engines').select('*').eq('is_active', true);

    if (!keywords || !engines) {
      return new Response(JSON.stringify({ success: false, error: '키워드/엔진 조회 실패' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pending = keywords.filter((k) => !processedIds.has(k.id));
    const chunk = pending.slice(0, CHUNK_SIZE);

    if (chunk.length === 0) {
      // 처리할 게 없으면 완료 처리
      await supabase.from('crawl_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', job.id);
      return new Response(JSON.stringify({ success: true, message: '완료 처리됨', job_id: job.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let chunkSuccess = 0, chunkFail = 0;

    for (const kw of chunk) {
      const shuffled = shuffleArray(engines);
      for (const engine of shuffled) {
        try {
          await randomDelay(3000, 7000);
          const lname = engine.name.toLowerCase();
          const engineType: 'naver' | 'google' | null =
            engine.name === '네이버' || lname.includes('naver') ? 'naver'
            : engine.name === '구글' || lname.includes('google') ? 'google'
            : null;
          if (!engineType) continue;

          const response = await fetch(`${supabaseUrl}/functions/v1/scrape-search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'X-Cron-Secret': expectedSecret,
            },
            body: JSON.stringify({ keyword: kw.keyword, engine: engineType }),
          });
          const data = await response.json();

          if (data.success && data.results) {
            for (const r of data.results) {
              await supabase.from('crawl_results').insert({
                job_id: job.id,
                keyword_id: kw.id,
                search_engine_id: engine.id,
                rank: r.rank,
                blog_title: r.title,
                blog_author: r.author,
                blog_url: r.url,
                snippet: r.snippet,
                published_date: r.published_date,
                blog_platform: r.platform,
                thumbnail_url: r.thumbnail_url,
                is_ai_briefing: false,
              });
            }
            for (const r of (data.ai_briefing ?? [])) {
              await supabase.from('crawl_results').insert({
                job_id: job.id,
                keyword_id: kw.id,
                search_engine_id: engine.id,
                rank: r.rank,
                blog_title: r.title,
                blog_author: r.author,
                blog_url: r.url,
                snippet: r.snippet,
                published_date: r.published_date,
                blog_platform: r.platform,
                thumbnail_url: r.thumbnail_url,
                is_ai_briefing: true,
              });
            }
            chunkSuccess++;
          } else {
            chunkFail++;
            console.error(`스크랩 실패 ${kw.keyword}/${engine.name}:`, data.error);
          }
        } catch (e) {
          chunkFail++;
          console.error(`처리 오류 ${kw.keyword}/${engine.name}:`, e);
        }
        await randomDelay(1000, 3000);
      }
      // 키워드 단위로 즉시 processed_keyword_ids에 추가 (함수 중간 사망 시 손실 최소화)
      processedIds.add(kw.id);
      await supabase.from('crawl_jobs')
        .update({
          processed_keyword_ids: Array.from(processedIds),
          processed_keywords: processedIds.size,
        })
        .eq('id', job.id);
    }

    // ===== 6) 빈 완료 가드: 청크 전부 실패면 즉시 job=failed로 마감 =====
    // (scrape-search 인증 실패·Firecrawl 다운 등으로 65/65 "완료"되지만 0건 insert 사고 방지)
    const totalOps = chunk.length * engines.length;
    const failRate = totalOps > 0 ? chunkFail / totalOps : 0;
    if (chunkSuccess === 0 && chunkFail > 0) {
      await supabase.from('crawl_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: `청크 전부 실패 (${chunkFail}/${totalOps}). scrape-search 또는 의존 서비스 점검 필요.`,
        })
        .eq('id', job.id);

      const { data: notifRow } = await supabase
        .from('settings').select('value').eq('key', 'notifications').single();
      const notif: NotificationSettings = notifRow?.value || { slackWebhook: '', onComplete: false, onError: false };
      if (notif.onError && notif.slackWebhook) {
        await sendSlack(notif.slackWebhook, `자동 수집 실패 — 청크 ${chunkFail}/${totalOps} 전부 실패. job_id=${job.id}`, true);
      }

      return new Response(JSON.stringify({
        success: false,
        job_id: job.id,
        error: 'chunk all failed',
        chunk_size: chunk.length,
        chunk_success: chunkSuccess,
        chunk_fail: chunkFail,
        fail_rate: failRate,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== 7) 모두 처리됐는지 확인 =====
    const finishedNow = pending.length - chunk.length === 0;
    if (finishedNow) {
      await supabase.from('crawl_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', job.id);

      // Slack 알림 (설정 시)
      const { data: notifRow } = await supabase
        .from('settings').select('value').eq('key', 'notifications').single();
      const notif: NotificationSettings = notifRow?.value || { slackWebhook: '', onComplete: false, onError: false };
      if (notif.onComplete && notif.slackWebhook) {
        await sendSlack(notif.slackWebhook, `오늘(${today}) 키워드 ${processedIds.size}개 수집 완료`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      chunk_size: chunk.length,
      chunk_success: chunkSuccess,
      chunk_fail: chunkFail,
      processed_total: processedIds.size,
      total_keywords: job.total_keywords,
      finished: finishedNow,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    console.error('scheduled-crawl 오류:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
