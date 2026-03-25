import { useEffect, useRef, useState } from 'react';
import { Bell, Disc3, Eye, Home, MapPin, MessageCircle, User } from 'lucide-react';
import muusicLogo from '../assets/logo-muusic.png';

export default function SidebarNavLite({
  onProfileOpen,
  onLocationClick,
  onSpotifyConnect,
  spotifyConnected,
  spotifyConnecting,
  chatOpen,
  onChatToggle,
  notificationsOpen,
  onNotificationsToggle,
  mapVisibility,
  onMapVisibilityChange
}) {
  const [viewPopoverOpen, setViewPopoverOpen] = useState(false);
  const popoverRef = useRef(null);
  const eyeButtonRef = useRef(null);

  useEffect(() => {
    if (!viewPopoverOpen) return undefined;

    const onDocumentPointerDown = (event) => {
      if (!popoverRef.current?.contains(event.target) && !eyeButtonRef.current?.contains(event.target)) {
        setViewPopoverOpen(false);
      }
    };

    const onEscape = (event) => {
      if (event.key !== 'Escape') return;
      setViewPopoverOpen(false);
      eyeButtonRef.current?.focus();
    };

    document.addEventListener('mousedown', onDocumentPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [viewPopoverOpen]);

  useEffect(() => {
    if (!viewPopoverOpen) return;
    const firstInput = popoverRef.current?.querySelector('input');
    firstInput?.focus();
  }, [viewPopoverOpen]);

  function handleTogglePopover() {
    setViewPopoverOpen((prev) => !prev);
  }

  function handleToggleVisibility(key) {
    onMapVisibilityChange?.((prev) => ({
      ...prev,
      [key]: !(prev?.[key] !== false)
    }));
  }

  return (
    <aside className="rail-sidebar">
      <div className="rail-logo">
        <img
          src={muusicLogo}
          alt="Muusic"
          className="rail-logo-img"
        />
      </div>

      <nav className="rail-nav rail-top">
        <button type="button" className="rail-btn active" aria-label="Home" data-tooltip="Home">
          <Home />
        </button>
        <button type="button" className="rail-btn" aria-label="Localização" data-tooltip="Localização" onClick={onLocationClick}>
          <MapPin />
        </button>
        <button type="button" className={chatOpen ? 'rail-btn active' : 'rail-btn'} aria-label="Chat" onClick={onChatToggle} data-tooltip="Chat">
          <MessageCircle />
        </button>
        <button
          type="button"
          className={notificationsOpen ? 'rail-btn active' : 'rail-btn'}
          aria-label="Notificações"
          data-tooltip="Notificações"
          onClick={onNotificationsToggle}
        >
          <Bell />
        </button>
        <div className="rail-view-wrap">
          <button
            ref={eyeButtonRef}
            type="button"
            className={viewPopoverOpen ? 'rail-btn active' : 'rail-btn'}
            aria-label="Filtros de visualização do mapa"
            data-tooltip="Visualização"
            aria-haspopup="dialog"
            aria-expanded={viewPopoverOpen}
            aria-controls="map-visibility-popover"
            onClick={handleTogglePopover}
          >
            <Eye />
          </button>
          {viewPopoverOpen && (
            <div
              id="map-visibility-popover"
              className="map-visibility-popover"
              role="dialog"
              aria-label="Filtros de visualização"
              ref={popoverRef}
            >
              <label className="map-visibility-item">
                <input
                  type="checkbox"
                  checked={mapVisibility?.users !== false}
                  onChange={() => handleToggleVisibility('users')}
                />
                <span>Usuários</span>
              </label>
              <label className="map-visibility-item">
                <input
                  type="checkbox"
                  checked={mapVisibility?.shows !== false}
                  onChange={() => handleToggleVisibility('shows')}
                />
                <span>Shows</span>
              </label>
            </div>
          )}
        </div>
      </nav>

      <nav className="rail-nav rail-bottom">
        <button
          type="button"
          className={spotifyConnected ? 'rail-btn spotify-connected' : 'rail-btn'}
          aria-label="Conectar Spotify"
          onClick={onSpotifyConnect}
          data-tooltip={spotifyConnected ? 'Spotify conectado' : spotifyConnecting ? 'Conectando Spotify...' : 'Conectar Spotify'}
        >
          <Disc3 />
        </button>
        <button type="button" className="rail-btn" aria-label="Perfil" onClick={onProfileOpen} data-tooltip="Perfil">
          <User />
        </button>
      </nav>
    </aside>
  );
}
