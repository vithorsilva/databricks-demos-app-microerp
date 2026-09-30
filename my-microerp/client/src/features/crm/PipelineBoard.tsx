import { useState } from 'react';
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { ErrorBanner, FieldLabel, Panel, StatusBadge } from '@/components/brand/index.js';
import { formatBRL } from '@/lib/format.js';
import { useBoard, useCompanies } from './hooks.js';
import { OpportunityDrawer } from './OpportunityDrawer.js';
import { WinDialog } from './WinDialog.js';
import { rotLevel, daysSince, ownerInitials } from './lib.js';
import type { Opportunity, Pipeline } from '@shared/crm/types.js';

export function PipelineBoard({ pipeline }: { pipeline: Pipeline }) {
  const { companies } = useCompanies();
  const {
    opportunities,
    loading,
    error,
    createOpportunity,
    updateOpportunity,
    winOpportunity,
    persistReorder,
    deleteOpportunity,
    reload,
  } = useBoard(pipeline.id);

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overStageId, setOverStageId] = useState<number | null>(null);
  const [overZone, setOverZone] = useState<'won' | 'lost' | null>(null);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [winTarget, setWinTarget] = useState<Opportunity | null>(null);

  const stages = [...pipeline.stages].sort((a, b) => a.position - b.position);
  const byStage = (stageId: number) =>
    opportunities.filter((o) => o.stage_id === stageId).sort((a, b) => a.sort_index - b.sort_index);

  const totalValue = (stageId: number) => byStage(stageId).reduce((sum, o) => sum + (o.amount ?? 0), 0);

  /** Recoloca o card arrastado no estágio destino (no fim) e persiste a ordem. */
  const dropOnStage = (targetStageId: number) => {
    if (draggingId === null) return;
    const dragged = opportunities.find((o) => o.id === draggingId);
    setDraggingId(null);
    setOverStageId(null);
    if (!dragged || dragged.stage_id === targetStageId) return;

    const targetStage = stages.find((s) => s.id === targetStageId);
    const moved: Opportunity = {
      ...dragged,
      stage_id: targetStageId,
      stage_name: targetStage?.name ?? dragged.stage_name,
      probability: targetStage?.probability ?? dragged.probability,
    };
    const others = opportunities.filter((o) => o.id !== draggingId);
    const next = [...others, moved];

    // Reindexa os estágios afetados (origem e destino).
    const affected = new Set([dragged.stage_id, targetStageId]);
    const items = next
      .filter((o) => affected.has(o.stage_id))
      .sort((a, b) => a.sort_index - b.sort_index)
      .map((o) => ({ id: o.id, stage_id: o.stage_id }));
    // sort_index sequencial por estágio
    const perStage: Record<number, number> = {};
    const payload = items.map((it) => {
      const idx = perStage[it.stage_id] ?? 0;
      perStage[it.stage_id] = idx + 1;
      return { ...it, sort_index: idx };
    });
    const withIdx = next.map((o) => {
      const p = payload.find((x) => x.id === o.id);
      return p ? { ...o, sort_index: p.sort_index } : o;
    });
    void persistReorder(withIdx, payload);
  };

  const dropOnZone = (zone: 'won' | 'lost') => {
    if (draggingId === null) return;
    const dragged = opportunities.find((o) => o.id === draggingId);
    setDraggingId(null);
    setOverZone(null);
    if (!dragged) return;
    if (zone === 'won') {
      setWinTarget(dragged); // abre o diálogo de parcelas
    } else {
      void updateOpportunity(dragged.id, { status: 'lost' });
    }
  };

  const openCard = (o: Opportunity) => {
    setSelected(o);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-5">
      <NewDealForm
        companies={companies}
        onCreate={(companyId, title, amount) => {
          void createOpportunity({ company_id: companyId, pipeline_id: pipeline.id, title, amount });
        }}
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {stages.map((s) => (
            <Skeleton key={s.id} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stages.map((stage) => {
              const items = byStage(stage.id);
              const isOver = overStageId === stage.id;
              return (
                <div
                  key={stage.id}
                  className={`flex w-72 shrink-0 flex-col border-t-[3px] border-t-dex-azul bg-dex-azul/[0.04] transition-colors ${
                    isOver ? 'outline-2 outline-dex-azul' : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStageId(stage.id);
                  }}
                  onDragLeave={() => setOverStageId((v) => (v === stage.id ? null : v))}
                  onDrop={() => dropOnStage(stage.id)}
                >
                  <div>
                    <div className="flex items-baseline justify-between px-3 pt-3 pb-1">
                      <h3 className="font-display text-sm font-bold tracking-[0.04em] text-dex-azul uppercase">{stage.name}</h3>
                      <span className="font-display text-xs font-semibold text-muted-foreground tabular-nums">{stage.probability}%</span>
                    </div>
                    <p className="px-3 pb-2 text-xs text-muted-foreground tabular-nums">
                      {items.length} {items.length === 1 ? 'negócio' : 'negócios'} · {formatBRL(totalValue(stage.id))}
                    </p>
                  </div>
                  <div className="flex-1 space-y-2 p-2">
                    {items.map((o) => (
                      <DealCard
                        key={o.id}
                        opp={o}
                        dragging={draggingId === o.id}
                        onDragStart={() => setDraggingId(o.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={() => openCard(o)}
                      />
                    ))}
                    {items.length === 0 && (
                      <p className="border border-dashed border-[#a6a6a6] px-1 py-4 text-center text-xs text-muted-foreground">Arraste cards aqui</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drop zones de fechamento (estilo barra inferior do Pipedrive) */}
          <div className="grid grid-cols-2 gap-3">
            <DropZone
              label="GANHO"
              tone="won"
              active={overZone === 'won'}
              onDragOver={(e) => {
                e.preventDefault();
                setOverZone('won');
              }}
              onDragLeave={() => setOverZone((v) => (v === 'won' ? null : v))}
              onDrop={() => dropOnZone('won')}
            />
            <DropZone
              label="PERDIDO"
              tone="lost"
              active={overZone === 'lost'}
              onDragOver={(e) => {
                e.preventDefault();
                setOverZone('lost');
              }}
              onDragLeave={() => setOverZone((v) => (v === 'lost' ? null : v))}
              onDrop={() => dropOnZone('lost')}
            />
          </div>
        </>
      )}

      <OpportunityDrawer
        opportunity={selected}
        pipeline={pipeline}
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o);
          if (!o) reload();
        }}
        onUpdate={updateOpportunity}
        onWin={(opp) => setWinTarget(opp)}
        onDelete={(id) => {
          void deleteOpportunity(id);
        }}
      />

      <WinDialog
        opportunity={winTarget}
        open={winTarget !== null}
        onOpenChange={(o) => {
          if (!o) setWinTarget(null);
        }}
        onConfirm={winOpportunity}
      />
    </div>
  );
}

function DealCard({
  opp,
  dragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  opp: Opportunity;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const rot = rotLevel(opp.stage_changed_at);
  const days = daysSince(opp.stage_changed_at);
  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`flex cursor-pointer flex-col gap-1.5 border bg-card px-3.5 py-3 transition-[opacity,border-color] ${
        dragging ? 'opacity-40' : 'hover:border-dex-azul'
      }`}
    >
      <p className="font-display text-[15px] leading-tight font-semibold text-dex-marinho">{opp.title}</p>
      <p className="text-xs text-muted-foreground">{opp.company_name}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-display text-base font-semibold text-dex-azul tabular-nums">
          {opp.amount != null ? formatBRL(opp.amount) : '—'}
        </span>
        <div className="flex items-center gap-1.5">
          {rot !== 'fresh' && (
            <StatusBadge tone={rot === 'danger' ? 'alert' : 'neutral'} className="h-5 px-1.5 text-[11px]">
              <span title={`Parado há ${days} dias`}>{days}d</span>
            </StatusBadge>
          )}
          <span
            className="flex size-6 items-center justify-center bg-dex-tint font-display text-[11px] font-bold text-dex-azul"
            title={opp.owner ?? 'Sem responsável'}
          >
            {ownerInitials(opp.owner)}
          </span>
        </div>
      </div>
    </div>
  );
}

function DropZone({
  label,
  tone,
  active,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: string;
  tone: 'won' | 'lost';
  active: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
}) {
  const c = tone === 'won' ? 'var(--dex-azul)' : 'var(--dex-magenta)';
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="flex items-center justify-center border-2 border-dashed py-4 font-display text-sm font-bold tracking-[0.08em] uppercase transition-colors"
      style={{
        borderColor: c,
        color: c,
        background: active ? `color-mix(in srgb, ${c} 10%, transparent)` : 'transparent',
      }}
    >
      {label}
    </div>
  );
}

function NewDealForm({
  companies,
  onCreate,
}: {
  companies: { id: number; name: string }[];
  onCreate: (companyId: number, title: string, amount?: number) => void;
}) {
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState<number | undefined>();
  const [amount, setAmount] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || companyId === undefined) return;
    const amt = parseFloat(amount.replace(',', '.'));
    onCreate(companyId, title.trim(), Number.isFinite(amt) && amt > 0 ? amt : undefined);
    setTitle('');
    setAmount('');
  };

  return (
    <Panel title="Nova oportunidade">
      <form
        onSubmit={submit}
        className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_260px_160px_auto]"
      >
        <FieldLabel label="Título">
          <Input placeholder="Ex.: Migração do DW para Databricks" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Empresa">
          <Select value={companyId?.toString() ?? ''} onValueChange={(v) => setCompanyId(Number(v))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldLabel>
        <FieldLabel label="Valor (R$)">
          <Input placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </FieldLabel>
        <Button type="submit" className="justify-self-start" disabled={!title.trim() || companyId === undefined}>
          Adicionar
        </Button>
      </form>
    </Panel>
  );
}
