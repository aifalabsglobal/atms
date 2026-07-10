'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap, Loader2, Check, Share2, User, Users, Shield, BookOpen, ChevronDown, Crown, KeyRound } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KnuctDIDAuthPanel } from '@/components/knuct/did-auth-panel';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demo-accounts';
import { BRAND } from '@/lib/branding';
import { copyDemoShareKit, copyDemoWalkthrough } from '@/lib/demo-share';
import { DEMO_FLOW, DEMO_PREP_STEPS, DEMO_DO_NOT_SHOW } from '@/lib/demo-walkthrough';
import { ROLE_COLORS } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const QUICK_TRY = [
  { label: 'Super Admin', email: 'vice.chancellor@aimscs.ac.in', icon: Crown, color: '#1A3C6E' },
  { label: 'Admin', email: 'registrar@aimscs.ac.in', icon: Shield, color: '#7c3aed' },
  { label: 'Faculty', email: 'faculty.venkat@aimscs.ac.in', icon: Users, color: '#1B6B4A' },
  { label: 'Student', email: 'student.ravi@aimscs.ac.in', icon: User, color: '#2563eb' },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [knuctLoading, setKnuctLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [googleSso, setGoogleSso] = useState(false);

  useEffect(() => {
    setMounted(true);
    setEmail('vice.chancellor@aimscs.ac.in');
    setPassword(DEMO_PASSWORD);

    const params = new URLSearchParams(window.location.search);
    const authError = params.get('error');
    if (authError === 'CredentialsSignin') {
      setError('Invalid email or password. On a fresh deploy, seed the database (npm run db:seed).');
    } else if (authError === 'Configuration') {
      setError('Auth is misconfigured. Set NEXTAUTH_URL to your Vercel domain and a strong NEXTAUTH_SECRET.');
    } else if (authError === 'GoogleAccountNotLinked') {
      setError('No AIMSCS account matches that Google email. Ask an admin to create your user first.');
    } else if (authError === 'MFA_INVALID') {
      setError('Invalid authenticator code. Try again.');
      setMfaRequired(true);
    }

    fetch('/api/auth/methods')
      .then((r) => r.json())
      .then((d) => setGoogleSso(d.google === true))
      .catch(() => setGoogleSso(false));
  }, []);

  const signInAs = async (targetEmail: string, targetPassword = DEMO_PASSWORD, code?: string) => {
    setLoadingEmail(targetEmail);
    setError('');
    try {
      if (!code) {
        const pre = await fetch('/api/auth/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail, password: targetPassword }),
        });
        const preData = await pre.json().catch(() => ({}));
        if (pre.status === 401 || preData.ok === false) {
          setError('Invalid email or password. Use vice.chancellor@aimscs.ac.in / demo123 after seeding (npm run db:seed).');
          return;
        }
        if (preData.mfaRequired) {
          setEmail(targetEmail);
          setPassword(targetPassword);
          setMfaRequired(true);
          setMfaCode('');
          return;
        }
      }

      const result = await signIn('credentials', {
        email: targetEmail,
        password: targetPassword,
        mfaCode: code || undefined,
        callbackUrl: '/',
        redirect: false,
      });

      if (result?.ok) {
        router.replace('/');
        router.refresh();
        return;
      }

      if (result?.error === 'MFA_REQUIRED') {
        setMfaRequired(true);
        return;
      }
      if (result?.error === 'MFA_INVALID') {
        setError('Invalid authenticator code. Try again.');
        setMfaRequired(true);
        return;
      }
      if (result?.error === 'CredentialsSignin') {
        setError(
          mfaRequired
            ? 'Invalid authenticator code or password.'
            : 'Invalid email or password. Use vice.chancellor@aimscs.ac.in / demo123 after seeding (npm run db:seed).',
        );
      } else if (result?.error === 'DatabaseConnectionError') {
        setError('Database is waking up — wait a few seconds and try again.');
      } else if (result?.error) {
        setError(`Login failed (${result.error}). Wait a few seconds and try again.`);
      } else {
        setError('Login failed — the server may be waking up. Please try again in a few seconds.');
      }
    } catch {
      setError('Login failed — the server may be waking up. Please try again in a few seconds.');
    } finally {
      setLoadingEmail(null);
    }
  };

  const handleKnuctLogin = async (loginToken: string) => {
    setKnuctLoading(true);
    setError('');
    try {
      const result = await signIn('knuct', {
        loginToken,
        redirect: false,
      });

      if (result?.ok) {
        router.replace('/');
        router.refresh();
        return;
      }

      setError('Knuct sign-in failed. The login token may have expired — please try again.');
    } catch {
      setError('Knuct sign-in failed — the server may be waking up. Please try again.');
    } finally {
      setKnuctLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInAs(email, password, mfaRequired ? mfaCode : undefined);
  };

  const handleShare = async () => {
    const ok = await copyDemoShareKit();
    if (ok) {
      setCopied(true);
      toast({ title: 'Demo kit copied', description: 'Paste and send to anyone — URL, password, and all role logins included.' });
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast({ title: 'Copy failed', description: 'Select and copy the demo details manually.', variant: 'destructive' });
    }
  };

  const handleCopyScript = async () => {
    const ok = await copyDemoWalkthrough();
    if (ok) {
      setScriptCopied(true);
      toast({ title: 'Demo script copied', description: '5-minute walkthrough with backup Two Sum solution.' });
      setTimeout(() => setScriptCopied(false), 2500);
    } else {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const loading = loadingEmail !== null || knuctLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A3C6E]/5 via-background to-[#1A3C6E]/10 p-4 py-8">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center space-y-3 pb-2">
          <BrandLogo size="lg" className="mx-auto" priority />
          <CardTitle className="text-xl text-[#1A3C6E]">{BRAND.name}</CardTitle>
          <CardDescription>
            {BRAND.tagline} — sign in with email or Knuct DID
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!mounted ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <Tabs defaultValue="password" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Email & password</TabsTrigger>
                <TabsTrigger value="knuct" className="gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  Knuct DID
                </TabsTrigger>
              </TabsList>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <TabsContent value="password">
                <div className="grid md:grid-cols-2 gap-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={BRAND.emailPlaceholder}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading || mfaRequired}
                        required
                      />
                    </div>
                    {mfaRequired && (
                      <div className="space-y-2">
                        <Label htmlFor="mfa">Authenticator code</Label>
                        <Input
                          id="mfa"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          className="font-mono tracking-widest"
                          maxLength={6}
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          disabled={loading}
                          required
                          placeholder="000000"
                        />
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground hover:underline"
                          onClick={() => {
                            setMfaRequired(false);
                            setMfaCode('');
                          }}
                        >
                          Back to password
                        </button>
                      </div>
                    )}
                    <Button type="submit" className="w-full bg-[#1A3C6E] hover:bg-[#1A3C6E]/90" disabled={loading}>
                      {loadingEmail === email ? <Loader2 className="h-4 w-4 animate-spin" /> : mfaRequired ? 'Verify & sign in' : 'Sign in'}
                    </Button>
                    {googleSso && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={loading}
                        onClick={() => void signIn('google', { callbackUrl: '/' })}
                      >
                        Continue with Google
                      </Button>
                    )}
                  </form>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Try instantly — no setup needed</p>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_TRY.map((q) => {
                          const Icon = q.icon;
                          const isLoading = loadingEmail === q.email;
                          return (
                            <Button
                              key={q.email}
                              type="button"
                              variant="outline"
                              className="h-auto py-3 flex flex-col gap-1.5"
                              disabled={loading}
                              onClick={() => void signInAs(q.email)}
                            >
                              {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" style={{ color: q.color }} />
                              ) : (
                                <Icon className="h-5 w-5" style={{ color: q.color }} />
                              )}
                              <span className="text-[11px] font-medium">{q.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full gap-2"
                      onClick={() => void handleShare()}
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
                      {copied ? 'Copied!' : 'Copy demo kit for anyone'}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Includes login URL, password (<code className="font-mono">{DEMO_PASSWORD}</code>), and all 9 demo roles
                    </p>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 border-[#1A3C6E]/30"
                      onClick={() => void handleCopyScript()}
                    >
                      {scriptCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <BookOpen className="h-4 w-4 text-[#1A3C6E]" />}
                      {scriptCopied ? 'Script copied!' : 'Copy 5-min demo script'}
                    </Button>

                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground py-1"
                      onClick={() => setScriptOpen((o) => !o)}
                    >
                      <ChevronDown className={cn('h-3 w-3 transition-transform', scriptOpen && 'rotate-180')} />
                      {scriptOpen ? 'Hide' : 'Show'} demo prep & walkthrough
                    </button>

                    {scriptOpen && (
                      <div className="rounded-lg border bg-muted/30 p-3 text-[10px] space-y-3 max-h-64 overflow-y-auto text-left">
                        <div>
                          <p className="font-semibold text-[#1A3C6E] mb-1">Before demo (once)</p>
                          <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground font-mono">
                            {DEMO_PREP_STEPS.map((s) => <li key={s}>{s}</li>)}
                          </ul>
                        </div>
                        {DEMO_FLOW.map((block) => (
                          <div key={block.role}>
                            <p className="font-semibold">{block.role} <span className="font-normal text-muted-foreground">~{block.minutes}m</span></p>
                            <ul className="list-disc pl-4 text-muted-foreground">
                              {block.steps.map((s) => <li key={s}>{s}</li>)}
                            </ul>
                          </div>
                        ))}
                        <div>
                          <p className="font-semibold text-destructive/80 mb-1">Do not show live</p>
                          <ul className="list-disc pl-4 text-muted-foreground">
                            {DEMO_DO_NOT_SHOW.map((s) => <li key={s}>{s}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-1 border-t">
                      <p className="text-[10px] text-muted-foreground text-center">All demo roles</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DEMO_ACCOUNTS.map((account) => {
                          const isLoading = loadingEmail === account.email;
                          return (
                            <Button
                              key={account.email}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={cn('text-[10px] h-auto py-1.5 gap-1 justify-start', isLoading && 'opacity-80')}
                              disabled={loading}
                              onClick={() => void signInAs(account.email)}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: ROLE_COLORS[account.role] }}
                              />
                              {isLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : account.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="knuct" className="space-y-4">
                <KnuctDIDAuthPanel
                  mode="login"
                  onLoginToken={(loginToken) => void handleKnuctLogin(loginToken)}
                />
                <p className="text-[10px] text-muted-foreground text-center">
                  Your Knuct wallet must already be provisioned and linked to your SCMS account.
                  Run the live pilot from Settings if you have not set up a wallet yet.
                </p>
              </TabsContent>
              <p className="text-center text-sm text-muted-foreground">
                New to SCMS?{' '}
                <Link href="/register" className="text-[#1A3C6E] font-medium hover:underline">
                  Register with Knuct
                </Link>
              </p>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
