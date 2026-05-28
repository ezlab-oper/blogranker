'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Search,
  Tags,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Map,
  BarChart3,
  Users,
  BookOpen,
  PenSquare,
  UsersRound,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_PERMISSIONS } from '@/types/auth';

type NavItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  requireFeatures: boolean;
  requireSettings: boolean;
  requireAdminManagement: boolean;
  children?: { icon: typeof LayoutDashboard; label: string; path: string }[];
};

const allNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: '대시보드', path: '/', requireFeatures: false, requireSettings: false, requireAdminManagement: false },
  { icon: Tags, label: '키워드 관리', path: '/keywords', requireFeatures: true, requireSettings: false, requireAdminManagement: false },
  { icon: FileText, label: '키워드 수집', path: '/results', requireFeatures: true, requireSettings: false, requireAdminManagement: false },
  { icon: TrendingUp, label: '순위 추이', path: '/trends', requireFeatures: false, requireSettings: false, requireAdminManagement: false },
  { icon: BarChart3, label: '수집 통계', path: '/statistics', requireFeatures: false, requireSettings: false, requireAdminManagement: false },
  {
    icon: BookOpen,
    label: '블로그 포스팅',
    path: '/blog-posting',
    requireFeatures: false,
    requireSettings: false,
    requireAdminManagement: false,
    children: [
      { icon: PenSquare, label: '포스팅 목록', path: '/blog-posting/postings' },
      { icon: UsersRound, label: '블로거 목록', path: '/blog-posting/bloggers' },
    ],
  },
  {
    icon: Settings,
    label: '설정',
    path: '/settings',
    requireFeatures: false,
    requireSettings: true,
    requireAdminManagement: false,
    children: [
      { icon: Users, label: '관리자', path: '/settings/admin-management' },
      { icon: Map, label: '스크래핑 로직 맵', path: '/settings/scraping-logic' },
    ],
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, signOut, canAccessSettings, canManageAdmins, canUseFeatures } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // Filter nav items based on permissions
  const navItems = allNavItems.filter((item) => {
    if (item.requireSettings && !canAccessSettings) return false;
    if (item.requireAdminManagement && !canManageAdmins) return false;
    if (item.requireFeatures && !canUseFeatures) return false;
    return true;
  });

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-screen bg-sidebar border-r border-sidebar-border flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <motion.div
          initial={false}
          animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
          className="flex items-center gap-2 overflow-hidden"
        >
          <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center flex-shrink-0">
            <Search className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-foreground whitespace-nowrap">
            블로그 랭크 트래커
          </span>
        </motion.div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent flex-shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          // 부모는 정확 일치 OR 자식 경로의 prefix일 때 활성
          const isActive =
            pathname === item.path ||
            (!!item.children && pathname.startsWith(item.path + '/'));
          const Icon = item.icon;

          const linkContent = (
            <Link
              href={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <motion.span
                initial={false}
                animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
                className="font-medium whitespace-nowrap overflow-hidden"
              >
                {item.label}
              </motion.span>
            </Link>
          );

          const parentRow = collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ) : (
            linkContent
          );

          // 자식 메뉴 렌더 (펼쳐진 사이드바에서만 노출, 들여쓰기)
          const childRows =
            item.children && !collapsed
              ? item.children.map((child) => {
                  const ChildIcon = child.icon;
                  const childActive = pathname === child.path;
                  return (
                    <Link
                      key={child.path}
                      href={child.path}
                      className={cn(
                        'flex items-center gap-3 pl-10 pr-3 py-2 rounded-lg transition-all duration-200 text-sm',
                        childActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent'
                      )}
                    >
                      <ChildIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium whitespace-nowrap">{child.label}</span>
                    </Link>
                  );
                })
              : null;

          // 접힌 상태에서도 자식이 직접 활성이면 아이콘 단독으로 접근 가능하게 노출
          const collapsedChildIcons =
            item.children && collapsed
              ? item.children.map((child) => {
                  const ChildIcon = child.icon;
                  const childActive = pathname === child.path;
                  return (
                    <Tooltip key={child.path} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          href={child.path}
                          className={cn(
                            'flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all duration-200',
                            childActive
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent'
                          )}
                        >
                          <ChildIcon className="w-4 h-4" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {child.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })
              : null;

          return (
            <div key={item.path} className={item.children && !collapsed ? 'space-y-1' : undefined}>
              {parentRow}
              {childRows}
              {collapsedChildIcons}
            </div>
          );
        })}
      </nav>

      {/* User info & Logout */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        <motion.div
          initial={false}
          animate={{ opacity: collapsed ? 0 : 1, height: collapsed ? 0 : 'auto' }}
          className="overflow-hidden"
        >
          {user && role && (
            <div className="mb-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.email}
              </p>
              <p className="text-xs text-sidebar-foreground/60">
                {ROLE_PERMISSIONS[role].label}
              </p>
            </div>
          )}
        </motion.div>
        
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="w-full text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              로그아웃
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-5 h-5 mr-2" />
            로그아웃
          </Button>
        )}
        
        <motion.div
          initial={false}
          animate={{ opacity: collapsed ? 0 : 1, height: collapsed ? 0 : 'auto' }}
          className="overflow-hidden"
        >
          <p className="text-xs text-sidebar-foreground/60">
            Blog Rank Tracker v1.0
          </p>
        </motion.div>
      </div>
    </motion.aside>
  );
}
