import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Play, Search, X } from 'lucide-react';
import { API_URL } from '../config/appConfig';
import BuzzCommunitiesPanel from './BuzzCommunitiesPanel';
import UserProfile from './user-profile/UserProfile';

const SHOWS_POLL_INTERVAL_MS = 30000;
const MAX_FORUM_SHOWS = 20;
const MAX_FORUM_POSTS = 80;
const MAX_FORUM_COMMENTS = 80;
const MAX_FORUM_REPLIES = 80;

function buildInitialPosts() {
  const base = [
    {
      id: 'post-1',
      user: 'ana.souza',
      name: 'Ana Souza',
      city: 'São Paulo',
      country: 'Brasil',
      coords: [-46.6333, -23.5505],
      ago: 'há 12 min',
      caption: 'Partiu show hoje, alguém mais indo?',
      image: 'https://picsum.photos/seed/feed-ana/900/900',
      likes: 128,
      liked: false,
      comments: [{ id: 'c-1-1', user: 'cadu.music', text: 'Fechei ingresso agora.', likes: 3, liked: false, replies: [{ id: 'r-1-1-1', user: 'ana.souza', text: 'Bora!' }] }]
    },
    {
      id: 'post-2',
      user: 'rafaela.melo',
      name: 'Rafaela Melo',
      city: 'Goiânia',
      country: 'Brasil',
      coords: [-49.2643, -16.6869],
      ago: 'há 24 min',
      caption: 'Setlist perfeito. Energia absurda no palco.',
      image: 'https://picsum.photos/seed/feed-rafa/900/900',
      likes: 247,
      liked: true,
      comments: [
        { id: 'c-2-1', user: 'leo.pires', text: 'Essa música final foi sinistra.', likes: 8, liked: false, replies: [] },
        { id: 'c-2-2', user: 'mari.brito', text: 'Quero esse replay no feed.', likes: 5, liked: false, replies: [] }
      ]
    },
    {
      id: 'post-3',
      user: 'joaopedro.dj',
      name: 'João Pedro',
      city: 'Belo Horizonte',
      country: 'Brasil',
      coords: [-43.9409, -19.9167],
      ago: 'há 39 min',
      caption: 'Pré-show com a galera. Hoje promete muito.',
      image: 'https://picsum.photos/seed/feed-joao/900/900',
      likes: 91,
      liked: false,
      comments: []
    }
  ];

  return base.map((post, index) => ({ ...post, avatar: `https://i.pravatar.cc/120?img=${index + 12}` }));
}

function formatShowDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data a confirmar';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(date);
}

function buildForumKey(showId, parentId) {
  return `${showId}:${parentId}`;
}

