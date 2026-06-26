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
import { Trophy, X, Clock, Plus } from 'lucide-react';
import { formatBRL } from '@/lib/format.js';
import { useBoard, useCompanies } from './hooks.js';
import { OpportunityDrawer } from './OpportunityDrawer.js';
import { stageColor, rotLevel, daysSince, ownerInitials } from './lib.js';
import type { Opportunity, Pipeline } from '@shared/crm/types.js';

function ErrorBanner({ message }: { message: string }) {
  return <div className="text-destructive bg-destructive/10 p-3 rounded-md">{message}</div>;
}

export function PipelineBoard({ pipeline }: { pipeline: Pipeline }) {
  const { companies } = useCompanies();
  const {
    opportunities,
    loading,
    error,
    createOpportunity,
    updateOpportunity,
    persistReorder,
    deleteOpportunity,
    reload,
  } = useBoard(pipeline.id);

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overStageId, setOverStageId] = useState<number | null>(null);
  const [overZone, setOverZone] = useState<'won' | 'lost' | null>(null);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    const id = draggingId;
    setDraggingId(null);
    setOverZone(null);
    void updateOpportunity(id, { status: zone });
  };

  const openCard = (o: Opportunity) => {
    setSelected(o);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-4 pt-4">
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
                  className={`flex w-72 shrink-0 flex-col rounded-md border bg-muted/40 transition-colors ${
                    isOver ? 'ring-2 ring-primary' : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStageId(stage.id);
                  }}
                  onDragLeave={() => setOverStageId((v) => (v === stage.id ? null : v))}
                  onDrop={() => dropOnStage(stage.id)}
                >
                  <div className="rounded-t-md" style={{ borderTop: `3px solid ${stageColor(stage.position)}` }}>
                    <div className="flex items-baseline justify-between px-3 py-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide">{stage.name}</h3>
                      <span className="text-[11px] text-muted-foreground">{stage.probability}%</span>
                    </div>
                    <p className="px-3 pb-2 text-[11px] text-muted-foreground tabular-nums">
                      {items.length} {items.length === 1 ? 'negócio' : 'negócios'} · {formatBRL(totalValue(stage.id))}
                    </p>
                  </div>
                  <div className="flex-1 space-y-2 p-2">
                    {items.map((o) => (
                      <DealCard
                        key={o.id}
                        opp={o}
                        color={stageColor(stage.position)}
                        dragging={draggingId === o.id}
                        onDragStart={() => setDraggingId(o.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={() => openCard(o)}
                      />
                    ))}
                    {items.length === 0 && (
                      <p className="px-1 py-3 text-center text-xs text-muted-foreground">Arraste cards aqui</p>
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
              tone="success"
              active={overZone === 'won'}
              icon={<Trophy className="h-4 w-4" />}
              onDragOver={(e) => {
                e.preventDefault();
                setOverZone('won');
              }}
              onDragLeave={() => setOverZone((v) => (v === 'won' ? null : v))}
              onDrop={() => dropOnZone('won')}
            />
            <DropZone
              label="PERDIDO"
              tone="destructive"
              active={overZone === 'lost'}
              icon={<X className="h-4 w-4" />}
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
        onDelete={(id) => {
          void deleteOpportunity(id);
        }}
      />
    </div>
  );
}

function DealCard({
  opp,
  color,
  dragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  opp: Opportunity;
  color: string;
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
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`cursor-pointer rounded-md border bg-card p-2 shadow-[var(--shadow-card)] transition-opacity ${
        dragging ? 'opacity-40' : 'hover:border-[var(--dex-red)]'
      }`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <p className="text-sm font-medium leading-tight">{opp.title}</p>
      <p className="text-xs text-muted-foreground">{opp.company_name}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold tabular-nums">{opp.amount != null ? formatBRL(opp.amount) : '—'}</span>
        <div className="flex items-center gap-1.5">
          {rot !== 'fresh' && (
            <span
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium"
              style={{
                background: rot === 'danger' ? 'var(--destructive)' : 'var(--warning)',
                color: rot === 'danger' ? 'var(--destructive-foreground)' : 'var(--warning-foreground)',
              }}
              title={`Parado há ${days} dias`}
            >
              <Clock className="h-2.5 w-2.5" /> {days}d
            </span>
          )}
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground"
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
  icon,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: string;
  tone: 'success' | 'destructive';
  active: boolean;
  icon: React.ReactNode;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
}) {
  const c = tone === 'success' ? 'var(--success)' : 'var(--destructive)';
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed py-4 text-sm font-semibold uppercase tracking-wide transition-colors"
      style={{
        borderColor: c,
        color: c,
        background: active ? `color-mix(in srgb, ${c} 12%, transparent)` : 'transparent',
      }}
    >
      {icon} {label}
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
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <Input
        placeholder="Título da oportunidade"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="min-w-48 flex-1"
      />
      <Select value={companyId?.toString() ?? ''} onValueChange={(v) => setCompanyId(Number(v))}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Empresa" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id.toString()}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Valor (R$)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-36"
        inputMode="decimal"
      />
      <Button type="submit" disabled={!title.trim() || companyId === undefined}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar
      </Button>
    </form>
  );
}
