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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@databricks/appkit-ui/react';
import { Trash2, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/brand/index.js';
import { useCompanies, useContacts, usePipelines } from './hooks.js';
import { PipelineBoard } from './PipelineBoard.js';
import { PipelineManager } from './PipelineManager.js';
import { CrmReports } from './CrmReports.js';
import { CompanyDrawer } from './CompanyDrawer.js';
import type { Company, CompanyType, Contact } from '@shared/crm/types.js';

const TYPE_LABEL: Record<CompanyType, string> = {
  customer: 'Cliente',
  supplier: 'Fornecedor',
  both: 'Ambos',
};

function ErrorBanner({ message }: { message: string }) {
  return <div className="text-destructive bg-destructive/10 p-3 rounded-md mb-4">{message}</div>;
}

export function CrmPage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
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
    </div>
  );
}

// ── Funil ──────────────────────────────────────────────────
function FunnelTab() {
  const pm = usePipelines();
  const { pipelines, current, currentId, setCurrentId, loading, error } = pm;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={currentId?.toString() ?? ''}
          onValueChange={(v) => setCurrentId(Number(v))}
          disabled={loading || pipelines.length === 0}
        >
          <SelectTrigger className="w-64">
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
      {!loading && !current && <p className="text-muted-foreground py-8 text-center">Nenhum funil configurado.</p>}
    </div>
  );
}

// ── Relatórios ─────────────────────────────────────────────
function ReportsTab() {
  const { pipelines, currentId, setCurrentId, loading } = usePipelines();
  return (
    <div className="space-y-4 pt-4">
      <Select
        value={currentId?.toString() ?? ''}
        onValueChange={(v) => setCurrentId(Number(v))}
        disabled={loading || pipelines.length === 0}
      >
        <SelectTrigger className="w-64">
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
    <div className="space-y-4 pt-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Nome da empresa"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-48"
        />
        <Select value={type} onValueChange={(v) => setType(v as CompanyType)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
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
              <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{TYPE_LABEL[c.type]}</Badge>
                </TableCell>
                <TableCell>{c.email ?? '—'}</TableCell>
                <TableCell>{c.phone ?? '—'}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteCompany(c.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Excluir empresa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    <div className="space-y-4 pt-4">
      <Select
        value={companyId?.toString() ?? ''}
        onValueChange={(v) => setCompanyId(Number(v))}
        disabled={loadingCompanies}
      >
        <SelectTrigger className="w-72">
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

      {companyId === undefined && (
        <p className="text-muted-foreground text-center py-8">Selecione uma empresa para ver seus contatos.</p>
      )}

      {companyId !== undefined && (
        <>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
            <Input
              placeholder="Nome do contato"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 min-w-48"
            />
            <Input placeholder="Cargo" value={role} onChange={(e) => setRole(e.target.value)} className="w-40" />
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-48"
            />
            <Input placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-40" />
            <Button type="submit" disabled={!name.trim()}>
              Adicionar
            </Button>
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
                  <TableHead>Telefone</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.role ?? '—'}</TableCell>
                    <TableCell>{c.email ?? '—'}</TableCell>
                    <TableCell>{c.phone ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(c)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Editar contato"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void deleteContact(c.id);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Excluir contato"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
      <div className="space-y-3 py-2">
        <Input placeholder="Nome do contato" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Cargo" value={role} onChange={(e) => setRole(e.target.value)} />
        <Input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
        <Skeleton key={`sk-${i}`} className="h-10 w-full" />
      ))}
    </div>
  );
}
