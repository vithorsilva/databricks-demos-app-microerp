import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Input,
  Button,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Separator,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { Trophy, X, Trash2, Check, Phone, Mail, Users, CheckSquare, StickyNote, Plus } from 'lucide-react';
import { useActivities } from './hooks.js';
import { ACTIVITY_META } from './lib.js';
import type { Opportunity, Pipeline, ActivityType, UpdateOpportunityBody } from '@shared/crm/types.js';

const ACTIVITY_ICON: Record<ActivityType, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  task: CheckSquare,
  note: StickyNote,
};

export function OpportunityDrawer({
  opportunity,
  pipeline,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: {
  opportunity: Opportunity | null;
  pipeline: Pipeline | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: number, body: UpdateOpportunityBody) => Promise<Opportunity | null>;
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
  onDelete,
  onClose,
}: {
  opportunity: Opportunity;
  pipeline: Pipeline | undefined;
  onUpdate: (id: number, body: UpdateOpportunityBody) => Promise<Opportunity | null>;
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

  const markWon = async () => {
    await onUpdate(opportunity.id, { status: 'won' });
    onClose();
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
          <Badge variant="secondary">{opportunity.stage_name}</Badge>
        </div>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-8">
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 text-white"
            style={{ background: 'var(--success)' }}
            onClick={() => {
              void markWon();
            }}
          >
            <Trophy className="mr-1 h-4 w-4" /> Ganho
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setLosing((v) => !v)}>
            <X className="mr-1 h-4 w-4" /> Perdido
          </Button>
        </div>

        {losing && (
          <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive">Motivo da perda</p>
            <Input
              placeholder="Ex.: preço, concorrente, sem orçamento..."
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            />
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
            size="sm"
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
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => {
            onDelete(opportunity.id);
            onClose();
          }}
        >
          <Trash2 className="mr-1 h-4 w-4" /> Excluir oportunidade
        </Button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
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
      <h4 className="text-sm font-semibold">Atividades</h4>
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
        <Button type="submit" size="icon" disabled={!subject.trim()} aria-label="Adicionar atividade">
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {loading && <Skeleton className="h-10 w-full" />}
      {!loading && activities.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma atividade registrada.</p>
      )}
      <ul className="space-y-2">
        {activities.map((a) => {
          const Icon = ACTIVITY_ICON[a.type];
          return (
            <li key={a.id} className="flex items-start gap-2 rounded-md border bg-card p-2 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className={a.done ? 'text-muted-foreground line-through' : 'font-medium'}>{a.subject}</p>
                <p className="text-xs text-muted-foreground">{ACTIVITY_META[a.type].label}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  void toggleActivity(a.id, !a.done);
                }}
                aria-label="Concluir atividade"
              >
                <Check className={`h-4 w-4 ${a.done ? 'text-[var(--success)]' : 'text-muted-foreground'}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  void deleteActivity(a.id);
                }}
                aria-label="Excluir atividade"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
