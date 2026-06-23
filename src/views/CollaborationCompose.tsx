'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Copy, Send, X, ExternalLink, Eye, Code } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { extractBlogId } from '@/hooks/useBlogUrls';
import {
  COMPOSE_SELECTION_KEY,
  type ComposeSelectionItem,
} from '@/views/TopBloggers';

const DEFAULT_SUBJECT = '[이지랩] 협업 제안 드립니다';

const DEFAULT_HTML = `<p>안녕하세요, {{블로거명}} 블로거님.</p>
<p>{{블로거명}}님의 블로그를 평소 즐겨 보고 있는 이지랩 마케팅팀 {{관리자이름}}입니다.</p>
<p>{{블로거명}}님의 블로그가 저희 서비스의 주요 타겟인 (예: IT에 관심 있는 20~40대)와 잘 맞다고 생각했습니다.</p>
<p>그래서 이번에 협업 제안을 드리고 싶어 연락드리게 되었습니다.</p>

<p><strong>[협업 제안 내용]</strong></p>
<p>저희 이지랩은 [서비스 한 줄 소개] 입니다.</p>
<p>이번에 (신규 출시 / 업데이트 / 캠페인)을 맞아, {{블로거명}}님께 아래와 같은 협업을 제안드립니다.</p>

<ul>
  <li><strong>협업 형태</strong>: (제품 리뷰 포스팅 / 사용기 작성 등)</li>
  <li><strong>협업 기간</strong>: (예: 2026년 7월 중)</li>
  <li><strong>제공 사항</strong>: (소정의 원고료 등)</li>
  <li><strong>요청 사항</strong>: (블로그 포스팅 n회 또는 조건)</li>
</ul>

<p>콘텐츠 방향이나 내용은 {{블로거명}}님의 스타일을 최대한 존중하며 진행하고 싶습니다.</p>
<p>관심이 있으시다면 아래 연락처로 편하게 회신해 주세요.</p>
<p>추가적으로 궁금한 사항이 있으시면 말씀해 주시면 자세히 안내드리겠습니다.</p>
<p>감사합니다.</p>

<p style="margin-top:24px;">{{관리자이름}} 드림</p>`;

