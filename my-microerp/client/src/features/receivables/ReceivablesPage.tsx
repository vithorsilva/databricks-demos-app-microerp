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
  Badge,
} from '@databricks/appkit-ui/react';
import { Trash2, Check } from 'lucide-react';
import { PageHeader, KpiCard } from '@/components/brand/index.js';
import { formatBRL, formatDateBR } from '@/lib/format.js';
import { useReceivables } from './hooks.js';
import type { ReceivableStatus } from '@shared/receivables/types.js';

const STATUS_BADGE: Record<ReceivableStatus, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-muted text-muted-foreground' },
  overdue: { label: 'Vencido', className: 'bg-destructive/10 text-destructive' },
  paid: { label: 'Pago', className: 'bg-[var(--success)]/10 text-[var(--success)]' },
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
    <div className="w-full max-w-5xl mx-auto">
      <PageHeader title="Contas a Receber" subtitle="Títulos de clientes, baixas e indicadores." />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="A receber" value={formatBRL(summary?.total_pending ?? 0)} />
        <KpiCard label="Vencido" value={formatBRL(summary?.total_overdue ?? 0)} highlight />
        <KpiCard label="Recebido no mês" value={formatBRL(summary?.total_received_month ?? 0)} />
        <KpiCard label="Títulos vencidos" value={String(summary?.count_overdue ?? 0)} highlight />
      </div>

      {/* Form novo título */}
      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2">
        <Select value={customerId?.toString() ?? ''} onValueChange={(v) => setCustomerId(Number(v))}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} className="flex-1 min-w-48" />
        <Input placeholder="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32" inputMode="decimal" />
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-44" />
        <Button type="submit">Adicionar</Button>
      </form>

      {/* Filtro */}
      <div className="mb-4 flex gap-1">
        {FILTERS.map((f) => (
          <Button key={f.value} variant={filter === f.value ? 'default' : 'outline'} size="sm"
            onClick={() => setFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      {error && <div className="text-destructive bg-destructive/10 p-3 rounded-md mb-4">{error}</div>}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={`sk-${i}`} className="h-10 w-full" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Nenhum título a receber. Cadastre um acima.</p>
      )}

      {!loading && items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => {
              const badge = STATUS_BADGE[r.status];
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.customer_name}</TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(r.amount)}</TableCell>
                  <TableCell>{formatDateBR(r.due_date)}</TableCell>
                  <TableCell><Badge className={badge.className}>{badge.label}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {r.status !== 'paid' && (
                        <Button variant="ghost" size="sm" className="text-primary"
                          onClick={() => { void settleReceivable(r.id); }} aria-label="Dar baixa">
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                        onClick={() => { void deleteReceivable(r.id); }} aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
