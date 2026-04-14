import { useEffect, useState } from 'react';
import { CalendarDays, Eye, Heart, Pencil, Plus, Users, Video } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { mockAdminFeedItems } from '../../mocks/adminContentFeed';
import '../../styles/admin-content-feed.css';

const STORAGE_KEY = 'muusic.admin.content.feed';

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

function EmptyPreview({ type }) {
  return (
    <div className="grid h-[340px] place-items-center rounded-2xl border border-dashed border-white/10 bg-black/30 text-sm text-slate-300">
      {type === 'video' ? 'Vídeo indisponível para preview.' : 'Imagem indisponível para preview.'}
    </div>
  );
}

function PreviewModal({ item, onClose }) {
  if (!item) return null;

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

function FeedEditorModal({ draft, onChange, onClose, onSubmit, submitLabel }) {
  if (!draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <button type="button" className="admin-content-feed-overlay absolute inset-0" onClick={onClose} aria-label="Fechar editor" />
      <div className="relative z-10 w-full max-w-3xl rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Gestão de Conteúdo</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{submitLabel === 'Salvar conteúdo' ? 'Editar conteúdo' : 'Novo conteúdo'}</h3>
          </div>
          <Button type="button" variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={onClose}>
            Cancelar
          </Button>
        </div>

        <form
          className="grid gap-4 p-6 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Título
            <input
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400"
              value={draft.title}
              onChange={(event) => onChange('title', event.target.value)}
              placeholder="Ex: Highlights do fim de semana"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Criador
            <input
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400"
              value={draft.creatorName}
              onChange={(event) => onChange('creatorName', event.target.value)}
              placeholder="Nome da pessoa responsável"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Tipo
            <select
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400"
              value={draft.type}
              onChange={(event) => onChange('type', event.target.value)}
            >
              <option value="image">Imagem</option>
              <option value="video">Vídeo</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            URL da miniatura
            <input
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400"
              value={draft.thumbnail}
              onChange={(event) => onChange('thumbnail', event.target.value)}
              placeholder="https://..."
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            URL da mídia
            <input
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400"
              value={draft.mediaUrl}
              onChange={(event) => onChange('mediaUrl', event.target.value)}
              placeholder={draft.type === 'video' ? 'https://...mp4' : 'https://...jpg'}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Publicação
            <input
              type="datetime-local"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400"
              value={draft.publishedAt}
              onChange={(event) => onChange('publishedAt', event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Status
            <select
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400"
              value={draft.status}
              onChange={(event) => onChange('status', event.target.value)}
            >
              <option value="published">Publicado</option>
              <option value="scheduled">Agendado</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Likes
            <input
              type="number"
              min="0"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400"
              value={draft.likes}
              onChange={(event) => onChange('likes', event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Alcance
            <input
              type="number"
              min="0"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-sky-400"
              value={draft.reach}
              onChange={(event) => onChange('reach', event.target.value)}
            />
          </label>

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" className="bg-sky-500 text-slate-950 hover:bg-sky-400">
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function makeInitialDraft() {
  return {
    id: '',
    title: '',
    creatorName: '',
    type: 'image',
    thumbnail: '',
    mediaUrl: '',
    status: 'scheduled',
    publishedAt: '',
    likes: 0,
    reach: 0
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

  function openNewModal() {
    setEditorDraft(makeInitialDraft());
  }

  function openEditModal(item) {
    setEditorDraft({
      ...item,
      publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString().slice(0, 16) : '',
      likes: Number(item.likes || 0),
      reach: Number(item.reach || 0)
    });
  }

  function updateDraft(field, value) {
    setEditorDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function submitDraft() {
    if (!editorDraft) return;

    const normalized = {
      ...editorDraft,
      id: editorDraft.id || `feed-${Date.now()}`,
      publishedAt: editorDraft.publishedAt ? new Date(editorDraft.publishedAt).toISOString() : new Date().toISOString(),
      likes: Number(editorDraft.likes || 0),
      reach: Number(editorDraft.reach || 0)
    };

    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.id === normalized.id);
      if (existingIndex === -1) {
        return [normalized, ...current];
      }

      const next = [...current];
      next[existingIndex] = normalized;
      return next;
    });
    setEditorDraft(null);
  }

  function toggleItem(item) {
    setItems((current) =>
      current.map((entry) => {
        if (entry.id !== item.id) return entry;
        return {
          ...entry,
          status: entry.status === 'inactive' ? 'published' : 'inactive'
        };
      })
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Conteúdo"
        subtitle="Operação editorial do time de marketing para o que aparece na plataforma."
        actions={
          <Button className="bg-sky-500 text-slate-950 hover:bg-sky-400" onClick={openNewModal}>
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
              {items.map((item) => {
                const status = STATUS_META[item.status] || STATUS_META.inactive;
                const isActive = item.status !== 'inactive';

                return (
                  <TableRow key={item.id} className="border-white/10 hover:bg-white/[0.03]">
                    <TableCell className="w-[118px]">
                      <div className="flex items-center gap-3 text-sm text-slate-200">
                        <span className={`h-3 w-3 shrink-0 rounded-full ${status.dot}`} />
                        <StatusSwitch checked={isActive} onClick={() => toggleItem(item)} />
                      </div>
                    </TableCell>

                    <TableCell className="min-w-[320px]">
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
                          <p className="mt-1 text-sm text-slate-400">{item.type === 'video' ? 'Vídeo' : 'Imagem'} com preview em modal.</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="w-[160px] text-sm text-slate-300">
                      {item.creatorName || '-'}
                    </TableCell>

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
                        onClick={() => openEditModal(item)}
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
      <FeedEditorModal
        draft={editorDraft}
        onChange={updateDraft}
        onClose={() => setEditorDraft(null)}
        onSubmit={submitDraft}
        submitLabel={editorDraft?.id ? 'Salvar conteúdo' : 'Adicionar conteúdo'}
      />
    </div>
  );
}
