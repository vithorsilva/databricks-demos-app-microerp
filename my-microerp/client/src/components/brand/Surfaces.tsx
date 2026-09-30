import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.js';

/** Panel — superfície plana com borda fina e título opcional em Barlow. */
export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border bg-card p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg font-semibold text-dex-azul">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** FieldLabel — rótulo de campo: Barlow 700, caixa alta, dex-azul. Envolve o controle. */
export function FieldLabel({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="font-display text-xs font-bold tracking-[0.08em] text-dex-azul uppercase">{label}</span>
      {children}
    </label>
  );
}

/** ErrorBanner — estado de erro padrão (borda e fundo magenta, texto escuro). */
export function ErrorBanner({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      className={cn('border border-dex-magenta bg-dex-magenta/6 px-4 py-3 text-sm text-dex-texto', className)}
    >
      <span className="mr-2 font-display text-xs font-bold tracking-[0.08em] text-dex-magenta uppercase">Erro</span>
      {message}
    </div>
  );
}

/** EmptyState — estado vazio padrão: título curto + orientação do próximo passo. */
export function EmptyState({ title, hint, className }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-1 border border-dashed border-[#a6a6a6] px-6 py-10 text-center', className)}>
      <p className="font-display text-lg font-semibold text-dex-marinho">{title}</p>
      {hint && <p className="max-w-md text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
