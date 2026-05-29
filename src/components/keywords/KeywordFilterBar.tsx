import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useKeywordCategories } from '@/hooks/useKeywords';

const PROGRAMS = ['이지캡쳐', '이지집', '이지메모', '이지파인더', '이지캠', '이지리더'] as const;
export { PROGRAMS };

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
  // 카테고리는 DB(keyword_categories)와 동기화 — '카테고리 관리'에서 추가/삭제 시 자동 반영
  const { data: categories = [] } = useKeywordCategories();

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
