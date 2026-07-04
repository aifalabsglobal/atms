'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Loader2, Check, Share2, User, Users, Shield, BookOpen, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demo-accounts';
import { copyDemoShareKit, copyDemoWalkthrough } from '@/lib/demo-share';
import { DEMO_FLOW, DEMO_PREP_STEPS, DEMO_DO_NOT_SHOW } from '@/lib/demo-walkthrough';
import { ROLE_COLORS } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const QUICK_TRY = [
  { label: 'Student', email: 'student.ravi@jntuh.ac.in', icon: User, color: '#2563eb' },
  { label: 'Faculty', email: 'faculty.venkat@jntuh.ac.in', icon: Users, color: '#1B6B4A' },
  { label: 'Admin', email: 'registrar@jntuh.ac.in', icon: Shield, color: '#7c3aed' },
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

  useEffect(() => {
    setMounted(true);
    setPassword(DEMO_PASSWORD);
  }, []);

  const signInAs = async (targetEmail: string, targetPassword = DEMO_PASSWORD) => {
    setLoadingEmail(targetEmail);
    setError('');
    const result = await signIn('credentials', {
      email: targetEmail,
      password: targetPassword,
      redirect: false,
    });
    setLoadingEmail(null);
    if (result?.error) {
      setError('Invalid email or password');
      return;
    }
    router.push('/');
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInAs(email, password);
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

  const loading = loadingEmail !== null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A3C6E]/5 via-background to-[#1A3C6E]/10 p-4 py-8">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-[#1A3C6E] flex items-center justify-center">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-xl text-[#1A3C6E]">JNTUH SCMS</CardTitle>
          <CardDescription>
            Smart Campus Management System — free to try, easy to share with anyone
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
            <div className="grid md:grid-cols-2 gap-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@jntuh.ac.in"
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
                    disabled={loading}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full bg-[#1A3C6E] hover:bg-[#1A3C6E]/90" disabled={loading}>
                  {loadingEmail === email ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
                </Button>
              </form>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Try instantly — no setup needed</p>
                  <div className="grid grid-cols-3 gap-2">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
