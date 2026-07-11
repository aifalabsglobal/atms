'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Loader2, KeyRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type MfaStatus = { enabled: boolean };
type MfaSetup = { secret: string; qrDataUrl: string };

export function MfaSettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [token, setToken] = useState('');
  const [disableToken, setDisableToken] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: async () => {
      const res = await fetch('/api/auth/mfa');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load MFA status');
      return json as MfaStatus;
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/mfa', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Setup failed');
      return json as MfaSetup;
    },
    onSuccess: (payload) => {
      setSetup(payload);
      setToken('');
    },
    onError: (err: Error) => toast({ title: 'MFA setup failed', description: err.message, variant: 'destructive' }),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/mfa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Confirm failed');
      return json;
    },
    onSuccess: () => {
      setSetup(null);
      setToken('');
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
      toast({ title: 'MFA enabled', description: 'Authenticator app required on password login.' });
    },
    onError: (err: Error) => toast({ title: 'Invalid code', description: err.message, variant: 'destructive' }),
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/mfa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: disableToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Disable failed');
      return json;
    },
    onSuccess: () => {
      setDisableToken('');
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
      toast({ title: 'MFA disabled' });
    },
    onError: (err: Error) => toast({ title: 'Could not disable MFA', description: err.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand" /> Two-factor authentication (TOTP)
        </CardTitle>
        <CardDescription>
          Use Google Authenticator, Authy, or 1Password. Required after password login when enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Badge
            variant="outline"
            className={data?.enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600'}
          >
            MFA {data?.enabled ? 'enabled' : 'disabled'}
          </Badge>
        )}

        {!data?.enabled && !setup && (
          <Button
            size="sm"
            className="gap-2 bg-brand hover:bg-brand/90"
            disabled={startMutation.isPending}
            onClick={() => startMutation.mutate()}
          >
            {startMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Set up authenticator
          </Button>
        )}

        {setup && (
          <div className="space-y-3 rounded-lg border p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrDataUrl} alt="MFA QR code" className="h-40 w-40 mx-auto" />
            <p className="text-xs text-muted-foreground text-center font-mono break-all">{setup.secret}</p>
            <div className="space-y-2">
              <Label className="text-xs">Enter 6-digit code to confirm</Label>
              <Input
                className="h-9 font-mono tracking-widest"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={token.length !== 6 || confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
              >
                {confirmMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Enable MFA'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSetup(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {data?.enabled && (
          <div className="space-y-2 max-w-xs">
            <Label className="text-xs">Disable with current code</Label>
            <Input
              className="h-9 font-mono tracking-widest"
              maxLength={6}
              value={disableToken}
              onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={disableToken.length !== 6 || disableMutation.isPending}
              onClick={() => disableMutation.mutate()}
            >
              Disable MFA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
