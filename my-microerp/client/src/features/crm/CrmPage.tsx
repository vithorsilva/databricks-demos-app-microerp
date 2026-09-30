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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@databricks/appkit-ui/react';
import {
  PageHeader,
  Panel,
  FieldLabel,
  ErrorBanner,
  EmptyState,
  StatusBadge,
  TextAction,
  type StatusTone,
} from '@/components/brand/index.js';
import { useCompanies, useContacts, usePipelines } from './hooks.js';
import { PipelineBoard } from './PipelineBoard.js';
import { PipelineManager } from './PipelineManager.js';
import { CrmReports } from './CrmReports.js';
import { CompanyDrawer } from './CompanyDrawer.js';
import type { Company, CompanyType, Contact } from '@shared/crm/types.js';

const TYPE_META: Record<CompanyType, { label: string; tone: StatusTone }> = {
  customer: { label: 'Cliente', tone: 'brand' },
  supplier: { label: 'Fornecedor', tone: 'dark' },
  both: { label: 'Ambos', tone: 'neutral' },
};

export function CrmPage() {
  return (
    <>
      <PageHeader title="CRM corporativo" subtitle="Funil de vendas, relatórios, empresas e contatos." />
      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Funil</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <FunnelTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="companies">
          <CompaniesSection />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsSection />
        </TabsContent>
      </Tabs>
    </>
  );
}

