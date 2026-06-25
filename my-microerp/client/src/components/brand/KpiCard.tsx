import { cn } from '@/lib/utils.js';

/**
 * KpiCard — card de indicador da marca DEX.
 * Flat por padrão; no hover sobe 3px, ganha --shadow-card e borda --dex-red.
 * `highlight` aplica acento vermelho ao valor (usado em indicadores críticos,
 * ex.: nº de títulos vencidos).
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
        'group rounded-md border bg-card p-4 transition-all duration-150',
        'hover:-translate-y-[3px] hover:shadow-[var(--shadow-card)]',
        className,
      )}
      style={{ borderColor: 'var(--border)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--dex-red)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className="mt-1 text-2xl font-bold tabular-nums"
        style={{ color: highlight ? 'var(--dex-red)' : 'var(--foreground)' }}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
