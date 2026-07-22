import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export default function KnuctLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-background">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/knuct" className="flex items-center gap-2 font-semibold text-brand">
            <BrandLogo size="sm" />
            <span>Knuct Console</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/knuct/verify" className="hover:text-foreground">
              Verify
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Campus ATMS
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
