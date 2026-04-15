import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  LayoutDashboard,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Ticket,
  Trophy,
  Users
} from 'lucide-react';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import { cn } from '../../lib/utils';

const navSections = [
  {
    label: 'V1',
    items: [
      { key: 'feed', label: 'Feed', icon: Clapperboard },
      { key: 'superfas', label: 'Superfãs', icon: Trophy },
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'usuarios', label: 'Usuários', icon: Users },
      { key: 'moderacao', label: 'Moderação', icon: ShieldCheck }
    ]
  },
  {
    label: 'Management',
    disabled: true,
    items: [
      { key: 'shows', label: 'Shows', icon: CalendarDays },
      { key: 'trendings', label: 'Trendings', icon: BarChart3 },
      { key: 'performance', label: 'Performance', icon: Activity }
    ]
  },
  {
    label: 'Growth',
    disabled: true,
    items: [
      { key: 'lista_espera', label: 'Lista de Espera', icon: Users },
      { key: 'landing_pages', label: 'Landing Pages', icon: LayoutDashboard },
      { key: 'campanhas', label: 'Campanhas', icon: Sparkles }
    ]
  },
  {
    label: 'Publicidade',
    disabled: true,
    items: [
      { key: 'publicidade_dashboard', label: 'Dashboard', icon: BarChart3 },
      { key: 'anuncios', label: 'Anúncios', icon: Ticket },
      { key: 'clientes', label: 'Clientes', icon: Users },
      { key: 'convites_publicidade', label: 'Convites', icon: ShieldCheck }
    ]
  },
  {
    label: 'Blog',
    items: [{ key: 'blog', label: 'Blog', icon: CalendarDays }]
  }
];

function SidebarContent({ activeItem, collapsed, onToggle, onNavigate, closeMobile }) {
  return (
    <>
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <div className={cn('flex items-center gap-3 overflow-hidden', collapsed && 'justify-center')}>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Ticket className="h-4 w-4" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Fanverse Admin</p>
              <p className="truncate text-xs text-muted-foreground">Sistema operacional</p>
            </div>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label="Colapsar sidebar"
          className="admin-neutral-control hidden h-8 w-8 lg:inline-flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="space-y-6 p-4">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="admin-sidebar-section-label text-xs uppercase tracking-[0.14em]">{section.label}</p>
                {section.disabled ? (
                  <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
                    Inativo
                  </span>
                ) : null}
              </div>
            ) : null}
            <nav className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.key === activeItem;
                const disabled = Boolean(section.disabled);
                const row = (
                  <button
                    key={item.key}
                    type="button"
                    disabled={disabled}
                    className={cn(
                      'admin-sidebar-item group flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150',
                      active ? 'is-active' : '',
                      collapsed && 'justify-center px-0',
                      disabled && 'cursor-not-allowed opacity-40'
                    )}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      if (disabled) return;
                      onNavigate?.(item.key);
                      closeMobile?.();
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </button>
                );

                if (!collapsed) return row;

                return (
                  <Tooltip key={item.key} content={item.label}>
                    {row}
                  </Tooltip>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </>
  );
}

export default function AdminLayout({ children, activeItem = 'usuarios', userName, onLogout, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem('fanverse-admin-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const sidebarWidth = useMemo(() => (collapsed ? 'lg:w-20' : 'lg:w-64'), [collapsed]);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('fanverse-admin-theme', next);
      }
      return next;
    });
  }

  return (
    <div className={cn('admin-root min-h-screen bg-background text-foreground', theme)}>
      <div className="flex min-h-screen">
        <aside className={cn('admin-sidebar-shell hidden shrink-0 border-r border-border lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto', sidebarWidth)}>
          <SidebarContent activeItem={activeItem} collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} onNavigate={onNavigate} />
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu lateral"
            />
            <aside className="admin-sidebar-shell relative h-full w-72 border-r border-border">
              <div className="flex h-16 items-center justify-end border-b border-border px-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="admin-neutral-control"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fechar menu"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <SidebarContent
                activeItem={activeItem}
                collapsed={false}
                onToggle={() => {}}
                onNavigate={onNavigate}
                closeMobile={() => setMobileOpen(false)}
              />
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border/90 bg-background/80 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-4 lg:px-8">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="hidden md:block">
                  <p className="text-sm font-semibold text-foreground">Painel administrativo</p>
                  <p className="text-xs text-muted-foreground">Moderação, analytics e operação</p>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Button variant="outline" size="sm" onClick={toggleTheme} aria-label="Alternar tema">
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === 'dark' ? 'Light' : 'Dark'}
                </Button>
                <span className="hidden sm:inline">{userName}</span>
                <Button variant="ghost" size="sm" className="admin-neutral-control" onClick={onLogout}>
                  Sair
                </Button>
              </div>
            </div>
          </div>

          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
