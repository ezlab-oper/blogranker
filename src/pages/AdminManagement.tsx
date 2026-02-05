import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAdminManagement } from '@/hooks/useAdminManagement';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole, AdminUser, ROLE_PERMISSIONS } from '@/types/auth';
import { UserPlus, Trash2, Edit, Loader2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const roleColors: Record<AppRole, string> = {
  master: 'bg-red-500/10 text-red-600 border-red-500/20',
  admin: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  viewer: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

export default function AdminManagement() {
  const { admins, isLoading, createAdmin, updateAdmin, deleteAdmin } = useAdminManagement();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  
  // Create form state
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createRole, setCreateRole] = useState<AppRole>('admin');

  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('admin');
  const [editPassword, setEditPassword] = useState('');

  const handleCreate = async () => {
    await createAdmin.mutateAsync({ 
      email: createEmail, 
      password: createPassword, 
      role: createRole, 
      displayName: createDisplayName || undefined 
    });
    setIsCreateOpen(false);
    setCreateEmail('');
    setCreatePassword('');
    setCreateDisplayName('');
    setCreateRole('admin');
  };

  const openEditDialog = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEditDisplayName(admin.display_name || '');
    setEditRole(admin.role);
    setEditPassword('');
  };

  const handleUpdate = async () => {
    if (!editingAdmin) return;
    
    await updateAdmin.mutateAsync({
      userId: editingAdmin.id,
      displayName: editDisplayName,
      role: editRole,
      password: editPassword || undefined,
    });
    
    setEditingAdmin(null);
    setEditDisplayName('');
    setEditRole('admin');
    setEditPassword('');
  };

  const handleDelete = async (userId: string) => {
    await deleteAdmin.mutateAsync(userId);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">관리자 관리</h1>
            <p className="text-muted-foreground mt-1">
              시스템 관리자를 추가하고 관리합니다
            </p>
          </div>
          
          {/* Create Dialog */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                관리자 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 관리자 추가</DialogTitle>
                <DialogDescription>
                  새로운 관리자 계정을 생성합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="create-email">이메일 *</Label>
                  <Input
                    id="create-email"
                    type="email"
                    placeholder="admin@example.com"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">비밀번호 *</Label>
                  <Input
                    id="create-password"
                    type="password"
                    placeholder="••••••••"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-name">표시 이름</Label>
                  <Input
                    id="create-name"
                    placeholder="관리자 이름"
                    value={createDisplayName}
                    onChange={(e) => setCreateDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>역할 *</Label>
                  <Select value={createRole} onValueChange={(v) => setCreateRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        {ROLE_PERMISSIONS.admin.label}
                      </SelectItem>
                      <SelectItem value="viewer">
                        {ROLE_PERMISSIONS.viewer.label}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_PERMISSIONS[createRole].description}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  취소
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!createEmail || !createPassword || createAdmin.isPending}
                >
                  {createAdmin.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  생성
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingAdmin} onOpenChange={(open) => !open && setEditingAdmin(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>관리자 수정</DialogTitle>
              <DialogDescription>
                {editingAdmin?.email} 관리자 정보를 수정합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">표시 이름</Label>
                <Input
                  id="edit-name"
                  placeholder="관리자 이름"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>역할</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">
                      {ROLE_PERMISSIONS.master.label}
                    </SelectItem>
                    <SelectItem value="admin">
                      {ROLE_PERMISSIONS.admin.label}
                    </SelectItem>
                    <SelectItem value="viewer">
                      {ROLE_PERMISSIONS.viewer.label}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {ROLE_PERMISSIONS[editRole].description}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">새 비밀번호</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="변경하지 않으려면 비워두세요"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  비밀번호를 변경하지 않으려면 비워두세요.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingAdmin(null)}>
                취소
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateAdmin.isPending}
              >
                {updateAdmin.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Admin List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              관리자 목록
            </CardTitle>
            <CardDescription>
              총 {admins.length}명의 관리자가 등록되어 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                등록된 관리자가 없습니다.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이메일</TableHead>
                    <TableHead>표시 이름</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.email}</TableCell>
                      <TableCell>{admin.display_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleColors[admin.role]}>
                          {ROLE_PERMISSIONS[admin.role].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(admin.created_at), 'yyyy.MM.dd', { locale: ko })}
                      </TableCell>
                      <TableCell className="text-right">
                        {admin.id !== user?.id && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(admin)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>관리자 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    정말 이 관리자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(admin.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    삭제
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
