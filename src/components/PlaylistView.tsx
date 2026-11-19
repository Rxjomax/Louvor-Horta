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
import { BufferedInput, BufferedTextarea } from './BufferedTextFields';

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
      <div className="pb-4 border-b border-[#D7E2F0] dark:border-[#1F3B68] flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1
            id="playlist-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1D3A] dark:text-[#F4F8FC]"
          >
            Culto do Dia
          </h1>
          <p className="mt-1 text-sm sm:text-base text-[#465B78] dark:text-[#9BB2CE]">
            Organize a ordem do louvor, intercale pregação ou momentos entre músicas e partilhe ou transfira o PDF completo.
          </p>
        </div>

        {resolvedSongs.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenSongFromPlaylist(resolvedSongs[0].song.id)}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0B1D3A] hover:bg-[#153463] dark:bg-[#E4B84F] dark:hover:bg-[#EBC668] text-white dark:text-[#0B1D3A] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
          >
            <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
            <span>Iniciar Culto (1ª Cifra)</span>
          </button>
        )}
      </div>

      {/* Asymmetric 2-Column Layout on Desktop; Title -> Setlist -> Generator -> WhatsApp on Mobile */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* Title Card */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-4 sm:p-5">
          <label
            htmlFor="playlist-title-input"
            className="block text-sm font-semibold text-[#0B1D3A] dark:text-[#F4F8FC]"
          >
            Título / Data do Culto
          </label>
          <BufferedInput
            id="playlist-title-input"
            type="text"
            value={playlist.title}
            onCommit={onUpdateTitle}
            placeholder="Ex: Culto de Domingo - 18h30"
            className="mt-2 w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-[#F4F8FC] dark:bg-[#081429] text-base font-medium text-[#0B1D3A] dark:text-[#F4F8FC] placeholder:text-[#6B82A1] dark:placeholder:text-[#7E98BA] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F] focus:border-transparent"
          />
        </div>

        {/* Ordered Worship Songs & Service Moments (Appears 2nd on Mobile, Right Column on Desktop) */}
        <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:row-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold text-[#0B1D3A] dark:text-[#F4F8FC]">
              Ordem do Culto{' '}
              <span className="text-[#526886] dark:text-[#9BB2CE] font-normal tabular-nums">
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
                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[#1668A3]/30 dark:border-[#75C2F6]/40 bg-[#EBF5FE] dark:bg-[#13345D] text-[#1668A3] dark:text-[#75C2F6] text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap hover:bg-[#DCEEFF] dark:hover:bg-[#1A4375] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#75C2F6]"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Espaço / Momento</span>
              </button>

              {resolvedEntries.length > 0 && (
                <button
                  type="button"
                  onClick={onClearPlaylist}
                  className="min-h-[44px] px-3 text-sm font-medium text-[#526886] hover:text-rose-600 dark:text-[#9BB2CE] dark:hover:text-rose-400 transition-colors duration-150 rounded-lg whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  Limpar lista
                </button>
              )}
            </div>
          </div>

          {resolvedEntries.length === 0 ? (
            <div className="rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-8 text-center">
              <ListMusic
                className="w-8 h-8 mx-auto text-[#6B82A1] dark:text-[#7E98BA]"
                aria-hidden="true"
              />
              <p className="mt-3 text-base font-semibold text-[#0B1D3A] dark:text-[#F4F8FC]">
                Nenhuma música na lista deste culto
              </p>
              <p className="mt-1 text-sm text-[#465B78] dark:text-[#9BB2CE] max-w-sm mx-auto">
                Adicione músicas através do botão + no Repertório, gere uma lista aleatória ou crie espaços para pregação e oração.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onGoToRepertoire}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg border border-[#C3D3E8] dark:border-[#294B7F] text-sm font-semibold text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#EEF4FB] dark:hover:bg-[#16315D] transition-colors duration-150 whitespace-nowrap"
                >
                  Explorar Repertório
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMomentAt(0, 'Oração Inicial')}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#1668A3]/30 dark:border-[#75C2F6]/40 bg-[#EBF5FE] dark:bg-[#13345D] text-sm font-semibold text-[#1668A3] dark:text-[#75C2F6] hover:bg-[#DCEEFF] dark:hover:bg-[#1A4375] transition-colors duration-150 whitespace-nowrap inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Adicionar Espaço</span>
                </button>
              </div>
            </div>
          ) : (
            <ol
              aria-label="Ordem do culto com músicas e momentos"
              className="rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] overflow-hidden"
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
                      className="border-b border-[#D7E2F0] dark:border-[#1F3B68] last:border-b-0 bg-[#EBF5FE]/70 dark:bg-[#13345D]/45 p-3.5 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold tracking-wide text-[#1668A3] dark:text-[#75C2F6] uppercase">
                          Espaço / Momento no Culto
                        </span>

                        <div className="flex items-center shrink-0">
                          <button
                            type="button"
                            onClick={() => onMoveItem(entry.originalIndex, 'up')}
                            disabled={isFirst}
                            aria-label="Mover momento para cima"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#526886] hover:text-[#0B1D3A] dark:text-[#9BB2CE] dark:hover:text-white hover:bg-white/80 dark:hover:bg-[#16315D] disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#75C2F6]"
                          >
                            <ArrowUp className="w-4 h-4" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onMoveItem(entry.originalIndex, 'down')}
                            disabled={isLast}
                            aria-label="Mover momento para baixo"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#526886] hover:text-[#0B1D3A] dark:text-[#9BB2CE] dark:hover:text-white hover:bg-white/80 dark:hover:bg-[#16315D] disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#75C2F6]"
                          >
                            <ArrowDown className="w-4 h-4" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onRemoveItemAt(entry.originalIndex)}
                            aria-label="Remover espaço da ordem do culto"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#6B82A1] hover:text-rose-600 dark:text-[#7E98BA] dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
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
                          <BufferedInput
                            id={`moment-title-${entry.id}`}
                            type="text"
                            value={entry.title}
                            maxLength={160}
                            onCommit={(nextTitle) =>
                              onUpdateMoment(entry.id, { title: nextTitle })
                            }
                            placeholder="O que acontece aqui? (Ex: Pregação, Oração, Ceia...)"
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#1668A3]/30 dark:border-[#75C2F6]/35 bg-white dark:bg-[#081429] text-base font-semibold text-[#0B1D3A] dark:text-[#F4F8FC] placeholder:font-normal placeholder:text-[#6B82A1] dark:placeholder:text-[#7E98BA] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#75C2F6] focus:border-transparent"
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
                                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#0B1D3A] text-xs font-medium text-[#2A3F5F] dark:text-[#DCE8F6] hover:border-[#1668A3] hover:text-[#1668A3] dark:hover:border-[#75C2F6] dark:hover:text-[#75C2F6] transition-colors"
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
                          <BufferedTextarea
                            id={`moment-note-${entry.id}`}
                            rows={3}
                            maxLength={500}
                            value={entry.note}
                            onCommit={(nextNote) =>
                              onUpdateMoment(entry.id, { note: nextNote })
                            }
                            placeholder="Detalhes opcionais que também aparecerão no PDF (ex: Pr. João · Salmos 23, leitura, avisos...)"
                            className="w-full px-3 py-2 rounded-xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white/95 dark:bg-[#081429] text-base sm:text-sm text-[#1E3352] dark:text-[#DCE8F6] placeholder:text-[#6B82A1] dark:placeholder:text-[#7E98BA] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#75C2F6] focus:border-transparent resize-y"
                          />
                        </div>
                      </div>
                    </li>
                  );
                }

                return (
                  <li
                    key={`${entry.song.id}-${entry.originalIndex}`}
                    className="border-b border-[#D7E2F0] dark:border-[#1F3B68] last:border-b-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-[#F4F8FC] dark:hover:bg-[#16315D]/50 transition-colors duration-150">
                      {/* Order Index */}
                      <span className="w-7 text-center font-cifra text-sm font-bold text-[#1668A3] dark:text-[#75C2F6] tabular-nums shrink-0">
                        {String(entry.songOrder).padStart(2, '0')}
                      </span>

                      {/* Song Clickable Area -> Opens Chord Viewer in Playlist Mode */}
                      <button
                        type="button"
                        onClick={() => onOpenSongFromPlaylist(entry.song.id)}
                        className="flex-1 min-w-0 text-left py-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
                      >
                        <div className="text-sm sm:text-base font-semibold text-[#0B1D3A] dark:text-[#F4F8FC] truncate">
                          {entry.song.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#465B78] dark:text-[#9BB2CE]">
                          <span className="font-cifra text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#FBF4DF] dark:bg-[#E4B84F]/15 text-[#8F620B] dark:text-[#E4B84F] border border-[#E4B84F]/40 dark:border-[#E4B84F]/30 shrink-0">
                            {entry.activeKey === '—' ? 'Letra' : `Tom ${entry.activeKey}`}
                          </span>
                          <span className="truncate max-w-[140px] sm:max-w-none">{entry.song.artist}</span>
                          {entry.activeKey !== '—' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`font-semibold shrink-0 ${
                                  entry.cifraStyle === 'simplified'
                                    ? 'text-[#1668A3] dark:text-[#75C2F6]'
                                    : entry.cifraStyle === 'capo'
                                      ? 'text-[#8F620B] dark:text-[#E4B84F]'
                                      : 'text-[#526886] dark:text-[#9BB2CE]'
                                }`}
                              >
                                {entry.styleShortLabel}
                              </span>
                            </>
                          )}
                          {entry.transposeOffset !== 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-cifra text-xs text-[#8F620B] dark:text-[#E4B84F] shrink-0">
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
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#526886] hover:text-[#0B1D3A] dark:text-[#9BB2CE] dark:hover:text-white hover:bg-[#EEF4FB] dark:hover:bg-[#16315D] disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
                        >
                          <ArrowUp className="w-4 h-4" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onMoveItem(entry.originalIndex, 'down')}
                          disabled={isLast}
                          aria-label={`Mover ${entry.song.title} para baixo`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#526886] hover:text-[#0B1D3A] dark:text-[#9BB2CE] dark:hover:text-white hover:bg-[#EEF4FB] dark:hover:bg-[#16315D] disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
                        >
                          <ArrowDown className="w-4 h-4" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onRemoveItemAt(entry.originalIndex)}
                          aria-label={`Remover ${entry.song.title} da playlist`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#6B82A1] hover:text-rose-600 dark:text-[#7E98BA] dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
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
                          className="grid grid-cols-3 rounded-xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-[#F4F8FC] dark:bg-[#081429] p-0.5 gap-0.5 sm:max-w-xs w-full"
                        >
                          <button
                            type="button"
                            onClick={() => onUpdateSongCifra(entry.originalIndex, 'original')}
                            aria-pressed={entry.cifraStyle === 'original'}
                            className={`min-h-[44px] px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                              entry.cifraStyle === 'original'
                                ? 'bg-[#0B1D3A] dark:bg-[#F4F8FC] text-white dark:text-[#0B1D3A]'
                                : 'text-[#465B78] dark:text-[#9BB2CE] hover:text-[#0B1D3A] dark:hover:text-[#F4F8FC]'
                            }`}
                          >
                            Completa
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateSongCifra(entry.originalIndex, 'simplified')}
                            aria-pressed={entry.cifraStyle === 'simplified'}
                            className={`min-h-[44px] px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#75C2F6] ${
                              entry.cifraStyle === 'simplified'
                                ? 'bg-[#1668A3] dark:bg-[#75C2F6] text-white dark:text-[#0B1D3A]'
                                : 'text-[#465B78] dark:text-[#9BB2CE] hover:text-[#0B1D3A] dark:hover:text-[#F4F8FC]'
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
                            className={`min-h-[44px] px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8F620B] dark:focus-visible:ring-[#E4B84F] ${
                              entry.cifraStyle === 'capo'
                                ? 'bg-[#8F620B] dark:bg-[#E4B84F] text-white dark:text-[#0B1D3A]'
                                : 'text-[#465B78] dark:text-[#9BB2CE] hover:text-[#0B1D3A] dark:hover:text-[#F4F8FC]'
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
                              className="inline-flex items-center rounded-xl border border-[#E4B84F]/50 dark:border-[#E4B84F]/40 bg-[#FBF4DF] dark:bg-[#E4B84F]/15"
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
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-l-xl text-[#8F620B] dark:text-[#E4B84F] hover:bg-[#E4B84F]/20 disabled:opacity-35 transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                              <span className="px-2 font-cifra text-xs font-bold text-[#8F620B] dark:text-[#E4B84F] whitespace-nowrap tabular-nums">
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
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-r-xl text-[#8F620B] dark:text-[#E4B84F] hover:bg-[#E4B84F]/20 disabled:opacity-35 transition-colors"
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
                        <div className="h-px flex-1 border-t border-dashed border-[#D7E2F0] dark:border-[#1F3B68]" />
                        <button
                          type="button"
                          onClick={() => handleAddMomentAt(entry.originalIndex + 1)}
                          className="min-h-[44px] px-3 py-1.5 rounded-md text-xs font-medium text-[#526886] hover:text-[#1668A3] dark:text-[#9BB2CE] dark:hover:text-[#75C2F6] hover:bg-[#EBF5FE] dark:hover:bg-[#13345D]/60 inline-flex items-center gap-1 whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#75C2F6]"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Inserir espaço entre músicas</span>
                        </button>
                        <div className="h-px flex-1 border-t border-dashed border-[#D7E2F0] dark:border-[#1F3B68]" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Magic Setlist Generator */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-2 rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-4 sm:p-5">
          <h2 className="text-base font-semibold text-[#0B1D3A] dark:text-[#F4F8FC]">
            Gerar Lista Aleatória
          </h2>
          <p className="mt-1 text-sm text-[#465B78] dark:text-[#9BB2CE] leading-relaxed">
            Combina músicas de celebração, adoração e hinos do seu repertório sem repetir faixas.
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <label
              htmlFor="random-setlist-count"
              className="text-sm font-medium text-[#2A3F5F] dark:text-[#DCE8F6]"
            >
              Quantidade:
            </label>
            <div
              role="group"
              aria-label="Quantidade de músicas na lista aleatória"
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F4F8FC] dark:bg-[#081429] border border-[#D7E2F0] dark:border-[#1F3B68]"
            >
              <button
                type="button"
                onClick={() => stepRandomCount(-1)}
                disabled={songs.length === 0 || effectiveRandomCount <= 1}
                aria-label="Diminuir quantidade de músicas"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#0B1D3A] dark:text-[#DCE8F6] hover:bg-white dark:hover:bg-[#16315D] disabled:opacity-35 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
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
                className="min-h-[44px] w-14 px-2 text-center rounded-lg bg-white dark:bg-[#11264A] border border-[#D7E2F0] dark:border-[#1F3B68] text-base font-semibold tabular-nums text-[#8F620B] dark:text-[#E4B84F] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
              />

              <button
                type="button"
                onClick={() => stepRandomCount(1)}
                disabled={songs.length === 0 || effectiveRandomCount >= maxRandomCount}
                aria-label="Aumentar quantidade de músicas"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#0B1D3A] dark:text-[#DCE8F6] hover:bg-white dark:hover:bg-[#16315D] disabled:opacity-35 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onGenerateRandom(effectiveRandomCount)}
            disabled={songs.length === 0}
            className="mt-4 w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#0B1D3A] hover:bg-[#153463] dark:bg-[#16315D] dark:hover:bg-[#1E3F75] border border-[#0B1D3A] dark:border-[#E4B84F]/50 text-white dark:text-[#E4B84F] text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
          >
            <Shuffle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Gerar Lista Aleatória ({effectiveRandomCount}{' '}
              {effectiveRandomCount === 1 ? 'música' : 'músicas'})
            </span>
          </button>
        </div>

        {/* WhatsApp Share & PDF Export Box */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-3 rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-4 sm:p-5">
          <h2 className="text-base font-semibold text-[#0B1D3A] dark:text-[#F4F8FC]">
            Partilhar Lista no WhatsApp
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#526886] dark:text-[#9BB2CE]">
            Envie a ordem do culto no WhatsApp ou guarde em PDF para imprimir e partilhar o ficheiro.
          </p>
          <pre
            aria-label="Pré-visualização da mensagem para o WhatsApp"
            className="mt-3 p-3 rounded-xl bg-[#F4F8FC] dark:bg-[#081429] border border-[#D7E2F0] dark:border-[#1F3B68] text-xs sm:text-sm font-cifra text-[#2A3F5F] dark:text-[#DCE8F6] whitespace-pre-wrap break-words leading-relaxed"
          >
            {whatsAppMessage}
          </pre>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              disabled={resolvedEntries.length === 0}
              className="min-h-[46px] px-4 py-2 rounded-xl border border-[#C3D3E8] dark:border-[#294B7F] bg-white dark:bg-[#16315D] text-[#0B1D3A] dark:text-[#F4F8FC] text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap hover:bg-[#EEF4FB] dark:hover:bg-[#1E3F75] disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#1668A3] dark:text-[#75C2F6] shrink-0" aria-hidden="true" />
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
              className={`min-h-[46px] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#75C2F6] ${
                resolvedEntries.length === 0
                  ? 'bg-[#1668A3]/40 text-white/70 pointer-events-none'
                  : 'bg-[#1668A3] hover:bg-[#125486] dark:bg-[#75C2F6] dark:hover:bg-[#8ECDFA] text-white dark:text-[#0B1D3A]'
              }`}
            >
              <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Partilhar no WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => handleDownloadPlaylistPdf(false)}
              disabled={resolvedEntries.length === 0}
              className="min-h-[46px] px-4 py-2 rounded-xl border border-[#1668A3]/30 dark:border-[#75C2F6]/40 bg-[#EBF5FE] dark:bg-[#13345D] text-[#1668A3] dark:text-[#75C2F6] text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap hover:bg-[#DCEEFF] dark:hover:bg-[#1A4375] disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#75C2F6]"
            >
              {pdfSavedMode === 'list' ? (
                <>
                  <Check className="w-4 h-4 text-[#1668A3] dark:text-[#75C2F6] shrink-0" aria-hidden="true" />
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
              className="min-h-[46px] px-4 py-2 rounded-xl border border-[#E4B84F]/50 dark:border-[#E4B84F]/40 bg-[#FBF4DF] dark:bg-[#E4B84F]/15 text-[#8F620B] dark:text-[#E4B84F] text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap hover:bg-[#F5E7BC] dark:hover:bg-[#E4B84F]/25 disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8F620B] dark:focus-visible:ring-[#E4B84F]"
            >
              {pdfSavedMode === 'chords' ? (
                <>
                  <Check className="w-4 h-4 text-[#8F620B] dark:text-[#E4B84F] shrink-0" aria-hidden="true" />
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
