import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  ListMusic,
  Minus,
  Play,
  Plus,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CifraStyle, PlaylistState, Song } from '../types/music';
import { getEffectiveCifraParams } from '../utils/chords';
import { downloadPlaylistPdf } from '../utils/pdfExport';
import {
  buildWhatsAppShareUrl,
  formatWhatsAppSetlist,
  isPlaylistMoment,
} from '../utils/setlist';
import { loadRandomCount, saveRandomCount } from '../utils/storage';

const MOMENT_SUGGESTIONS = [
  'Pregação',
  'Oração',
  'Leitura Bíblica',
  'Ofertório',
  'Ceia do Senhor',
  'Avisos',
] as const;

interface PlaylistViewProps {
  playlist: PlaylistState;
  songs: Song[];
  onUpdateTitle: (title: string) => void;
  onGenerateRandom: (count: number) => void;
  onMoveItem: (index: number, direction: 'up' | 'down') => void;
  onRemoveItemAt: (index: number) => void;
  onInsertMoment: (atIndex: number, title?: string, note?: string) => string;
  onUpdateMoment: (
    momentId: string,
    patch: { title?: string; note?: string }
  ) => void;
  onUpdateSongCifra: (
    originalIndex: number,
    style: CifraStyle,
    capoFret?: number
  ) => void;
  onClearPlaylist: () => void;
  onOpenSongFromPlaylist: (songId: string) => void;
  onGoToRepertoire: () => void;
}

