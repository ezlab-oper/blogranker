import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { icon: LayoutDashboard, label: '대시보드', path: '/' },
  { icon: Tags, label: '키워드 관리', path: '/keywords' },
  { icon: FileText, label: '수집 결과', path: '/results' },
  { icon: TrendingUp, label: '순위 추이', path: '/trends' },
  { icon: Activity, label: '사용량', path: '/usage' },
  { icon: Settings, label: '설정', path: '/settings' },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

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
      <nav className="flex-1 py-4 px-3 space-y-1">
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

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
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