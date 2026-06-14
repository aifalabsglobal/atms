'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2 } from 'lucide-react';
import type { UserItem } from '@/lib/types';
import type { Role } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

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

function rolesForActor(actorRole: Role): { value: Role; label: string }[] {
  if (actorRole === 'super_admin') {
    return [{ value: 'super_admin', label: 'Super Admin' }, ...ROLES];
  }
  if (actorRole === 'admin') return ROLES;
  if (actorRole === 'hod') {
    return ROLES.filter((r) => HOD_ROLES.includes(r.value));
  }
  return [];
}

export function CreateUserDialog({
  open,
  onOpenChange,
  actorRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorRole: Role;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: rolesForActor(actorRole)[0]?.value ?? 'student',
    department: '',
    phone: '',
    employeeId: '',
  });

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
      setForm({ name: '', email: '', role: rolesForActor(actorRole)[0]?.value ?? 'student', department: '', phone: '', employeeId: '' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const assignableRoles = rolesForActor(actorRole);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create User
          </DialogTitle>
          <DialogDescription>Add a new campus user. A temporary password will be generated.</DialogDescription>
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
    mutationFn: async ({ id, ...body }: { id: string; role?: Role; status?: string; resetPassword?: boolean }) => {
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
