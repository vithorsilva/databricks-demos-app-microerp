import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Skeleton,
  Separator,
} from '@databricks/appkit-ui/react';
import { EmptyState, ErrorBanner, StatusBadge, type StatusTone } from '@/components/brand/index.js';
import { formatBRL } from '@/lib/format.js';
import { useCompanyOpportunities } from './hooks.js';
import type { Company, Opportunity, OpportunityStatus } from '@shared/crm/types.js';

const STATUS_META: Record<OpportunityStatus, { label: string; tone: StatusTone }> = {
  open: { label: 'Aberta', tone: 'neutral' },
  won: { label: 'Ganha', tone: 'brand' },
  lost: { label: 'Perdida', tone: 'alert' },
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
        {error && <ErrorBanner message={error} />}
        {loading && <Skeleton className="h-40 w-full" />}

        {!loading && opportunities.length === 0 && (
          <EmptyState title="Nenhuma oportunidade" hint="Esta empresa ainda não tem oportunidades no CRM." />
        )}

        {!loading &&
          groups.map(
            (g) =>
              g.items.length > 0 && (
                <div key={g.status} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={STATUS_META[g.status].tone}>{STATUS_META[g.status].label}</StatusBadge>
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
  const closedAt = opp.status === 'won' ? opp.won_at : opp.status === 'lost' ? opp.lost_at : null;
  return (
    <li className="border bg-card px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-semibold text-dex-marinho">{opp.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {opp.stage_name} · {opp.amount != null ? formatBRL(opp.amount) : '—'}
          </p>
          {closedAt && (
            <p className="text-xs text-muted-foreground">
              {meta.label} em {fmtDate(closedAt)}
            </p>
          )}
          {opp.status === 'lost' && opp.lost_reason && (
            <p className="text-xs text-dex-texto">
              <span className="font-semibold text-dex-magenta">Motivo:</span> {opp.lost_reason}
            </p>
          )}
        </div>
        {opp.status !== 'open' && (
          <Button variant="outline" size="sm" onClick={onReopen} className="shrink-0">
            Reabrir
          </Button>
        )}
      </div>
    </li>
  );
}
