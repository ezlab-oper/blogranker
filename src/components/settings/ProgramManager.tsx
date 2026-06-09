'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePrograms, useAddProgram, useUpdateProgram, useDeleteProgram } from '@/hooks/usePrograms';

export function ProgramManager() {
  const { data: programs = [], isLoading } = usePrograms();
  const addProgram = useAddProgram();
  const updateProgram = useUpdateProgram();
  const deleteProgram = useDeleteProgram();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const maxOrder = programs.reduce((m, p) => Math.max(m, p.sort_order), 0);
    await addProgram.mutateAsync({ name, sort_order: maxOrder + 10 });
    setNewName('');
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    await updateProgram.mutateAsync({ id: editingId, name });
    setEditingId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="새 프로그램 이름 (예: 이지캡쳐)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          className="flex-1"
        />
        <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || addProgram.isPending} className="gap-1">
          <Plus className="w-4 h-4" /> 추가
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-lg animate-shimmer" />)}
        </div>
      ) : programs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">등록된 프로그램이 없습니다.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {programs.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
              {editingId === p.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 h-8"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit} disabled={updateProgram.isPending}>
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{p.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p.id, p.name)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>프로그램 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                          <strong>{p.name}</strong> 을(를) 삭제합니다. 이 프로그램을 참조하는 키워드·포스팅의 program 값은 NULL이 되지 않으니, 필요 시 먼저 다른 프로그램으로 옮기세요.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteProgram.mutate(p.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        프로그램을 추가·수정·삭제하면 키워드 관리·포스팅 추가 모달의 프로그램 목록에 즉시 반영됩니다.
      </p>
    </div>
  );
}
