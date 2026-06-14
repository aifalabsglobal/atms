'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demo-accounts';
import { ROLE_COLORS } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);

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

  const loading = loadingEmail !== null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A3C6E]/5 via-background to-[#1A3C6E]/10 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-xl bg-[#1A3C6E] flex items-center justify-center">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-xl text-[#1A3C6E]">JNTUH SCMS</CardTitle>
          <CardDescription>
            JNTUH Engineering College — Smart Campus Management System
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!mounted ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
          <>
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

          <div className="mt-6 space-y-2">
            <p className="text-xs text-muted-foreground text-center">
              Demo accounts — click to sign in instantly
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => {
                const isLoading = loadingEmail === account.email;
                return (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn('text-xs h-auto py-2 gap-1.5 justify-start', isLoading && 'opacity-80')}
                    disabled={loading}
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(DEMO_PASSWORD);
                      void signInAs(account.email);
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: ROLE_COLORS[account.role] }}
                    />
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : account.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-[10px] text-center text-muted-foreground">Password: {DEMO_PASSWORD}</p>
          </div>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
