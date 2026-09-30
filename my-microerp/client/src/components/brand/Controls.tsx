import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils.js';

/**
 * Segmented — filtro de opções exclusivas (ex.: status). Segmentos retos colados;
 * o ativo é preenchido em dex-azul. Usa aria-pressed para leitores de tela.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-10 border px-4 font-display text-sm font-semibold transition-colors',
              i > 0 && '-ml-px',
              active
                ? 'relative z-10 border-dex-azul bg-dex-azul text-white'
                : 'border-border bg-card text-dex-marinho hover:bg-dex-tint',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * TextAction — ação de linha em texto (a marca não usa ícones de terceiros).
 * `tone="muted"` para ações secundárias/destrutivas; `danger` fica magenta no hover.
 */
export function TextAction({
  tone = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'muted' }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-9 items-center px-2 font-display text-sm font-semibold underline decoration-1 underline-offset-[3px] transition-colors disabled:pointer-events-none disabled:opacity-50',
        tone === 'primary' ? 'text-dex-azul hover:text-dex-marinho' : 'text-muted-foreground hover:text-dex-magenta',
        className,
      )}
      {...props}
    />
  );
}
