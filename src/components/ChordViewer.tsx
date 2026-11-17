import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Headphones,
  Link2,
  Minus,
  Moon,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Square,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Song, ThemeMode } from '../types/music';
import {
  InstrumentSound,
  buildSongListeningLinks,
  extractSongChords,
  parseYouTubeEmbedInfo,
  playChordSound,
} from '../utils/audioPlayer';
import {
  parseCifraLines,
  stripChords,
  transposeKey,
} from '../utils/chords';
import { downloadSongPdf } from '../utils/pdfExport';
import { loadViewerPrefs, saveViewerPrefs } from '../utils/storage';

interface ChordViewerProps {
  song: Song;
  transposeOffset: number;
  onChangeTranspose: (delta: number) => void;
  onResetTranspose: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onBack: () => void;
  onEdit: (song: Song) => void;
  onUpdateYoutubeUrl?: (nextUrl: string) => void;
  playlistContext?: {
    currentIndex: number;
    total: number;
    prevTitle?: string;
    nextTitle?: string;
    onPrev?: () => void;
    onNext?: () => void;
  };
}

const SCROLL_SPEEDS = [
  { label: '1x', pxPerSec: 18 },
  { label: '2x', pxPerSec: 34 },
  { label: '3x', pxPerSec: 56 },
] as const;

