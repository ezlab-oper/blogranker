import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Bell, Shield, Loader2, Trash2, AlertTriangle, Calendar, FileSpreadsheet } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSettings, type AllSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  
  const { settings, isLoading, updateSettings, isUpdating, timeToCronExpression } = useSettings();
  const { toast } = useToast();
  
  const [localSettings, setLocalSettings] = useState<AllSettings>(settings);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  

  // Sync local state with fetched settings
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings(localSettings);
      toast({
        title: '설정 저장 완료',
        description: '설정이 성공적으로 저장되었습니다.',
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: '설정 저장 실패',
        description: '설정을 저장하는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAllResults = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('crawl_results')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast({
        title: '삭제 완료',
        description: '모든 수집 결과가 삭제되었습니다.',
      });
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete results:', error);
      toast({
        title: '삭제 실패',
        description: '수집 결과를 삭제하는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };


  // Calculate cron expression for display
  const cronExpression = timeToCronExpression(localSettings.schedule.time);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-3xl">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold tracking-tight">설정</h1>
          <p className="text-muted-foreground mt-1">
            시스템 설정을 관리하세요
          </p>
        </motion.div>

        {/* Schedule Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  스케줄 설정
                </CardTitle>
                <CardDescription>자동 수집 시간을 설정합니다</CardDescription>
              </div>
              <Badge variant={localSettings.schedule.enabled ? 'default' : 'secondary'}>
                {localSettings.schedule.enabled ? '활성화됨' : '비활성화됨'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cron Expression Display */}
            {localSettings.schedule.enabled && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Cron: <code className="px-1 py-0.5 bg-background rounded text-xs">{cronExpression}</code>
                </span>
                <span className="text-sm text-muted-foreground">
                  (매일 {localSettings.schedule.time} KST 실행)
                </span>
              </div>
            )}
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-time">수집 시간 (KST)</Label>
                <Input 
                  id="schedule-time" 
                  type="time" 
                  value={localSettings.schedule.time}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    schedule: { ...prev.schedule, time: e.target.value }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-interval">요청 간격 (초)</Label>
                <Input 
                  id="request-interval" 
                  type="number" 
                  value={localSettings.schedule.interval}
                  min="1" 
                  max="60"
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    schedule: { ...prev.schedule, interval: parseInt(e.target.value) || 5 }
                  }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">자동 수집 활성화</Label>
                <p className="text-sm text-muted-foreground">매일 지정된 시간에 자동으로 수집합니다</p>
              </div>
              <Switch 
                checked={localSettings.schedule.enabled}
                onCheckedChange={(checked) => setLocalSettings(prev => ({
                  ...prev,
                  schedule: { ...prev.schedule, enabled: checked }
                }))}
                className="data-[state=checked]:bg-success" 
              />
            </div>
            
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              알림 설정
            </CardTitle>
            <CardDescription>수집 완료/실패 시 알림을 받습니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
              <Input 
                id="slack-webhook" 
                type="url" 
                placeholder="https://hooks.slack.com/services/..."
                value={localSettings.notifications.slackWebhook}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, slackWebhook: e.target.value }
                }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">수집 완료 알림</Label>
                <p className="text-sm text-muted-foreground">수집이 완료되면 알림을 보냅니다</p>
              </div>
              <Switch 
                checked={localSettings.notifications.onComplete}
                onCheckedChange={(checked) => setLocalSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, onComplete: checked }
                }))}
                className="data-[state=checked]:bg-success" 
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">실패 알림</Label>
                <p className="text-sm text-muted-foreground">수집 실패 시 알림을 보냅니다</p>
              </div>
              <Switch 
                checked={localSettings.notifications.onError}
                onCheckedChange={(checked) => setLocalSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, onError: checked }
                }))}
                className="data-[state=checked]:bg-success" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Scraping Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              스크래핑 설정
            </CardTitle>
            <CardDescription>봇 탐지 대응 설정을 관리합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max-retries">최대 재시도 횟수</Label>
                <Input 
                  id="max-retries" 
                  type="number" 
                  value={localSettings.scraping.maxRetries}
                  min="1" 
                  max="10"
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    scraping: { ...prev.scraping, maxRetries: parseInt(e.target.value) || 3 }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="naver-pages">네이버 수집 범위</Label>
                <Input id="naver-pages" type="text" defaultValue="블로그 영역 전체" disabled />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">User-Agent 로테이션</Label>
                <p className="text-sm text-muted-foreground">요청마다 다른 User-Agent를 사용합니다</p>
              </div>
              <Switch 
                checked={localSettings.scraping.userAgentRotation}
                onCheckedChange={(checked) => setLocalSettings(prev => ({
                  ...prev,
                  scraping: { ...prev.scraping, userAgentRotation: checked }
                }))}
                className="data-[state=checked]:bg-success" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Google Sheet Integration */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              구글 시트 연동 (협업 블로그 목록)
            </CardTitle>
            <CardDescription>
              협업 포스팅 URL·블로거 ID를 가져올 구글 시트를 설정합니다. 시트는 서비스 계정에 읽기 권한으로 공유되어 있어야 합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sheet-id">스프레드시트 ID</Label>
              <Input
                id="sheet-id"
                type="text"
                placeholder="구글 시트 URL의 /d/ 와 /edit 사이 값"
                value={localSettings.blogSheet.spreadsheetId}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  blogSheet: { ...prev.blogSheet, spreadsheetId: e.target.value.trim() }
                }))}
              />
              <p className="text-xs text-muted-foreground">
                예: https://docs.google.com/spreadsheets/d/<strong>1zlFFPQ...39w</strong>/edit
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sheet-url-col">협업 포스팅 URL 열</Label>
                <Input
                  id="sheet-url-col"
                  type="text"
                  placeholder="E"
                  value={localSettings.blogSheet.urlColumn}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    blogSheet: { ...prev.blogSheet, urlColumn: e.target.value.trim().toUpperCase() }
                  }))}
                />
                <p className="text-xs text-muted-foreground">포스팅 URL이 있는 열 문자 (예: E)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheet-blogid-col">블로그 ID 열 (선택)</Label>
                <Input
                  id="sheet-blogid-col"
                  type="text"
                  placeholder="비우면 URL에서 자동 추출"
                  value={localSettings.blogSheet.blogIdColumn}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    blogSheet: { ...prev.blogSheet, blogIdColumn: e.target.value.trim().toUpperCase() }
                  }))}
                />
                <p className="text-xs text-muted-foreground">블로그 ID가 있는 열 문자. 비우면 URL에서 추출</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="shadow-card border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              위험 구역
            </CardTitle>
            <CardDescription>이 작업은 되돌릴 수 없습니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4 bg-destructive/5">
              <div>
                <Label className="text-base">수집 결과 전체 삭제</Label>
                <p className="text-sm text-muted-foreground">
                  모든 수집 결과 데이터를 삭제합니다. 키워드, 설정 등 다른 데이터는 유지됩니다.
                </p>
              </div>
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    전체 삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-5 h-5" />
                      정말 삭제하시겠습니까?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>
                        이 작업은 <strong>모든 수집 결과 데이터</strong>를 영구적으로 삭제합니다.
                      </p>
                      <p className="text-destructive font-medium">
                        ⚠️ 이 작업은 되돌릴 수 없습니다!
                      </p>
                      <p className="text-sm">
                        키워드, 카테고리, 설정 등 다른 데이터는 삭제되지 않습니다.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllResults}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          삭제 중...
                        </>
                      ) : (
                        '삭제 확인'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            className="gradient-primary text-white"
            onClick={handleSave}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              '설정 저장'
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}