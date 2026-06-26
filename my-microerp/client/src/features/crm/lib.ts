import type { ActivityType } from '@shared/crm/types.js';

/** Paleta para a barra de cor das colunas/cards do funil (cicla por posição). */
export const STAGE_COLORS = ['#0d4a8b', '#1565b8', '#d99000', '#1d8a3e', '#7c3aed', '#ed1c24', '#6b7080'];

export function stageColor(position: number): string {
  return STAGE_COLORS[position % STAGE_COLORS.length];
}

/** Dias inteiros decorridos desde uma data ISO (timestamptz). */
export function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export type RotLevel = 'fresh' | 'warning' | 'danger';

/** Classificação de "deal apodrecendo" por tempo parado no estágio. */
export function rotLevel(stageChangedAt: string | null): RotLevel {
  const d = daysSince(stageChangedAt);
  if (d >= 30) return 'danger';
  if (d >= 14) return 'warning';
  return 'fresh';
}

export const ACTIVITY_META: Record<ActivityType, { label: string }> = {
  call: { label: 'Ligação' },
  email: { label: 'E-mail' },
  meeting: { label: 'Reunião' },
  task: { label: 'Tarefa' },
  note: { label: 'Nota' },
};

/** Iniciais do responsável para o avatar do card. */
export function ownerInitials(owner: string | null): string {
  if (!owner) return '—';
  const parts = owner.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '—';
}
