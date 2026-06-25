import { useState } from 'react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
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
import { Trash2, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/brand/index.js';
import { formatBRL } from '@/lib/format.js';
import { useCompanies, useContacts, useOpportunities } from './hooks.js';
import type { CompanyType, OpportunityStage } from '@shared/crm/types.js';

const TYPE_LABEL: Record<CompanyType, string> = {
  customer: 'Cliente',
  supplier: 'Fornecedor',
  both: 'Ambos',
};

const STAGES: { key: OpportunityStage; label: string }[] = [
  { key: 'lead', label: 'Lead' },
  { key: 'qualified', label: 'Qualificado' },
  { key: 'proposal', label: 'Proposta' },
  { key: 'won', label: 'Ganho' },
  { key: 'lost', label: 'Perdido' },
];

const NEXT_STAGE: Partial<Record<OpportunityStage, OpportunityStage>> = {
  lead: 'qualified',
  qualified: 'proposal',
  proposal: 'won',
};

function ErrorBanner({ message }: { message: string }) {
  return <div className="text-destructive bg-destructive/10 p-3 rounded-md mb-4">{message}</div>;
}

export function CrmPage() {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <PageHeader title="CRM corporativo" subtitle="Empresas, contatos e pipeline de oportunidades." />
      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>
        <TabsContent value="companies"><CompaniesSection /></TabsContent>
        <TabsContent value="contacts"><ContactsSection /></TabsContent>
        <TabsContent value="pipeline"><PipelineSection /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Empresas ───────────────────────────────────────────────
function CompaniesSection() {
  const { companies, loading, error, createCompany, deleteCompany } = useCompanies();
  const [name, setName] = useState('');
  const [type, setType] = useState<CompanyType>('customer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    void createCompany({
      name: name.trim(),
      type,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    }).finally(() => {
      setName('');
      setEmail('');
      setPhone('');
      setSubmitting(false);
    });
  };

  return (
    <div className="space-y-4 pt-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <Input placeholder="Nome da empresa" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-48" />
        <Select value={type} onValueChange={(v) => setType(v as CompanyType)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Cliente</SelectItem>
            <SelectItem value="supplier">Fornecedor</SelectItem>
            <SelectItem value="both">Ambos</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-48" />
        <Input placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-40" />
        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? 'Salvando...' : 'Adicionar'}
        </Button>
      </form>

      {error && <ErrorBanner message={error} />}

      {loading && <SkeletonRows />}

      {!loading && companies.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Nenhuma empresa cadastrada.</p>
      )}

      {!loading && companies.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="secondary">{TYPE_LABEL[c.type]}</Badge></TableCell>
                <TableCell>{c.email ?? '—'}</TableCell>
                <TableCell>{c.phone ?? '—'}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => { void deleteCompany(c.id); }}
                    className="text-muted-foreground hover:text-destructive" aria-label="Excluir empresa">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Contatos ───────────────────────────────────────────────
function ContactsSection() {
  const { companies, loading: loadingCompanies } = useCompanies();
  const [companyId, setCompanyId] = useState<number | undefined>();
  const { contacts, loading, error, createContact, deleteContact } = useContacts(companyId);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || companyId === undefined) return;
    void createContact({ company_id: companyId, name: name.trim(), role: role.trim() || undefined });
    setName('');
    setRole('');
  };

  return (
    <div className="space-y-4 pt-4">
      <Select value={companyId?.toString() ?? ''} onValueChange={(v) => setCompanyId(Number(v))} disabled={loadingCompanies}>
        <SelectTrigger className="w-72"><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {companyId === undefined && (
        <p className="text-muted-foreground text-center py-8">Selecione uma empresa para ver seus contatos.</p>
      )}

      {companyId !== undefined && (
        <>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
            <Input placeholder="Nome do contato" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-48" />
            <Input placeholder="Cargo" value={role} onChange={(e) => setRole(e.target.value)} className="w-48" />
            <Button type="submit" disabled={!name.trim()}>Adicionar</Button>
          </form>

          {error && <ErrorBanner message={error} />}
          {loading && <SkeletonRows />}

          {!loading && contacts.length === 0 && (
            <p className="text-muted-foreground text-center py-8">Nenhum contato nesta empresa.</p>
          )}

          {!loading && contacts.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.role ?? '—'}</TableCell>
                    <TableCell>{c.email ?? '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { void deleteContact(c.id); }}
                        className="text-muted-foreground hover:text-destructive" aria-label="Excluir contato">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}

// ── Pipeline ───────────────────────────────────────────────
function PipelineSection() {
  const { companies } = useCompanies();
  const { opportunities, loading, error, createOpportunity, updateOpportunity } = useOpportunities();
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState<number | undefined>();
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || companyId === undefined) return;
    const amt = parseFloat(amount.replace(',', '.'));
    void createOpportunity({
      company_id: companyId,
      title: title.trim(),
      amount: Number.isFinite(amt) && amt > 0 ? amt : undefined,
    });
    setTitle('');
    setAmount('');
  };

  return (
    <div className="space-y-4 pt-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <Input placeholder="Título da oportunidade" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 min-w-48" />
        <Select value={companyId?.toString() ?? ''} onValueChange={(v) => setCompanyId(Number(v))}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36" inputMode="decimal" />
        <Button type="submit" disabled={!title.trim() || companyId === undefined}>Adicionar</Button>
      </form>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <SkeletonRows />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {STAGES.map((stage) => {
            const items = opportunities.filter((o) => o.stage === stage.key);
            return (
              <div key={stage.key} className="rounded-md border bg-muted/40 p-2">
                <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {stage.label} · {items.length}
                </h3>
                <div className="space-y-2">
                  {items.map((o) => {
                    const next = NEXT_STAGE[o.stage];
                    return (
                      <div key={o.id} className="rounded-md border bg-card p-2 text-sm">
                        <p className="font-medium leading-tight">{o.title}</p>
                        <p className="text-xs text-muted-foreground">{o.company_name}</p>
                        {o.amount != null && <p className="text-xs tabular-nums">{formatBRL(o.amount)}</p>}
                        {next && (
                          <Button variant="ghost" size="sm" className="mt-1 h-6 px-1 text-xs text-primary"
                            onClick={() => { void updateOpportunity(o.id, { stage: next }); }}>
                            Avançar <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={`sk-${i}`} className="h-10 w-full" />
      ))}
    </div>
  );
}
