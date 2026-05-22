'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Tag, ChevronRight, Power, PowerOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKeywords } from '@/hooks/useKeywords';
import { cn } from '@/lib/utils';

export function KeywordOverview() {
  const { data: keywords, isLoading } = useKeywords();

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">키워드 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-lg animate-shimmer" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayKeywords = keywords?.slice(0, 8) || [];
  const totalCount = keywords?.length || 0;

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg">키워드 현황</CardTitle>
        <Link href="/keywords">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            전체보기 <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {displayKeywords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>등록된 키워드가 없습니다.</p>
            <Link href="/keywords">
              <Button variant="link" size="sm" className="mt-2">
                키워드 추가하기
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {displayKeywords.map((kw, index) => (
              <motion.div
                key={kw.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  {kw.is_active ? (
                    <Power className="w-4 h-4 text-success" />
                  ) : (
                    <PowerOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={cn('font-medium', !kw.is_active && 'text-muted-foreground')}>
                    {kw.keyword}
                  </span>
                </div>
                {kw.category && (
                  <Badge
                    variant="secondary"
                    style={{ 
                      backgroundColor: `${kw.category.color}20`,
                      color: kw.category.color,
                      borderColor: `${kw.category.color}40`
                    }}
                    className="border"
                  >
                    {kw.category.name}
                  </Badge>
                )}
              </motion.div>
            ))}
            {totalCount > 8 && (
              <p className="text-center text-sm text-muted-foreground pt-2">
                +{totalCount - 8}개 더 보기
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}