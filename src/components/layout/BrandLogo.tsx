import React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'header' | 'auth' | 'compact';

interface BrandLogoProps {
  variant?: Variant;
  className?: string;
}

const VARIANTS: Record<Variant, { img: string; title: string; sub: string; text: string }> = {
  header:  { img: 'h-8 w-8',   title: 'text-base', sub: 'text-[10px]', text: 'text-white' },
  compact: { img: 'h-7 w-7',   title: 'text-sm',   sub: 'text-[10px]', text: 'text-white' },
  auth:    { img: 'h-14 w-14', title: 'text-2xl',  sub: 'text-sm',     text: 'text-foreground' },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'header', className }) => {
  const cfg = VARIANTS[variant];
  return (
    <div className={cn('flex items-center gap-2 select-none', className)}>
      <img
        src="/logoReg.png"
        alt="Leader App by Digitech"
        className={cn(cfg.img, 'object-contain')}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
      <div className={cn('flex flex-col leading-tight', cfg.text)}>
        <span className={cn(cfg.title, 'font-semibold tracking-tight')}>Leader App</span>
        <span className={cn(cfg.sub, 'opacity-80')}>by Digitech</span>
      </div>
    </div>
  );
};

export default BrandLogo;
