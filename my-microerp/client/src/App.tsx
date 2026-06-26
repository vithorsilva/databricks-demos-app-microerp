import { createBrowserRouter, RouterProvider, NavLink, Outlet } from 'react-router';
import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  GenieChat,
  useIsMobile,
} from '@databricks/appkit-ui/react';
import { Menu } from 'lucide-react';
import { TodosPage } from './features/todos/TodosPage';
import { CrmPage } from './features/crm/CrmPage';
import { ReceivablesPage } from './features/receivables/ReceivablesPage';
import { PayablesPage } from './features/payables/PayablesPage';
import { ColorBars, PageHeader } from '@/components/brand/index.js';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-white/80 hover:bg-white/10 hover:text-white'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

type NavLinkClassFn = (props: { isActive: boolean }) => string;

function NavLinks({ className, linkClass, onClick }: { className?: string; linkClass: NavLinkClassFn; onClick?: () => void }) {
  return (
    <nav className={className}>
      <NavLink to="/" end className={linkClass} onClick={onClick}>
        Home
      </NavLink>
      <NavLink to="/crm" className={linkClass} onClick={onClick}>
        CRM
      </NavLink>
      <NavLink to="/receivables" className={linkClass} onClick={onClick}>
        A Receber
      </NavLink>
      <NavLink to="/payables" className={linkClass} onClick={onClick}>
        A Pagar
      </NavLink>
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
    <div className="min-h-screen bg-background flex flex-col">
      <header
        className="px-4 md:px-6 py-3 flex items-center gap-4 text-white"
        style={{ background: 'var(--grad-header)' }}
      >
        {/* Logo DEX (versão branca) sobre a faixa azul/escura do header */}
        <img src="/dex-branco-v-H.png" alt="DEX | Datasource Expert" className="h-7 w-auto" />
        {/* Desktop nav — hidden below md breakpoint */}
        <NavLinks className="hidden md:flex gap-1" linkClass={navLinkClass} />
        {/* Mobile nav — visible below md breakpoint */}
        <div className="ml-auto md:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setMobileNavOpen(true)}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Navegação</SheetTitle>
              </SheetHeader>
              <NavLinks className="flex flex-col gap-1" linkClass={mobileNavLinkClass} onClick={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>

      <ColorBars />
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

function HomePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Micro ERP DEX"
        subtitle="Converse com o assistente de dados ou acesse os módulos do ERP."
      />

      <Card>
        <CardHeader>
          <CardTitle>Assistente DEX</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* GenieChat exige altura explícita no container pai — sem ela o chat colapsa para 0. */}
          <div className="h-[600px] rounded-md border overflow-hidden">
            <GenieChat alias="default" placeholder="Pergunte sobre seus dados..." />
          </div>
          <p className="text-xs text-muted-foreground">
            Respostas geradas por IA a partir dos seus dados via Genie — confira o SQL gerado antes de
            confiar nos resultados. As consultas respeitam as suas permissões de acesso aos dados.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Módulos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use a navegação acima para acessar os módulos do ERP.
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <NavLink to="/crm" className="text-primary underline underline-offset-4 hover:text-primary/80">
                CRM — empresas, contatos e pipeline →
              </NavLink>
            </li>
            <li>
              <NavLink to="/receivables" className="text-primary underline underline-offset-4 hover:text-primary/80">
                Contas a Receber →
              </NavLink>
            </li>
            <li>
              <NavLink to="/payables" className="text-primary underline underline-offset-4 hover:text-primary/80">
                Contas a Pagar →
              </NavLink>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
