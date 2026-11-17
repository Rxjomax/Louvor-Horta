import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Minus,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Song, ThemeMode } from '../types/music';
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
  playlistContext,
}: ChordViewerProps) {
  const initialPrefs = useMemo(() => loadViewerPrefs(), []);
  const [fontSize, setFontSize] = useState<number>(initialPrefs.fontSize);
  const [lyricsOnly, setLyricsOnly] = useState<boolean>(initialPrefs.lyricsOnly);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [speedIndex, setSpeedIndex] = useState<number>(initialPrefs.speedIndex);
  const [isPrintMode, setIsPrintMode] = useState<boolean>(false);

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

  // Reset scroll position and pause auto-scroll when switching songs
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setIsScrolling(false);
    scrollAccumulatorRef.current = 0;
    lastFrameTimeRef.current = null;
  }, [song.id]);

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
    setIsPrintMode(true);
    window.scrollTo({ top: 0 });
    // Trigger native browser print dialog after layout updates to print mode
    setTimeout(() => {
      try {
        window.print();
      } catch {
        // Sandboxed iframe environments fallback to on-screen print mode + PDF download
      }
    }, 80);
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
            onClick={onBack}
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
            {song.youtubeUrl && (
              <a
                href={song.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ouvir referência de ${song.title} no YouTube`}
                title="Ouvir referência no YouTube"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            )}

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
              onClick={() => onEdit(song)}
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
        <div className="no-print mb-5 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
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
                {transposeOffset !== 0 && (
                  <button
                    type="button"
                    onClick={onResetTranspose}
                    className="min-h-[36px] px-2 inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                            className="text-[#B85414] dark:text-[#F59E0B]"
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
