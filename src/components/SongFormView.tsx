import { Check, Save, Trash2, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Song, SongCategory } from '../types/music';
import { parseCifraLines } from '../utils/chords';

interface SongFormViewProps {
  editingSong: Song | null;
  onSaveSong: (data: Omit<Song, 'id' | 'createdAt'>, existingId?: string) => void;
  onDeleteSong?: (songId: string) => void;
  onCancel: () => void;
}

const KEY_OPTIONS = [
  'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
  'Am', 'Bbm', 'Bm', 'Cm', 'C#m', 'Dm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m',
  '—',
];

const CATEGORY_OPTIONS: SongCategory[] = ['Normal', 'Crianças', 'Hinos'];

const SAMPLE_CIFRA_PLACEHOLDER = `[Intro] G  D/F#  Em7  C9

[Verso 1]
G                D/F#
Exemplo de letra alinhada
Em7              C9
Com os acordes acima das sílabas`;

export function SongFormView({
  editingSong,
  onSaveSong,
  onDeleteSong,
  onCancel,
}: SongFormViewProps) {
  const [title, setTitle] = useState(editingSong?.title ?? '');
  const [artist, setArtist] = useState(editingSong?.artist ?? '');
  const [originalKey, setOriginalKey] = useState(editingSong?.originalKey ?? 'G');
  const [bpm, setBpm] = useState(
    editingSong?.bpm ? String(editingSong.bpm) : editingSong ? '' : '72'
  );
  const [category, setCategory] = useState<SongCategory>(
    editingSong?.category ?? 'Normal'
  );
  const [youtubeUrl, setYoutubeUrl] = useState(editingSong?.youtubeUrl ?? '');
  const [cifra, setCifra] = useState(editingSong?.cifra ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const previewLines = useMemo(() => {
    if (!cifra.trim()) return [];
    return parseCifraLines(cifra, 0, originalKey).slice(0, 18);
  }, [cifra, originalKey]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!title.trim()) {
      nextErrors.title = 'Informe o nome da música.';
    }
    if (!artist.trim()) {
      nextErrors.artist = 'Informe o artista ou ministério.';
    }
    const trimmedBpm = bpm.trim();
    const parsedBpm = trimmedBpm ? Number(trimmedBpm) : undefined;
    if (
      parsedBpm !== undefined &&
      (!Number.isFinite(parsedBpm) || parsedBpm < 30 || parsedBpm > 260)
    ) {
      nextErrors.bpm = 'Informe um BPM válido entre 30 e 260 (ou deixe em branco).';
    }
    if (!cifra.trim()) {
      nextErrors.cifra = 'Cole a letra com cifra para que os músicos possam tocar.';
    }
    if (youtubeUrl.trim() && !/^https?:\/\/.+/i.test(youtubeUrl.trim())) {
      nextErrors.youtubeUrl = 'O link deve começar com http:// ou https://';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSaveSong(
      {
        number: editingSong?.number,
        title: title.trim(),
        artist: artist.trim(),
        originalKey,
        bpm: parsedBpm !== undefined ? Math.round(parsedBpm) : undefined,
        category,
        youtubeUrl: youtubeUrl.trim() || undefined,
        cifra: cifra.replace(/\r\n/g, '\n').trimEnd(),
      },
      editingSong?.id
    );
  };

  return (
    <section
      aria-labelledby="song-form-heading"
      className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-12"
    >
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
        <div>
          <h1
            id="song-form-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
          >
            {editingSong ? 'Editar Música' : 'Adicionar Música'}
          </h1>
          <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Salva automaticamente no repertório local deste dispositivo.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors duration-150 shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
          <span>Cancelar</span>
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-7 space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="song-title"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Nome da Música *
              </label>
              <input
                id="song-title"
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                }}
                placeholder="Ex: Caminho no Deserto"
                aria-invalid={Boolean(errors.title)}
                className="mt-1.5 w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#B85414] dark:focus:ring-amber-500"
              />
              {errors.title && (
                <p role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="song-artist"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Artista / Ministério *
              </label>
              <input
                id="song-artist"
                type="text"
                required
                value={artist}
                onChange={(e) => {
                  setArtist(e.target.value);
                  if (errors.artist) setErrors((prev) => ({ ...prev, artist: '' }));
                }}
                placeholder="Ex: Soraya Moraes"
                aria-invalid={Boolean(errors.artist)}
                className="mt-1.5 w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#B85414] dark:focus:ring-amber-500"
              />
              {errors.artist && (
                <p role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                  {errors.artist}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="song-key"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Tom Original
              </label>
              <select
                id="song-key"
                value={originalKey}
                onChange={(e) => setOriginalKey(e.target.value)}
                className="mt-1.5 w-full min-h-[46px] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-base font-cifra font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#B85414] dark:focus:ring-amber-500"
              >
                {KEY_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k === '—' ? 'Sem cifra (só letra)' : k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="song-bpm"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                BPM (opcional)
              </label>
              <input
                id="song-bpm"
                type="number"
                min={30}
                max={260}
                placeholder="Ex: 72"
                value={bpm}
                onChange={(e) => {
                  setBpm(e.target.value);
                  if (errors.bpm) setErrors((prev) => ({ ...prev, bpm: '' }));
                }}
                aria-invalid={Boolean(errors.bpm)}
                className="mt-1.5 w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-base tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#B85414] dark:focus:ring-amber-500"
              />
              {errors.bpm && (
                <p role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                  {errors.bpm}
                </p>
              )}
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label
                htmlFor="song-category"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Categoria
              </label>
              <select
                id="song-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as SongCategory)}
                className="mt-1.5 w-full min-h-[46px] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#B85414] dark:focus:ring-amber-500"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="song-youtube"
              className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              Link do YouTube / Referência (opcional)
            </label>
            <input
              id="song-youtube"
              type="url"
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                if (errors.youtubeUrl)
                  setErrors((prev) => ({ ...prev, youtubeUrl: '' }));
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              aria-invalid={Boolean(errors.youtubeUrl)}
              className="mt-1.5 w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#B85414] dark:focus:ring-amber-500"
            />
            {errors.youtubeUrl && (
              <p role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {errors.youtubeUrl}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="song-cifra"
              className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              Letra com Cifra *
            </label>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Coloque os acordes em uma linha própria acima da letra. Use [Verso], [Refrão] ou [Ponte] para marcar seções.
            </p>
            <textarea
              id="song-cifra"
              required
              rows={12}
              value={cifra}
              onChange={(e) => {
                setCifra(e.target.value);
                if (errors.cifra) setErrors((prev) => ({ ...prev, cifra: '' }));
              }}
              placeholder={SAMPLE_CIFRA_PLACEHOLDER}
              aria-invalid={Boolean(errors.cifra)}
              className="mt-1.5 w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 font-cifra text-sm sm:text-base leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#B85414] dark:focus:ring-amber-500"
            />
            {errors.cifra && (
              <p role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {errors.cifra}
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
            {editingSong && onDeleteSong ? (
              !confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="min-h-[46px] px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors duration-150"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Excluir Música</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDeleteSong(editingSong.id)}
                    className="min-h-[46px] px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-rose-700"
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>Confirmar exclusão</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="min-h-[46px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Manter
                  </button>
                </div>
              )
            ) : (
              <div />
            )}

            <button
              type="submit"
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#B85414] dark:bg-amber-500 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-400"
            >
              <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{editingSong ? 'Salvar Alterações' : 'Salvar Música no Repertório'}</span>
            </button>
          </div>
        </form>

        {/* Live Cifra Recognition Preview */}
        <aside
          aria-label="Pré-visualização da cifra"
          className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Pré-visualização de Alinhamento
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Linhas reconhecidas como acordes ficam destacadas em destaque para conferência instantânea.
          </p>

          <div className="mt-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] min-h-[220px] overflow-x-auto font-cifra text-xs sm:text-sm leading-relaxed">
            {previewLines.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 font-sans text-sm">
                Digite ou cole a cifra ao lado para visualizar o destaque dos acordes.
              </p>
            ) : (
              previewLines.map((line, i) => {
                if (line.type === 'empty') {
                  return <div key={i} className="h-3" />;
                }
                if (line.type === 'section') {
                  return (
                    <div
                      key={i}
                      className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-2 mb-0.5"
                    >
                      {line.raw}
                    </div>
                  );
                }
                if (line.type === 'chords') {
                  return (
                    <div key={i} className="whitespace-pre font-bold">
                      {line.segments.map((seg, j) =>
                        seg.isChord ? (
                          <span
                            key={j}
                            className="text-[#B85414] dark:text-amber-400"
                          >
                            {seg.text}
                          </span>
                        ) : (
                          <span
                            key={j}
                            className="text-slate-500 dark:text-slate-400"
                          >
                            {seg.text}
                          </span>
                        )
                      )}
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className="whitespace-pre text-slate-800 dark:text-slate-100"
                  >
                    {line.raw}
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
