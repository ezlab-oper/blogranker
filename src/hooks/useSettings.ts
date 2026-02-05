import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface ScheduleSettings {
  time: string;
  interval: number;
  enabled: boolean;
  cronJobName?: string;
}

export interface NotificationSettings {
  slackWebhook: string;
  onComplete: boolean;
  onError: boolean;
}

export interface ScrapingSettings {
  maxRetries: number;
  userAgentRotation: boolean;
}

export interface AllSettings {
  schedule: ScheduleSettings;
  notifications: NotificationSettings;
  scraping: ScrapingSettings;
}

const defaultSettings: AllSettings = {
  schedule: { time: '09:00', interval: 5, enabled: false, cronJobName: '' },
  notifications: { slackWebhook: '', onComplete: false, onError: true },
  scraping: { maxRetries: 3, userAgentRotation: true },
};

function parseSettingValue<T>(value: Json | null | undefined, defaultValue: T): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultValue;
  }
  return value as unknown as T;
}

// Convert time string (HH:MM) to cron expression for that time in KST
function timeToCronExpression(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  // KST is UTC+9, so we need to subtract 9 hours for UTC
  const utcHours = (hours - 9 + 24) % 24;
  return `${minutes} ${utcHours} * * *`;
}

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<AllSettings> => {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value');

      if (error) {
        console.error('Error fetching settings:', error);
        return defaultSettings;
      }

      const settingsMap: Record<string, Json> = {};
      data?.forEach((row) => {
        settingsMap[row.key] = row.value;
      });

      return {
        schedule: parseSettingValue<ScheduleSettings>(settingsMap.schedule, defaultSettings.schedule),
        notifications: parseSettingValue<NotificationSettings>(settingsMap.notifications, defaultSettings.notifications),
        scraping: parseSettingValue<ScrapingSettings>(settingsMap.scraping, defaultSettings.scraping),
      };
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: AllSettings) => {
      const updates = [
        { key: 'schedule', value: newSettings.schedule as unknown as Json },
        { key: 'notifications', value: newSettings.notifications as unknown as Json },
        { key: 'scraping', value: newSettings.scraping as unknown as Json },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .update({ value: update.value })
          .eq('key', update.key);

        if (error) throw error;
      }

      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  // Removed cron management - schedule settings are now checked directly in the scheduled-crawl edge function

  return {
    settings: settings || defaultSettings,
    isLoading,
    updateSettings: updateSettingsMutation.mutateAsync,
    isUpdating: updateSettingsMutation.isPending,
    timeToCronExpression,
  };
}