export default function CollaborationCompose() {
  const { canPerformActions, user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [items, setItems] = useState<ComposeSelectionItem[]>([]);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [registering, setRegistering] = useState(false);

  // 관리자 표시 이름 — profiles.display_name 우선, 없으면 email 앞부분
  const { data: adminName = '담당자' } = useQuery({
    queryKey: ['my-profile-display-name', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data?.display_name?.trim() || user?.email?.split('@')[0] || '담당자';
    },
    staleTime: 1000 * 60 * 10,
  });

  // sessionStorage에서 선택 블로거 read
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(COMPOSE_SELECTION_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      setItems([]);
    }
  }, []);

  const removeItem = (blog_id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.blog_id !== blog_id);
      try { sessionStorage.setItem(COMPOSE_SELECTION_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // 미리보기 — {{블로거명}}, {{대표키워드}}는 첫 번째 블로거 기준. {{관리자이름}}은 현재 로그인 사용자.
  const previewHtml = useMemo(() => {
    const sample = items[0];
    const main = sample?.hit_keywords?.[0] || '';
    return html
      .replace(/\{\{블로거명\}\}/g, sample?.name || '(블로거명)')
      .replace(/\{\{대표키워드\}\}/g, main || '(대표키워드)')
      .replace(/\{\{관리자이름\}\}/g, adminName);
  }, [html, items, adminName]);

  const handleCopySubject = async () => {
    await navigator.clipboard.writeText(subject);
    toast({ title: '제목 복사됨' });
  };
  const handleCopyHtml = async () => {
    await navigator.clipboard.writeText(html);
    toast({ title: 'HTML 본문 복사됨' });
  };
  const handleCopyRendered = async () => {
    // 렌더된 본문(서식 유지). Clipboard API에 text/html과 text/plain 모두 등록.
    if (typeof ClipboardItem === 'undefined') {
      await navigator.clipboard.writeText(previewHtml);
      toast({ title: '본문 복사됨 (HTML 텍스트)' });
      return;
    }
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const plain = new Blob([previewHtml.replace(/<[^>]+>/g, '')], { type: 'text/plain' });
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': blob, 'text/plain': plain }),
    ]);
    toast({ title: '서식 포함 본문 복사됨' });
  };

  // "선택 블로거 등록" — 선택된 블로거를 bloggers에 status='협업 요청'으로 INSERT/갱신.
  // 중복 (같은 blog_url)은 status만 갱신하고, memo에는 발송 이력 한 줄을 prepend.
  const handleRegister = async () => {
    if (items.length === 0) {
      toast({ title: '등록할 블로거가 없습니다.', variant: 'destructive' });
      return;
    }
    setRegistering(true);
    try {
      // KST 발송 시각 — "2026-06-12 14:30"
      const now = new Date();
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
        .toISOString().slice(0, 16).replace('T', ' ');
      const memoLine = `[${kstNow}] '${adminName}'님이 협업 요청 발송`;

      // 기존 블로거의 memo·email을 받아 prepend / 빈 값일 때만 자동 보강.
      const blogUrls = items.map((i) => i.blog_url);
      const { data: existing } = await supabase
        .from('bloggers')
        .select('blog_url, memo, email')
        .in('blog_url', blogUrls);
      const memoMap = new Map<string, string>();
      const emailMap = new Map<string, string>();
      (existing ?? []).forEach((r) => {
        memoMap.set(r.blog_url, r.memo ?? '');
        emailMap.set(r.blog_url, r.email ?? '');
      });

      const nowIso = new Date().toISOString();

      const rows = items.map((i) => {
        const prev = memoMap.get(i.blog_url) ?? '';
        const memo = prev ? `${memoLine}\n${prev}` : memoLine;

        // 네이버 블로거면 {{blog_id}}@naver.com을 기본 이메일로 채움.
        // 단, 기존 등록 블로거에 이미 email이 있으면 덮어쓰지 않음.
        const blogId = i.blog_id || extractBlogId(i.blog_url) || '';
        const isNaver = (i.platform === '네이버블로그') || i.blog_url.includes('blog.naver.com');
        const existingEmail = emailMap.get(i.blog_url) || '';
        const email = existingEmail || (isNaver && blogId ? `${blogId}@naver.com` : null);

        return {
          name: i.name,
          blog_url: i.blog_url,
          blog_id: blogId || null,
          email,
          status: '협업 요청' as const,
          blog_grade: '일반' as const,
          is_influencer: false,
          contract_end_date: '2999-12-31',
          memo,
          requested_at: nowIso,
        };
      });

      const { data, error } = await supabase
        .from('bloggers')
        .upsert(rows, { onConflict: 'blog_url', ignoreDuplicates: false })
        .select();
      if (error) throw error;

      toast({
        title: `${data?.length ?? items.length}명을 '협업 요청'으로 등록`,
        description: `메모에 발송 이력 추가됨 (${adminName})`,
      });
      try { sessionStorage.removeItem(COMPOSE_SELECTION_KEY); } catch { /* ignore */ }
      router.push('/blog-posting/collab-requests');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류';
      toast({ title: '등록 실패', description: msg, variant: 'destructive' });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 mb-2 -ml-2">
            <ArrowLeft className="w-4 h-4" /> 상위노출 블로거로 돌아가기
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" />
            협업 요청 메일 작성
          </h1>
          <p className="text-muted-foreground mt-1">
            선택된 외부 블로거에게 발송할 협업 제안 메일을 작성하고, 블로거 목록에 <strong>협업 요청</strong> 상태로 등록합니다.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Subject + Editor */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">메일 본문</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="subject">제목</Label>
                    <Button variant="ghost" size="sm" onClick={handleCopySubject} className="h-7 gap-1 text-xs">
                      <Copy className="w-3 h-3" /> 복사
                    </Button>
                  </div>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>본문</Label>
                    <p className="text-xs text-muted-foreground">
                      {'{'}{'{'}블로거명{'}'}{'}'}, {'{'}{'{'}대표키워드{'}'}{'}'}는 첫 번째 블로거 기준, {'{'}{'{'}관리자이름{'}'}{'}'}는 로그인 계정의 표시 이름으로 치환됩니다.
                    </p>
                  </div>
                  <Tabs defaultValue="html" className="w-full">
                    <TabsList>
                      <TabsTrigger value="html" className="gap-1"><Code className="w-3.5 h-3.5" /> HTML</TabsTrigger>
                      <TabsTrigger value="preview" className="gap-1"><Eye className="w-3.5 h-3.5" /> 미리보기</TabsTrigger>
                    </TabsList>
                    <TabsContent value="html" className="mt-2">
                      <Textarea
                        value={html}
                        onChange={(e) => setHtml(e.target.value)}
                        className="font-mono text-xs min-h-[360px]"
                        spellCheck={false}
                      />
                    </TabsContent>
                    <TabsContent value="preview" className="mt-2">
                      <div className="rounded-md border p-4 min-h-[360px] bg-white text-black overflow-auto"
                        dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleCopyHtml} className="gap-2">
                    <Copy className="w-4 h-4" />
                    HTML 소스 복사
                  </Button>
                  <Button variant="outline" onClick={handleCopyRendered} className="gap-2">
                    <Copy className="w-4 h-4" />
                    서식 포함 본문 복사
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: 선택된 블로거 목록 */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  받는 사람
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    선택된 블로거가 없습니다.
                    <Button variant="link" size="sm" onClick={() => router.push('/results/top-bloggers')} className="block mx-auto">
                      ← 상위노출 블로거로 돌아가기
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {items.map((i) => (
                      <div key={i.blog_id} className="flex items-start gap-2 p-2 rounded-lg border bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{i.name}</div>
                          <a href={i.blog_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-0.5">
                            {i.blog_id} <ExternalLink className="w-3 h-3" />
                          </a>
                          {i.hit_keywords?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {i.hit_keywords.slice(0, 3).map((k) => (
                                <Badge key={k} variant="outline" className="text-[10px] font-normal">{k}</Badge>
                              ))}
                              {i.hit_keywords.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{i.hit_keywords.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                          onClick={() => removeItem(i.blog_id)} title="제외">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  발송 버튼은 <strong>블로거 목록에 '협업 요청' 상태로 등록</strong>합니다.
                </p>
                <Button
                  className="w-full gap-2 gradient-primary text-white"
                  onClick={handleRegister}
                  disabled={!canPerformActions || items.length === 0 || registering}
                >
                  <Send className="w-4 h-4" />
                  {registering ? '등록 중...' : `${items.length}명을 '협업 요청'으로 등록`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
