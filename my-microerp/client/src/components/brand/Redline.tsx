import { cn } from '@/lib/utils.js';

/**
 * Redline — barra de acento da marca DEX (56×4px, raio 2px, --dex-red).
 * Sempre posicionada antes de um título de página ou section-tag.
 */
export function Redline({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block h-1 w-14 rounded-[2px]', className)}
      style={{ backgroundColor: 'var(--dex-red)' }}
    />
  );
}