export function PlaylistView({
  playlist,
  songs,
  onUpdateTitle,
  onGenerateRandom,
  onMoveItem,
  onRemoveItemAt,
  onInsertMoment,
  onUpdateMoment,
  onUpdateSongCifra,
  onClearPlaylist,
  onOpenSongFromPlaylist,
  onGoToRepertoire,
}: PlaylistViewProps) {
  const maxRandomCount = Math.max(1, Math.min(50, songs.length));
  const [randomCount, setRandomCount] = useState<number>(() =>
    Math.min(loadRandomCount(4), Math.max(1, Math.min(50, songs.length)))
  );
  const [countInput, setCountInput] = useState<string>(() =>
    String(Math.min(loadRandomCount(4), Math.max(1, Math.min(50, songs.length))))
  );
  const isTypingCountRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [pdfSavedMode, setPdfSavedMode] = useState<'list' | 'chords' | null>(null);
  const [pendingFocusMomentId, setPendingFocusMomentId] = useState<string | null>(null);

  const effectiveRandomCount = Math.max(1, Math.min(maxRandomCount, randomCount));

  useEffect(() => {
    if (randomCount > maxRandomCount) {
      setRandomCount(maxRandomCount);
    }
  }, [randomCount, maxRandomCount]);

  useEffect(() => {
    saveRandomCount(effectiveRandomCount);
    if (!isTypingCountRef.current) {
      setCountInput(String(effectiveRandomCount));
    }
  }, [effectiveRandomCount]);

  const stepRandomCount = (delta: number) => {
    isTypingCountRef.current = false;
    setRandomCount((prev) => {
      const base = Math.max(1, Math.min(maxRandomCount, prev));
      return Math.max(1, Math.min(maxRandomCount, base + delta));
    });
  };

  const handleCountInputChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D+/g, '');
    isTypingCountRef.current = true;
    setCountInput(digitsOnly);
    if (digitsOnly !== '') {
      const parsed = Number.parseInt(digitsOnly, 10);
      if (Number.isFinite(parsed) && parsed >= 1) {
        setRandomCount(Math.min(maxRandomCount, parsed));
      }
    }
  };

  const handleCountInputBlur = () => {
    isTypingCountRef.current = false;
    setCountInput(String(effectiveRandomCount));
  };

  const songsById = useMemo(
    () => new Map(songs.map((s) => [s.id, s])),
    [songs]
  );

  type ResolvedEntry =
    | {
        kind: 'song';
        originalIndex: number;
        songOrder: number;
        song: Song;
        transposeOffset: number;
        activeKey: string;
        fingeredKey: string;
        cifraStyle: CifraStyle;
        capoFret: number;
        styleShortLabel: string;
      }
    | {
        kind: 'moment';
        originalIndex: number;
        id: string;
        title: string;
        note: string;
      };

  const resolvedEntries = useMemo(() => {
    const list: ResolvedEntry[] = [];
    let songOrder = 0;
    playlist.items.forEach((item, originalIndex) => {
      if (isPlaylistMoment(item)) {
        list.push({
          kind: 'moment',
          originalIndex,
          id: item.id,
          title: item.title,
          note: item.note ?? '',
        });
        return;
      }
      const song = songsById.get(item.songId);
      if (!song) return;
      songOrder++;
      const params = getEffectiveCifraParams(
        song,
        item.transposeOffset,
        item.cifraStyle,
        item.capoFret
      );
      list.push({
        kind: 'song',
        originalIndex,
        songOrder,
        song,
        transposeOffset: item.transposeOffset,
        activeKey: params.soundingKey,
        fingeredKey: params.fingeredKey,
        cifraStyle: params.style,
        capoFret: params.capoFret,
        styleShortLabel: params.shortLabel,
      });
    });
    return list;
  }, [playlist.items, songsById]);

  const resolvedSongs = useMemo(
    () =>
      resolvedEntries.filter(
        (e): e is Extract<ResolvedEntry, { kind: 'song' }> => e.kind === 'song'
      ),
    [resolvedEntries]
  );

  const momentCount = resolvedEntries.length - resolvedSongs.length;

  useEffect(() => {
    if (!pendingFocusMomentId) return;
    const el = document.getElementById(`moment-title-${pendingFocusMomentId}`);
    if (el instanceof HTMLInputElement) {
      el.focus();
      setPendingFocusMomentId(null);
    }
  }, [pendingFocusMomentId, resolvedEntries]);

  const whatsAppMessage = useMemo(
    () => formatWhatsAppSetlist(playlist.title, playlist.items, songsById),
    [playlist.title, playlist.items, songsById]
  );

  const whatsAppUrl = useMemo(
    () => buildWhatsAppShareUrl(whatsAppMessage),
    [whatsAppMessage]
  );

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsAppMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for restricted clipboard contexts
      const textarea = document.createElement('textarea');
      textarea.value = whatsAppMessage;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  const handleDownloadPlaylistPdf = (includeChords: boolean) => {
    if (resolvedEntries.length === 0) return;
    downloadPlaylistPdf(playlist.title, playlist.items, songsById, includeChords);
    const mode = includeChords ? 'chords' : 'list';
    setPdfSavedMode(mode);
    setTimeout(() => {
      setPdfSavedMode((prev) => (prev === mode ? null : prev));
    }, 2500);
  };

  const handleAddMomentAt = (atIndex: number, initialTitle = '') => {
    const newId = onInsertMoment(atIndex, initialTitle, '');
    setPendingFocusMomentId(newId);
  };

  return (
    <section
      aria-labelledby="playlist-heading"
      className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-12"
    >
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1
            id="playlist-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
          >
            Culto do Dia
          </h1>
          <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Organize a ordem do louvor, intercale pregação ou momentos entre músicas e partilhe ou transfira o PDF completo.
          </p>
        </div>

        {resolvedSongs.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenSongFromPlaylist(resolvedSongs[0].song.id)}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-[#B85414] dark:bg-amber-500 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 transition-opacity duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-400"
          >
            <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
            <span>Iniciar Culto (1ª Cifra)</span>
          </button>
        )}
      </div>

      {/* Asymmetric 2-Column Layout on Desktop; Title -> Setlist -> Generator -> WhatsApp on Mobile */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* Title Card */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-5">
          <label
            htmlFor="playlist-title-input"
            className="block text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Título / Data do Culto
          </label>
          <input
            id="playlist-title-input"
            type="text"
            value={playlist.title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            placeholder="Ex: Culto de Domingo - 18h30"
            className="mt-2 w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-base font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#B85414] dark:focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {/* Ordered Worship Songs & Service Moments (Appears 2nd on Mobile, Right Column on Desktop) */}
        <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:row-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Ordem do Culto{' '}
              <span className="text-slate-500 dark:text-slate-400 font-normal tabular-nums">
                ({resolvedSongs.length}{' '}
                {resolvedSongs.length === 1 ? 'música' : 'músicas'}
                {momentCount > 0
                  ? ` · ${momentCount} ${momentCount === 1 ? 'momento' : 'momentos'}`
                  : ''}
                )
              </span>
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleAddMomentAt(playlist.items.length)}
                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[#2F523E]/30 dark:border-emerald-700/60 bg-[#2F523E]/5 dark:bg-emerald-950/30 text-[#2F523E] dark:text-emerald-300 text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap hover:bg-[#2F523E]/10 dark:hover:bg-emerald-950/50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F523E] dark:focus-visible:ring-emerald-400"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Espaço / Momento</span>
              </button>

              {resolvedEntries.length > 0 && (
                <button
                  type="button"
                  onClick={onClearPlaylist}
                  className="min-h-[44px] px-3 text-sm font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors duration-150 rounded-lg whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  Limpar lista
                </button>
              )}
            </div>
          </div>

          {resolvedEntries.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 text-center">
              <ListMusic
                className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                Nenhuma música na lista deste culto
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                Adicione músicas através do botão + no Repertório, gere uma lista aleatória ou crie espaços para pregação e oração.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onGoToRepertoire}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 whitespace-nowrap"
                >
                  Explorar Repertório
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMomentAt(0, 'Oração Inicial')}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#2F523E]/30 dark:border-emerald-700/60 bg-[#2F523E]/5 dark:bg-emerald-950/30 text-sm font-semibold text-[#2F523E] dark:text-emerald-300 hover:bg-[#2F523E]/10 dark:hover:bg-emerald-950/50 transition-colors duration-150 whitespace-nowrap inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Adicionar Espaço</span>
                </button>
              </div>
            </div>
          ) : (
            <ol
              aria-label="Ordem do culto com músicas e momentos"
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden"
            >
              {resolvedEntries.map((entry, resolvedIdx) => {
                const isFirst = resolvedIdx === 0;
                const isLast = resolvedIdx === resolvedEntries.length - 1;
                const nextEntry = !isLast ? resolvedEntries[resolvedIdx + 1] : null;
                const showInsertBetween =
                  entry.kind === 'song' &&
                  nextEntry?.kind === 'song';

                if (entry.kind === 'moment') {
                  return (
                    <li
                      key={entry.id}
                      className="border-b border-slate-200 dark:border-slate-800 last:border-b-0 bg-[#2F523E]/[0.04] dark:bg-emerald-950/20 p-3.5 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold tracking-wide text-[#2F523E] dark:text-emerald-300 uppercase">
                          Espaço / Momento no Culto
                        </span>

                        <div className="flex items-center shrink-0">
                          <button
                            type="button"
                            onClick={() => onMoveItem(entry.originalIndex, 'up')}
                            disabled={isFirst}
                            aria-label="Mover momento para cima"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F523E] dark:focus-visible:ring-emerald-400"
                          >
                            <ArrowUp className="w-4 h-4" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onMoveItem(entry.originalIndex, 'down')}
                            disabled={isLast}
                            aria-label="Mover momento para baixo"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F523E] dark:focus-visible:ring-emerald-400"
                          >
                            <ArrowDown className="w-4 h-4" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onRemoveItemAt(entry.originalIndex)}
                            aria-label="Remover espaço da ordem do culto"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 space-y-2.5">
                        <div>
                          <label
                            htmlFor={`moment-title-${entry.id}`}
                            className="sr-only"
                          >
                            Nome do momento no culto
                          </label>
                          <input
                            id={`moment-title-${entry.id}`}
                            type="text"
                            value={entry.title}
                            maxLength={160}
                            onChange={(e) =>
                              onUpdateMoment(entry.id, { title: e.target.value })
                            }
                            placeholder="O que acontece aqui? (Ex: Pregação, Oração, Ceia...)"
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#2F523E]/25 dark:border-emerald-800/70 bg-white dark:bg-slate-950/80 text-base font-semibold text-slate-900 dark:text-slate-100 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2F523E] dark:focus:ring-emerald-400 focus:border-transparent"
                          />
                        </div>

                        {!entry.title.trim() && (
                          <div
                            role="group"
                            aria-label="Sugestões rápidas de momento"
                            className="flex flex-wrap gap-1.5"
                          >
                            {MOMENT_SUGGESTIONS.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() =>
                                  onUpdateMoment(entry.id, { title: suggestion })
                                }
                                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#2F523E] hover:text-[#2F523E] dark:hover:border-emerald-500 dark:hover:text-emerald-300 transition-colors"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}

                        <div>
                          <label
                            htmlFor={`moment-note-${entry.id}`}
                            className="sr-only"
                          >
                            Detalhes ou observações do momento para o PDF
                          </label>
                          <textarea
                            id={`moment-note-${entry.id}`}
                            rows={2}
                            maxLength={500}
                            value={entry.note}
                            onChange={(e) =>
                              onUpdateMoment(entry.id, { note: e.target.value })
                            }
                            placeholder="Detalhes opcionais que também aparecerão no PDF (ex: Pr. João · Salmos 23, leitura, avisos...)"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 text-base sm:text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2F523E] dark:focus:ring-emerald-400 focus:border-transparent resize-y"
                          />
                        </div>
                      </div>
                    </li>
                  );
                }

                return (
                  <li
                    key={`${entry.song.id}-${entry.originalIndex}`}
                    className="border-b border-slate-200 dark:border-slate-800 last:border-b-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors duration-150">
                      {/* Order Index */}
                      <span className="w-7 text-center font-cifra text-sm font-bold text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                        {String(entry.songOrder).padStart(2, '0')}
                      </span>

                      {/* Song Clickable Area -> Opens Chord Viewer in Playlist Mode */}
                      <button
                        type="button"
                        onClick={() => onOpenSongFromPlaylist(entry.song.id)}
                        className="flex-1 min-w-0 text-left py-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
                      >
                        <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-50 truncate">
                          {entry.song.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-cifra text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#B85414] dark:text-amber-400 border border-slate-200 dark:border-slate-700 shrink-0">
                            {entry.activeKey === '—' ? 'Letra' : `Tom ${entry.activeKey}`}
                          </span>
                          <span className="truncate max-w-[140px] sm:max-w-none">{entry.song.artist}</span>
                          {entry.activeKey !== '—' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`font-semibold shrink-0 ${
                                  entry.cifraStyle === 'simplified'
                                    ? 'text-[#2F523E] dark:text-emerald-400'
                                    : entry.cifraStyle === 'capo'
                                      ? 'text-[#B85414] dark:text-amber-400'
                                      : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {entry.styleShortLabel}
                              </span>
                            </>
                          )}
                          {entry.transposeOffset !== 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-cifra text-xs text-[#B85414] dark:text-amber-400 shrink-0">
                                {entry.transposeOffset > 0
                                  ? `+${entry.transposeOffset}`
                                  : entry.transposeOffset}{' '}
                                st
                              </span>
                            </>
                          )}
                        </div>
                      </button>

                      {/* Reorder & Remove Controls (>= 44px touch targets) */}
                      <div className="flex items-center shrink-0">
                        <button
                          type="button"
                          onClick={() => onMoveItem(entry.originalIndex, 'up')}
                          disabled={isFirst}
                          aria-label={`Mover ${entry.song.title} para cima`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
                        >
                          <ArrowUp className="w-4 h-4" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onMoveItem(entry.originalIndex, 'down')}
                          disabled={isLast}
                          aria-label={`Mover ${entry.song.title} para baixo`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
                        >
                          <ArrowDown className="w-4 h-4" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onRemoveItemAt(entry.originalIndex)}
                          aria-label={`Remover ${entry.song.title} da playlist`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Per-song Cifra Style Selector (Completa / Simplificada / Capo) for Culto & PDF */}
                    {entry.activeKey !== '—' && (
                      <div className="px-3 sm:px-4 pb-3 pt-0.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div
                          role="group"
                          aria-label={`Versão da cifra para ${entry.song.title}`}
                          className="grid grid-cols-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 p-0.5 gap-0.5 sm:max-w-xs w-full"
                        >
                          <button
                            type="button"
                            onClick={() => onUpdateSongCifra(entry.originalIndex, 'original')}
                            aria-pressed={entry.cifraStyle === 'original'}
                            className={`min-h-[44px] px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] ${
                              entry.cifraStyle === 'original'
                                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            Completa
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateSongCifra(entry.originalIndex, 'simplified')}
                            aria-pressed={entry.cifraStyle === 'simplified'}
                            className={`min-h-[44px] px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F523E] ${
                              entry.cifraStyle === 'simplified'
                                ? 'bg-[#2F523E] text-white'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            Simplificada
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const recommended =
                                entry.cifraStyle === 'capo'
                                  ? entry.capoFret
                                  : getEffectiveCifraParams(
                                      entry.song,
                                      entry.transposeOffset,
                                      'capo'
                                    ).capoFret;
                              onUpdateSongCifra(entry.originalIndex, 'capo', recommended);
                            }}
                            aria-pressed={entry.cifraStyle === 'capo'}
                            className={`min-h-[44px] px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] ${
                              entry.cifraStyle === 'capo'
                                ? 'bg-[#B85414] text-white'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            Capo
                          </button>
                        </div>

                        {entry.cifraStyle === 'capo' && (
                          <div className="flex items-center justify-between sm:justify-end gap-2">
                            <div
                              role="group"
                              aria-label={`Casa do capotraste para ${entry.song.title}`}
                              className="inline-flex items-center rounded-xl border border-[#B85414]/35 dark:border-amber-500/40 bg-[#B85414]/5 dark:bg-amber-950/30"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateSongCifra(
                                    entry.originalIndex,
                                    'capo',
                                    Math.max(1, entry.capoFret - 1)
                                  )
                                }
                                disabled={entry.capoFret <= 1}
                                aria-label="Diminuir casa do capotraste"
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-l-xl text-[#B85414] dark:text-amber-400 hover:bg-[#B85414]/10 disabled:opacity-35 transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                              <span className="px-2 font-cifra text-xs font-bold text-[#B85414] dark:text-amber-300 whitespace-nowrap tabular-nums">
                                {entry.capoFret}ª casa · em {entry.fingeredKey}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateSongCifra(
                                    entry.originalIndex,
                                    'capo',
                                    Math.min(9, entry.capoFret + 1)
                                  )
                                }
                                disabled={entry.capoFret >= 9}
                                aria-label="Aumentar casa do capotraste"
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-r-xl text-[#B85414] dark:text-amber-400 hover:bg-[#B85414]/10 disabled:opacity-35 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {showInsertBetween && (
                      <div className="px-3 sm:px-4 pb-1 -mt-1 flex items-center gap-2">
                        <div className="h-px flex-1 border-t border-dashed border-slate-200 dark:border-slate-800" />
                        <button
                          type="button"
                          onClick={() => handleAddMomentAt(entry.originalIndex + 1)}
                          className="min-h-[44px] px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-[#2F523E] dark:text-slate-400 dark:hover:text-emerald-300 hover:bg-[#2F523E]/5 dark:hover:bg-emerald-950/30 inline-flex items-center gap-1 whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F523E] dark:focus-visible:ring-emerald-400"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Inserir espaço entre músicas</span>
                        </button>
                        <div className="h-px flex-1 border-t border-dashed border-slate-200 dark:border-slate-800" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Magic Setlist Generator */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Gerar Lista Aleatória
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Combina músicas de celebração, adoração e hinos do seu repertório sem repetir faixas.
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <label
              htmlFor="random-setlist-count"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Quantidade:
            </label>
            <div
              role="group"
              aria-label="Quantidade de músicas na lista aleatória"
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80"
            >
              <button
                type="button"
                onClick={() => stepRandomCount(-1)}
                disabled={songs.length === 0 || effectiveRandomCount <= 1}
                aria-label="Diminuir quantidade de músicas"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 disabled:opacity-35 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>

              <input
                id="random-setlist-count"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Quantidade de músicas"
                value={countInput}
                onChange={(e) => handleCountInputChange(e.target.value)}
                onBlur={handleCountInputBlur}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    stepRandomCount(1);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    stepRandomCount(-1);
                  }
                }}
                disabled={songs.length === 0}
                className="min-h-[44px] w-14 px-2 text-center rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-base font-semibold tabular-nums text-[#B85414] dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-[#B85414] dark:focus:ring-amber-500"
              />

              <button
                type="button"
                onClick={() => stepRandomCount(1)}
                disabled={songs.length === 0 || effectiveRandomCount >= maxRandomCount}
                aria-label="Aumentar quantidade de músicas"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 disabled:opacity-35 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onGenerateRandom(effectiveRandomCount)}
            disabled={songs.length === 0}
            className="mt-4 w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-900 dark:border-amber-500/50 text-white dark:text-amber-400 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-400"
          >
            <Shuffle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Gerar Lista Aleatória ({effectiveRandomCount}{' '}
              {effectiveRandomCount === 1 ? 'música' : 'músicas'})
            </span>
          </button>
        </div>

        {/* WhatsApp Share & PDF Export Box */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Partilhar Lista no WhatsApp
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Envie a ordem do culto no WhatsApp ou guarde em PDF para imprimir e partilhar o ficheiro.
          </p>
          <pre
            aria-label="Pré-visualização da mensagem para o WhatsApp"
            className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-cifra text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed"
          >
            {whatsAppMessage}
          </pre>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              disabled={resolvedEntries.length === 0}
              className="min-h-[46px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Copiar Lista</span>
                </>
              )}
            </button>

            <a
              href={resolvedEntries.length > 0 ? whatsAppUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={resolvedEntries.length === 0}
              onClick={(e) => {
                if (resolvedEntries.length === 0) e.preventDefault();
              }}
              className={`min-h-[46px] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                resolvedEntries.length === 0
                  ? 'bg-emerald-600/40 text-white/70 pointer-events-none'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Partilhar no WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => handleDownloadPlaylistPdf(false)}
              disabled={resolvedEntries.length === 0}
              className="min-h-[46px] px-4 py-2 rounded-xl border border-[#2F523E]/30 dark:border-emerald-700/60 bg-[#2F523E]/5 dark:bg-emerald-950/30 text-[#2F523E] dark:text-emerald-300 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap hover:bg-[#2F523E]/10 dark:hover:bg-emerald-950/50 disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F523E] dark:focus-visible:ring-emerald-400"
            >
              {pdfSavedMode === 'list' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>PDF Guardado!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Guardar PDF (Lista)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPlaylistPdf(true)}
              disabled={resolvedEntries.length === 0}
              className="min-h-[46px] px-4 py-2 rounded-xl border border-[#B85414]/35 dark:border-amber-500/40 bg-[#B85414]/5 dark:bg-amber-950/30 text-[#B85414] dark:text-amber-300 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap hover:bg-[#B85414]/10 dark:hover:bg-amber-950/50 disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-400"
            >
              {pdfSavedMode === 'chords' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>PDF Transferido!</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Baixar PDF c/ Tudo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
