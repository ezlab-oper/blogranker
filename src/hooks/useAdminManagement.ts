import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminUser, AppRole } from '@/types/auth';
import { toast } from 'sonner';

export function useAdminManagement() {
  const queryClient = useQueryClient();

  // Fetch all admins with their roles
  const { data: admins = [], isLoading, error } = useQuery({
    queryKey: ['admins'],
    queryFn: async (): Promise<AdminUser[]> => {
      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Combine data
      return roles.map((role) => {
        const profile = profiles.find((p) => p.user_id === role.user_id);
        return {
          id: role.user_id,
          email: profile?.email || 'Unknown',
          display_name: profile?.display_name || null,
          role: role.role as AppRole,
          created_at: role.created_at,
        };
      });
    },
  });

  // Create new admin
  const createAdmin = useMutation({
    mutationFn: async ({
      email,
      password,
      role,
      displayName,
    }: {
      email: string;
      password: string;
      role: AppRole;
      displayName?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: { email, password, role, displayName },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success('관리자가 생성되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`관리자 생성 실패: ${error.message}`);
    },
  });

  // Update admin (displayName, role, password)
  const updateAdmin = useMutation({
    mutationFn: async ({
      userId,
      displayName,
      role,
      password,
    }: {
      userId: string;
      displayName?: string;
      role?: AppRole;
      password?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('update-admin', {
        body: { userId, displayName, role, password },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success('관리자 정보가 수정되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`관리자 수정 실패: ${error.message}`);
    },
  });

  // Delete admin
  const deleteAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-admin', {
        body: { userId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success('관리자가 삭제되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`관리자 삭제 실패: ${error.message}`);
    },
  });

  return {
    admins,
    isLoading,
    error,
    createAdmin,
    updateAdmin,
    deleteAdmin,
  };
}
