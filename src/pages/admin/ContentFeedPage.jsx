import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Eye, Heart, Images, Mic2, Pencil, Plus, Upload, Users, Video } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { mockAdminFeedItems } from '../../mocks/adminContentFeed';
import '../../styles/admin-content-feed.css';

const STORAGE_KEY = 'muusic.admin.content.feed';

const CONTENT_TYPES = [
  {
    value: 'simple_image',
    label: 'Imagem simples / carrossel',
    icon: Images,
    mediaHint: 'Links das imagens do post'
  },
  {
    value: 'photo_album',
    label: 'Álbum de fotos',
    icon: Images,
    mediaHint: 'Links das fotos do álbum'
  },
  {
    value: 'ana_stories',
    label: 'Stories da Ana',
    icon: Video,
    mediaHint: 'Links dos stories'
  },
  {
    value: 'ana_audio',
    label: 'Áudio da Ana',
    icon: Mic2,
    mediaHint: 'Link do arquivo de áudio'
  },
  {
    value: 'poll',
    label: 'Enquete, com ou sem imagem',
    icon: Eye,
    mediaHint: 'Imagem opcional da enquete'
  },
  {
    value: 'tiktok_video',
    label: 'Video TikTok',
    icon: Video,
    mediaHint: 'Link do vídeo'
  }
];

