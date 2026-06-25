/** Formatação BRL e datas — usada apenas na UI (a API trafega number/ISO). */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(value: number): string {
  return brl.format(value);
}

/** Converte 'YYYY-MM-DD' para 'DD/MM/AAAA' sem aplicar timezone. */
export function formatDateBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