export function ChordViewer({
  song,
  transposeOffset,
  onChangeTranspose,
  onResetTranspose,
  theme,
  onToggleTheme,
  onBack,
  onEdit,
  onUpdateYoutubeUrl,
  playlistContext,
}: ChordViewerProps) {
  const initialPrefs = useMemo(() => loadViewerPrefs(), []);
  const [fontSize, setFontSize] = useState<number>(initialPrefs.fontSize);
  const [lyricsOnly, setLyricsOnly] = useState<boolean>(initialPrefs.lyricsOnly);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [speedIndex, setSpeedIndex] = useState<number>(initialPrefs.speedIndex);
  const [isPrintMode, setIsPrintMode] = useState<boolean>(false);

  // Listening & Chord Synthesizer panel state
  const [isListenOpen, setIsListenOpen] = useState<boolean>(false);
  const [showEmbeddedVideo, setShowEmbeddedVideo] = useState<boolean>(false);
  const [instrument, setInstrument] = useState<InstrumentSound>('guitar');
  const [isPlayingProgression, setIsPlayingProgression] = useState<boolean>(false);
  const [activeChordIdx, setActiveChordIdx] = useState<number | null>(null);
  const [lastPlayedChord, setLastPlayedChord] = useState<string | null>(null);
  const [playbackBpm, setPlaybackBpm] = useState<number>(
    song.bpm && song.bpm >= 45 && song.bpm <= 180 ? song.bpm : 76
  );
  const [youtubeInput, setYoutubeInput] = useState<string>(song.youtubeUrl ?? '');
  const [showUrlEditor, setShowUrlEditor] = useState<boolean>(false);
  const [savedUrlBanner, setSavedUrlBanner] = useState<boolean>(false);

  useEffect(() => {
    saveViewerPrefs({ fontSize, lyricsOnly, speedIndex });
  }, [fontSize, lyricsOnly, speedIndex]);

  const scrollAccumulatorRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number | null>(null);

  const isDark = theme === 'dark';
  const activeKey = transposeKey(song.originalKey, transposeOffset);

  const parsedLines = useMemo(
    () => parseCifraLines(song.cifra, transposeOffset, song.originalKey),
    [song.cifra, transposeOffset, song.originalKey]
  );

  const strippedLines = useMemo(() => stripChords(song.cifra), [song.cifra]);

  const songChords = useMemo(
    () => extractSongChords(parsedLines),
    [parsedLines]
  );

  const listeningLinks = useMemo(
    () => buildSongListeningLinks(song),
    [song]
  );

  const embedInfo = useMemo(
    () => parseYouTubeEmbedInfo(song.youtubeUrl),
    [song.youtubeUrl]
  );

  // Reset scroll position and audio state when switching songs
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setIsScrolling(false);
    setIsPlayingProgression(false);
    setShowEmbeddedVideo(false);
    setActiveChordIdx(null);
    setLastPlayedChord(null);
    setYoutubeInput(song.youtubeUrl ?? '');
    setShowUrlEditor(false);
    setPlaybackBpm(
      song.bpm && song.bpm >= 45 && song.bpm <= 180 ? song.bpm : 76
    );
    scrollAccumulatorRef.current = 0;
    lastFrameTimeRef.current = null;
  }, [song.id, song.youtubeUrl, song.bpm]);

  // Chord progression playback timer synchronized with the song's actual lines
  useEffect(() => {
    if (!isPlayingProgression || songChords.steps.length === 0) {
      setActiveChordIdx(null);
      return;
    }

    let stepIdx = 0;
    const intervalMs = Math.max(
      750,
      Math.round((60 / Math.max(45, Math.min(180, playbackBpm))) * 2000)
    );
    const noteDurationSec = Math.min(2.4, (intervalMs / 1000) * 1.15);

    const playStep = () => {
      const currentStep = songChords.steps[stepIdx];
      if (currentStep) {
        setActiveChordIdx(stepIdx);
        setLastPlayedChord(currentStep.chord);
        playChordSound(currentStep.chord, instrument, noteDurationSec);
      }
      stepIdx = (stepIdx + 1) % songChords.steps.length;
    };

    playStep();
    const timer = window.setInterval(playStep, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPlayingProgression, songChords.steps, instrument, playbackBpm]);

  // Smooth rAF auto-scroll with fractional pixel accumulation
  useEffect(() => {
    if (!isScrolling) {
      lastFrameTimeRef.current = null;
      return;
    }

    let rafId = 0;
    const pxPerSec = SCROLL_SPEEDS[speedIndex].pxPerSec;

    const tick = (now: number) => {
      if (lastFrameTimeRef.current !== null) {
        const dt = Math.min((now - lastFrameTimeRef.current) / 1000, 0.1);
        scrollAccumulatorRef.current += pxPerSec * dt;

        if (scrollAccumulatorRef.current >= 1) {
          const wholePx = Math.floor(scrollAccumulatorRef.current);
          scrollAccumulatorRef.current -= wholePx;
          window.scrollBy(0, wholePx);

          const maxScroll =
            document.documentElement.scrollHeight - window.innerHeight;
          if (window.scrollY >= maxScroll - 2) {
            setIsScrolling(false);
            return;
          }
        }
      }
      lastFrameTimeRef.current = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isScrolling, speedIndex]);

  const cycleSpeed = () => {
    setSpeedIndex((prev) => (prev + 1) % SCROLL_SPEEDS.length);
  };

  const handleOpenPrintSheet = () => {
    setIsScrolling(false);
    setIsPlayingProgression(false);
    setIsPrintMode(true);
    window.scrollTo({ top: 0 });
    setTimeout(() => {
      try {
        window.print();
      } catch {
        // Sandboxed iframe environments fallback to on-screen print mode + PDF download
      }
    }, 80);
  };

  const handlePlaySingleChord = (chord: string) => {
    setIsPlayingProgression(false);
    setLastPlayedChord(chord);
    playChordSound(chord, instrument, 1.8);
  };

  const handleSaveCustomYoutubeUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateYoutubeUrl) return;
    onUpdateYoutubeUrl(youtubeInput.trim());
    setShowUrlEditor(false);
    setShowEmbeddedVideo(true);
    setSavedUrlBanner(true);
    window.setTimeout(() => setSavedUrlBanner(false), 2500);
  };

  useEffect(() => {
    if (!isPrintMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPrintMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrintMode]);

  const activeStep =
    activeChordIdx !== null ? songChords.steps[activeChordIdx] : undefined;

  return (
    <div
      className={`print-chord-sheet min-h-screen bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-50 transition-colors duration-150 ${
        isPrintMode ? 'is-print-mode' : ''
      }`}
    >
      {/* Floating Control Bar when in Print Sheet Mode (hidden on physical paper via .print-mode-bar) */}
      {isPrintMode && (
        <div
          role="region"
          aria-label="Opções de impressão da cifra"
          className="print-mode-bar sticky top-0 z-50 border-b border-slate-200 bg-slate-900 text-white px-3 sm:px-6 py-2.5"
        >
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs sm:text-sm font-medium text-slate-200">
              Modo Folha de Impressão (cabeçalho, rodapé e navegação ocultos)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadSongPdf(song, transposeOffset, lyricsOnly)}
                className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#B85414] hover:bg-[#9E460F] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Transferir PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    window.print();
                  } catch {
                    downloadSongPdf(song, transposeOffset, lyricsOnly);
                  }
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Printer className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Imprimir</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPrintMode(false)}
                aria-label="Fechar modo de impressão"
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium inline-flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Voltar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact Top Stage Bar (non-fixed on mobile to keep fixed surfaces <= 15%, sticky on md+) */}
      <header className="no-print md:sticky md:top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-2 sm:px-6 h-13 sm:h-14 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setIsPlayingProgression(false);
              onBack();
            }}
            aria-label="Voltar para a lista"
            className="min-h-[44px] min-w-[44px] px-2.5 inline-flex items-center gap-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
          >
            <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Voltar</span>
          </button>

          <div className="min-w-0 flex-1 text-center px-1">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 truncate">
              {song.number !== undefined ? `#${song.number} · ` : ''}
              {song.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {song.artist}
              {song.bpm && song.bpm > 0 ? (
                <>
                  {' '}
                  · <span className="tabular-nums">{song.bpm} BPM</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsListenOpen((prev) => {
                  const next = !prev;
                  if (next && embedInfo) {
                    setShowEmbeddedVideo(true);
                  }
                  return next;
                });
              }}
              aria-expanded={isListenOpen}
              aria-label="Ouvir música (versão original, tocada e acordes)"
              title="Ouvir música (versão original, tocada e acordes)"
              className={`min-h-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500 ${
                isListenOpen || isPlayingProgression
                  ? 'border-[#2F523E] bg-[#2F523E] text-white dark:border-emerald-500 dark:bg-emerald-600'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Headphones className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Ouvir</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPrintSheet}
              aria-label={`Imprimir cifra de ${song.title}`}
              title="Imprimir / Transferir PDF da cifra"
              className="min-h-[44px] min-w-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
            >
              <Printer className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlayingProgression(false);
                onEdit(song);
              }}
              aria-label={`Editar cifra de ${song.title}`}
              title="Editar cifra"
              className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={
                isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Palco'
              }
              title={isDark ? 'Modo Claro' : 'Modo Palco'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
            >
              {isDark ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-[#B85414]" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Chord / Lyrics Reading Area */}
      <main
        className={`print-chord-sheet max-w-4xl mx-auto px-3 sm:px-8 pt-4 sm:pt-6 ${
          playlistContext ? 'pb-40' : 'pb-28'
        }`}
      >
        {/* Print-only Sheet Header (replaces interactive header on paper) */}
        <div className="print-only mb-4 pb-3 border-b border-slate-300">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-xl font-bold text-slate-900">
              {song.number !== undefined ? `#${song.number} · ` : ''}
              {song.title}
            </h1>
            {song.originalKey !== '—' && (
              <span className="font-cifra text-sm font-bold text-[#B85414]">
                Tom: {activeKey}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            {song.artist}
            {song.bpm && song.bpm > 0 ? ` · ${song.bpm} BPM` : ''}
            {` · ${song.category}`}
          </p>
        </div>

        {/* Key, Category & Font Size Strip (screen only) */}
        <div className="no-print mb-3 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            {song.originalKey === '—' ? (
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Só letra (sem cifra)
              </span>
            ) : (
              <>
                <span>Tom:</span>
                <span className="font-cifra font-bold text-base text-[#B85414] dark:text-amber-400">
                  {activeKey}
                </span>
                <button
                  type="button"
                  onClick={() => handlePlaySingleChord(activeKey)}
                  title={`Ouvir o acorde do tom (${activeKey})`}
                  className="min-h-[38px] px-2.5 py-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414]"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#B85414] dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Ouvir Tom ({activeKey})</span>
                </button>
                {transposeOffset !== 0 && (
                  <button
                    type="button"
                    onClick={onResetTranspose}
                    className="min-h-[38px] px-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Voltar ao tom original"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Original: {song.originalKey}</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">{song.category}</span>
            <div
              role="group"
              aria-label="Tamanho da letra"
              className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0"
            >
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(11, s - 1))}
                disabled={fontSize <= 11}
                aria-label="Diminuir tamanho da letra"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-l-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
              >
                <span className="flex items-center">
                  A<Minus className="w-3 h-3" aria-hidden="true" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                disabled={fontSize >= 24}
                aria-label="Aumentar tamanho da letra"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-r-lg border-l border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
              >
                <span className="flex items-center">
                  A<Plus className="w-3 h-3" aria-hidden="true" />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Always-accessible "Ouvir Música" Bar & Expandable Audio Studio (screen only) */}
        <section
          aria-label="Ouvir música e referências de ensaio"
          className="no-print mb-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/70 overflow-hidden"
        >
          {/* Compact Quick-Listen Strip */}
          <div className="p-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setIsListenOpen((prev) => {
                  const next = !prev;
                  if (next && embedInfo) {
                    setShowEmbeddedVideo(true);
                  }
                  return next;
                });
              }}
              aria-expanded={isListenOpen}
              className="min-h-[44px] px-3 py-2 rounded-lg bg-[#2F523E] hover:bg-[#244030] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Headphones className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Ouvir Música (Original, Tocada e Acordes)</span>
              {isListenOpen ? (
                <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              {embedInfo ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsListenOpen(true);
                    setShowEmbeddedVideo(true);
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 text-[#B85414] dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Ouvir Versão Original Aqui</span>
                </button>
              ) : (
                <a
                  href={listeningLinks.originalYoutube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 text-[#B85414] dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Versão Original</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                </a>
              )}

              <a
                href={listeningLinks.acousticYoutube}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Music2 className="w-3.5 h-3.5 text-[#2F523E] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Tocada / Acústica</span>
                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
              </a>

              {songChords.steps.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsListenOpen(true);
                    setIsPlayingProgression((prev) => !prev);
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    isPlayingProgression
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {isPlayingProgression ? (
                    <>
                      <Square className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Parar Acordes</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-[#B85414] dark:text-amber-400 shrink-0" aria-hidden="true" />
                      <span>Tocar Acordes ({activeKey})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Expanded "Ouvir & Ensaiar" Panel */}
          {isListenOpen && (
            <div className="border-t border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 space-y-5 bg-white dark:bg-slate-900/90">
              {/* Part 1: Original Recording, Embedded Player, Acoustic, Tutorial, Playback */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      1. Ouvir Gravação Original e Versões de «{listeningLinks.cleanTitle}»
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {listeningLinks.firstLyricSnippet
                        ? `Verso inicial: "${listeningLinks.firstLyricSnippet}"`
                        : 'Escolha a versão para ouvir sem sair da cifra ou abrir no YouTube / Spotify:'}
                    </p>
                  </div>

                  {onUpdateYoutubeUrl && (
                    <button
                      type="button"
                      onClick={() => setShowUrlEditor((prev) => !prev)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {song.youtubeUrl
                          ? 'Alterar ligação do vídeo'
                          : 'Fixar ligação do YouTube'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Embedded YouTube Player right at the top when available */}
                {embedInfo && (
                  <div className="mb-3.5">
                    {!showEmbeddedVideo ? (
                      <button
                        type="button"
                        onClick={() => setShowEmbeddedVideo(true)}
                        className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-[#B85414] hover:bg-[#9E460F] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                      >
                        <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>
                          Reproduzir Vídeo desta Música Aqui na Página
                          {embedInfo.startSeconds > 0
                            ? ` (inicia aos ${Math.floor(embedInfo.startSeconds / 60)}m${String(
                                embedInfo.startSeconds % 60
                              ).padStart(2, '0')}s)`
                            : ''}
                        </span>
                      </button>
                    ) : (
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black aspect-video max-w-2xl">
                        <iframe
                          title={`Vídeo de referência: ${song.title}`}
                          src={embedInfo.embedUrl}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Form to pin a specific YouTube URL to this song for the whole team */}
                {showUrlEditor && onUpdateYoutubeUrl && (
                  <form
                    onSubmit={handleSaveCustomYoutubeUrl}
                    className="mb-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2"
                  >
                    <label
                      htmlFor="song-youtube-pin"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Cole a ligação do YouTube da versão exata desta música (fica guardada para todo o grupo):
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="song-youtube-pin"
                        type="url"
                        value={youtubeInput}
                        onChange={(e) => setYoutubeInput(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F523E]"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="min-h-[44px] px-4 py-2 rounded-lg bg-[#2F523E] hover:bg-[#244030] text-white text-xs font-semibold whitespace-nowrap transition-colors"
                        >
                          Guardar Vídeo
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUrlEditor(false)}
                          className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {savedUrlBanner && (
                  <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>Ligação guardada e sincronizada com o grupo!</span>
                  </div>
                )}

                {/* Version Buttons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <a
                    href={listeningLinks.originalYoutube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-[#B85414] dark:hover:border-amber-500 text-left flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        Versão Original (YouTube)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {song.youtubeUrl
                          ? 'Abrir vídeo oficial da coletânea'
                          : `Ouvir "${listeningLinks.cleanTitle}"`}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#B85414] dark:text-amber-400 shrink-0" aria-hidden="true" />
                  </a>

                  <a
                    href={listeningLinks.acousticYoutube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-[#2F523E] dark:hover:border-emerald-500 text-left flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        Versão Tocada / Acústica
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Voz e guitarra de «{listeningLinks.cleanTitle}»
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#2F523E] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  </a>

                  <a
                    href={listeningLinks.tutorialYoutube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-[#B85414] dark:hover:border-amber-500 text-left flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        Como Tocar (Aula / Cifra)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Ritmo e acordes na guitarra
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#B85414] dark:text-amber-400 shrink-0" aria-hidden="true" />
                  </a>

                  <a
                    href={listeningLinks.playbackYoutube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-slate-400 text-left flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        Playback / Instrumental
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Base instrumental para treinar vozes
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                  </a>

                  <a
                    href={listeningLinks.spotifySearch}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-emerald-600 text-left flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        Ouvir no Spotify
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Pesquisar «{listeningLinks.cleanTitle}» no Spotify
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  </a>
                </div>
              </div>

              {/* Part 2: Interactive Chord Synthesizer ("Versão Tocada dos Acordes no Tom Atual") */}
              {song.originalKey !== '—' && songChords.unique.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        2. Ouvir Acordes desta Cifra Tocados na Aplicação (Tom:{' '}
                        <span className="font-cifra text-[#B85414] dark:text-amber-400">
                          {activeKey}
                        </span>
                        )
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Ouça os acordes exatos de «{listeningLinks.cleanTitle}» acompanhados verso a verso ou toque num acorde:
                      </p>
                    </div>

                    {/* Instrument Switcher: Guitarra Acústica vs Piano */}
                    <div
                      role="group"
                      aria-label="Escolher instrumento de reprodução"
                      className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start"
                    >
                      <button
                        type="button"
                        onClick={() => setInstrument('guitar')}
                        className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                          instrument === 'guitar'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Guitarra Acústica
                      </button>
                      <button
                        type="button"
                        onClick={() => setInstrument('piano')}
                        className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                          instrument === 'piano'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Piano Suave
                      </button>
                    </div>
                  </div>

                  {/* Progression Player Controls */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setIsPlayingProgression((prev) => !prev)}
                      className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                        isPlayingProgression
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-[#B85414] hover:bg-[#9E460F] text-white'
                      }`}
                    >
                      {isPlayingProgression ? (
                        <>
                          <Square className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>Parar Reprodução dos Acordes</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>Tocar Sequência de Acordes da Música</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePlaySingleChord(activeKey)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Volume2 className="w-4 h-4 text-[#B85414] dark:text-amber-400 shrink-0" aria-hidden="true" />
                      <span>Dar o Tom ({activeKey})</span>
                    </button>

                    {/* Tempo (BPM) adjuster */}
                    <div className="flex items-center gap-1.5 ml-auto text-xs text-slate-600 dark:text-slate-400">
                      <span>Ritmo:</span>
                      <button
                        type="button"
                        onClick={() => setPlaybackBpm((b) => Math.max(50, b - 6))}
                        aria-label="Diminuir velocidade dos acordes"
                        className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <span className="font-cifra font-bold text-slate-800 dark:text-slate-200 tabular-nums min-w-[58px] text-center">
                        {playbackBpm} BPM
                      </span>
                      <button
                        type="button"
                        onClick={() => setPlaybackBpm((b) => Math.min(150, b + 6))}
                        aria-label="Aumentar velocidade dos acordes"
                        className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Active Lyric + Chord Synchronized Display when playing */}
                  {isPlayingProgression && activeStep && (
                    <div className="mb-3 p-3 rounded-xl border border-[#B85414]/30 dark:border-amber-500/30 bg-[#B85414]/5 dark:bg-amber-500/10 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#B85414] dark:text-amber-400">
                          {activeStep.section} · Acorde a soar:{' '}
                          <span className="font-cifra text-sm">{activeStep.chord}</span>
                        </span>
                        <span className="text-xs font-cifra text-slate-500 dark:text-slate-400 tabular-nums">
                          Passo {(activeChordIdx ?? 0) + 1}/{songChords.steps.length}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        «{activeStep.lyricLine}»
                      </p>
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                        {songChords.steps.slice(0, 32).map((step, idx) => (
                          <button
                            key={`${step.chord}-${idx}`}
                            type="button"
                            onClick={() => handlePlaySingleChord(step.chord)}
                            className={`px-2 py-1 rounded font-cifra text-xs font-bold shrink-0 transition-colors ${
                              idx === activeChordIdx
                                ? 'bg-[#B85414] text-white'
                                : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                          >
                            {step.chord}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interactive Chords of this Song */}
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                      Acordes desta música (toque num acorde para o ouvir na{' '}
                      {instrument === 'guitar' ? 'guitarra' : 'piano'}):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {songChords.unique.map((chord) => {
                        const isCurrentlySounding = lastPlayedChord === chord;
                        return (
                          <button
                            key={chord}
                            type="button"
                            onClick={() => handlePlaySingleChord(chord)}
                            className={`min-h-[42px] min-w-[52px] px-3 py-1.5 rounded-lg font-cifra text-sm font-bold border transition-colors inline-flex items-center justify-center gap-1.5 ${
                              isCurrentlySounding
                                ? 'border-[#B85414] dark:border-amber-400 bg-[#B85414]/15 dark:bg-amber-400/20 text-[#B85414] dark:text-amber-300'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 hover:border-[#B85414] dark:hover:border-amber-400'
                            }`}
                          >
                            <Volume2 className="w-3 h-3 opacity-70 shrink-0" aria-hidden="true" />
                            <span>{chord}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Cifra or Lyrics-only content */}
        <article
          aria-label={`Cifra de ${song.title}`}
          data-testid="chord-sheet-content"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
          className={
            lyricsOnly
              ? 'space-y-2 max-w-[65ch]'
              : 'font-cifra overflow-x-auto pb-4'
          }
        >
          {lyricsOnly
            ? strippedLines.map((line, index) => {
                if (!line) {
                  return <div key={index} className="h-4" />;
                }
                const isSection = /^\[.+\]$/.test(line.trim());
                if (isSection) {
                  return (
                    <h2
                      key={index}
                      className="pt-4 pb-1 text-xs font-sans font-bold uppercase tracking-wider text-[#B85414] dark:text-amber-400"
                    >
                      {line.replace(/^\[|\]$/g, '')}
                    </h2>
                  );
                }
                return (
                  <p
                    key={index}
                    className="font-sans text-slate-900 dark:text-slate-100 font-medium"
                  >
                    {line}
                  </p>
                );
              })
            : parsedLines.map((line, index) => {
                if (line.type === 'empty') {
                  return <div key={index} className="h-4" />;
                }

                if (line.type === 'section') {
                  return (
                    <h2
                      key={index}
                      className="pt-3 pb-1 font-sans text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      {line.raw.replace(/^\[|\]$/g, '')}
                    </h2>
                  );
                }

                if (line.type === 'chords') {
                  return (
                    <div
                      key={index}
                      className="whitespace-pre font-bold leading-snug tracking-normal select-text"
                    >
                      {line.segments.map((seg, segIdx) =>
                        seg.isChord ? (
                          <span
                            key={segIdx}
                            onClick={() => handlePlaySingleChord(seg.text.trim())}
                            title={`Toque para ouvir o acorde ${seg.text.trim()}`}
                            className="text-[#B85414] dark:text-[#F59E0B] cursor-pointer hover:underline decoration-dotted underline-offset-4"
                          >
                            {seg.text}
                          </span>
                        ) : (
                          <span
                            key={segIdx}
                            className="text-slate-500 dark:text-slate-400 font-normal"
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
                    key={index}
                    className="whitespace-pre text-slate-900 dark:text-slate-100 leading-snug mb-1.5"
                  >
                    {line.raw}
                  </div>
                );
              })}
        </article>
      </main>

      {/* Fixed Stage Toolbar at Bottom (Ergonomic Thumb Zone, >= 44px buttons) */}
      <footer
        aria-label="Controlos de palco"
        className="no-print fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md pb-safe"
      >
        <div className="max-w-4xl mx-auto px-2 sm:px-4">
          {/* Playlist Prev / Next Stepper (only when opened from Culto do Dia) */}
          {playlistContext && (
            <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={playlistContext.onPrev}
                disabled={!playlistContext.onPrev}
                className="min-h-[44px] px-2.5 inline-flex items-center gap-1 rounded-lg text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none min-w-0 max-w-[44%]"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {playlistContext.prevTitle
                    ? `Anterior: ${playlistContext.prevTitle}`
                    : 'Música Anterior'}
                </span>
              </button>

              <span className="text-xs font-cifra font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                {playlistContext.currentIndex + 1}/{playlistContext.total}
              </span>

              <button
                type="button"
                onClick={playlistContext.onNext}
                disabled={!playlistContext.onNext}
                className="min-h-[44px] px-2.5 inline-flex items-center justify-end gap-1 rounded-lg text-xs sm:text-sm font-semibold text-[#B85414] dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none min-w-0 max-w-[44%]"
              >
                <span className="truncate">
                  {playlistContext.nextTitle
                    ? `Próxima: ${playlistContext.nextTitle}`
                    : 'Próxima Música'}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Main Stage Controls Row */}
          <div className="py-1.5 flex items-center justify-between gap-2">
            {/* Transpose (-1/2 | Key | +1/2) */}
            {song.originalKey === '—' ? (
              <div className="min-h-[44px] px-3 flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                Só letra
              </div>
            ) : (
              <>
                <div
                  role="group"
                  aria-label="Transpositor de tom"
                  className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => onChangeTranspose(-1)}
                    aria-label="Diminuir meio tom"
                    className="min-h-[44px] min-w-[44px] px-2 flex items-center justify-center rounded-l-xl text-xs font-cifra font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
                  >
                    -½
                  </button>
                  <button
                    type="button"
                    onClick={onResetTranspose}
                    aria-label={`Tom atual ${activeKey}. Toque para repor o tom original`}
                    className="min-h-[44px] min-w-[36px] px-1.5 flex items-center justify-center font-cifra text-sm font-bold text-[#B85414] dark:text-amber-400 border-x border-slate-200 dark:border-slate-700"
                  >
                    {activeKey}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeTranspose(1)}
                    aria-label="Aumentar meio tom"
                    className="min-h-[44px] min-w-[44px] px-2 flex items-center justify-center rounded-r-xl text-xs font-cifra font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
                  >
                    +½
                  </button>
                </div>

                {/* Lyrics-only Toggle */}
                <button
                  type="button"
                  onClick={() => setLyricsOnly((prev) => !prev)}
                  aria-pressed={lyricsOnly}
                  aria-label={lyricsOnly ? 'Mostrar Letra e Cifra' : 'Mostrar Só Letra'}
                  className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500 ${
                    lyricsOnly
                      ? 'border-[#B85414] dark:border-amber-400 bg-[#B85414] dark:bg-amber-500 text-white dark:text-slate-950'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {lyricsOnly ? (
                    <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <EyeOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{lyricsOnly ? 'Com Cifra' : 'Só Letra'}</span>
                </button>
              </>
            )}

            {/* Auto-Scroll Play/Pause & Speed */}
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0">
              <button
                type="button"
                onClick={() => setIsScrolling((prev) => !prev)}
                aria-pressed={isScrolling}
                aria-label={
                  isScrolling ? 'Pausar deslocamento automático' : 'Iniciar deslocamento automático'
                }
                className={`min-h-[44px] min-w-[44px] px-2.5 flex items-center justify-center gap-1 rounded-l-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500 ${
                  isScrolling
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                {isScrolling ? (
                  <Pause className="w-4 h-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">Scroll</span>
              </button>
              <button
                type="button"
                onClick={cycleSpeed}
                aria-label={`Velocidade do deslocamento: ${SCROLL_SPEEDS[speedIndex].label}. Toque para alterar`}
                className="min-h-[44px] min-w-[44px] px-2 flex items-center justify-center rounded-r-xl border-l border-slate-200 dark:border-slate-700 font-cifra text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
              >
                {SCROLL_SPEEDS[speedIndex].label}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
