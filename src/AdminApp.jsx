import { useCallback, useEffect, useState } from 'react';
import AuthPage from './components/AuthPage';
import AdminLayout from './components/admin/AdminLayout';
import Button from './components/ui/Button';
import { API_URL } from './config/appConfig';
import DashboardPage from './pages/admin/DashboardPage';
import ModerationPage from './pages/admin/ModerationPage';
import PerformancePage from './pages/admin/PerformancePage';
import ShowsPage from './pages/admin/ShowsPage';
import TrendingsPage from './pages/admin/TrendingsPage';
import UsersPage from './pages/admin/UsersPage';
import MockSectionPage from './pages/admin/MockSectionPage';
import ContentFeedPage from './pages/admin/ContentFeedPage';
import SuperfansPage from './pages/admin/SuperfansPage';
import { useAuthFlow } from './hooks/useAuthFlow';
import { mockAdminSections } from './mocks/adminGrowthAdsBlog';
import './styles/global.css';

const ROUTE_BY_PAGE = {
  dashboard: '/dashboard',
  usuarios: '/usuarios',
  shows: '/shows',
  trendings: '/trendings',
  moderacao: '/moderacao',
  performance: '/performance',
  feed: '/conteudo/feed',
  superfas: '/superfas',
  lista_espera: '/growth/lista-espera',
  landing_pages: '/growth/landing-pages',
  campanhas: '/growth/campanhas',
  publicidade_dashboard: '/publicidade/dashboard',
  anuncios: '/publicidade/anuncios',
  clientes: '/publicidade/clientes',
  convites_publicidade: '/publicidade/convites',
  blog: '/blog'
};

const PAGE_BY_ROUTE = {
  '/dashboard': 'dashboard',
  '/usuarios': 'usuarios',
  '/shows': 'shows',
  '/trendings': 'trendings',
  '/moderacao': 'moderacao',
  '/performance': 'performance',
  '/conteudo/feed': 'feed',
  '/superfas': 'superfas',
  '/growth/lista-espera': 'lista_espera',
  '/growth/landing-pages': 'landing_pages',
  '/growth/campanhas': 'campanhas',
  '/publicidade/dashboard': 'publicidade_dashboard',
  '/publicidade/anuncios': 'anuncios',
  '/publicidade/clientes': 'clientes',
  '/publicidade/convites': 'convites_publicidade',
  '/blog': 'blog'
};

export default function AdminApp() {
  const {
    authMode,
    setAuthMode,
    authForm,
    authError,
    authBooting,
    authUser,
    updateAuthField,
    submitAuth,
    submitForgotPassword,
    submitResetPassword,
    forgotMode,
    resetMode,
    forgotMessage,
    openForgotMode,
    closeForgotMode,
    logout
  } = useAuthFlow();

  const isAdmin = authUser?.role === 'ADMIN';
  const [activePage, setActivePage] = useState(() => PAGE_BY_ROUTE[window.location.pathname] || 'usuarios');

  const adminFetch = useCallback(
    async (path, options = {}) => {
      if (!authUser?.token) {
        throw new Error('Sessao administrativa ausente.');
      }

      const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${authUser.token}`,
        'x-session-id': authUser.sessionId || ''
      };

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        cache: 'no-store',
        headers
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Falha na requisicao administrativa.');
      }
      return payload;
    },
    [authUser?.token, authUser?.sessionId]
  );

  const navigateToPage = useCallback(
    (nextPage) => {
      const route = ROUTE_BY_PAGE[nextPage] || '/usuarios';
      if (window.location.pathname !== route) {
        window.history.pushState({}, '', route);
      }
      setActivePage(nextPage);
    },
    []
  );

  useEffect(() => {
    const onPopState = () => {
      setActivePage(PAGE_BY_ROUTE[window.location.pathname] || 'usuarios');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (authBooting) {
    return (
      <div className="dark grid min-h-screen place-items-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <AuthPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        authError={authError}
        forgotMode={forgotMode}
        resetMode={resetMode}
        forgotMessage={forgotMessage}
        updateAuthField={updateAuthField}
        submitAuth={submitAuth}
        submitForgotPassword={submitForgotPassword}
        submitResetPassword={submitResetPassword}
        openForgotMode={openForgotMode}
        closeForgotMode={closeForgotMode}
      />
    );
  }

  if (!isAdmin) {
    return (
      <div className="dark grid min-h-screen place-items-center bg-background p-4 text-foreground">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Painel Muusic</h1>
          <p className="mt-2 text-sm text-muted-foreground">Seu usuário não possui permissão administrativa.</p>
          <Button className="mt-5" onClick={() => logout().catch(() => {})}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const pageByNav = {
    dashboard: <DashboardPage apiFetch={adminFetch} />,
    usuarios: <UsersPage apiFetch={adminFetch} />,
    shows: <ShowsPage apiFetch={adminFetch} />,
    trendings: <TrendingsPage apiFetch={adminFetch} />,
    moderacao: <ModerationPage />,
    performance: <PerformancePage apiFetch={adminFetch} />,
    feed: <ContentFeedPage />,
    superfas: <SuperfansPage />,
    lista_espera: <MockSectionPage {...mockAdminSections.lista_espera} />,
    landing_pages: <MockSectionPage {...mockAdminSections.landing_pages} />,
    campanhas: <MockSectionPage {...mockAdminSections.campanhas} />,
    publicidade_dashboard: <MockSectionPage {...mockAdminSections.publicidade_dashboard} />,
    anuncios: <MockSectionPage {...mockAdminSections.anuncios} />,
    clientes: <MockSectionPage {...mockAdminSections.clientes} />,
    convites_publicidade: <MockSectionPage {...mockAdminSections.convites_publicidade} />,
    blog: <MockSectionPage {...mockAdminSections.blog} />
  };

  return (
    <AdminLayout
      activeItem={activePage}
      onNavigate={navigateToPage}
      userName={authUser.name}
      onLogout={() => logout().catch(() => {})}
    >
      {pageByNav[activePage] || <UsersPage apiFetch={adminFetch} />}
    </AdminLayout>
  );
}
