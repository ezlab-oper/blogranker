import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const PROGRAMS = ['이지캡쳐', '이지집', '이지메모', '이지파인더', '이지캠', '이지리더'] as const;
export { PROGRAMS };
const CATEGORIES = ['브랜드', '기능', '경쟁사'] as const;

interface KeywordFilterBarProps {
  selectedPrograms: string[];
  selectedCategories: string[];
  onProgramChange: (programs: string[]) => void;
  onCategoryChange: (categories: string[]) => void;
}

export function KeywordFilterBar({
  selectedPrograms,
  selectedCategories,
  onProgramChange,
  onCategoryChange,
}: KeywordFilterBarProps) {
  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  return (
    <div className="rounded-xl border bg-card shadow-card p-4 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* 프로그램 */}
        <div className="space-y-2 flex-1">
          <span className="text-sm font-semibold text-foreground">프로그램</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {PROGRAMS.map(prog => (
              <Label key={prog} className="flex items-center gap-1.5 cursor-pointer text-sm font-normal">
                <Checkbox
                  checked={selectedPrograms.includes(prog)}
                  onCheckedChange={() => toggleItem(selectedPrograms, prog, onProgramChange)}
                />
                {prog}
              </Label>
            ))}
          </div>
        </div>

        {/* 카테고리 */}
        <div className="space-y-2 flex-1">
          <span className="text-sm font-semibold text-foreground">카테고리</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CATEGORIES.map(cat => (
              <Label key={cat} className="flex items-center gap-1.5 cursor-pointer text-sm font-normal">
                <Checkbox
                  checked={selectedCategories.includes(cat)}
                  onCheckedChange={() => toggleItem(selectedCategories, cat, onCategoryChange)}
                />
                {cat}
              </Label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
