import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface TrendStatsCardProps {
  keywordId: string;
  keywordName: string;
  stats: {
    first: number;
    last: number;
    change: number;
  };
  color: string;
  index: number;
}

export function TrendStatsCard({
  keywordName,
  stats,
  color,
  index,
}: TrendStatsCardProps) {
  const isImproved = stats.change > 0;
  const isUnchanged = stats.change === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="shadow-card hover:shadow-lg transition-shadow">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-medium truncate flex-1 ml-2">
              {keywordName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">{stats.last}위</div>
            <div
              className={`flex items-center gap-1 text-sm ${
                isImproved
                  ? 'text-success'
                  : isUnchanged
                  ? 'text-muted-foreground'
                  : 'text-destructive'
              }`}
            >
              {isImproved ? (
                <TrendingUp className="w-4 h-4" />
              ) : isUnchanged ? (
                <Minus className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>
                {isUnchanged
                  ? '변동 없음'
                  : `${Math.abs(stats.change)}${isImproved ? '↑' : '↓'}`}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.first}위 → {stats.last}위
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
