'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, Pencil, Upload, UserX } from 'lucide-react';
import type { UserItem } from '@/lib/types';
import type { Role } from '@/lib/store';
import { STAFF_ROLES } from '@/lib/user-management';
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

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'hod', label: 'HOD' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'lab_assistant', label: 'Lab Assistant' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'visitor', label: 'Visitor' },
  { value: 'security', label: 'Security' },
];

const HOD_ROLES: Role[] = ['faculty', 'lab_assistant', 'student'];

function rolesForActor(actorRole: Role, scope: 'all' | 'staff' | 'campus' = 'all'): { value: Role; label: string }[] {
  let roles = rolesForActorUnscoped(actorRole);
  if (scope === 'staff') {
    roles = roles.filter((r) => STAFF_ROLES.includes(r.value));
  } else if (scope === 'campus') {
    roles = roles.filter((r) => !STAFF_ROLES.includes(r.value));
  }
  return roles;
}

function rolesForActorUnscoped(actorRole: Role): { value: Role; label: string }[] {
  if (actorRole === 'super_admin') {
    return [{ value: 'super_admin', label: 'Super Admin' }, ...ROLES];
  }
  if (actorRole === 'admin') return ROLES;
  if (actorRole === 'hod') {
    return ROLES.filter((r) => HOD_ROLES.includes(r.value));
  }
  return [];
}

function defaultRoleForScope(actorRole: Role, scope: 'all' | 'staff' | 'campus'): Role {
  const roles = rolesForActor(actorRole, scope);
  if (scope === 'staff') {
    const faculty = roles.find((r) => r.value === 'faculty');
    if (faculty) return faculty.value;
  }
  if (scope === 'campus') {
    const student = roles.find((r) => r.value === 'student');
    if (student) return student.value;
  }
  return roles[0]?.value ?? 'student';
}

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
] as const;

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    role: 'student' as Role,
    status: 'active',
    department: '',
    phone: '',
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      role: user.role as Role,
      status: user.status,
      department: user.department || '',
      phone: user.phone || '',
    });
    setAvatarUrl(user.avatarUrl);
  }, [user]);

  const assignableRoles = rolesForActor(actorRole);
  const canEditDept = actorRole !== 'hod';

  const handleSave = () => {
    if (!user) return;
    updateUser.mutate(
      {
        id: user.id,
        name: form.name,
        role: form.role,
        status: form.status,
        department: form.department,
        phone: form.phone,
      },
      { onSuccess: () => onOpenChange(false) },
    );
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
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
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
            <Label htmlFor="eu-dept">Department</Label>
            <Input id="eu-dept" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} disabled={!canEditDept} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eu-phone">Phone</Label>
            <Input id="eu-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {['super_admin', 'admin'].includes(actorRole) && user.status !== 'inactive' && (
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorRole: Role;
  roleScope?: 'all' | 'staff' | 'campus';
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: defaultRoleForScope(actorRole, roleScope),
    department: '',
    phone: '',
    employeeId: '',
  });

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      role: defaultRoleForScope(actorRole, roleScope),
    }));
  }, [open, actorRole, roleScope]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      return data as { user: UserItem; tempPassword?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: 'User created',
        description: data.tempPassword ? `Temporary password: ${data.tempPassword}` : undefined,
      });
      onOpenChange(false);
      setForm({
        name: '',
        email: '',
        role: defaultRoleForScope(actorRole, roleScope),
        department: '',
        phone: '',
        employeeId: '',
      });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const assignableRoles = rolesForActor(actorRole, roleScope);
  const isStaffForm = roleScope === 'staff';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {isStaffForm ? 'Add Staff Member' : roleScope === 'campus' ? 'Add Campus User' : 'Create User'}
          </DialogTitle>
          <DialogDescription>
            {isStaffForm
              ? 'Add faculty, admin, or security staff. A temporary password will be generated.'
              : 'Add a new campus user. A temporary password will be generated.'}
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
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
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
            <Label htmlFor="cu-dept">Department</Label>
            <Input id="cu-dept" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} disabled={actorRole === 'hod'} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cu-phone">Phone</Label>
            <Input id="cu-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name || !form.email}>
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
      role?: Role;
      status?: string;
      department?: string;
      phone?: string;
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
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deactivate failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User deactivated' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return { updateUser, deactivateUser };
}
