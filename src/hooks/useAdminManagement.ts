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
      // Use edge function to create admin (requires service role)
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

  // Update admin role
  const updateAdminRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success('관리자 역할이 변경되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`역할 변경 실패: ${error.message}`);
    },
  });

  // Delete admin
  const deleteAdmin = useMutation({
    mutationFn: async (userId: string) => {
      // Use edge function to delete admin (requires service role)
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
    updateAdminRole,
    deleteAdmin,
  };
}