const STATUS_META = {
  published: {
    dot: 'bg-emerald-400'
  },
  scheduled: {
    dot: 'bg-amber-400'
  },
  inactive: {
    dot: 'bg-slate-500'
  }
};

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatCompact(value) {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function toDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function getContentTypeMeta(contentType) {
  return CONTENT_TYPES.find((item) => item.value === contentType) || CONTENT_TYPES[0];
}

function EmptyPreview({ type }) {
  return (
    <div className="grid h-[340px] place-items-center rounded-[12px] border border-dashed border-white/10 bg-black/30 text-sm text-slate-300">
      {type === 'video' ? 'Vídeo indisponível para preview.' : 'Imagem indisponível para preview.'}
    </div>
  );
}

function PreviewModal({ item, onClose }) {
  if (!item) return null;

  const typeMeta = getContentTypeMeta(item.contentType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <button type="button" className="admin-content-feed-overlay absolute inset-0" onClick={onClose} aria-label="Fechar preview" />
      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Preview do conteúdo</p>
            <div className="mt-1 flex items-center gap-3">
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <span className="admin-content-feed-type-pill inline-flex items-center px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]">
                {item.type === 'video' ? 'Vídeo' : 'Imagem'}
              </span>
              <span className="admin-content-feed-type-pill inline-flex items-center px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]">
                {typeMeta.label}
              </span>
            </div>
          </div>
          <Button type="button" variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="p-6">
          {item.type === 'video' ? (
            item.mediaUrl ? (
              <video
                key={item.mediaUrl}
                src={item.mediaUrl}
                poster={item.thumbnail}
                controls
                autoPlay
                playsInline
                className="max-h-[70vh] w-full rounded-[12px] bg-black object-contain"
                style={{ accentColor: '#94a3b8' }}
              />
            ) : (
              <EmptyPreview type="video" />
            )
          ) : item.mediaUrl ? (
            <img src={item.mediaUrl} alt={item.title} className="max-h-[70vh] w-full rounded-[12px] bg-black object-contain" />
          ) : (
            <EmptyPreview type="image" />
          )}
        </div>
      </div>
    </div>
  );
}

function StatusSwitch({ checked, onClick }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      className={`admin-content-feed-switch peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full shadow-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        checked ? 'is-checked' : ''
      }`}
    >
      <span
        className={`admin-content-feed-switch-thumb pointer-events-none inline-block h-5 w-5 rounded-full bg-white ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-[20px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function makeInitialDraft() {
  return {
    id: '',
    title: '',
    creatorName: '',
    contentType: 'simple_image',
    type: 'image',
    thumbnail: '',
    mediaUrl: '',
    mediaGallery: '',
    audioUrl: '',
    question: '',
    pollOptions: 'Opção 1\nOpção 2',
    status: 'scheduled',
    publishedAt: '',
    likes: 0,
    reach: 0
  };
}

function ContentTypeSelector({ value, onSelect }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {CONTENT_TYPES.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={`admin-content-type-option text-left ${selected ? 'is-selected' : ''}`}
          >
            <div className="flex items-start gap-4">
              <div className={`admin-content-type-icon ${selected ? 'is-selected' : ''}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{option.label}</p>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EditorField({ label, children }) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MockUploadField({ label, helper, multiple = false }) {
  return (
    <EditorField label={label}>
      <button type="button" className="admin-content-upload-field">
        <span className="admin-content-upload-icon">
          <Upload className="h-4 w-4" />
        </span>
        <span className="text-left">
          <span className="block text-sm font-medium text-white">{multiple ? 'Selecionar arquivos' : 'Selecionar arquivo'}</span>
          {helper ? <span className="mt-1 block text-sm text-slate-400">{helper}</span> : null}
        </span>
      </button>
    </EditorField>
  );
}

function ContentEditorPage({ draft, onChange, onBack, onSubmit }) {
  const typeMeta = getContentTypeMeta(draft.contentType);
  const isPoll = draft.contentType === 'poll';
  const isAudio = draft.contentType === 'ana_audio';
  const isMultiMedia =
    draft.contentType === 'simple_image' || draft.contentType === 'photo_album' || draft.contentType === 'ana_stories';
  const previewMedia =
    draft.thumbnail ||
    draft.mediaUrl ||
    draft.audioUrl ||
    draft.mediaGallery.split('\n').map((item) => item.trim()).find(Boolean) ||
    '';
  const previewKind =
    draft.contentType === 'ana_stories' || draft.contentType === 'tiktok_video' ? 'Vídeo' : draft.contentType === 'ana_audio' ? 'Áudio' : 'Imagem';
  const pollOptions = draft.pollOptions
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title={draft.id ? 'Editar conteúdo' : 'Novo conteúdo'}
        subtitle="Escolha o formato e complete o restante dos campos abaixo."
        actions={
          <Button variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={onBack}>
            Voltar para o feed
          </Button>
        }
      />

      <div className="admin-content-breadcrumb">
        <span>V1</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>Feed</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{draft.id ? 'Editar conteúdo' : 'Novo conteúdo'}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border-white/10 bg-slate-950 text-white">
          <CardContent className="space-y-8 pt-6">
            <section className="space-y-4">
              <ContentTypeSelector value={draft.contentType} onSelect={(nextType) => onChange('contentType', nextType)} />
            </section>

            <section className="admin-content-editor-section">
              <div className="admin-content-editor-section-head">
                <h3 className="text-lg font-semibold text-white">Informações básicas</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <EditorField label="Título">
                  <input
                    className="admin-content-editor-input"
                    value={draft.title}
                    onChange={(event) => onChange('title', event.target.value)}
                    placeholder="Ex: Highlights do fim de semana"
                  />
                </EditorField>

                <MockUploadField label="Imagem de capa" helper="Mockup de upload. O envio real será implementado depois." />
              </div>
            </section>

            <section className="admin-content-editor-section">
              <div className="admin-content-editor-section-head">
                <div>
                  <h3 className="mt-2 text-lg font-semibold text-white">{typeMeta.label}</h3>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {isMultiMedia ? (
                  <MockUploadField label={draft.contentType === 'photo_album' ? 'Uploads de imagens' : 'Uploads de mídia'} helper="Mockup de upload múltiplo." multiple />
                ) : null}

                {!isAudio && !isPoll && draft.contentType !== 'simple_image' && draft.contentType !== 'photo_album' && draft.contentType !== 'ana_stories' ? (
                  <EditorField label={typeMeta.mediaHint}>
                    <input
                      className="admin-content-editor-input"
                      value={draft.mediaUrl}
                      onChange={(event) => onChange('mediaUrl', event.target.value)}
                      placeholder="https://..."
                    />
                  </EditorField>
                ) : null}

                {draft.contentType === 'simple_image' ? (
                  <MockUploadField label="Upload da imagem ou do carrossel" helper="Mockup de upload." multiple />
                ) : null}

                {isAudio ? (
                  <EditorField label="Link do áudio da Ana">
                    <input
                      className="admin-content-editor-input"
                      value={draft.audioUrl}
                      onChange={(event) => onChange('audioUrl', event.target.value)}
                      placeholder="https://..."
                    />
                  </EditorField>
                ) : null}

                {isPoll ? (
                  <>
                    <EditorField label="Pergunta da enquete">
                      <input
                        className="admin-content-editor-input"
                        value={draft.question}
                        onChange={(event) => onChange('question', event.target.value)}
                        placeholder="Qual lançamento deve abrir a semana?"
                      />
                    </EditorField>

                    <EditorField label="Opções da enquete">
                      <textarea
                        className="admin-content-editor-input admin-content-editor-textarea"
                        value={draft.pollOptions}
                        onChange={(event) => onChange('pollOptions', event.target.value)}
                        placeholder={'Opção 1\nOpção 2\nOpção 3'}
                      />
                    </EditorField>

                    <EditorField label="Imagem opcional da enquete">
                      <MockUploadField label="Imagem opcional da enquete" helper="Mockup de upload." />
                    </EditorField>
                  </>
                ) : null}

                {draft.contentType === 'tiktok_video' ? (
                  <EditorField label="URL do vídeo TikTok">
                    <input
                      className="admin-content-editor-input"
                      value={draft.mediaUrl}
                      onChange={(event) => onChange('mediaUrl', event.target.value)}
                      placeholder="https://..."
                    />
                  </EditorField>
                ) : null}
              </div>
            </section>
          </CardContent>
        </Card>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="border-white/10 bg-slate-950 text-white">
            <CardContent className="space-y-5 pt-6">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Resumo da publicação</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{draft.title || 'Novo conteúdo'}</h3>
                <p className="mt-1 text-sm text-slate-400">{typeMeta.label}</p>
              </div>

              <div className="overflow-hidden rounded-[12px] border border-white/10 bg-white/[0.03]">
                {isPoll ? (
                  <div className="admin-content-preview-poll">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Enquete</p>
                        <h4 className="mt-2 text-base font-semibold text-white">{draft.question || 'Pergunta da enquete'}</h4>
                      </div>

                      <div className="space-y-2">
                        {pollOptions.length ? (
                          pollOptions.map((option, index) => (
                            <div key={`${option}-${index}`} className="admin-content-preview-poll-option">
                              <span>{option}</span>
                            </div>
                          ))
                        ) : (
                          <div className="admin-content-preview-poll-empty">Adicione as opções da enquete.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : isAudio ? (
                  <div className="admin-content-preview-audio">
                    <div className="admin-content-preview-audio-art">
                      {draft.thumbnail ? <img src={draft.thumbnail} alt={draft.title || 'Capa do áudio'} className="h-full w-full object-cover" /> : <Mic2 className="h-8 w-8 text-slate-300" />}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Áudio da Ana</p>
                        <h4 className="mt-2 text-base font-semibold text-white">{draft.title || 'Novo áudio'}</h4>
                        <p className="mt-1 text-sm text-slate-400">{draft.audioUrl ? 'Arquivo pronto para publicação.' : 'Adicione o link do áudio para visualizar este bloco.'}</p>
                      </div>
                      <div className="admin-content-preview-audio-bar">
                        <span className="admin-content-preview-audio-progress" />
                      </div>
                    </div>
                  </div>
                ) : previewMedia ? (
                  <div className="relative aspect-[4/3]">
                    <img src={draft.thumbnail || previewMedia} alt={draft.title || 'Preview'} className="h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent px-4 pb-3 pt-8">
                      <span className="admin-content-feed-type-pill inline-flex items-center px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em]">
                        {previewKind}
                      </span>
                      <span className="admin-content-feed-type-pill inline-flex items-center px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em]">
                        {typeMeta.label}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid aspect-[4/3] place-items-center text-sm text-slate-400">Preview do conteúdo</div>
                )}
              </div>

              <div className="space-y-3 border-t border-white/10 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-white/15 text-white hover:bg-white/10"
                  onClick={() => onSubmit('inactive')}
                >
                  Salvar como rascunho
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-white/15 text-white hover:bg-white/10"
                  onClick={() => onSubmit('scheduled')}
                >
                  Agendar
                </Button>
                <Button type="button" className="w-full bg-sky-500 text-slate-950 hover:bg-sky-400" onClick={() => onSubmit('published')}>
                  Publicar agora
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function normalizeDraftForSave(draft, nextStatus) {
  const mediaUrl =
    draft.contentType === 'ana_audio'
      ? draft.audioUrl
      : draft.contentType === 'poll'
        ? draft.mediaUrl
        : draft.contentType === 'simple_image'
          ? draft.mediaUrl
          : draft.mediaUrl || draft.thumbnail;

  const contentType = draft.contentType;
  const isVideoType = contentType === 'ana_stories' || contentType === 'tiktok_video';

  return {
    ...draft,
    id: draft.id || `feed-${Date.now()}`,
    status: nextStatus,
    type: isVideoType ? 'video' : 'image',
    mediaUrl: mediaUrl || draft.thumbnail || '',
    publishedAt: draft.publishedAt ? new Date(draft.publishedAt).toISOString() : new Date().toISOString(),
    likes: Number(draft.likes || 0),
    reach: Number(draft.reach || 0)
  };
}

export default function ContentFeedPage() {
  const [items, setItems] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      return Array.isArray(stored) && stored.length ? stored : mockAdminFeedItems;
    } catch {
      return mockAdminFeedItems;
    }
  });
  const [previewItem, setPreviewItem] = useState(null);
  const [editorDraft, setEditorDraft] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const listItems = useMemo(() => items, [items]);

  function openNewPage() {
    setEditorDraft(makeInitialDraft());
  }

  function openEditPage(item) {
    setEditorDraft({
      ...makeInitialDraft(),
      ...item,
      publishedAt: toDateTimeLocalValue(item.publishedAt),
      likes: Number(item.likes || 0),
      reach: Number(item.reach || 0),
      contentType: item.contentType || 'simple_image',
      mediaGallery: item.mediaGallery || '',
      pollOptions: item.pollOptions || 'Opção 1\nOpção 2',
      question: item.question || '',
      audioUrl: item.audioUrl || ''
    });
  }

  function updateDraft(field, value) {
    setEditorDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function submitDraft(nextStatus) {
    if (!editorDraft) return;

    const normalized = normalizeDraftForSave(editorDraft, nextStatus);
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.id === normalized.id);
      if (existingIndex === -1) return [normalized, ...current];
      const next = [...current];
      next[existingIndex] = normalized;
      return next;
    });
    setEditorDraft(null);
  }

  function toggleItem(item) {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              status: entry.status === 'inactive' ? 'published' : 'inactive'
            }
          : entry
      )
    );
  }

  if (editorDraft) {
    return <ContentEditorPage draft={editorDraft} onChange={updateDraft} onBack={() => setEditorDraft(null)} onSubmit={submitDraft} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Conteúdo"
        subtitle="Operação editorial do time de marketing para o que aparece na plataforma."
        actions={
          <Button className="bg-sky-500 text-slate-950 hover:bg-sky-400" onClick={openNewPage}>
            <Plus className="h-4 w-4" />
            Adicionar novo
          </Button>
        }
      />

      <Card className="border-white/10 bg-slate-950 text-white">
        <CardHeader className="pb-0" />
        <CardContent className="pt-6">
          <Table className="bg-transparent text-white">
            <TableHeader className="bg-white/[0.03]">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-slate-500">Status</TableHead>
                <TableHead className="text-slate-500">Conteúdo</TableHead>
                <TableHead className="text-slate-500">Criador</TableHead>
                <TableHead className="text-slate-500">Data</TableHead>
                <TableHead className="text-slate-500">Likes</TableHead>
                <TableHead className="text-slate-500">Alcance</TableHead>
                <TableHead className="text-slate-500">Edição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listItems.map((item) => {
                const status = STATUS_META[item.status] || STATUS_META.inactive;
                const isActive = item.status !== 'inactive';
                const typeMeta = getContentTypeMeta(item.contentType);

                return (
                  <TableRow key={item.id} className="border-white/10 hover:bg-white/[0.03]">
                    <TableCell className="w-[118px]">
                      <div className="flex items-center gap-3 text-sm text-slate-200">
                        <span className={`h-3 w-3 shrink-0 rounded-full ${status.dot}`} />
                        <StatusSwitch checked={isActive} onClick={() => toggleItem(item)} />
                      </div>
                    </TableCell>

                    <TableCell className="min-w-[340px]">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="admin-content-feed-preview-trigger group relative h-24 w-32 shrink-0 overflow-hidden rounded-[12px] text-left"
                          aria-label={`Abrir preview de ${item.title}`}
                        >
                          <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/10 opacity-0 transition group-hover:opacity-100">
                            {item.type === 'video' ? <Video className="h-6 w-6 text-white" /> : <Eye className="h-6 w-6 text-white" />}
                          </span>
                          <span className="admin-content-feed-type-pill absolute bottom-2 left-2 inline-flex items-center px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em]">
                            {item.type === 'video' ? 'Vídeo' : 'Imagem'}
                          </span>
                        </button>

                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-400">{typeMeta.label}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="w-[160px] text-sm text-slate-300">{item.creatorName || '-'}</TableCell>

                    <TableCell className="w-[180px]">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <CalendarDays className="h-4 w-4 text-slate-500" />
                        <span>{formatDate(item.publishedAt)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="w-[120px]">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Heart className="h-4 w-4 text-slate-400" />
                        <span>{formatCompact(item.likes)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="w-[120px]">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Users className="h-4 w-4 text-slate-400" />
                        <span>{formatCompact(item.reach)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="w-[96px]">
                      <button
                        type="button"
                        onClick={() => openEditPage(item)}
                        className="admin-content-feed-edit-btn inline-flex h-10 w-10 items-center justify-center text-slate-200 transition"
                        aria-label={`Editar ${item.title}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
