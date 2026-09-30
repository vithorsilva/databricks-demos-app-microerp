import { cn } from '@/lib/utils.js';

/**
 * KpiCard — indicador da marca DEX: superfície plana, barra superior dex-azul
 * (dex-vermelho em `highlight`, para indicadores que pedem atenção) e valor em Barlow.
 */
export function KpiCard({
  label,
  value,
  hint,
  highlight = false,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border border-t-4 bg-card px-5 py-4',
        highlight ? 'border-t-dex-vermelho' : 'border-t-dex-azul',
        className,
      )}
    >
      <p className="font-display text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          'font-display text-2xl leading-tight font-semibold tabular-nums md:text-[28px]',
          highlight ? 'text-dex-marinho' : 'text-dex-azul',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
