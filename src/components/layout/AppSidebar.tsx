import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Activity,
  Map,
  BarChart3,
  Users,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_PERMISSIONS } from '@/types/auth';

const allNavItems = [
  { icon: LayoutDashboard, label: '대시보드', path: '/', requireFeatures: false, requireSettings: false, requireAdminManagement: false },
  { icon: Tags, label: '키워드 관리', path: '/keywords', requireFeatures: true, requireSettings: false, requireAdminManagement: false },
  { icon: FileText, label: '수집 결과', path: '/results', requireFeatures: true, requireSettings: false, requireAdminManagement: false },
  { icon: TrendingUp, label: '순위 추이', path: '/trends', requireFeatures: false, requireSettings: false, requireAdminManagement: false },
  { icon: BarChart3, label: '수집 통계', path: '/statistics', requireFeatures: false, requireSettings: false, requireAdminManagement: false },
  { icon: Map, label: '스크래핑 로직 맵', path: '/scraping-logic', requireFeatures: false, requireSettings: false, requireAdminManagement: false },
  { icon: Activity, label: '사용량', path: '/usage', requireFeatures: false, requireSettings: false, requireAdminManagement: false },
  { icon: Users, label: '관리자 관리', path: '/admin-management', requireFeatures: false, requireSettings: false, requireAdminManagement: true },
  { icon: Settings, label: '설정', path: '/settings', requireFeatures: false, requireSettings: true, requireAdminManagement: false },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut, canAccessSettings, canManageAdmins, canUseFeatures } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
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
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          const linkContent = (
            <Link
              to={item.path}
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

          if (collapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.path}>{linkContent}</div>;
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