function normalizeShowDate(show) {
  const date = new Date(show?.startsAt);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function sortShows(list = []) {
  return [...list].sort((a, b) => normalizeShowDate(a) - normalizeShowDate(b));
}

function applyShowChange(list, payload) {
  const safeList = Array.isArray(list) ? list : [];
  if (!payload || !payload.type) return safeList;

  if (payload.type === 'deleted') {
    return safeList.filter((item) => item.id !== payload.showId);
  }

  const incoming = payload.show;
  if (!incoming || !incoming.id) return safeList;

  const existingIndex = safeList.findIndex((item) => item.id === incoming.id);
  if (existingIndex === -1) {
    return sortShows([...safeList, incoming]);
  }

  const next = [...safeList];
  next[existingIndex] = { ...next[existingIndex], ...incoming };
  return sortShows(next);
}

function capForumMap(map, keepId) {
  const keys = Object.keys(map);
  if (keys.length <= MAX_FORUM_SHOWS) return map;
  const removable = keys.filter((key) => key !== keepId).slice(0, keys.length - MAX_FORUM_SHOWS);
  if (!removable.length) return map;
  const next = { ...map };
  removable.forEach((key) => {
    delete next[key];
  });
  return next;
}

export default function RealFeedLite({
  onFocusItem,
  onOpenItem,
  onArtistClick,
  onShowsChange,
  socketRef,
  realtimeReady,
  selectedShowDetail,
  onCloseShowDetail,
  selectedArtistDetail,
  onCloseArtistDetail,
  selectedUserDetail,
  onCloseUserDetail,
  onUserClick,
  onUserChat,
  collapsed,
  onToggleCollapse
}) {
  const [activeTab, setActiveTab] = useState('feed');
  const [feedPosts, setFeedPosts] = useState(() => buildInitialPosts());
  const [commentDrafts, setCommentDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyOpen, setReplyOpen] = useState({});

  const [shows, setShows] = useState([]);
  const [showDetailTab, setShowDetailTab] = useState('info');
  const [artistDetailTab, setArtistDetailTab] = useState('albums');
  const [showForumById, setShowForumById] = useState({});
  const [showPostDraft, setShowPostDraft] = useState('');
  const [showCommentDrafts, setShowCommentDrafts] = useState({});
  const [showReplyDrafts, setShowReplyDrafts] = useState({});
  const [showReplyOpen, setShowReplyOpen] = useState({});

  const fallbackShows = useMemo(
    () => [
      {
        id: 'fallback-show-1',
        artist: 'Jorge & Mateus',
        venue: 'Villa Country',
        city: 'Sao Paulo',
        country: 'Brasil',
        address: 'Av. Francisco Matarazzo, 774 - Agua Branca',
        description: 'Noite especial com repertorio completo e convidados.',
        latitude: -23.536,
        longitude: -46.664,
        startsAt: new Date(Date.now() + 4 * 86400000).toISOString(),
        thumbUrl: 'https://picsum.photos/seed/fallback-show-1/112/112'
      },
      {
        id: 'fallback-show-2',
        artist: 'Henrique & Juliano',
        venue: 'Espaco Hall',
        city: 'Rio de Janeiro',
        country: 'Brasil',
        address: 'Av. Ayrton Senna, 5850 - Barra da Tijuca',
        description: 'Show com abertura especial e ativações no local.',
        latitude: -22.874,
        longitude: -43.364,
        startsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        thumbUrl: 'https://picsum.photos/seed/fallback-show-2/112/112'
      }
    ],
    []
  );

  const loadShows = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/shows?page=1&limit=200`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Falha ao carregar shows.');
      const list = Array.isArray(payload.shows) ? payload.shows : [];
      setShows(list.length ? sortShows(list) : fallbackShows);
    } catch {
      setShows(fallbackShows);
    }
  }, [fallbackShows]);

  useEffect(() => {
    loadShows();
    if (realtimeReady) return undefined;
    const intervalId = window.setInterval(loadShows, SHOWS_POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadShows, realtimeReady]);

  useEffect(() => {
    if (!realtimeReady) return undefined;
    const socket = socketRef?.current;
    if (!socket) return undefined;
    const onShowsChanged = (payload) => {
      if (!payload?.type) {
        loadShows();
        return;
      }
      setShows((prev) => applyShowChange(prev, payload));
    };
    socket.on('shows:changed', onShowsChanged);
    return () => socket.off('shows:changed', onShowsChanged);
  }, [fallbackShows, loadShows, realtimeReady, socketRef]);

  useEffect(() => {
    onShowsChange?.(shows);
  }, [shows, onShowsChange]);

  useEffect(() => {
    if (!selectedShowDetail?.id) return;
    setShowDetailTab('info');
    setShowPostDraft('');
  }, [selectedShowDetail?.id]);

  useEffect(() => {
    if (!selectedArtistDetail?.id) return;
    setArtistDetailTab(selectedArtistDetail.initialTab || 'albums');
  }, [selectedArtistDetail?.id, selectedArtistDetail?.initialTab]);

  const showsForRender = useMemo(() => {
    const monthAbbr = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
    return shows.map((show) => {
      const date = new Date(show.startsAt);
      const dateLabel = Number.isNaN(date.getTime()) ? 'Data a confirmar' : `${date.getDate()} de ${monthAbbr[date.getMonth()]}`;
      return {
        id: show.id,
        artist: show.artist,
        venue: show.venue,
        city: show.city,
        country: show.country || 'Brasil',
        coords: [Number(show.longitude), Number(show.latitude)],
        dateLabel,
        thumb: show.thumbUrl || `https://picsum.photos/seed/${encodeURIComponent(show.artist || show.id)}/112/112`
      };
    });
  }, [shows]);

  const currentShowForum = useMemo(() => {
    const showId = selectedShowDetail?.id;
    if (!showId) return [];
    return showForumById[showId] || [];
  }, [selectedShowDetail?.id, showForumById]);

  function toggleLike(postId) {
    setFeedPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, liked: !post.liked, likes: post.liked ? Math.max(0, post.likes - 1) : post.likes + 1 } : post))
    );
  }

  function addComment(postId) {
    const draft = (commentDrafts[postId] || '').trim();
    if (!draft) return;
    setFeedPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, comments: [...post.comments, { id: `c-${postId}-${Date.now()}`, user: 'voce', text: draft, likes: 0, liked: false, replies: [] }] } : post))
    );
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
  }

  function toggleReplyInput(postId, commentId) {
    const key = `${postId}:${commentId}`;
    setReplyOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function addReply(postId, commentId) {
    const key = `${postId}:${commentId}`;
    const draft = (replyDrafts[key] || '').trim();
    if (!draft) return;
    setFeedPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, comments: post.comments.map((comment) => (comment.id === commentId ? { ...comment, replies: [...comment.replies, { id: `r-${commentId}-${Date.now()}`, user: 'voce', text: draft }] } : comment)) }
          : post
      )
    );
    setReplyDrafts((prev) => ({ ...prev, [key]: '' }));
    setReplyOpen((prev) => ({ ...prev, [key]: false }));
  }

  function toggleCommentLike(postId, commentId) {
    setFeedPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((comment) =>
                comment.id === commentId ? { ...comment, liked: !comment.liked, likes: comment.liked ? Math.max(0, comment.likes - 1) : comment.likes + 1 } : comment
              )
            }
          : post
      )
    );
  }

  function addShowPost() {
    const showId = selectedShowDetail?.id;
    const text = showPostDraft.trim();
    if (!showId || !text) return;
    const newPost = { id: `sp-${Date.now()}`, user: 'voce', text, likes: 0, liked: false, comments: [] };
    setShowForumById((prev) => {
      const nextPosts = [newPost, ...(prev[showId] || [])].slice(0, MAX_FORUM_POSTS);
      return capForumMap({ ...prev, [showId]: nextPosts }, showId);
    });
    setShowPostDraft('');
  }

  function toggleShowPostLike(postId) {
    const showId = selectedShowDetail?.id;
    if (!showId) return;
    setShowForumById((prev) => ({
      ...prev,
      [showId]: (prev[showId] || []).map((post) =>
        post.id === postId ? { ...post, liked: !post.liked, likes: post.liked ? Math.max(0, post.likes - 1) : post.likes + 1 } : post
      )
    }));
  }

  function addShowComment(postId) {
    const showId = selectedShowDetail?.id;
    if (!showId) return;
    const key = buildForumKey(showId, postId);
    const text = (showCommentDrafts[key] || '').trim();
    if (!text) return;
    const comment = { id: `sc-${Date.now()}`, user: 'voce', text, likes: 0, liked: false, replies: [] };
    setShowForumById((prev) => {
      const next = {
        ...prev,
        [showId]: (prev[showId] || []).map((post) => (post.id === postId ? { ...post, comments: [...post.comments, comment].slice(-MAX_FORUM_COMMENTS) } : post))
      };
      return capForumMap(next, showId);
    });
    setShowCommentDrafts((prev) => ({ ...prev, [key]: '' }));
  }

  function toggleShowCommentLike(postId, commentId) {
    const showId = selectedShowDetail?.id;
    if (!showId) return;
    setShowForumById((prev) => ({
      ...prev,
      [showId]: (prev[showId] || []).map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((comment) =>
                comment.id === commentId ? { ...comment, liked: !comment.liked, likes: comment.liked ? Math.max(0, comment.likes - 1) : comment.likes + 1 } : comment
              )
            }
          : post
      )
    }));
  }

  function toggleShowReplyInput(postId, commentId) {
    const showId = selectedShowDetail?.id;
    if (!showId) return;
    const key = buildForumKey(showId, `${postId}:${commentId}`);
    setShowReplyOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function addShowReply(postId, commentId) {
    const showId = selectedShowDetail?.id;
    if (!showId) return;
    const key = buildForumKey(showId, `${postId}:${commentId}`);
    const text = (showReplyDrafts[key] || '').trim();
    if (!text) return;
    setShowForumById((prev) => {
      const next = {
        ...prev,
        [showId]: (prev[showId] || []).map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments.map((comment) =>
                  comment.id === commentId
                    ? { ...comment, replies: [...comment.replies, { id: `sr-${Date.now()}`, user: 'voce', text }].slice(-MAX_FORUM_REPLIES) }
                    : comment
                )
              }
            : post
        )
      };
      return capForumMap(next, showId);
    });
    setShowReplyDrafts((prev) => ({ ...prev, [key]: '' }));
    setShowReplyOpen((prev) => ({ ...prev, [key]: false }));
  }

  function openUserProfile(userName, extra = {}) {
    const safeName = userName || 'Usuario';
    onUserClick?.({
      name: safeName,
      avatar: extra.avatar || `https://i.pravatar.cc/120?u=${encodeURIComponent(safeName)}`,
      city: extra.city || 'Cidade indisponivel',
      bio: extra.bio || '',
      recentTracks: extra.recentTracks || []
    });
  }

  function openArtistDetail(artistPayload) {
    if (!artistPayload?.name && !artistPayload?.artist && !artistPayload?.artistName) return;
    onArtistClick?.(artistPayload);
  }

  if (collapsed) {
    return (
      <button type="button" className="right-panel-expand" onClick={onToggleCollapse} aria-label="Expandir painel">
        <ChevronLeft size={18} />
      </button>
    );
  }

  const isShowDetailOpen = Boolean(selectedShowDetail);
  const isArtistDetailOpen = !isShowDetailOpen && Boolean(selectedArtistDetail);
  const isUserDetailOpen = !isShowDetailOpen && !isArtistDetailOpen && Boolean(selectedUserDetail);
  const isDetailOpen = isShowDetailOpen || isArtistDetailOpen || isUserDetailOpen;
  const showDetailThumb = selectedShowDetail?.thumbUrl || `https://picsum.photos/seed/${encodeURIComponent(selectedShowDetail?.artist || 'evento')}/900/560`;
  const artistSections = selectedArtistDetail?.sections || {};
  const artistItems = artistSections[artistDetailTab] || [];
  const artistHeroImage = selectedArtistDetail?.heroImage || `https://picsum.photos/seed/${encodeURIComponent(selectedArtistDetail?.name || 'artista')}/1200/1600`;
  const rightPanelClassName = isUserDetailOpen ? 'right-panel user-profile-mode' : isArtistDetailOpen ? 'right-panel artist-detail-mode' : 'right-panel';

  return (
    <div className={rightPanelClassName}>
      {!isUserDetailOpen && !isArtistDetailOpen && (
        <div className="right-head">
          {!isDetailOpen ? (
            <div className="feed-tabs">
              <button type="button" className={activeTab === 'feed' ? 'feed-tab active' : 'feed-tab'} onClick={() => setActiveTab('feed')}>
                Feed
              </button>
              <button type="button" className={activeTab === 'buzz' ? 'feed-tab active' : 'feed-tab'} onClick={() => setActiveTab('buzz')}>
                Buzz
              </button>
              <button type="button" className={activeTab === 'shows' ? 'feed-tab active' : 'feed-tab'} onClick={() => setActiveTab('shows')}>
                Shows
              </button>
            </div>
          ) : (
            <div className="feed-tabs" />
          )}
          <button type="button" className="right-panel-collapse" onClick={onToggleCollapse} aria-label="Recolher painel">
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      <div className={isDetailOpen ? 'feed-box show-detail-mode' : 'feed-box'}>
        {isShowDetailOpen && (
          <article className="show-detail-card">
            <img src={showDetailThumb} alt={selectedShowDetail?.artist || 'Evento'} className="show-detail-cover" />
            <div className="show-detail-body">
              <div className="show-detail-head">
                <h3>
                  <button
                    type="button"
                    className="artist-detail-inline-trigger"
                    onClick={() =>
                      openArtistDetail({
                        artistId: selectedShowDetail?.artistId,
                        name: selectedShowDetail?.artist || 'Evento',
                        thumbUrl: selectedShowDetail?.thumbUrl || null
                      })
                    }
                  >
                    {selectedShowDetail?.artist || 'Evento'}
                  </button>
                </h3>
                <button type="button" className="show-detail-close" onClick={onCloseShowDetail} aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>

              <div className="show-detail-tabs">
                <button type="button" className={showDetailTab === 'info' ? 'feed-tab active' : 'feed-tab'} onClick={() => setShowDetailTab('info')}>
                  Informações
                </button>
                <button type="button" className={showDetailTab === 'forum' ? 'feed-tab active' : 'feed-tab'} onClick={() => setShowDetailTab('forum')}>
                  Fórum
                </button>
              </div>

              {showDetailTab === 'info' && (
                <div className="show-detail-pane">
                  <div className="show-detail-meta-group">
                    <p className="show-detail-line">{formatShowDate(selectedShowDetail?.startsAt)}</p>
                    <p className="show-detail-line">
                      {selectedShowDetail?.venue || 'Local a confirmar'} - {selectedShowDetail?.city || 'Cidade a confirmar'}
                    </p>
                    <p className="show-detail-address">{selectedShowDetail?.address || 'Endereço não informado'}</p>
                  </div>
                  <p className="show-detail-desc">{selectedShowDetail?.description || 'Descrição não informada.'}</p>
                  <div className="show-detail-actions">
                    <button
                      type="button"
                      className="show-ticket-btn"
                      onClick={() =>
                        onFocusItem({
                          coords: [Number(selectedShowDetail?.longitude), Number(selectedShowDetail?.latitude)],
                          city: selectedShowDetail?.city,
                          country: selectedShowDetail?.country || 'Brasil'
                        })
                      }
                    >
                      Ver no mapa
                    </button>
                    {selectedShowDetail?.ticketUrl ? (
                      <a href={selectedShowDetail.ticketUrl} target="_blank" rel="noreferrer" className="feed-link secondary">
                        Ingressos
                      </a>
                    ) : (
                      <button type="button" className="feed-link secondary" disabled>
                        Sem ingressos
                      </button>
                    )}
                  </div>
                </div>
              )}

              {showDetailTab === 'forum' && (
                <div className="show-detail-pane">
                  <div className="social-comment-box show-forum-new-post">
                    <input value={showPostDraft} onChange={(event) => setShowPostDraft(event.target.value)} placeholder="Escreva uma publicação para este evento" />
                    <button type="button" className="social-send-btn" onClick={addShowPost}>
                      Publicar
                    </button>
                  </div>

                  <div className="social-comments show-forum-list">
                    {currentShowForum.map((post) => {
                      const commentDraftKey = buildForumKey(selectedShowDetail.id, post.id);
                      return (
                        <div key={post.id} className="social-comment-wrap show-forum-post">
                          <div className="social-comment-row">
                            <p className="social-comment">
                              <strong>
                                <button type="button" className="social-inline-user" onClick={() => openUserProfile(post.user)}>
                                  {post.user}
                                </button>
                              </strong>{' '}
                              {post.text}
                            </p>
                            <button type="button" className={post.liked ? 'social-comment-like liked' : 'social-comment-like'} onClick={() => toggleShowPostLike(post.id)}>
                              <Heart size={11} />
                              {post.likes}
                            </button>
                          </div>

                          <div className="social-replies">
                            {post.comments.map((comment) => {
                              const replyKey = buildForumKey(selectedShowDetail.id, `${post.id}:${comment.id}`);
                              return (
                                <div key={comment.id} className="social-comment-wrap">
                                  <div className="social-comment-row">
                                    <p className="social-comment">
                                      <strong>
                                        <button type="button" className="social-inline-user" onClick={() => openUserProfile(comment.user)}>
                                          {comment.user}
                                        </button>
                                      </strong>{' '}
                                      {comment.text}
                                    </p>
                                    <button
                                      type="button"
                                      className={comment.liked ? 'social-comment-like liked' : 'social-comment-like'}
                                      onClick={() => toggleShowCommentLike(post.id, comment.id)}
                                    >
                                      <Heart size={11} />
                                      {comment.likes}
                                    </button>
                                  </div>
                                  <button type="button" className="social-reply-toggle" onClick={() => toggleShowReplyInput(post.id, comment.id)}>
                                    Responder
                                  </button>
                                  {comment.replies.map((reply) => (
                                    <p key={reply.id} className="social-reply">
                                      <strong>
                                        <button type="button" className="social-inline-user" onClick={() => openUserProfile(reply.user)}>
                                          {reply.user}
                                        </button>
                                      </strong>{' '}
                                      {reply.text}
                                    </p>
                                  ))}
                                  {showReplyOpen[replyKey] && (
                                    <div className="social-reply-box">
                                      <input
                                        value={showReplyDrafts[replyKey] || ''}
                                        onChange={(event) => setShowReplyDrafts((prev) => ({ ...prev, [replyKey]: event.target.value }))}
                                        placeholder="Escreva uma resposta"
                                      />
                                      <button type="button" className="social-send-btn" onClick={() => addShowReply(post.id, comment.id)}>
                                        Enviar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="social-comment-box">
                            <input
                              value={showCommentDrafts[commentDraftKey] || ''}
                              onChange={(event) => setShowCommentDrafts((prev) => ({ ...prev, [commentDraftKey]: event.target.value }))}
                              placeholder="Comente essa publicação"
                            />
                            <button type="button" className="social-send-btn" onClick={() => addShowComment(post.id)}>
                              Comentar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {currentShowForum.length === 0 && <div className="feed-empty">Nenhuma publicação ainda.</div>}
                  </div>
                </div>
              )}
            </div>
          </article>
        )}

        {isArtistDetailOpen && (
          <article className="artist-detail-card">
            <div className="artist-detail-hero">
              <img src={artistHeroImage} alt={selectedArtistDetail?.name || 'Artista'} className="artist-detail-cover" />
              <div className="artist-detail-overlay" />
              <button type="button" className="artist-detail-close" onClick={onCloseArtistDetail} aria-label="Fechar">
                <X size={20} />
              </button>
              <div className="artist-detail-copy">
                <h3>{selectedArtistDetail?.name || 'Artista'}</h3>
                <div className="artist-detail-listener-row">
                  <div className="artist-detail-listeners-avatars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>{selectedArtistDetail?.listenersLabel || '68.598 ouvintes no mapa'}</p>
                </div>
              </div>
            </div>

            <div className="artist-detail-body">
              <div className="artist-detail-tabs">
                <button type="button" className={artistDetailTab === 'albums' ? 'feed-tab active' : 'feed-tab'} onClick={() => setArtistDetailTab('albums')}>
                  Álbuns
                </button>
                <button type="button" className={artistDetailTab === 'tracks' ? 'feed-tab active' : 'feed-tab'} onClick={() => setArtistDetailTab('tracks')}>
                  Faixas
                </button>
                <button type="button" className={artistDetailTab === 'singles' ? 'feed-tab active' : 'feed-tab'} onClick={() => setArtistDetailTab('singles')}>
                  Singles
                </button>
                <button type="button" className={artistDetailTab === 'shows' ? 'feed-tab active' : 'feed-tab'} onClick={() => setArtistDetailTab('shows')}>
                  Shows
                </button>
                <button type="button" className="artist-detail-search-btn" aria-label="Buscar">
                  <Search size={18} />
                </button>
              </div>

              <div className="artist-detail-grid">
                {artistDetailTab === 'albums' &&
                  artistItems.map((item) => (
                    <article key={item.id} className="artist-detail-item">
                      <img src={item.image} alt={item.title} className="artist-detail-item-cover" />
                      <div className="artist-detail-item-copy">
                        <h4>{item.title}</h4>
                        <p className="artist-detail-item-subtitle">{item.subtitle}</p>
                        <p className="artist-detail-item-meta">{item.meta}</p>
                      </div>
                    </article>
                  ))}

                {artistDetailTab === 'singles' && (
                  <div className="artist-singles-list">
                    {artistItems.map((item) => (
                      <article key={item.id} className="artist-single-row">
                        <img src={item.image} alt={item.title} className="artist-single-cover" />
                        <div className="artist-single-copy">
                          <h4>{item.title}</h4>
                          <p>{item.subtitle}</p>
                        </div>
                        <span className="artist-single-duration">{item.meta}</span>
                      </article>
                    ))}
                  </div>
                )}

                {artistDetailTab === 'shows' && (
                  <div className="artist-shows-list">
                    {artistItems.map((item) => (
                      <article key={item.id} className="artist-show-row">
                        <div className="artist-show-date">{item.meta}</div>
                        <div className="artist-show-copy">
                          <h4>{item.title}</h4>
                          <p>{item.subtitle}</p>
                        </div>
                        <button type="button" className="artist-show-cta">
                          {item.cta || 'Ingressos'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                {artistDetailTab === 'tracks' &&
                  artistItems.map((item) => (
                    <article key={item.id} className="artist-tracks-panel">
                      <div className="artist-tracks-release">
                        <img src={item.image} alt={item.title} className="artist-tracks-release-cover" />
                        <div className="artist-tracks-release-copy">
                          <h4>{item.title}</h4>
                          <p>{item.subtitle}</p>
                        </div>
                        <button type="button" className="artist-tracks-return" aria-label="Voltar">
                          ↩
                        </button>
                      </div>

                      <div className="artist-tracks-list">
                        {Array.isArray(item.tracks) &&
                          item.tracks.map((track) => (
                            <div key={track.id} className="artist-track-row">
                              <button type="button" className={track.active ? 'artist-track-play active' : 'artist-track-play'} aria-label={`Tocar ${track.title}`}>
                                <Play size={16} fill="currentColor" />
                              </button>
                              <div className="artist-track-copy">
                                <h5>{track.title}</h5>
                                <p>{track.subtitle}</p>
                              </div>
                              <div className="artist-track-metrics">
                                <span className="artist-track-listeners">
                                  <i />
                                  {track.listeners}
                                </span>
                                <span className="artist-track-duration">{track.duration}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          </article>
        )}

        {isUserDetailOpen && (
          <UserProfile profile={selectedUserDetail} onBack={onCloseUserDetail} onForward={onToggleCollapse} onChatOpen={onUserChat} />
        )}

        {!isDetailOpen && activeTab === 'feed' && (
          <div className="social-feed-list">
            {feedPosts.map((post) => (
              <article key={post.id} className="social-card">
                <header className="social-head">
                  <img src={post.avatar} alt={post.name} width="40" height="40" className="social-avatar" />
                  <div className="social-user-copy">
                    <button type="button" className="social-username as-link" onClick={() => openUserProfile(post.name, { avatar: post.avatar, city: post.city })}>
                      {post.user}
                    </button>
                    <button type="button" className="social-location" onClick={() => onFocusItem({ coords: post.coords, city: post.city, country: post.country })}>
                      {post.city}, {post.country}
                    </button>
                  </div>
                  <span className="social-time">{post.ago}</span>
                </header>
                <img src={post.image} alt={`Post de ${post.name}`} className="social-media" />
                <div className="social-actions">
                  <button type="button" className={post.liked ? 'social-action liked' : 'social-action'} onClick={() => toggleLike(post.id)}>
                    <Heart size={14} />
                    {post.likes}
                  </button>
                  <button type="button" className="social-action">
                    <MessageCircle size={14} />
                    {post.comments.length}
                  </button>
                </div>
                <p className="social-caption">
                  <strong>
                    <button type="button" className="social-inline-user" onClick={() => openUserProfile(post.name, { avatar: post.avatar, city: post.city })}>
                      {post.user}
                    </button>
                  </strong>{' '}
                  {post.caption}
                </p>
                <div className="social-comments">
                  {post.comments.map((comment) => {
                    const key = `${post.id}:${comment.id}`;
                    return (
                      <div key={comment.id} className="social-comment-wrap">
                        <div className="social-comment-row">
                          <p className="social-comment">
                            <strong>
                              <button type="button" className="social-inline-user" onClick={() => openUserProfile(comment.user)}>
                                {comment.user}
                              </button>
                            </strong>{' '}
                            {comment.text}
                          </p>
                          <button type="button" className={comment.liked ? 'social-comment-like liked' : 'social-comment-like'} onClick={() => toggleCommentLike(post.id, comment.id)}>
                            <Heart size={11} />
                            {comment.likes}
                          </button>
                        </div>
                        <button type="button" className="social-reply-toggle" onClick={() => toggleReplyInput(post.id, comment.id)}>
                          Responder
                        </button>
                        {comment.replies.length > 0 && (
                          <div className="social-replies">
                            {comment.replies.map((reply) => (
                              <p key={reply.id} className="social-reply">
                                <strong>
                                  <button type="button" className="social-inline-user" onClick={() => openUserProfile(reply.user)}>
                                    {reply.user}
                                  </button>
                                </strong>{' '}
                                {reply.text}
                              </p>
                            ))}
                          </div>
                        )}
                        {replyOpen[key] && (
                          <div className="social-reply-box">
                            <input value={replyDrafts[key] || ''} onChange={(event) => setReplyDrafts((prev) => ({ ...prev, [key]: event.target.value }))} placeholder="Responder comentário" />
                            <button type="button" className="social-send-btn" onClick={() => addReply(post.id, comment.id)}>
                              Enviar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="social-comment-box">
                  <input value={commentDrafts[post.id] || ''} onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [post.id]: event.target.value }))} placeholder="Adicione um comentário" />
                  <button type="button" className="social-send-btn" onClick={() => addComment(post.id)}>
                    Comentar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!isDetailOpen && activeTab === 'buzz' && <BuzzCommunitiesPanel />}

        {!isDetailOpen && activeTab === 'shows' && (
          <div className="shows-list-wrap">
            <div className="shows-toolbar">
              <h3>Shows</h3>
            </div>
            <div className="shows-list">
              {showsForRender.map((show) => (
                <div key={show.id} className="show-card">
                  <img src={show.thumb} alt={show.artist} width="56" height="56" className="show-thumb" />
                  <div className="show-copy">
                    <p className="show-artist">
                      <button
                        type="button"
                        className="artist-detail-inline-trigger"
                        onClick={() =>
                          openArtistDetail({
                            id: `artist:${show.id}`,
                            name: show.artist,
                            thumbUrl: show.thumb
                          })
                        }
                      >
                        {show.artist}
                      </button>
                    </p>
                    <p className="show-meta">
                      {show.dateLabel} •{' '}
                      <button type="button" className="show-venue-link" onClick={() => onFocusItem({ coords: show.coords, city: show.city, country: show.country })}>
                        {show.venue} - {show.city}
                      </button>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="show-ticket-btn"
                    onClick={() => onOpenItem({ artist: show.artist, city: show.city, country: show.country, coords: show.coords, listeners: 0, likes: 0, comments: 0 })}
                  >
                    Ingressos
                  </button>
                </div>
              ))}
              {showsForRender.length === 0 && <div className="feed-empty">Nenhum show cadastrado.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
