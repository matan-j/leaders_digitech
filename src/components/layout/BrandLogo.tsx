import React from 'react';
import { cn } from '@/lib/utils';
import { useDisplayLogo } from '@/hooks/useDisplayLogo';

type Variant = 'header' | 'auth' | 'compact';

interface BrandLogoProps {
  variant?: Variant;
  className?: string;
  /** Override the URL (used by Auth/ResetPassword which load before query client is ready). */
  src?: string;
}

const VARIANTS: Record<Variant, { img: string; title: string; sub: string; text: string }> = {
  header:  { img: 'h-12 w-auto max-w-[180px]', title: 'text-lg',  sub: 'text-[11px]', text: 'text-white' },
  compact: { img: 'h-10 w-auto max-w-[140px]', title: 'text-sm',  sub: 'text-[10px]', text: 'text-white' },
  auth:    { img: 'h-16 w-auto max-w-[220px]', title: 'text-2xl', sub: 'text-sm',     text: 'text-foreground' },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'header', className, src }) => {
  const settingsLogo = useDisplayLogo();
  const logoSrc = src ?? settingsLogo;
  const cfg = VARIANTS[variant];

  return (
    <div className={cn('flex items-center gap-3 select-none', className)}>
      <img
        src={logoSrc}
        alt="Leader App by Digitech"
        className={cn(cfg.img, 'object-contain drop-shadow-sm')}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
      <div className={cn('flex flex-col leading-tight', cfg.text)}>
        <span className={cn(cfg.title, 'font-bold tracking-tight')}>Leader App</span>
        <span className={cn(cfg.sub, 'opacity-80 font-medium')}>by Digitech</span>
      </div>
    </div>
  );
};

export default BrandLogo;
