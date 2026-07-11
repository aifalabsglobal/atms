import Image from 'next/image';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/branding';

const SIZES = {
  sm: { box: 'h-8 w-8', dimension: 32, padding: 'p-0.5' },
  md: { box: 'h-12 w-12', dimension: 48, padding: 'p-0.5' },
  lg: { box: 'h-16 w-16', dimension: 64, padding: 'p-1' },
  xl: { box: 'h-20 w-20', dimension: 80, padding: 'p-1' },
} as const;

type BrandLogoSize = keyof typeof SIZES;

export function BrandLogo({
  size = 'md',
  className,
  priority = false,
  src,
  alt,
}: {
  size?: BrandLogoSize;
  className?: string;
  priority?: boolean;
  src?: string;
  alt?: string;
}) {
  const config = SIZES[size];
  const imageSrc = src && src.startsWith('/') ? src : BRAND.logoSrc;
  const imageAlt = alt?.trim() || BRAND.logoAlt;

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-[#1A3C6E]/10 shadow-sm',
        config.box,
        className,
      )}
      style={{ ['--tw-ring-color' as string]: 'color-mix(in srgb, var(--brand-primary, #1A3C6E) 10%, transparent)' }}
    >
      <Image
        src={imageSrc}
        alt={imageAlt}
        width={config.dimension}
        height={config.dimension}
        className={cn('h-full w-full object-contain', config.padding)}
        priority={priority}
      />
    </div>
  );
}
