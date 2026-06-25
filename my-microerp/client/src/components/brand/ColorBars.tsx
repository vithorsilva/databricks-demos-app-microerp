import { cn } from '@/lib/utils.js';

/**
 * ColorBars — assinatura de rodapé da marca DEX.
 * Faixas: vermelho · azul · branco · azul · vermelho.
 */
const BARS = [
  { id: 'red-l', color: 'var(--dex-red)' },
  { id: 'blue-l', color: 'var(--dex-blue)' },
  { id: 'white', color: '#ffffff' },
  { id: 'blue-r', color: 'var(--dex-blue)' },
  { id: 'red-r', color: 'var(--dex-red)' },
];

export function ColorBars({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex h-1 w-full overflow-hidden', className)}>
      {BARS.map((bar) => (
        <span key={bar.id} className="flex-1" style={{ backgroundColor: bar.color }} />
      ))}
    </div>
  );
}
