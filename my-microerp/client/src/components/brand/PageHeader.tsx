import type { ReactNode } from 'react';

/**
 * PageHeader — título de página da marca DEX.
 * Barra vertical dex-vermelho + título Barlow 600 em dex-azul, subtítulo opcional
 * e um slot `actions` alinhado à direita (ex.: botão primário da página).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-8 w-1 shrink-0 bg-dex-vermelho" />
          <h1 className="font-display text-[28px] leading-tight font-semibold text-dex-azul md:text-[32px]">{title}</h1>
        </div>
        {subtitle && <p className="pl-4 text-base leading-snug text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}
