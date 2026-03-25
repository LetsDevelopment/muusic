function NowPlayingDock({
  hasActiveTrack,
  trackName,
  artistName,
  isPlaying,
  coverImage,
  fallbackImage,
  useMarqueeTitle,
  isMobileDevice,
  onArtistClick
}) {
  const imageSrc = coverImage || fallbackImage || null;

  return (
    <aside className="now-playing-dock" aria-live="polite">
      <div className="now-playing-dock-shell">
        <p className="now-playing-dock-kicker">Now playing</p>
        {hasActiveTrack ? (
          <div className="now-playing-dock-body">
            {imageSrc ? (
              <img src={imageSrc} alt={artistName || trackName} className="now-playing-dock-cover" />
            ) : (
              <div className="now-playing-dock-cover now-playing-dock-cover-fallback" aria-hidden="true">
                ♪
              </div>
            )}
            <div className="now-playing-dock-copy">
              <div className="now-playing-dock-status">
                <div className={isPlaying ? 'now-playing-dock-eq is-playing' : 'now-playing-dock-eq'} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="now-playing-dock-status-text">{isPlaying ? 'Tocando agora' : 'Pausado'}</span>
              </div>
              <p className={useMarqueeTitle ? 'now-playing-dock-title marquee' : 'now-playing-dock-title'}>
                <span>{trackName}</span>
              </p>
              <button
                type="button"
                className={isMobileDevice ? 'now-playing-dock-artist' : 'now-playing-dock-artist now-playing-dock-artist-button'}
                onClick={onArtistClick}
                disabled={isMobileDevice}
              >
                {artistName}
              </button>
              <p className="now-playing-dock-note">
                Dados sendo lidos sem login do Spotify, somente do navegador.
              </p>
            </div>
          </div>
        ) : (
          <div className="now-playing-dock-body is-empty">
            {fallbackImage ? (
              <img src={fallbackImage} alt="Spotify" className="now-playing-dock-cover" />
            ) : (
              <div className="now-playing-dock-cover now-playing-dock-cover-fallback" aria-hidden="true">
                ♪
              </div>
            )}
            <div className="now-playing-dock-copy">
              <p className="now-playing-dock-title">Conectar ao Spotify</p>
              <p className="now-playing-dock-empty">Clique no ícone do Spotify ou ative o sync do Spotify Web em Minha Conta.</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default NowPlayingDock;
