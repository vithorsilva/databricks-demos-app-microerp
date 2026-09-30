import { useState } from 'react';
import {
  Button,
  Input,
  Skeleton,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@databricks/appkit-ui/react';
import {
  PageHeader,
  KpiCard,
  Panel,
  FieldLabel,
  ErrorBanner,
  EmptyState,
  StatusBadge,
  Segmented,
  TextAction,
  type StatusTone,
} from '@/components/brand/index.js';
import { formatBRL, formatDateBR } from '@/lib/format.js';
import { useReceivables } from './hooks.js';
import type { ReceivableStatus } from '@shared/receivables/types.js';

const STATUS_BADGE: Record<ReceivableStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'Pendente', tone: 'neutral' },
  overdue: { label: 'Vencido', tone: 'alert' },
  paid: { label: 'Pago', tone: 'brand' },
};

const FILTERS: { value: 'all' | ReceivableStatus; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'paid', label: 'Pagos' },
];

export function ReceivablesPage() {
  const {
    items, summary, customers, filter, setFilter,
    loading, error, createReceivable, settleReceivable, deleteReceivable,
  } = useReceivables();

  const [customerId, setCustomerId] = useState<number | undefined>();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount.replace(',', '.'));
    if (!description.trim() || customerId === undefined || !(amt > 0) || !dueDate) return;
    void createReceivable({
      customer_id: customerId,
      description: description.trim(),
      amount: amt,
      due_date: dueDate,
    });
    setDescription('');
    setAmount('');
    setDueDate('');
  };

  return (
    <div className="space-y-7">
      <PageHeader title="Contas a Receber" subtitle="Títulos de clientes, baixas e indicadores." />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="A receber" value={formatBRL(summary?.total_pending ?? 0)} />
        <KpiCard label="Vencido" value={formatBRL(summary?.total_overdue ?? 0)} highlight />
        <KpiCard label="Recebido no mês" value={formatBRL(summary?.total_received_month ?? 0)} />
        <KpiCard label="Títulos vencidos" value={String(summary?.count_overdue ?? 0)} highlight />
      </div>

      {/* Form novo título */}
      <Panel title="Novo título">
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-[240px_minmax(0,1fr)_150px_170px_auto]"
        >
          <FieldLabel label="Cliente">
            <Select value={customerId?.toString() ?? ''} onValueChange={(v) => setCustomerId(Number(v))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldLabel>
          <FieldLabel label="Descrição">
            <Input placeholder="Ex.: Parcela 2/3 do projeto" value={description} onChange={(e) => setDescription(e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Valor (R$)">
            <Input placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </FieldLabel>
          <FieldLabel label="Vencimento">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </FieldLabel>
          <Button type="submit" className="h-9 justify-self-start">Adicionar</Button>
        </form>
      </Panel>

      <section className="space-y-4">
        {/* Filtro */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented label="Filtrar por status" options={FILTERS} value={filter} onChange={setFilter} />
          {!loading && (
            <span className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? 'título' : 'títulos'}
            </span>
          )}
        </div>

        {error && <ErrorBanner message={error} />}

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={`sk-${i}`} className="h-12 w-full" />)}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            title="Nenhum título a receber"
            hint="Cadastre um título no formulário acima ou ganhe uma oportunidade no CRM."
          />
        )}

        {!loading && items.length > 0 && (
          <div className="border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => {
                  const badge = STATUS_BADGE[r.status];
                  return (
                    <TableRow key={r.id} className="h-14">
                      <TableCell className="pl-4 font-semibold">{r.customer_name}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="text-right font-display text-[15px] font-semibold text-dex-marinho tabular-nums">
                        {formatBRL(r.amount)}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatDateBR(r.due_date)}</TableCell>
                      <TableCell><StatusBadge tone={badge.tone}>{badge.label}</StatusBadge></TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          {r.status !== 'paid' && (
                            <TextAction onClick={() => { void settleReceivable(r.id); }}>Dar baixa</TextAction>
                          )}
                          <TextAction tone="muted" onClick={() => { void deleteReceivable(r.id); }}>Excluir</TextAction>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
