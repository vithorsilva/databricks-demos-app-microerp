import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Badge,
  Button,
  Skeleton,
  Separator,
} from '@databricks/appkit-ui/react';
import { RotateCcw, Trophy, X, Circle } from 'lucide-react';
import { formatBRL } from '@/lib/format.js';
import { useCompanyOpportunities } from './hooks.js';
import type { Company, Opportunity, OpportunityStatus } from '@shared/crm/types.js';

const STATUS_META: Record<OpportunityStatus, { label: string; color: string; icon: typeof Circle }> = {
  open: { label: 'Aberta', color: 'var(--primary)', icon: Circle },
  won: { label: 'Ganha', color: 'var(--success)', icon: Trophy },
  lost: { label: 'Perdida', color: 'var(--destructive)', icon: X },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = iso.slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
}

export function CompanyDrawer({
  company,
  open,
  onOpenChange,
}: {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {company && <CompanyOpportunities key={company.id} company={company} />}
      </SheetContent>
    </Sheet>
  );
}

function CompanyOpportunities({ company }: { company: Company }) {
  const { opportunities, loading, error, reopen } = useCompanyOpportunities(company.id);

  const groups: { status: OpportunityStatus; items: Opportunity[] }[] = (
    ['open', 'won', 'lost'] as OpportunityStatus[]
  ).map((status) => ({ status, items: opportunities.filter((o) => o.status === status) }));

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-6">{company.name}</SheetTitle>
        <p className="text-sm text-muted-foreground">Histórico de oportunidades</p>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-8">
        {error && <div className="text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
        {loading && <Skeleton className="h-40 w-full" />}

        {!loading && opportunities.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">Nenhuma oportunidade para esta empresa.</p>
        )}

        {!loading &&
          groups.map(
            (g) =>
              g.items.length > 0 && (
                <div key={g.status} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" style={{ color: STATUS_META[g.status].color }}>
                      {STATUS_META[g.status].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{g.items.length}</span>
                  </div>
                  <ul className="space-y-2">
                    {g.items.map((o) => (
                      <OpportunityRow key={o.id} opp={o} onReopen={() => void reopen(o.id)} />
                    ))}
                  </ul>
                  <Separator />
                </div>
              )
          )}
      </div>
    </>
  );
}

function OpportunityRow({ opp, onReopen }: { opp: Opportunity; onReopen: () => void }) {
  const meta = STATUS_META[opp.status];
  const Icon = meta.icon;
  const closedAt = opp.status === 'won' ? opp.won_at : opp.status === 'lost' ? opp.lost_at : null;
  return (
    <li className="rounded-md border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
            <p className="truncate font-medium">{opp.title}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {opp.stage_name} · {opp.amount != null ? formatBRL(opp.amount) : '—'}
          </p>
          {closedAt && (
            <p className="text-xs text-muted-foreground">
              {meta.label} em {fmtDate(closedAt)}
            </p>
          )}
          {opp.status === 'lost' && opp.lost_reason && (
            <p className="text-xs text-destructive">Motivo: {opp.lost_reason}</p>
          )}
        </div>
        {opp.status !== 'open' && (
          <Button variant="outline" size="sm" onClick={onReopen} className="shrink-0">
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reabrir
          </Button>
        )}
      </div>
    </li>
  );
}
