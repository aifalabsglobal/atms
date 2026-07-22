'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    const search = window.location.search;
    router.replace(`/knuct/register${search}`);
  }, [router]);

  return null;
}
