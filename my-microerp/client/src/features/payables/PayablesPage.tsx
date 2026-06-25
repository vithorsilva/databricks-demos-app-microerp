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
import { usePayables } from './hooks.js';
import type { PayableStatus } from '@shared/payables/types.js';

const STATUS_BADGE: Record<PayableStatus, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-muted text-muted-foreground' },
  overdue: { label: 'Vencido', className: 'bg-destructive/10 text-destructive' },
  paid: { label: 'Pago', className: 'bg-[var(--success)]/10 text-[var(--success)]' },
};

const FILTERS: { value: 'all' | PayableStatus; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'paid', label: 'Pagos' },
];

export function PayablesPage() {
  const {
    items, summary, suppliers, filter, setFilter,
    loading, error, createPayable, settlePayable, deletePayable,
  } = usePayables();

  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount.replace(',', '.'));
    if (!description.trim() || supplierId === undefined || !(amt > 0) || !dueDate) return;
    void createPayable({
      supplier_id: supplierId,
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
      <PageHeader title="Contas a Pagar" subtitle="Títulos de fornecedores, baixas e indicadores." />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="A pagar" value={formatBRL(summary?.total_pending ?? 0)} />
        <KpiCard label="Vencido" value={formatBRL(summary?.total_overdue ?? 0)} highlight />
        <KpiCard label="Pago no mês" value={formatBRL(summary?.total_paid_month ?? 0)} />
        <KpiCard label="Títulos vencidos" value={String(summary?.count_overdue ?? 0)} highlight />
      </div>

      {/* Form novo título */}
      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2">
        <Select value={supplierId?.toString() ?? ''} onValueChange={(v) => setSupplierId(Number(v))}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
          <SelectContent>
            {suppliers.map((c) => (
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
        <p className="text-muted-foreground text-center py-8">Nenhum título a pagar. Cadastre um acima.</p>
      )}

      {!loading && items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => {
              const badge = STATUS_BADGE[p.status];
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.supplier_name}</TableCell>
                  <TableCell>{p.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(p.amount)}</TableCell>
                  <TableCell>{formatDateBR(p.due_date)}</TableCell>
                  <TableCell><Badge className={badge.className}>{badge.label}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {p.status !== 'paid' && (
                        <Button variant="ghost" size="sm" className="text-primary"
                          onClick={() => { void settlePayable(p.id); }} aria-label="Dar baixa">
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                        onClick={() => { void deletePayable(p.id); }} aria-label="Excluir">
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
