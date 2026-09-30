import { createBrowserRouter, RouterProvider, NavLink, Outlet } from 'react-router';
import { useState, useEffect } from 'react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  GenieChat,
  useIsMobile,
} from '@databricks/appkit-ui/react';
import { TodosPage } from './features/todos/TodosPage';
import { CrmPage } from './features/crm/CrmPage';
import { ReceivablesPage } from './features/receivables/ReceivablesPage';
import { PayablesPage } from './features/payables/PayablesPage';
import { BrandBars, FooterStripe, PageHeader, TitleTab } from '@/components/brand/index.js';

const NAV_ITEMS = [
  { to: '/', label: 'Início', end: true },
  { to: '/crm', label: 'CRM' },
  { to: '/receivables', label: 'A Receber' },
  { to: '/payables', label: 'A Pagar' },
];

/** Aba do header: texto branco; a ativa ganha o traço dex-vermelho na base. */
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex h-16 items-center border-y-4 border-t-transparent px-4 font-display text-[15px] font-medium tracking-[0.02em] transition-colors ${
    isActive ? 'border-b-dex-vermelho text-white' : 'border-b-transparent text-white/80 hover:text-white'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block border-l-4 px-4 py-3 font-display text-base font-medium transition-colors ${
    isActive ? 'border-l-dex-vermelho bg-dex-tint text-dex-azul' : 'border-l-transparent text-dex-marinho hover:bg-dex-tint'
  }`;

type NavLinkClassFn = (props: { isActive: boolean }) => string;

function NavLinks({ className, linkClass, onClick }: { className?: string; linkClass: NavLinkClassFn; onClick?: () => void }) {
  return (
    <nav className={className} aria-label="Módulos">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={onClick}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Layout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center gap-6 bg-dex-azul px-4 md:gap-10 md:px-8">
        {/* Logo DEX (versão branca) sobre a faixa azul do header */}
        <img src="/dex-branco-v-H.png" alt="DEX | Datasource Expert" className="h-7 w-auto" />
        {/* Desktop nav — hidden below md breakpoint */}
        <NavLinks className="hidden gap-1 md:flex" linkClass={navLinkClass} />
        <div className="ml-auto flex items-center gap-5">
          <span className="hidden font-display text-sm font-medium tracking-[0.08em] text-white/80 uppercase sm:inline">
            Micro ERP
          </span>
          <BrandBars inverse />
          {/* Mobile nav — visible below md breakpoint */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <Button
              variant="ghost"
              className="h-11 border border-white/60 px-4 text-white hover:bg-white/10 hover:text-white md:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              Menu
            </Button>
            <SheetContent side="left" className="p-0">
              <SheetHeader className="border-b">
                <SheetTitle>Navegação</SheetTitle>
              </SheetHeader>
              <NavLinks className="flex flex-col py-2" linkClass={mobileNavLinkClass} onClick={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="dex-grid-bg flex-1 px-4 py-8 md:px-10 md:py-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>

      <FooterStripe className="shrink-0" />
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/crm', element: <CrmPage /> },
      { path: '/receivables', element: <ReceivablesPage /> },
      { path: '/payables', element: <PayablesPage /> },
      { path: '/todos', element: <TodosPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

const MODULES = [
  { to: '/crm', title: 'CRM', description: 'Empresas, contatos e funil de vendas.' },
  { to: '/receivables', title: 'Contas a Receber', description: 'Títulos de clientes, baixas e indicadores.' },
  { to: '/payables', title: 'Contas a Pagar', description: 'Obrigações com fornecedores e vencimentos.' },
];

function HomePage() {
  return (
    <>
      <PageHeader title="Micro ERP DEX" subtitle="Converse com o assistente de dados ou acesse os módulos do ERP." />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex flex-col border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 pt-5 pb-4">
            <TitleTab>Assistente DEX</TitleTab>
            <span className="font-display text-[13px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
              Genie · dados do ERP
            </span>
          </div>
          {/* GenieChat exige altura explícita no container pai — sem ela o chat colapsa para 0. */}
          <div className="h-[600px] overflow-hidden">
            <GenieChat alias="default" placeholder="Pergunte sobre seus dados..." />
          </div>
          <p className="border-t px-5 py-3 text-xs leading-relaxed text-muted-foreground">
            Respostas geradas por IA a partir dos seus dados via Genie — confira o SQL gerado antes de confiar nos
            resultados. As consultas respeitam as suas permissões de acesso aos dados.
          </p>
        </section>

        <aside className="flex flex-col gap-4">
          <h2 className="font-display text-xs font-bold tracking-[0.08em] text-dex-azul uppercase">Módulos</h2>
          {MODULES.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className="group flex flex-col gap-2 border bg-card px-6 py-5 transition-colors hover:border-dex-azul"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display text-[22px] font-semibold text-dex-azul">{m.title}</span>
                <span
                  aria-hidden="true"
                  className="font-display text-xl font-bold text-dex-vermelho transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{m.description}</span>
            </NavLink>
          ))}
        </aside>
      </div>
    </>
  );
}
