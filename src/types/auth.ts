// Auth types for the admin system

export type AppRole = 'master' | 'admin' | 'viewer';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
}

// Role permissions
export const ROLE_PERMISSIONS = {
  master: {
    canAccessSettings: true,
    canManageAdmins: true,
    canUseFeatures: true,
    label: '최고 관리자',
    description: '모든 기능 사용 가능, 설정 수정, 관리자 관리',
  },
  admin: {
    canAccessSettings: false,
    canManageAdmins: false,
    canUseFeatures: true,
    label: '일반 관리자',
    description: '일반 기능 사용 가능, 설정 수정 불가',
  },
  viewer: {
    canAccessSettings: false,
    canManageAdmins: false,
    canUseFeatures: false,
    label: '뷰어 관리자',
    description: '조회만 가능',
  },
} as const;
