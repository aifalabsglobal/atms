'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KnuctDIDAuthPanel } from '@/components/knuct/did-auth-panel';
import { usePlatformSettings } from '@/hooks/use-platform-settings';
import { DEFAULT_GENERAL_SETTINGS } from '@/lib/settings/general-defaults';
import { BRAND } from '@/lib/branding';
import { DEMO_PASSWORD } from '@/lib/demo-accounts';

export default function KnuctLoginPage() {
  const router = useRouter();
  const { data: platform } = usePlatformSettings(true);
  const general = platform ?? DEFAULT_GENERAL_SETTINGS;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('vice.chancellor@aimscs.ac.in');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('error');
    if (authError === 'CredentialsSignin') {
      setError('Invalid credentials or Knuct console access is not enabled for this account.');
    }
  }, []);

  const handleDidLogin = async (loginToken: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await signIn('knuct', { loginToken, redirect: false });
      if (result?.ok) {
        router.replace('/knuct');
        router.refresh();
        return;
      }
      setError('Knuct DID sign-in failed. Token may have expired — try again.');
    } catch {
      setError('Knuct DID sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpsPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!mfaRequired) {
        const pre = await fetch('/api/auth/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, requireKnuctConsoleAccess: true }),
        });
        const preData = await pre.json().catch(() => ({}));
        if (pre.status === 401 || preData.ok === false) {
          setError(
            preData.error === 'KNUCT_CONSOLE_DENIED'
              ? 'This account does not have Knuct console access.'
              : 'Invalid email or password, or Knuct console access is not enabled.',
          );
          return;
        }
        if (preData.mfaRequired) {
          setMfaRequired(true);
          setMfaCode('');
          setError('Enter your authenticator code.');
          return;
        }
      }

      const result = await signIn('knuct-console', {
        email,
        password,
        mfaCode: mfaRequired ? mfaCode : undefined,
        redirect: false,
      });
      if (result?.ok) {
        router.replace('/knuct');
        router.refresh();
        return;
      }
      setError('Ops sign-in failed. Check credentials / MFA, or knuctConsoleAccess.');
    } catch {
      setError('Ops sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-4 py-10">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center space-y-3 pb-2">
          <BrandLogo size="lg" className="mx-auto" priority src={general.logoUrl} alt={general.companyName} />
          <CardTitle className="text-xl" style={{ color: general.brandingPrimaryColor }}>
            Knuct Console
          </CardTitle>
          <CardDescription>
            Standalone wallets, anchors, and credentials — separate from campus ATMS roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Tabs defaultValue="did" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="did" className="gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Knuct DID
              </TabsTrigger>
              <TabsTrigger value="ops">Ops password</TabsTrigger>
            </TabsList>

            <TabsContent value="did" className="space-y-3">
              <KnuctDIDAuthPanel
                mode="login"
                onLoginToken={(token) => void handleDidLogin(token)}
                disabled={loading}
              />
              <p className="text-[10px] text-muted-foreground text-center">
                Wallet must already be provisioned and linked to your account.
              </p>
            </TabsContent>

            <TabsContent value="ops">
              <form onSubmit={handleOpsPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="knuct-email">Email</Label>
                  <Input
                    id="knuct-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={BRAND.emailPlaceholder}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="knuct-password">Password</Label>
                  <Input
                    id="knuct-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || mfaRequired}
                    required
                  />
                </div>
                {mfaRequired && (
                  <div className="space-y-2">
                    <Label htmlFor="knuct-mfa">Authenticator code</Label>
                    <Input
                      id="knuct-mfa"
                      inputMode="numeric"
                      className="font-mono tracking-widest"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:underline"
                      onClick={() => {
                        setMfaRequired(false);
                        setMfaCode('');
                        setError('');
                      }}
                    >
                      Back to password
                    </button>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full text-white"
                  style={{ backgroundColor: general.brandingPrimaryColor }}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in to console'}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Requires <code className="font-mono">knuctConsoleAccess</code> on the user record.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New wallet?{' '}
            <Link href="/knuct/register" className="text-brand font-medium hover:underline">
              Register
            </Link>
            {' · '}
            <Link href="/login" className="hover:underline">
              Campus login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
