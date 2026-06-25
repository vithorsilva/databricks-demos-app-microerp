import { Redline } from './Redline.js';

/**
 * PageHeader — cabeçalho padrão das páginas de módulo DEX.
 * A primeira palavra do título é renderizada em --dex-red (foco da marca),
 * precedida por uma Redline e seguida por um subtítulo opcional.
 */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const [first, ...rest] = title.split(' ');
  return (
    <header className="mb-6 space-y-2">
      <Redline />
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        <span style={{ color: 'var(--dex-red)' }}>{first}</span>
        {rest.length > 0 && ` ${rest.join(' ')}`}
      </h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
