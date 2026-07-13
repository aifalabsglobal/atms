'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, Pencil, Upload, UserX, KeyRound } from 'lucide-react';
import type { UserItem } from '@/lib/types';
import type { Role } from '@/lib/store';
import {
  defaultRoleForScope,
  rolesForActor,
  canDeactivateUser,
  canResetUserPassword,
  type RoleScope,
} from '@/lib/user-management';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
] as const;

type DepartmentOption = { id: string; name: string; code: string };

function useDepartments(enabled: boolean) {
  return useQuery({
    queryKey: ['departments-picker'],
    queryFn: () =>
      fetch('/api/masters/departments?limit=100&isActive=true').then((r) => {
        if (!r.ok) throw new Error('Failed to load departments');
        return r.json() as Promise<{ departments: DepartmentOption[] }>;
      }),
    enabled,
    staleTime: 60_000,
  });
}

type StudentOption = { id: string; name: string; email: string };

function useStudents(enabled: boolean) {
  return useQuery({
    queryKey: ['students-picker'],
    queryFn: () =>
      fetch('/api/users?role=student&status=active&limit=200').then((r) => {
        if (!r.ok) throw new Error('Failed to load students');
        return r.json() as Promise<{ users: StudentOption[] }>;
      }),
    enabled,
    staleTime: 60_000,
  });
}

