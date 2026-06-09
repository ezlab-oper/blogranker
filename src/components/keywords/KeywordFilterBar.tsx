import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useKeywordCategories } from '@/hooks/useKeywords';
import { usePrograms } from '@/hooks/usePrograms';

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
  // 카테고리는 DB(keyword_categories), 프로그램은 DB(programs)와 동기화.
  const { data: categories = [] } = useKeywordCategories();
  const { data: programs = [] } = usePrograms();

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  return (
    <div className="rounded-xl border bg-card shadow-card p-4 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* 프로그램 */}
        <div className="space-y-2 flex-1">
          <span className="text-sm font-semibold text-foreground">프로그램</span>
          {programs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              등록된 프로그램이 없습니다. (설정 → 프로그램 관리에서 등록)
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {programs.map(prog => (
                <Label key={prog.id} className="flex items-center gap-1.5 cursor-pointer text-sm font-normal">
                  <Checkbox
                    checked={selectedPrograms.includes(prog.name)}
                    onCheckedChange={() => toggleItem(selectedPrograms, prog.name, onProgramChange)}
                  />
                  {prog.name}
                </Label>
              ))}
            </div>
          )}
        </div>

        {/* 카테고리 (DB 동기화) */}
        <div className="space-y-2 flex-1">
          <span className="text-sm font-semibold text-foreground">카테고리</span>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              등록된 카테고리가 없습니다. (키워드 추가 다이얼로그의 "카테고리 관리"에서 등록)
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {categories.map(cat => (
                <Label key={cat.id} className="flex items-center gap-1.5 cursor-pointer text-sm font-normal">
                  <Checkbox
                    checked={selectedCategories.includes(cat.name)}
                    onCheckedChange={() => toggleItem(selectedCategories, cat.name, onCategoryChange)}
                  />
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={cat.color ? { color: cat.color } : undefined}
                  >
                    {cat.color && (
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    {cat.name}
                  </span>
                </Label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
