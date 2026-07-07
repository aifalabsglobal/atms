'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Download, Wallet } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { KnuctDIDAuthPanel, type RegisterProfile } from '@/components/knuct/did-auth-panel';
import { BRAND } from '@/lib/branding';

const REGISTER_ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'lab_assistant', label: 'Lab Assistant' },
  { value: 'parent', label: 'Parent' },
  { value: 'visitor', label: 'Visitor' },
] as const;

type SubmitResult = {
  did?: string;
  privShareFilename?: string;
  privShareBase64?: string;
};

function downloadPrivShare(filename: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ProfileFields({
  profile,
  setProfile,
  disabled,
}: {
  profile: RegisterProfile;
  setProfile: React.Dispatch<React.SetStateAction<RegisterProfile>>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reg-name">Full name</Label>
        <Input
          id="reg-name"
          value={profile.name}
          onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
          placeholder="Your full name"
          required
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-email">Email</Label>
        <Input
          id="reg-email"
          type="email"
          value={profile.email}
          onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
          placeholder={BRAND.emailPlaceholder}
          required
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="reg-roll">Roll / Employee ID</Label>
          <Input
            id="reg-roll"
            value={profile.employeeId ?? ''}
            onChange={(e) => setProfile((p) => ({ ...p, employeeId: e.target.value }))}
            placeholder="Optional"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-phone">Phone</Label>
          <Input
            id="reg-phone"
            value={profile.phone ?? ''}
            onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            placeholder="Optional"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-dept">Department</Label>
        <Input
          id="reg-dept"
          value={profile.department ?? ''}
          onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}
          placeholder="e.g. Computer Science"
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label>Requested role</Label>
        <Select
          value={profile.requestedRole ?? 'student'}
          onValueChange={(v) => setProfile((p) => ({ ...p, requestedRole: v }))}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REGISTER_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const [mounted, setMounted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [profile, setProfile] = useState<RegisterProfile>({
    name: '',
    email: '',
    employeeId: '',
    phone: '',
    department: '',
    requestedRole: 'student',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const profileReady = Boolean(profile.name.trim() && profile.email.trim());

  const createWalletAndRegister = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'create-wallet', ...profile }),
      });
      const data = (await res.json()) as SubmitResult & { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? 'Wallet creation failed');
      setResult({
        did: data.did,
        privShareFilename: data.privShareFilename,
        privShareBase64: data.privShareBase64,
      });
      setSubmitted(true);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Wallet creation failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A3C6E]/5 via-background to-[#1A3C6E]/10 p-4 py-8">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center space-y-3 pb-2">
          <BrandLogo size="lg" className="mx-auto" priority />
          <CardTitle className="text-xl text-[#1A3C6E]">Register with Knuct</CardTitle>
          <CardDescription>
            Create a new Knuct wallet or link an existing one. An administrator will approve your campus account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!mounted ? (
            <Skeleton className="h-64 w-full" />
          ) : submitted ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
              <p className="font-medium text-green-800">Registration submitted</p>
              {result?.did && (
                <p className="text-xs font-mono text-green-800 break-all">DID: {result.did}</p>
              )}
              <p className="text-sm text-green-700">
                An administrator will review your request. After approval, sign in with your private share on the login page.
              </p>
              {result?.privShareBase64 && result.privShareFilename && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-green-300"
                  onClick={() =>
                    downloadPrivShare(result.privShareFilename!, result.privShareBase64!)
                  }
                >
                  <Download className="h-4 w-4" />
                  Download private share (save this file!)
                </Button>
              )}
              <Button asChild className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90">
                <Link href="/login">Back to login</Link>
              </Button>
            </div>
          ) : (
            <>
              <Tabs defaultValue="create">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="create" className="gap-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    Create wallet
                  </TabsTrigger>
                  <TabsTrigger value="existing">I have a wallet</TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="space-y-4 mt-4">
                  <ProfileFields profile={profile} setProfile={setProfile} disabled={creating} />
                  <p className="text-xs text-muted-foreground">
                    We will create a Knuct wallet on the blockchain for you, then submit your profile for admin approval.
                    You will download your private share once — keep it safe; it is your login key.
                  </p>
                  {createError && (
                    <p className="text-sm text-destructive">{createError}</p>
                  )}
                  <Button
                    type="button"
                    className="w-full bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 gap-2"
                    disabled={!profileReady || creating}
                    onClick={() => void createWalletAndRegister()}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating wallet… (may take 1–2 min)
                      </>
                    ) : (
                      'Create Knuct wallet & register'
                    )}
                  </Button>
                </TabsContent>

                <TabsContent value="existing" className="space-y-4 mt-4">
                  <ProfileFields profile={profile} setProfile={setProfile} />
                  <KnuctDIDAuthPanel
                    mode="register"
                    registerProfile={profile}
                    disabled={!profileReady}
                    onRegistered={() => setSubmitted(true)}
                  />
                  {!profileReady && (
                    <p className="text-xs text-muted-foreground text-center">
                      Enter your name and email before uploading your private share.
                    </p>
                  )}
                </TabsContent>
              </Tabs>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-[#1A3C6E] font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
