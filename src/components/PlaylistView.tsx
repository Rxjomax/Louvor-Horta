import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  ListMusic,
  Minus,
  Play,
  Plus,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PlaylistState, Song } from '../types/music';
import { transposeKey } from '../utils/chords';
import {
  buildWhatsAppShareUrl,
  formatWhatsAppSetlist,
} from '../utils/setlist';
import { loadRandomCount, saveRandomCount } from '../utils/storage';

interface PlaylistViewProps {
  playlist: PlaylistState;
  songs: Song[];
  onUpdateTitle: (title: string) => void;
  onGenerateRandom: (count: number) => void;
  onMoveItem: (index: number, direction: 'up' | 'down') => void;
  onRemoveItem: (songId: string) => void;
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
  onRemoveItem,
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

  const resolvedItems = useMemo(() => {
    return playlist.items
      .map((item) => {
        const song = songsById.get(item.songId);
        if (!song) return null;
        return {
          ...item,
          song,
          activeKey: transposeKey(song.originalKey, item.transposeOffset),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [playlist.items, songsById]);

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
            Organize a ordem do louvor, sorteie um repertório equilibrado e envie no grupo da equipe.
          </p>
        </div>

        {resolvedItems.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenSongFromPlaylist(resolvedItems[0].song.id)}
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

        {/* Ordered Worship Songs (Appears 2nd on Mobile, Right Column on Desktop) */}
        <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:row-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Ordem do Culto{' '}
              <span className="text-slate-500 dark:text-slate-400 font-normal tabular-nums">
                ({resolvedItems.length} {resolvedItems.length === 1 ? 'música' : 'músicas'})
              </span>
            </h2>
            {resolvedItems.length > 0 && (
              <button
                type="button"
                onClick={onClearPlaylist}
                className="min-h-[44px] px-3 text-sm font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Limpar lista
              </button>
            )}
          </div>

          {resolvedItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 text-center">
              <ListMusic
                className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                Nenhuma música na playlist deste culto
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                Adicione músicas pelo botão + no Repertório ou use o gerador de setlist aleatório.
              </p>
              <button
                type="button"
                onClick={onGoToRepertoire}
                className="mt-5 min-h-[44px] px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150"
              >
                Explorar Repertório
              </button>
            </div>
          ) : (
            <ol
              aria-label="Músicas ordenadas do culto"
              className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden"
            >
              {resolvedItems.map((entry, index) => (
                <li
                  key={entry.song.id}
                  className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors duration-150"
                >
                  {/* Order Index */}
                  <span className="w-7 text-center font-cifra text-sm font-bold text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                    {String(index + 1).padStart(2, '0')}
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
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 truncate">
                      <span className="font-cifra text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#B85414] dark:text-amber-400 border border-slate-200 dark:border-slate-700 shrink-0">
                        {entry.activeKey === '—' ? 'Letra' : `Tom ${entry.activeKey}`}
                      </span>
                      <span className="truncate">{entry.song.artist}</span>
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
                      onClick={() => onMoveItem(index, 'up')}
                      disabled={index === 0}
                      aria-label={`Mover ${entry.song.title} para cima`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
                    >
                      <ArrowUp className="w-4 h-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onMoveItem(index, 'down')}
                      disabled={index === resolvedItems.length - 1}
                      aria-label={`Mover ${entry.song.title} para baixo`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
                    >
                      <ArrowDown className="w-4 h-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(entry.song.id)}
                      aria-label={`Remover ${entry.song.title} da playlist`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Magic Setlist Generator */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Gerar Setlist Aleatório
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
              aria-label="Quantidade de músicas no setlist aleatório"
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
              Gerar Setlist Aleatório ({effectiveRandomCount}{' '}
              {effectiveRandomCount === 1 ? 'música' : 'músicas'})
            </span>
          </button>
        </div>

        {/* WhatsApp Share Box */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Compartilhar Setlist no WhatsApp
          </h2>
          <pre
            aria-label="Prévia da mensagem do WhatsApp"
            className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-cifra text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed"
          >
            {whatsAppMessage}
          </pre>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              disabled={resolvedItems.length === 0}
              className="min-h-[46px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Copiar Setlist</span>
                </>
              )}
            </button>

            <a
              href={resolvedItems.length > 0 ? whatsAppUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={resolvedItems.length === 0}
              onClick={(e) => {
                if (resolvedItems.length === 0) e.preventDefault();
              }}
              className={`min-h-[46px] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                resolvedItems.length === 0
                  ? 'bg-emerald-600/40 text-white/70 pointer-events-none'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Enviar no WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
