import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.js';

/** TitleTab — aba azul inclinada a 14° com lasca ciano; cabeçalho de painel da marca. */
export function TitleTab({ children, as: Tag = 'h2' }: { children: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <div className="flex items-center">
      <Tag
        className="flex h-9 items-center bg-dex-azul pr-7 pl-4 font-display text-lg font-normal text-white"
        style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 9px) 100%, 0 100%)' }}
      >
        {children}
      </Tag>
      <span
        aria-hidden="true"
        className="-ml-[9px] h-9 w-[17px] bg-dex-ciano"
        style={{ clipPath: 'polygon(12px 0, 17px 0, 8px 100%, 3px 100%)' }}
      />
    </div>
  );
}

const BAR_CLIP = 'polygon(5px 0, 12px 0, 7px 100%, 0 100%)';

/** BrandBars — a marca de barras (azul, azul, vermelho). `inverse` para fundo azul. */
export function BrandBars({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  const base = inverse ? 'bg-white' : 'bg-dex-azul';
  return (
    <div aria-hidden="true" className={cn('flex gap-[3px]', className)}>
      <span className={cn('h-[22px] w-3', base)} style={{ clipPath: BAR_CLIP }} />
      <span className={cn('h-[22px] w-3', base)} style={{ clipPath: BAR_CLIP }} />
      <span className="h-[22px] w-3 bg-dex-vermelho" style={{ clipPath: BAR_CLIP }} />
    </div>
  );
}

/** FooterStripe — faixa de rodapé da marca: hachura → barra longa → segmento vermelho. */
export function FooterStripe({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex h-2 w-full gap-1', className)}>
      <span
        className="w-24 shrink-0 md:w-44"
        style={{ background: 'repeating-linear-gradient(-76deg, var(--dex-vermelho) 0 2px, transparent 2px 7px)' }}
      />
      <span
        className="flex-1 bg-dex-azul"
        style={{ clipPath: 'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)' }}
      />
      <span
        className="w-16 shrink-0 bg-dex-vermelho md:w-28"
        style={{ clipPath: 'polygon(2px 0, 100% 0, 100% 100%, 0 100%)' }}
      />
    </div>
  );
}
