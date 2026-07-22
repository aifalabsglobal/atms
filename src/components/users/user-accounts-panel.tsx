'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UserPlus, Search, Pencil, GraduationCap, BookOpen, Shield, UserCog,
  Users, FlaskConical, Heart, MapPin, ShieldCheck, Crown,
} from 'lucide-react';
import type { UserItem } from '@/lib/types';
import type { Role } from '@/lib/store';
import { ROLE_LABELS } from '@/lib/store';
import { rolesForActor } from '@/lib/user-management';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateUserDialog, EditUserDialog } from '@/components/users/user-management-dialogs';

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-800',
  admin: 'bg-orange-100 text-orange-800',
  hod: 'bg-purple-100 text-purple-800',
  faculty: 'bg-blue-100 text-blue-800',
  lab_assistant: 'bg-teal-100 text-teal-800',
  student: 'bg-green-100 text-green-800',
  parent: 'bg-amber-100 text-amber-800',
  visitor: 'bg-gray-100 text-gray-800',
  security: 'bg-rose-100 text-rose-800',
};

const QUICK_CREATE: { label: string; role: Role; icon: typeof UserPlus }[] = [
  { label: 'Teacher', role: 'faculty', icon: GraduationCap },
  { label: 'Student', role: 'student', icon: BookOpen },
  { label: 'HOD', role: 'hod', icon: Shield },
  { label: 'Admin', role: 'admin', icon: UserCog },
  { label: 'Lab Assistant', role: 'lab_assistant', icon: FlaskConical },
  { label: 'Parent', role: 'parent', icon: Heart },
  { label: 'Security', role: 'security', icon: ShieldCheck },
  { label: 'Visitor', role: 'visitor', icon: MapPin },
];

type UsersApiResponse = {
  users: UserItem[];
  total: number;
};

export function UserAccountsPanel({ actorRole }: { actorRole: Role }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState<Role | undefined>();
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const assignableRoles = rolesForActor(actorRole);
  const limit = 15;

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search.trim()) params.set('search', search.trim());
    if (roleFilter !== 'all') params.set('role', roleFilter);
    return params.toString();
  }, [search, roleFilter, page]);

  const { data, isLoading } = useQuery<UsersApiResponse>({
    queryKey: ['settings-user-accounts', queryParams],
    queryFn: () =>
      fetch(`/api/users?${queryParams}`).then((r) => {
        if (!r.ok) throw new Error('Failed to load users');
        return r.json();
      }),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const openCreate = (role?: Role) => {
    setCreateRole(role);
    setCreateOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-brand" />
                User Accounts
              </CardTitle>
              <CardDescription>
                Create teachers, students, and every campus role. A temporary password is generated on create.
              </CardDescription>
            </div>
            <Button size="sm" className="bg-brand hover:bg-brand/90" onClick={() => openCreate()}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Create User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick create by role</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_CREATE.filter((q) => assignableRoles.some((r) => r.value === q.role)).map((q) => {
                const Icon = q.icon;
                return (
                  <Button
                    key={q.role}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => openCreate(q.role)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {q.label}
                  </Button>
                );
              })}
              {assignableRoles.some((r) => r.value === 'super_admin') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => openCreate('super_admin')}
                >
                  <Crown className="h-3.5 w-3.5" />
                  Super Admin
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email…"
                className="pl-9 h-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setRoleFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px] h-9">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {assignableRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No users match your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <Badge className={`${ROLE_BADGE[user.role] ?? ''} text-[10px]`}>
                              {ROLE_LABELS[user.role as Role] ?? user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{user.department || '—'}</TableCell>
                          <TableCell className="text-sm capitalize">{user.status}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditUser(user);
                                  setEditOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{total} user{total === 1 ? '' : 's'}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="self-center">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        actorRole={actorRole}
        initialRole={createRole}
      />
      <EditUserDialog
        user={editUser}
        open={editOpen}
        onOpenChange={setEditOpen}
        actorRole={actorRole}
      />
    </div>
  );
}
