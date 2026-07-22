'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyPage() {
  const router = useRouter();

  useEffect(() => {
    const search = window.location.search;
    router.replace(`/knuct/verify${search}`);
  }, [router]);

  return null;
}
