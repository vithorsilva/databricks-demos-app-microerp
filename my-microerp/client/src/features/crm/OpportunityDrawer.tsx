import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Input,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Separator,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { FieldLabel, StatusBadge, TextAction } from '@/components/brand/index.js';
import { useActivities } from './hooks.js';
import { ACTIVITY_META } from './lib.js';
import type { Opportunity, Pipeline, ActivityType, UpdateOpportunityBody } from '@shared/crm/types.js';

export function OpportunityDrawer({
  opportunity,
  pipeline,
  open,
  onOpenChange,
  onUpdate,
  onWin,
  onDelete,
}: {
  opportunity: Opportunity | null;
  pipeline: Pipeline | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: number, body: UpdateOpportunityBody) => Promise<Opportunity | null>;
  onWin: (opp: Opportunity) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {opportunity && (
          <DealEditor
            key={opportunity.id}
            opportunity={opportunity}
            pipeline={pipeline}
            onUpdate={onUpdate}
            onWin={onWin}
            onDelete={onDelete}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DealEditor({
  opportunity,
  pipeline,
  onUpdate,
  onWin,
  onDelete,
  onClose,
}: {
  opportunity: Opportunity;
  pipeline: Pipeline | undefined;
  onUpdate: (id: number, body: UpdateOpportunityBody) => Promise<Opportunity | null>;
  onWin: (opp: Opportunity) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(opportunity.title);
  const [amount, setAmount] = useState(opportunity.amount != null ? String(opportunity.amount) : '');
  const [owner, setOwner] = useState(opportunity.owner ?? '');
  const [expectedClose, setExpectedClose] = useState(opportunity.expected_close ?? '');
  const [stageId, setStageId] = useState<number>(opportunity.stage_id);
  const [losing, setLosing] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const amt = parseFloat(amount.replace(',', '.'));
    await onUpdate(opportunity.id, {
      title: title.trim() || undefined,
      amount: Number.isFinite(amt) && amt > 0 ? amt : undefined,
      owner: owner.trim() || undefined,
      expected_close: expectedClose || undefined,
      stage_id: stageId,
    });
    setSaving(false);
  };

  const markWon = () => {
    onClose();
    onWin(opportunity);
  };

  const confirmLost = async () => {
    await onUpdate(opportunity.id, { status: 'lost', lost_reason: lostReason.trim() || undefined });
    onClose();
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-6">{opportunity.title}</SheetTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{opportunity.company_name}</span>
          <StatusBadge tone="brand">{opportunity.stage_name}</StatusBadge>
        </div>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-8">
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => {
              void markWon();
            }}
          >
            Marcar ganho
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setLosing((v) => !v)} aria-expanded={losing}>
            Marcar perdido
          </Button>
        </div>

        {losing && (
          <div className="space-y-3 border border-dex-magenta bg-dex-magenta/6 p-4">
            <FieldLabel label="Motivo da perda">
              <Input
                placeholder="Ex.: preço, concorrente, sem orçamento..."
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
              />
            </FieldLabel>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                void confirmLost();
              }}
            >
              Confirmar perda
            </Button>
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <Field label="Título">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <Input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Previsão">
              <Input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} />
            </Field>
          </div>
          <Field label="Responsável">
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Nome do vendedor" />
          </Field>
          <Field label="Estágio">
            <Select value={stageId.toString()} onValueChange={(v) => setStageId(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(pipeline?.stages ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name} · {s.probability}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            onClick={() => {
              void handleSave();
            }}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>

        <Separator />

        <ActivitiesTimeline opportunityId={opportunity.id} />

        <Separator />
        <TextAction
          tone="muted"
          className="px-0"
          onClick={() => {
            onDelete(opportunity.id);
            onClose();
          }}
        >
          Excluir oportunidade
        </TextAction>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <FieldLabel label={label}>{children}</FieldLabel>;
}

function ActivitiesTimeline({ opportunityId }: { opportunityId: number }) {
  const { activities, loading, createActivity, toggleActivity, deleteActivity } = useActivities(opportunityId);
  const [type, setType] = useState<ActivityType>('task');
  const [subject, setSubject] = useState('');

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    void createActivity({ opportunity_id: opportunityId, type, subject: subject.trim() });
    setSubject('');
  };

  return (
    <div className="space-y-3">
      <h4 className="font-display text-base font-semibold text-dex-azul">Atividades</h4>
      <form onSubmit={add} className="flex items-end gap-2">
        <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ACTIVITY_META) as ActivityType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {ACTIVITY_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1" />
        <Button type="submit" disabled={!subject.trim()}>
          Adicionar
        </Button>
      </form>

      {loading && <Skeleton className="h-10 w-full" />}
      {!loading && activities.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma atividade registrada.</p>
      )}
      <ul className="space-y-2">
        {activities.map((a) => (
          <li key={a.id} className="flex items-start gap-3 border bg-card px-3 py-2.5 text-sm">
            <span className="mt-0.5 w-16 shrink-0 font-display text-[11px] font-bold tracking-[0.06em] text-dex-azul uppercase">
              {ACTIVITY_META[a.type].label}
            </span>
            <p className={`min-w-0 flex-1 ${a.done ? 'text-muted-foreground line-through' : 'font-medium'}`}>{a.subject}</p>
            <div className="flex shrink-0 items-center">
              <TextAction
                className="min-h-0 py-0.5"
                onClick={() => {
                  void toggleActivity(a.id, !a.done);
                }}
              >
                {a.done ? 'Reabrir' : 'Concluir'}
              </TextAction>
              <TextAction
                tone="muted"
                className="min-h-0 py-0.5"
                onClick={() => {
                  void deleteActivity(a.id);
                }}
              >
                Excluir
              </TextAction>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
