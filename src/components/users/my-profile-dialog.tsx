'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, UserCircle, KeyRound } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { uploadProfileImage } from '@/components/users/user-management-dialogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

type MyProfile = {
  id: string;
  email: string;
  name: string;
  employeeId: string | null;
  department: string | null;
  phone: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
  profileImageUrl: string | null;
  lastLoginAt: string | null;
};

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function MyProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { update: updateSession } = useSession();
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-profile', currentUser?.id],
    queryFn: async () => {
      const res = await fetch('/api/users/me');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load profile');
      return json as { user: MyProfile };
    },
    enabled: open && !!currentUser?.id,
  });

  useEffect(() => {
    const user = data?.user;
    if (!user) return;
    setName(user.name);
    setPhone(user.phone || '');
    setPhotoUrl(user.profileImageUrl || user.avatarUrl);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, [data?.user]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        name,
        phone,
      };
      if (currentPassword || newPassword || confirmPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('New password and confirmation do not match');
        }
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update profile');
      return json as { user: MyProfile; passwordChanged?: boolean };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          name: result.user.name,
          profileImageUrl: result.user.profileImageUrl || undefined,
          avatar: getInitials(result.user.name),
        });
      }
      await updateSession();
      toast({
        title: result.passwordChanged ? 'Profile and password updated' : 'Profile updated',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setUploading(true);
      try {
        const url = await uploadProfileImage(currentUser.id, base64);
        setPhotoUrl(url);
        setCurrentUser({
          ...currentUser,
          profileImageUrl: url,
        });
        queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        await updateSession();
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

  const profile = data?.user;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            My Profile
          </DialogTitle>
          <DialogDescription>Update your photo, contact details, and password.</DialogDescription>
        </DialogHeader>

        {isLoading || !profile ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-1">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border-2">
                {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
                <AvatarFallback className="text-sm font-bold">{getInitials(name || profile.name)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1.5">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={uploading} />
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild disabled={uploading}>
                    <span>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploading ? 'Uploading…' : 'Change photo'}
                    </span>
                  </Button>
                </label>
                <p className="text-[11px] text-muted-foreground">Used for display and face attendance.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="capitalize">{profile.role.replace('_', ' ')}</Badge>
              <Badge variant="secondary" className="capitalize">{profile.status}</Badge>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="mp-email">Email</Label>
              <Input id="mp-email" value={profile.email} disabled />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mp-name">Full name</Label>
              <Input id="mp-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Employee ID</Label>
                <Input value={profile.employeeId || '—'} disabled />
              </div>
              <div className="grid gap-1.5">
                <Label>Department</Label>
                <Input value={profile.department || '—'} disabled />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mp-phone">Phone</Label>
              <Input id="mp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" /> Change password
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="mp-current">Current password</Label>
                <Input
                  id="mp-current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="mp-new">New password</Label>
                <Input
                  id="mp-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="mp-confirm">Confirm new password</Label>
                <Input
                  id="mp-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading || !name.trim()}
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
