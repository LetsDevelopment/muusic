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
  ShieldCheck,
  Sparkles,
  Ticket,
  Users
} from 'lucide-react';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import { cn } from '../../lib/utils';

const navSections = [
  {
    label: 'V1',
    items: [{ key: 'feed', label: 'Feed', icon: Clapperboard }]
  },
  {
    label: 'Management',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'usuarios', label: 'Usuários', icon: Users },
      { key: 'shows', label: 'Shows', icon: CalendarDays },
      { key: 'trendings', label: 'Trendings', icon: BarChart3 },
      { key: 'moderacao', label: 'Moderação', icon: ShieldCheck },
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
        <div className={cn('flex items-center gap-2 overflow-hidden', collapsed && 'justify-center')}>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-foreground">
            <Ticket className="h-4 w-4" />
          </div>
          {!collapsed ? <span className="text-sm font-semibold text-foreground">Management</span> : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label="Colapsar sidebar"
          className="admin-neutral-control hidden h-8 w-8 text-muted-foreground hover:text-foreground lg:inline-flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="space-y-6 p-4">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{section.label}</p>
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
                      active ? 'is-active text-white' : 'text-muted-foreground hover:text-white',
                      collapsed && 'justify-center px-0',
                      disabled && 'cursor-not-allowed opacity-40 hover:text-muted-foreground'
                    )}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      if (disabled) return;
                      onNavigate?.(item.key);
                      closeMobile?.();
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {!collapsed ? <span>{item.label}</span> : null}
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

  const sidebarWidth = useMemo(() => (collapsed ? 'lg:w-20' : 'lg:w-64'), [collapsed]);

  return (
    <div className="admin-root dark min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className={cn('hidden shrink-0 border-r border-border bg-card lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto', sidebarWidth)}>
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
            <aside className="relative h-full w-72 border-r border-border bg-card">
              <div className="flex h-16 items-center justify-end border-b border-border px-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="admin-neutral-control text-muted-foreground hover:text-foreground"
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
          <div className="flex h-16 items-center justify-between border-b border-border px-4 lg:px-8">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
              <span>{userName}</span>
              <Button variant="ghost" size="sm" className="admin-neutral-control text-muted-foreground hover:text-foreground" onClick={onLogout}>
                Sair
              </Button>
            </div>
          </div>

          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
