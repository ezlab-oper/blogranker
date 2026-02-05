import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Clock, Bell, Shield } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

export default function Settings() {
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
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              스케줄 설정
            </CardTitle>
            <CardDescription>자동 수집 시간을 설정합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-time">수집 시간 (KST)</Label>
                <Input id="schedule-time" type="time" defaultValue="09:00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-interval">요청 간격 (초)</Label>
                <Input id="request-interval" type="number" defaultValue="5" min="1" max="60" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">자동 수집 활성화</Label>
                <p className="text-sm text-muted-foreground">매일 지정된 시간에 자동으로 수집합니다</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-success" />
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
              <Input id="slack-webhook" type="url" placeholder="https://hooks.slack.com/services/..." />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">수집 완료 알림</Label>
                <p className="text-sm text-muted-foreground">수집이 완료되면 알림을 보냅니다</p>
              </div>
              <Switch className="data-[state=checked]:bg-success" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">실패 알림</Label>
                <p className="text-sm text-muted-foreground">수집 실패 시 알림을 보냅니다</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-success" />
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
                <Input id="max-retries" type="number" defaultValue="3" min="1" max="10" />
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
              <Switch defaultChecked className="data-[state=checked]:bg-success" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="gradient-primary text-white">설정 저장</Button>
        </div>
      </div>
    </AppLayout>
  );
}