function PipelineSelect({
  pipelines,
  currentId,
  setCurrentId,
  disabled,
}: {
  pipelines: { id: number; name: string }[];
  currentId: number | undefined;
  setCurrentId: (id: number) => void;
  disabled: boolean;
}) {
  return (
    <FieldLabel label="Funil" className="w-full sm:w-72">
      <Select value={currentId?.toString() ?? ''} onValueChange={(v) => setCurrentId(Number(v))} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione um funil" />
        </SelectTrigger>
        <SelectContent>
          {pipelines.map((p) => (
            <SelectItem key={p.id} value={p.id.toString()}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldLabel>
  );
}

// ── Funil ──────────────────────────────────────────────────
function FunnelTab() {
  const pm = usePipelines();
  const { pipelines, current, currentId, setCurrentId, loading, error } = pm;

  return (
    <div className="space-y-5 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PipelineSelect
          pipelines={pipelines}
          currentId={currentId}
          setCurrentId={setCurrentId}
          disabled={loading || pipelines.length === 0}
        />
        <PipelineManager
          current={current}
          createPipeline={(name) => {
            void pm.createPipeline(name);
          }}
          renamePipeline={(id, name) => {
            void pm.renamePipeline(id, name);
          }}
          deletePipeline={(id) => {
            void pm.deletePipeline(id);
          }}
          createStage={(b) => {
            void pm.createStage(b);
          }}
          updateStage={(id, b) => {
            void pm.updateStage(id, b);
          }}
          deleteStage={(id) => {
            void pm.deleteStage(id);
          }}
        />
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Skeleton className="h-64 w-full" />}
      {!loading && current && <PipelineBoard key={current.id} pipeline={current} />}
      {!loading && !current && (
        <EmptyState title="Nenhum funil configurado" hint="Crie um funil em “Gerenciar funil”." />
      )}
    </div>
  );
}

// ── Relatórios ─────────────────────────────────────────────
function ReportsTab() {
  const { pipelines, currentId, setCurrentId, loading } = usePipelines();
  return (
    <div className="space-y-5 pt-6">
      <PipelineSelect
        pipelines={pipelines}
        currentId={currentId}
        setCurrentId={setCurrentId}
        disabled={loading || pipelines.length === 0}
      />
      <CrmReports pipelineId={currentId} />
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
  const [selected, setSelected] = useState<Company | null>(null);

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
    <div className="space-y-5 pt-6">
      <Panel title="Nova empresa">
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_220px_170px_auto]"
        >
          <FieldLabel label="Nome">
            <Input placeholder="Nome da empresa" value={name} onChange={(e) => setName(e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Tipo">
            <Select value={type} onValueChange={(v) => setType(v as CompanyType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Cliente</SelectItem>
                <SelectItem value="supplier">Fornecedor</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </FieldLabel>
          <FieldLabel label="E-mail">
            <Input placeholder="contato@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Telefone">
            <Input placeholder="(27) 0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FieldLabel>
          <Button type="submit" className="justify-self-start" disabled={submitting || !name.trim()}>
            {submitting ? 'Salvando...' : 'Adicionar'}
          </Button>
        </form>
      </Panel>

      {error && <ErrorBanner message={error} />}

      {loading && <SkeletonRows />}

      {!loading && companies.length === 0 && (
        <EmptyState title="Nenhuma empresa cadastrada" hint="Cadastre clientes e fornecedores no formulário acima." />
      )}

      {!loading && companies.length > 0 && (
        <div className="border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id} className="h-14 cursor-pointer" onClick={() => setSelected(c)}>
                  <TableCell className="pl-4 font-semibold">{c.name}</TableCell>
                  <TableCell>
                    <StatusBadge tone={TYPE_META[c.type].tone}>{TYPE_META[c.type].label}</StatusBadge>
                  </TableCell>
                  <TableCell>{c.email ?? '—'}</TableCell>
                  <TableCell>{c.phone ?? '—'}</TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <TextAction
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(c);
                        }}
                      >
                        Histórico
                      </TextAction>
                      <TextAction
                        tone="muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteCompany(c.id);
                        }}
                      >
                        Excluir
                      </TextAction>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CompanyDrawer
        company={selected}
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      />
    </div>
  );
}

// ── Contatos ───────────────────────────────────────────────
function ContactsSection() {
  const { companies, loading: loadingCompanies } = useCompanies();
  const [companyId, setCompanyId] = useState<number | undefined>();
  const { contacts, loading, error, createContact, updateContact, deleteContact } = useContacts(companyId);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState<Contact | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || companyId === undefined) return;
    void createContact({
      company_id: companyId,
      name: name.trim(),
      role: role.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    }).then((created) => {
      if (created) {
        setName('');
        setRole('');
        setEmail('');
        setPhone('');
      }
    });
  };

  return (
    <div className="space-y-5 pt-6">
      <FieldLabel label="Empresa" className="w-full sm:w-80">
        <Select
          value={companyId?.toString() ?? ''}
          onValueChange={(v) => setCompanyId(Number(v))}
          disabled={loadingCompanies}
        >
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

      {companyId === undefined && (
        <EmptyState title="Selecione uma empresa" hint="Os contatos são listados por empresa." />
      )}

      {companyId !== undefined && (
        <>
          <Panel title="Novo contato">
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_220px_170px_auto]"
            >
              <FieldLabel label="Nome">
                <Input placeholder="Nome do contato" value={name} onChange={(e) => setName(e.target.value)} />
              </FieldLabel>
              <FieldLabel label="Cargo">
                <Input placeholder="Ex.: Diretor de TI" value={role} onChange={(e) => setRole(e.target.value)} />
              </FieldLabel>
              <FieldLabel label="E-mail">
                <Input type="email" placeholder="nome@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FieldLabel>
              <FieldLabel label="Telefone">
                <Input placeholder="(27) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </FieldLabel>
              <Button type="submit" className="justify-self-start" disabled={!name.trim()}>
                Adicionar
              </Button>
            </form>
          </Panel>

          {error && <ErrorBanner message={error} />}
          {loading && <SkeletonRows />}

          {!loading && contacts.length === 0 && (
            <EmptyState title="Nenhum contato nesta empresa" hint="Cadastre o primeiro contato no formulário acima." />
          )}

          {!loading && contacts.length > 0 && (
            <div className="border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="pr-4 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow key={c.id} className="h-14">
                      <TableCell className="pl-4 font-semibold">{c.name}</TableCell>
                      <TableCell>{c.role ?? '—'}</TableCell>
                      <TableCell>{c.email ?? '—'}</TableCell>
                      <TableCell>{c.phone ?? '—'}</TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <TextAction onClick={() => setEditing(c)}>Editar</TextAction>
                          <TextAction
                            tone="muted"
                            onClick={() => {
                              void deleteContact(c.id);
                            }}
                          >
                            Excluir
                          </TextAction>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <ContactEditDialog
            contact={editing}
            onOpenChange={(o) => {
              if (!o) setEditing(null);
            }}
            onSave={(id, body) => updateContact(id, body)}
          />
        </>
      )}
    </div>
  );
}

function ContactEditDialog({
  contact,
  onOpenChange,
  onSave,
}: {
  contact: Contact | null;
  onOpenChange: (open: boolean) => void;
  onSave: (id: number, body: { name: string; role?: string; email?: string; phone?: string }) => Promise<Contact | null>;
}) {
  return (
    <Dialog open={contact !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {contact && <ContactEditForm key={contact.id} contact={contact} onSave={onSave} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ContactEditForm({
  contact,
  onSave,
  onClose,
}: {
  contact: Contact;
  onSave: (id: number, body: { name: string; role?: string; email?: string; phone?: string }) => Promise<Contact | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(contact.name);
  const [role, setRole] = useState(contact.role ?? '');
  const [email, setEmail] = useState(contact.email ?? '');
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const updated = await onSave(contact.id, {
      name: name.trim(),
      role: role.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });
    setSaving(false);
    if (updated) onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar contato</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <FieldLabel label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Cargo">
          <Input value={role} onChange={(e) => setRole(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Telefone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FieldLabel>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
        <Button
          onClick={() => {
            void handleSave();
          }}
          disabled={saving || !name.trim()}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogFooter>
    </>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={`sk-${i}`} className="h-12 w-full" />
      ))}
    </div>
  );
}