function StudentPicker({
  value,
  onChange,
  disabled,
  placeholder = 'Select student',
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { data, isLoading } = useStudents(true);
  const students = data?.users ?? [];

  return (
    <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)} disabled={disabled || isLoading}>
      <SelectTrigger><SelectValue placeholder={isLoading ? 'Loading…' : placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{placeholder}</SelectItem>
        {students.map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.name} — {s.email}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function resolveDepartmentId(user: UserItem, departments: DepartmentOption[]): string {
  if (user.departmentId) return user.departmentId;
  if (user.department) {
    const match = departments.find((d) => d.name === user.department);
    if (match) return match.id;
  }
  return '';
}

export async function uploadProfileImage(userId: string, imageBase64: string): Promise<string> {
  const res = await fetch('/api/users/profile-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, imageBase64 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to upload image');
  return data.profileImageUrl as string;
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  actorRole,
}: {
  user: UserItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorRole: Role;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { updateUser, deactivateUser } = useUserMutations();
  const { data: deptData } = useDepartments(open);
  const departments = deptData?.departments ?? [];
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    employeeId: '',
    role: 'student' as Role,
    status: 'active',
    departmentId: '',
    phone: '',
    linkedStudentId: '',
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      email: user.email,
      employeeId: user.employeeId || '',
      role: user.role as Role,
      status: user.status,
      departmentId: resolveDepartmentId(user, departments),
      phone: user.phone || '',
      linkedStudentId: user.linkedStudentId || '',
    });
    setAvatarUrl(user.avatarUrl);
  }, [user, departments]);

  const assignableRoles = rolesForActor(actorRole);
  const canEditDept = actorRole !== 'hod';
  const canEditIdentity = actorRole === 'super_admin' || actorRole === 'admin';
  const showResetPassword = user ? canResetUserPassword(actorRole, user.role as Role) : false;
  const showDeactivate = user
    ? canDeactivateUser(actorRole, user.role as Role) && user.status !== 'inactive'
    : false;

  const handleSave = () => {
    if (!user) return;
    if (form.role === 'parent' && !form.linkedStudentId) {
      toast({ title: 'Student required', description: 'Select a linked student for parent accounts.', variant: 'destructive' });
      return;
    }
    const selectedDept = departments.find((d) => d.id === form.departmentId);
    updateUser.mutate(
      {
        id: user.id,
        name: form.name,
        email: canEditIdentity ? form.email : undefined,
        employeeId: canEditIdentity ? form.employeeId : undefined,
        role: form.role,
        status: form.status,
        department: selectedDept?.name ?? (form.departmentId ? undefined : user.department ?? undefined),
        departmentId: form.departmentId || null,
        phone: form.phone,
        linkedStudentId: form.role === 'parent' ? form.linkedStudentId : null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const handleResetPassword = () => {
    if (!user) return;
    if (!window.confirm(`Reset password for ${user.email}? A new temporary password will be generated.`)) return;
    updateUser.mutate({ id: user.id, resetPassword: true });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setUploading(true);
      try {
        const url = await uploadProfileImage(user.id, base64);
        setAvatarUrl(url);
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['settings-user-accounts'] });
        toast({ title: 'Profile photo updated' });
      } catch (err) {
        toast({ title: 'Upload failed', description: (err as Error).message, variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeactivate = () => {
    if (!user) return;
    deactivateUser.mutate(user.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit User
          </DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 border-2">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={form.name} />}
              <AvatarFallback className="text-sm font-bold">{getInitials(form.name || user.name)}</AvatarFallback>
            </Avatar>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={uploading} />
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild disabled={uploading}>
                <span>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? 'Uploading…' : 'Change Photo'}
                </span>
              </Button>
            </label>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eu-name">Full name</Label>
            <Input id="eu-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eu-email">Email</Label>
            <Input
              id="eu-email"
              type="email"
              value={form.email}
              disabled={!canEditIdentity}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eu-emp">Employee ID</Label>
            <Input
              id="eu-emp"
              value={form.employeeId}
              disabled={!canEditIdentity}
              onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({
                ...f,
                role: v as Role,
                linkedStudentId: v === 'parent' ? f.linkedStudentId : '',
              }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Department</Label>
            {departments.length > 0 ? (
              <Select
                value={form.departmentId || 'none'}
                onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v === 'none' ? '' : v }))}
                disabled={!canEditDept}
              >
                <SelectTrigger><SelectValue placeholder={user.department || 'Select department'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={user.department || ''} disabled />
            )}
          </div>
          {form.role === 'parent' && (
            <div className="grid gap-1.5">
              <Label>Linked student</Label>
              <StudentPicker
                value={form.linkedStudentId}
                onChange={(id) => setForm((f) => ({ ...f, linkedStudentId: id }))}
                placeholder={user.linkedStudent ? `${user.linkedStudent.name} — ${user.linkedStudent.email}` : 'Select student'}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="eu-phone">Phone</Label>
            <Input id="eu-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {showResetPassword && (
            <Button
              variant="outline"
              size="sm"
              className="mr-auto gap-1.5"
              disabled={updateUser.isPending}
              onClick={handleResetPassword}
            >
              {updateUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Reset password
            </Button>
          )}
          {showDeactivate && (
            <Button
              variant="destructive"
              size="sm"
              className="mr-auto"
              disabled={deactivateUser.isPending}
              onClick={handleDeactivate}
            >
              {deactivateUser.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
              Deactivate
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateUser.isPending || !form.name}>
            {updateUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateUserDialog({
  open,
  onOpenChange,
  actorRole,
  roleScope = 'all',
  initialRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorRole: Role;
  roleScope?: RoleScope;
  initialRole?: Role;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: deptData } = useDepartments(open);
  const departments = deptData?.departments ?? [];
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: defaultRoleForScope(actorRole, roleScope),
    departmentId: '',
    phone: '',
    employeeId: '',
    linkedStudentId: '',
  });

  useEffect(() => {
    if (!open) return;
    const role = initialRole ?? defaultRoleForScope(actorRole, roleScope);
    setForm((prev) => ({
      ...prev,
      role: rolesForActor(actorRole, roleScope).some((r) => r.value === role)
        ? role
        : defaultRoleForScope(actorRole, roleScope),
      linkedStudentId: role === 'parent' ? prev.linkedStudentId : '',
    }));
  }, [open, actorRole, roleScope, initialRole]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (form.role === 'parent' && !form.linkedStudentId) {
        throw new Error('Select a linked student for parent accounts');
      }
      const selectedDept = departments.find((d) => d.id === form.departmentId);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          department: selectedDept?.name,
          linkedStudentId: form.role === 'parent' ? form.linkedStudentId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      return data as { user: UserItem; tempPassword?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['settings-user-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-user-picker'] });
      toast({
        title: 'User created',
        description: data.tempPassword ? `Temporary password: ${data.tempPassword}` : undefined,
      });
      onOpenChange(false);
      setForm({
        name: '',
        email: '',
        role: defaultRoleForScope(actorRole, roleScope),
        departmentId: '',
        phone: '',
        employeeId: '',
        linkedStudentId: '',
      });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const assignableRoles = rolesForActor(actorRole, roleScope);
  const isStaffForm = roleScope === 'staff';
  const roleLabel = assignableRoles.find((r) => r.value === form.role)?.label ?? form.role;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {initialRole
              ? `Add ${roleLabel}`
              : isStaffForm
                ? 'Add Staff Member'
                : roleScope === 'campus'
                  ? 'Add Campus User'
                  : 'Create User'}
          </DialogTitle>
          <DialogDescription>
            A temporary password will be generated. Share it securely with the user.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cu-name">Full name</Label>
            <Input id="cu-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cu-email">Email</Label>
            <Input id="cu-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({
                ...f,
                role: v as Role,
                linkedStudentId: v === 'parent' ? f.linkedStudentId : '',
              }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cu-emp">Employee ID</Label>
              <Input id="cu-emp" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Department</Label>
            {departments.length > 0 ? (
              <Select
                value={form.departmentId || 'none'}
                onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v === 'none' ? '' : v }))}
                disabled={actorRole === 'hod'}
              >
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input placeholder="Department name" disabled={actorRole === 'hod'} />
            )}
          </div>
          {form.role === 'parent' && (
            <div className="grid gap-1.5">
              <Label>Linked student</Label>
              <StudentPicker
                value={form.linkedStudentId}
                onChange={(id) => setForm((f) => ({ ...f, linkedStudentId: id }))}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="cu-phone">Phone</Label>
            <Input id="cu-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name || !form.email || (form.role === 'parent' && !form.linkedStudentId)}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateUser = useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string;
      name?: string;
      email?: string;
      employeeId?: string | null;
      role?: Role;
      status?: string;
      department?: string;
      departmentId?: string | null;
      phone?: string;
      linkedStudentId?: string | null;
      resetPassword?: boolean;
    }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      return data as { user: UserItem; tempPassword?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['settings-user-accounts'] });
      if (data.tempPassword) {
        toast({ title: 'Password reset', description: `New password: ${data.tempPassword}` });
      } else {
        toast({ title: 'User updated' });
      }
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deactivateUser = useMutation({
    mutationFn: async (id: string) => {
      // Soft-deactivate via PATCH so HOD (and admins) share one working path.
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deactivate failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['settings-user-accounts'] });
      toast({ title: 'User deactivated' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return { updateUser, deactivateUser };
}
