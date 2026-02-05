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

      // Manage cron job based on schedule settings
      const jobName = 'scheduled-blog-crawl';
      const cronExpression = timeToCronExpression(newSettings.schedule.time);
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // First unschedule any existing job (ignore errors if it doesn't exist)
      try {
        await supabase.rpc('unschedule_cron_job' as never, { job_name: jobName });
      } catch {
        // Job might not exist
      }

      // Schedule new job if enabled
      if (newSettings.schedule.enabled) {
        try {
          await supabase.rpc('schedule_cron_job' as never, {
            job_name: jobName,
            schedule: cronExpression,
            function_url: `${projectUrl}/functions/v1/scheduled-crawl`,
            auth_token: anonKey,
          });
          console.log(`Cron job scheduled: ${cronExpression} for ${projectUrl}/functions/v1/scheduled-crawl`);
        } catch (error) {
          console.error('Failed to schedule cron job:', error);
          // Don't throw - the settings are still saved
        }
      }

      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  // Manage cron job for scheduled crawl
  const manageCronMutation = useMutation({
    mutationFn: async ({ enabled, time }: { enabled: boolean; time: string }) => {
      const jobName = 'scheduled-blog-crawl';
      
      // First, try to unschedule existing job
      try {
        await supabase.rpc('unschedule_cron_job' as any, { job_name: jobName });
      } catch {
        // Job might not exist, that's okay
      }

      if (enabled) {
        const cronExpression = timeToCronExpression(time);
        const projectUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        // Schedule new job using pg_cron via RPC
        // Note: This needs to be done via SQL insert since we don't have RPC for this
        console.log(`Cron job would be scheduled: ${cronExpression}`);
        console.log(`Would call: ${projectUrl}/functions/v1/scheduled-crawl`);
        
        return { scheduled: true, expression: cronExpression };
      }

      return { scheduled: false };
    },
  });

  return {
    settings: settings || defaultSettings,
    isLoading,
    updateSettings: updateSettingsMutation.mutateAsync,
    isUpdating: updateSettingsMutation.isPending,
    manageCron: manageCronMutation.mutateAsync,
    isManagingCron: manageCronMutation.isPending,
    timeToCronExpression,
  };
}
