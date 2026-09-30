import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.js';

export type StatusTone = 'neutral' | 'alert' | 'brand' | 'dark';

/** Quadrado de cor + fundo suave por tom. O texto fica sempre em dex-marinho (contraste AA). */
const TONES: Record<StatusTone, { square: string; bg: string }> = {
  neutral: { square: 'bg-[#a6a6a6]', bg: 'bg-[#f2f2f2]' },
  alert: { square: 'bg-dex-vermelho', bg: 'bg-dex-vermelho/8' },
  brand: { square: 'bg-dex-azul', bg: 'bg-dex-azul/8' },
  dark: { square: 'bg-dex-marinho', bg: 'bg-[#f2f2f2]' },
};

/** StatusBadge — rótulo de status angular da marca DEX. */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-2 px-2.5 text-[13px] font-semibold whitespace-nowrap text-dex-marinho',
        t.bg,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-2 shrink-0', t.square)} />
      {children}
    </span>
  );
}
