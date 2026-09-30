import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Input,
  Button,
} from '@databricks/appkit-ui/react';
import { FieldLabel, TextAction } from '@/components/brand/index.js';
import { formatBRL } from '@/lib/format.js';
import type { Opportunity, WinOpportunityBody } from '@shared/crm/types.js';

type Row = { id: number; amount: string; due_date: string };

let rowSeq = 0;
const nextRowId = () => ++rowSeq;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayPlusISO(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function addMonthsISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const daysInMonth = new Date(ny, nm, 0).getDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth))}`;
}

function parseAmount(s: string): number {
  const v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
}

export function WinDialog({
  opportunity,
  open,
  onOpenChange,
  onConfirm,
}: {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: number, body: WinOpportunityBody) => Promise<Opportunity | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {opportunity && (
          <WinForm
            key={opportunity.id}
            opportunity={opportunity}
            onConfirm={onConfirm}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WinForm({
  opportunity,
  onConfirm,
  onClose,
}: {
  opportunity: Opportunity;
  onConfirm: (id: number, body: WinOpportunityBody) => Promise<Opportunity | null>;
  onClose: () => void;
}) {
  const firstDue = opportunity.expected_close ?? todayPlusISO(30);
  const baseAmount = opportunity.amount != null ? String(opportunity.amount).replace('.', ',') : '';

  const [total, setTotal] = useState(baseAmount);
  const [count, setCount] = useState('1');
  const [rows, setRows] = useState<Row[]>([
    { id: nextRowId(), amount: baseAmount, due_date: firstDue },
  ]);
  const [saving, setSaving] = useState(false);

  const generate = () => {
    const n = Math.max(1, Math.floor(Number(count) || 1));
    const t = parseAmount(total);
    const valid = Number.isFinite(t) && t > 0;
    const cents = valid ? Math.round(t * 100) : 0;
    const base = valid ? Math.floor(cents / n) : 0;
    const remainder = valid ? cents - base * n : 0;
    const next: Row[] = Array.from({ length: n }, (_, i) => {
      const c = base + (i === n - 1 ? remainder : 0);
      return {
        id: nextRowId(),
        amount: valid ? String(c / 100).replace('.', ',') : '',
        due_date: addMonthsISO(firstDue, i),
      };
    });
    setRows(next);
  };

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { id: nextRowId(), amount: '', due_date: addMonthsISO(prev[prev.length - 1]?.due_date ?? firstDue, 1) },
    ]);
  const removeRow = (id: number) => setRows((prev) => prev.filter((r) => r.id !== id));

  const parsed = rows.map((r) => ({ amount: parseAmount(r.amount), due_date: r.due_date }));
  const sum = parsed.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0);
  const allValid =
    rows.length > 0 &&
    parsed.every((r) => Number.isFinite(r.amount) && r.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.due_date));
  const canConfirm = allValid && sum > 0;

  const confirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    const result = await onConfirm(opportunity.id, {
      installments: parsed.map((r) => ({ amount: r.amount, due_date: r.due_date })),
    });
    setSaving(false);
    if (result) onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Marcar como ganha</DialogTitle>
        <DialogDescription>
          {opportunity.title} · {opportunity.company_name}. Defina as parcelas do contas a receber.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="flex items-end gap-2">
          <FieldLabel label="Valor total (R$)" className="flex-1">
            <Input value={total} inputMode="decimal" onChange={(e) => setTotal(e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Parcelas" className="w-24">
            <Input value={count} inputMode="numeric" onChange={(e) => setCount(e.target.value)} />
          </FieldLabel>
          <Button type="button" variant="outline" onClick={generate}>
            Gerar
          </Button>
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => {
            const amt = parsed[i].amount;
            const invalid = !Number.isFinite(amt) || amt <= 0;
            return (
              <div key={r.id} className="flex items-center gap-2">
                <span className="w-6 font-display text-sm font-semibold text-dex-azul tabular-nums">{i + 1}.</span>
                <Input
                  value={r.amount}
                  inputMode="decimal"
                  placeholder="Valor"
                  onChange={(e) => updateRow(r.id, { amount: e.target.value })}
                  aria-invalid={invalid}
                  aria-label={`Valor da parcela ${i + 1}`}
                  className="w-32"
                />
                <Input
                  type="date"
                  value={r.due_date}
                  onChange={(e) => updateRow(r.id, { due_date: e.target.value })}
                  aria-label={`Vencimento da parcela ${i + 1}`}
                  className="flex-1"
                />
                <TextAction tone="muted" onClick={() => removeRow(r.id)} disabled={rows.length <= 1}>
                  Remover
                </TextAction>
              </div>
            );
          })}
          <TextAction className="px-0" onClick={addRow}>
            Adicionar parcela
          </TextAction>
        </div>

        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">Total das parcelas</span>
          <span className="font-display text-base font-semibold text-dex-azul tabular-nums">{formatBRL(sum)}</span>
        </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
        <Button
          onClick={() => {
            void confirm();
          }}
          disabled={!canConfirm || saving}
        >
          {saving ? 'Salvando...' : 'Confirmar ganho'}
        </Button>
      </DialogFooter>
    </>
  );
}
