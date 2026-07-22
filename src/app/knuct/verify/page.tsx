'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Search, ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_BRAND_PRIMARY } from '@/lib/brand-color';

const UOH_NAVY = DEFAULT_BRAND_PRIMARY;

type VerifyResult = {
  verified: boolean;
  message?: string;
  anchor?: {
    resourceType: string;
    resourceId: string;
    payloadHash: string;
    status: string;
    knuctTxRef: string | null;
    createdAt: string;
    chainPublished: boolean;
  };
};

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerify = useCallback(async (hashValue: string) => {
    const trimmed = hashValue.trim();
    if (trimmed.length < 8) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/verify/anchor?hash=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Verification failed');
        return;
      }
      setResult(data);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const paramHash = searchParams.get('hash');
    if (paramHash && paramHash.trim().length >= 8) {
      setHash(paramHash.trim());
      runVerify(paramHash);
    }
  }, [searchParams, runVerify]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    await runVerify(hash);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand/5 to-background">
      <div className="mx-auto max-w-lg px-4 py-12">
        <Link href="/knuct/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Knuct console
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: UOH_NAVY }}>
              <ShieldCheck className="h-5 w-5" /> Audit Anchor Verification
            </CardTitle>
            <CardDescription>
              Verify a SHA-256 audit hash recorded by AIMSCS. Chain publish status shown when available.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleVerify} className="flex gap-2">
              <Input
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="Paste hash (full or first 12+ chars)"
                className="font-mono text-xs"
              />
              <Button type="submit" disabled={loading || hash.trim().length < 8} style={{ backgroundColor: UOH_NAVY }}>
                {loading ? '…' : <Search className="h-4 w-4" />}
              </Button>
            </form>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {result && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {result.verified ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-700">Anchor found</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium text-muted-foreground">{result.message ?? 'Not found'}</span>
                    </>
                  )}
                </div>

                {result.anchor && (
                  <dl className="grid gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Hash</dt>
                      <dd className="font-mono break-all">{result.anchor.payloadHash}</dd>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <dt className="text-muted-foreground">Module</dt>
                        <dd><Badge variant="outline" className="font-mono text-[10px]">{result.anchor.resourceType}</Badge></dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Status</dt>
                        <dd>{result.anchor.status}</dd>
                      </div>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Recorded</dt>
                      <dd>{new Date(result.anchor.createdAt).toLocaleString('en-IN')}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Knuct chain</dt>
                      <dd>{result.anchor.chainPublished ? `Published (${result.anchor.knuctTxRef})` : 'Hash-only (pending chain publish)'}</dd>
                    </div>
                  </dl>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    }>
      <VerifyPageContent />
    </Suspense>
  );
}
