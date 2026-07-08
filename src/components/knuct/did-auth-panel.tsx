'use client';

/**
 * KnuctDIDAuthPanel — client-side DID authentication flow.
 *
 * Modes:
 *  - verify (default): requires NextAuth session, POST /api/knuct/did-auth
 *  - login: POST /api/knuct/login → loginToken
 *  - register: POST /api/register → pending approval
 */
import { useRef, useState, useEffect } from 'react';
import { ShieldCheck, Upload, Loader2, CheckCircle2, XCircle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { computePrivShareHash } from '@/lib/knuct/priv-share';
import { createChallengeResponse } from '@/lib/knuct/nlss';
import { ensureOpenCvReady } from '@/lib/knuct/opencv-loader';
import { isMobileDevice } from '@/lib/knuct/device';

type Step = 'idle' | 'hashing' | 'challenge' | 'responding' | 'completing' | 'done' | 'error';

const STEP_LABELS: Record<Step, string> = {
  idle: 'Select private share image to begin',
  hashing: 'Reading image…',
  challenge: 'Requesting challenge from Knuct…',
  responding: 'Computing cryptographic response…',
  completing: 'Verifying with Knuct server…',
  done: 'DID authenticated',
  error: 'Authentication failed',
};

export type RegisterProfile = {
  name: string;
  email: string;
  employeeId?: string;
  phone?: string;
  departmentId?: string;
  department?: string;
  requestedRole?: string;
};

interface Props {
  mode?: 'verify' | 'login' | 'register';
  registerProfile?: RegisterProfile;
  onSuccess?: (did: string) => void;
  onLoginToken?: (loginToken: string, did: string) => void;
  onRegistered?: (payload: { id: string; did: string; message?: string }) => void;
  onCancel?: () => void;
  compact?: boolean;
  disabled?: boolean;
}

export function KnuctDIDAuthPanel({
  mode = 'verify',
  registerProfile,
  onSuccess,
  onLoginToken,
  onRegistered,
  onCancel,
  compact = false,
  disabled = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const flowIdRef = useRef<string | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [did, setDid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const apiPath =
    mode === 'login' ? '/api/knuct/login' :
    mode === 'register' ? '/api/register' :
    '/api/knuct/did-auth';

  useEffect(() => {
    if (isMobileDevice()) {
      ensureOpenCvReady().catch((err) => {
        console.warn('[knuct] OpenCV preload failed:', err);
      });
    }
  }, []);

  const reset = () => {
    setStep('idle');
    setDid(null);
    setError(null);
    setFileName(null);
    flowIdRef.current = null;
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    if (mode === 'register') {
      if (!registerProfile?.name?.trim() || !registerProfile?.email?.trim()) {
        setStep('error');
        setError('Fill in your name and email before uploading your private share.');
        return;
      }
    }

    setFileName(file.name);
    setError(null);

    try {
      setStep('hashing');
      if (isMobileDevice()) {
        await ensureOpenCvReady();
      }
      const { privShare, hash } = await computePrivShareHash(file);

      setStep('challenge');
      const challengeRes = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'challenge', hash }),
      });
      if (!challengeRes.ok) {
        const { error: e } = (await challengeRes.json()) as { error?: string };
        throw new Error(e ?? `Challenge failed (HTTP ${challengeRes.status})`);
      }
      const challengeBody = (await challengeRes.json()) as { challenge: string; flowId?: string };
      if (mode === 'login' || mode === 'register') {
        if (!challengeBody.flowId) throw new Error('Flow ID missing from server');
        flowIdRef.current = challengeBody.flowId;
      }

      setStep('responding');
      const response = createChallengeResponse(challengeBody.challenge, 32, privShare);

      setStep('completing');
      const completeBody =
        mode === 'login'
          ? { step: 'complete', flowId: flowIdRef.current, response }
          : mode === 'register'
            ? { step: 'complete', flowId: flowIdRef.current, response, ...registerProfile }
            : { step: 'complete', response };
      const completeRes = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeBody),
      });
      if (!completeRes.ok) {
        const { error: e } = (await completeRes.json()) as { error?: string };
        throw new Error(e ?? `Auth completion failed (HTTP ${completeRes.status})`);
      }

      if (mode === 'login') {
        const { did: authenticatedDid, loginToken } = (await completeRes.json()) as {
          did: string;
          loginToken: string;
        };
        setDid(authenticatedDid);
        setStep('done');
        onLoginToken?.(loginToken, authenticatedDid);
        return;
      }

      if (mode === 'register') {
        const payload = (await completeRes.json()) as { id: string; did: string; message?: string };
        setDid(payload.did);
        setStep('done');
        onRegistered?.(payload);
        return;
      }

      const { did: authenticatedDid } = (await completeRes.json()) as { did: string };
      setDid(authenticatedDid);
      setStep('done');
      onSuccess?.(authenticatedDid);
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const isLoading = !['idle', 'done', 'error'].includes(step);
  const title =
    mode === 'login' ? 'Sign in with Knuct DID' :
    mode === 'register' ? 'Verify your Knuct wallet' :
    'DID Authentication';
  const description =
    mode === 'login'
      ? 'Upload your Knuct private share image to sign in. The image is processed in your browser and never uploaded.'
      : mode === 'register'
        ? 'Upload your private share to prove wallet ownership. Your profile details will be sent for admin approval.'
        : 'Upload your Knuct private share image to authenticate your DID. The image is processed entirely in your browser — it never leaves your device.';

  if (compact && step === 'done' && did) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="font-mono truncate">{did.slice(0, 24)}…</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-[#1A3C6E]" />
        <p className="text-sm font-medium">{title}</p>
        {step === 'done' && (
          <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">verified</Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>

      <div className="flex items-center gap-2 text-xs">
        {step === 'done' ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        ) : step === 'error' ? (
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        ) : isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#1A3C6E] shrink-0" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span
          className={
            step === 'done'
              ? 'text-green-700'
              : step === 'error'
                ? 'text-red-600'
                : isLoading
                  ? 'text-[#1A3C6E]'
                  : 'text-muted-foreground'
          }
        >
          {STEP_LABELS[step]}
        </span>
      </div>

      {isLoading && (
        <div className="grid grid-cols-4 gap-1">
          {(['hashing', 'challenge', 'responding', 'completing'] as Step[]).map((s) => {
            const steps: Step[] = ['hashing', 'challenge', 'responding', 'completing'];
            const idx = steps.indexOf(s);
            const curIdx = steps.indexOf(step as Step);
            const isDone = idx < curIdx;
            const isCur = s === step;
            return (
              <div
                key={s}
                className={`h-1 rounded-full transition-all ${
                  isDone ? 'bg-green-500' : isCur ? 'bg-[#1A3C6E]' : 'bg-muted'
                }`}
              />
            );
          })}
        </div>
      )}

      {step === 'done' && did && mode !== 'login' && (
        <div className="rounded bg-green-50 border border-green-200 px-3 py-2">
          <p className="text-[10px] text-green-600 font-medium mb-0.5">Authenticated DID</p>
          <p className="text-xs font-mono text-green-800 break-all">{did}</p>
        </div>
      )}

      {step === 'error' && error && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {fileName && step !== 'idle' && (
        <p className="text-[10px] text-muted-foreground">File: {fileName}</p>
      )}

      <div className="flex gap-2">
        {step === 'idle' || step === 'error' ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={disabled || isLoading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {step === 'error' ? 'Try again' : 'Select private share'}
            </Button>
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </>
        ) : step === 'done' ? (
          mode === 'login' || mode === 'register' ? null : (
            <Button size="sm" variant="ghost" onClick={reset}>
              Re-authenticate
            </Button>
          )
        ) : (
          <Button size="sm" variant="ghost" disabled>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Processing…
          </Button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
