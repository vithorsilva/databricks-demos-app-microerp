import { useState } from 'react';
import { BarChart, DonutChart, Input, Skeleton } from '@databricks/appkit-ui/react';
import { KpiCard } from '@/components/brand/index.js';
import { formatBRL } from '@/lib/format.js';
import { useInsights } from './hooks.js';
import type { InsightsResponse } from '@shared/crm/types.js';

const BLUE = '#0d4a8b';
const LIGHT_BLUE = '#1565b8';
const GREEN = '#1d8a3e';
const RED = '#ed1c24';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{message}</p>;
}

export function CrmReports({ pipelineId }: { pipelineId: number | undefined }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, loading, error } = useInsights(pipelineId, from, to);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">De</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Até</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </label>
      </div>

      {error && <div className="text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}

      {loading || !data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : (
        <Reports data={data} />
      )}
    </div>
  );
}

function Reports({ data }: { data: InsightsResponse }) {
  const { funnel, forecast, won_lost, owner_performance } = data;

  const funnelData = funnel.map((f) => ({
    Estágio: f.stage_name,
    Valor: f.value,
    Negócios: f.count,
  }));

  const forecastData = forecast.map((f) => ({
    Mês: f.month,
    Valor: f.value,
    Ponderado: f.weighted,
  }));

  const wonLostData = [
    { Resultado: 'Ganhos', Quantidade: won_lost.won_count },
    { Resultado: 'Perdidos', Quantidade: won_lost.lost_count },
  ];

  const reasonsData = won_lost.lost_reasons.map((r) => ({ Motivo: r.reason, Negócios: r.count }));

  const ownerData = owner_performance.map((o) => ({
    Responsável: o.owner,
    Ganho: o.won_value,
    'Em aberto': o.open_value,
  }));

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Em aberto" value={formatBRL(won_lost.open_value)} hint={`${won_lost.open_count} negócios`} />
        <KpiCard label="Valor ponderado" value={formatBRL(won_lost.weighted_value)} hint="Forecast por probabilidade" />
        <KpiCard
          label="Win rate"
          value={`${won_lost.win_rate}%`}
          hint={`${won_lost.won_count} ganhos · ${won_lost.lost_count} perdidos`}
          highlight
        />
        <KpiCard label="Ticket médio (ganhos)" value={formatBRL(won_lost.avg_ticket)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Funil de conversão (valor por estágio)">
          {funnel.length === 0 ? (
            <EmptyChart message="Sem oportunidades no funil." />
          ) : (
            <>
              <BarChart
                data={funnelData}
                xKey="Estágio"
                yKey="Valor"
                orientation="horizontal"
                colors={[BLUE]}
                height={220}
              />
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {funnel.map((f) => (
                  <li key={f.stage_id} className="flex justify-between tabular-nums">
                    <span>{f.stage_name}</span>
                    <span>
                      {f.count} neg. · {f.conversion}% do topo
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel title="Previsão por mês de fechamento">
          {forecast.length === 0 ? (
            <EmptyChart message="Nenhuma oportunidade com previsão de fechamento." />
          ) : (
            <BarChart
              data={forecastData}
              xKey="Mês"
              yKey={['Valor', 'Ponderado']}
              colors={[BLUE, LIGHT_BLUE]}
              height={260}
            />
          )}
        </Panel>

        <Panel title="Ganhos x Perdidos">
          {won_lost.won_count + won_lost.lost_count === 0 ? (
            <EmptyChart message="Nenhum negócio fechado no período." />
          ) : (
            <DonutChart data={wonLostData} xKey="Resultado" yKey="Quantidade" colors={[GREEN, RED]} height={220} />
          )}
        </Panel>

        <Panel title="Motivos de perda">
          {reasonsData.length === 0 ? (
            <EmptyChart message="Sem perdas registradas." />
          ) : (
            <BarChart
              data={reasonsData}
              xKey="Motivo"
              yKey="Negócios"
              orientation="horizontal"
              colors={[RED]}
              height={220}
            />
          )}
        </Panel>

        <Panel title="Desempenho por responsável">
          {ownerData.length === 0 ? (
            <EmptyChart message="Sem oportunidades atribuídas." />
          ) : (
            <BarChart
              data={ownerData}
              xKey="Responsável"
              yKey={['Ganho', 'Em aberto']}
              colors={[GREEN, BLUE]}
              height={260}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
