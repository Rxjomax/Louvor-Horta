import {
  Check,
  Copy,
  Download,
  QrCode,
  Share2,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

interface SocialQRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CardFormat = 'square' | 'story';
type CardTheme = 'navy' | 'light';

const OFFICIAL_URL = 'https://louvor-horta.vercel.app/';

const MESSAGE_PRESETS = [
  'Aceda às cifras, escalas e músicas do Louvor IEB Horta',
  'Acompanhe o Culto do Dia e as letras direto no seu telemóvel',
  'Aponte a câmara para abrir o aplicativo oficial do Louvor IEB Horta',
  'Faça parte da equipa e acompanhe os ensaios e escalas da igreja',
];

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.slice(0, 5);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function SocialQRModal({ isOpen, onClose }: SocialQRModalProps) {
  const [message, setMessage] = useState(MESSAGE_PRESETS[0]);
  const [subtitle, setSubtitle] = useState('Aponte a câmara do telemóvel');
  const [format, setFormat] = useState<CardFormat>('square');
  const [cardTheme, setCardTheme] = useState<CardTheme>('navy');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const renderPoster = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 1080;
      const height = format === 'story' ? 1920 : 1080;
      canvas.width = width;
      canvas.height = height;

      const isNavy = cardTheme === 'navy';

      // Background
      if (isNavy) {
        const grad = ctx.createRadialGradient(
          width / 2,
          height * 0.35,
          60,
          width / 2,
          height * 0.5,
          height * 0.85
        );
        grad.addColorStop(0, '#183A6A');
        grad.addColorStop(1, '#0C1F3C');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = '#F8FAFC';
      }
      ctx.fillRect(0, 0, width, height);

      // Subtle editorial framing rule inside poster
      ctx.strokeStyle = isNavy
        ? 'rgba(228, 184, 79, 0.24)'
        : 'rgba(15, 36, 69, 0.12)';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, 44, 44, width - 88, height - 88, 36);
      ctx.stroke();

      // Load church emblem once
      if (!logoImageRef.current) {
        try {
          const img = new Image();
          img.src = '/pwa-512x512.png';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('logo load failed'));
          });
          logoImageRef.current = img;
        } catch {
          // Continue without image if unavailable
        }
      }

      if (cancelled) return;

      const isStory = format === 'story';
      const logoSize = isStory ? 168 : 112;
      const logoY = isStory ? 140 : 88;

      if (logoImageRef.current) {
        ctx.save();
        drawRoundedRect(
          ctx,
          (width - logoSize) / 2,
          logoY,
          logoSize,
          logoSize,
          isStory ? 38 : 26
        );
        ctx.clip();
        ctx.drawImage(
          logoImageRef.current,
          (width - logoSize) / 2,
          logoY,
          logoSize,
          logoSize
        );
        ctx.restore();

        ctx.strokeStyle = isNavy
          ? 'rgba(228, 184, 79, 0.45)'
          : 'rgba(15, 36, 69, 0.18)';
        ctx.lineWidth = 2;
        drawRoundedRect(
          ctx,
          (width - logoSize) / 2,
          logoY,
          logoSize,
          logoSize,
          isStory ? 38 : 26
        );
        ctx.stroke();
      }

      // Brand kicker
      const kickerY = logoY + logoSize + (isStory ? 68 : 48);
      ctx.fillStyle = isNavy ? '#E4B84F' : '#B85414';
      ctx.font = `700 ${isStory ? 28 : 22}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOUVOR IEB HORTA', width / 2, kickerY);

      // Custom message text
      const displayMessage =
        message.trim() || 'Aceda ao aplicativo do Louvor IEB Horta';
      const fontSize = isStory ? 54 : 40;
      const lineHeight = isStory ? 68 : 50;
      ctx.fillStyle = isNavy ? '#FFFFFF' : '#0F172A';
      ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
      const lines = wrapCanvasLines(ctx, displayMessage, width - 170);

      const textStartY = kickerY + (isStory ? 84 : 58);
      lines.forEach((line, idx) => {
        ctx.fillText(line, width / 2, textStartY + idx * lineHeight);
      });

      // QR Code white card
      const textBottomY = textStartY + Math.max(1, lines.length) * lineHeight;
      const qrSize = isStory ? 600 : 410;
      const qrPad = isStory ? 44 : 30;
      const qrCardSize = qrSize + qrPad * 2;
      const availableSpaceBottom = height - (isStory ? 250 : 165);
      const qrCardY = Math.round(
        textBottomY + (availableSpaceBottom - textBottomY - qrCardSize) / 2
      );
      const qrCardX = (width - qrCardSize) / 2;

      ctx.fillStyle = '#FFFFFF';
      drawRoundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 32);
      ctx.fill();

      if (!isNavy) {
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 32);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(228, 184, 79, 0.45)';
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 32);
        ctx.stroke();
      }

      // Generate QR onto temporary offscreen canvas
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, OFFICIAL_URL, {
        width: qrSize,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#0C1F3C',
          light: '#FFFFFF',
        },
      });

      if (cancelled) return;
      ctx.drawImage(qrCanvas, qrCardX + qrPad, qrCardY + qrPad, qrSize, qrSize);

      // Footer scan prompt + URL
      const footerRuleY = height - (isStory ? 210 : 136);
      ctx.strokeStyle = isNavy
        ? 'rgba(255, 255, 255, 0.16)'
        : 'rgba(15, 23, 42, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(width * 0.24, footerRuleY);
      ctx.lineTo(width * 0.76, footerRuleY);
      ctx.stroke();

      const subText = subtitle.trim();
      if (subText) {
        ctx.fillStyle = isNavy ? '#CBD5E1' : '#475569';
        ctx.font = `600 ${isStory ? 30 : 22}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
        ctx.fillText(subText, width / 2, footerRuleY + (isStory ? 54 : 36));
      }

      ctx.fillStyle = isNavy ? '#E4B84F' : '#0F2445';
      ctx.font = `700 ${isStory ? 30 : 23}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillText(
        'louvor-horta.vercel.app',
        width / 2,
        footerRuleY + (isStory ? 112 : 76)
      );
    };

    void renderPoster();
    return () => {
      cancelled = true;
    };
  }, [isOpen, message, subtitle, format, cardTheme]);

  if (!isOpen) {
    return null;
  }

  const exportPosterBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => resolve(blob), 'image/png', 1);
    });

  const handleDownloadPoster = async () => {
    setIsExporting(true);
    try {
      const blob = await exportPosterBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `louvor-ieb-horta-qrcode-${format}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadRawQR = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await QRCode.toDataURL(OFFICIAL_URL, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#0C1F3C',
          light: '#FFFFFF',
        },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'louvor-ieb-horta-qrcode-puro.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSharePoster = async () => {
    setIsExporting(true);
    setShareFeedback(null);
    try {
      const blob = await exportPosterBlob();
      if (!blob) return;
      const file = new File([blob], `louvor-ieb-horta-qrcode-${format}.png`, {
        type: 'image/png',
      });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          title: 'Louvor IEB Horta',
          text: `${message.trim() || 'Aceda ao Louvor IEB Horta'}\n${OFFICIAL_URL}`,
          files: [file],
        });
        return;
      }
      await handleDownloadPoster();
      setShareFeedback(
        'Imagem transferida! Agora pode publicá-la diretamente no Instagram, Facebook ou WhatsApp.'
      );
      window.setTimeout(() => setShareFeedback(null), 5000);
    } catch {
      // Ignore user cancellation of native share sheet
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(OFFICIAL_URL);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 3000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      className="no-print fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-3 sm:p-4"
    >
      <div className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0F2445] text-[#E4B84F] flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="qr-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
              >
                QR Code para Redes Sociais
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Personalize a mensagem e baixe o cartão pronto para Instagram,
                WhatsApp ou cartazes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar gerador de QR Code"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Left: Controls */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="qr-message-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Mensagem do Cartão (para as redes sociais)
              </label>
              <textarea
                id="qr-message-input"
                rows={3}
                maxLength={140}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva a mensagem que aparecerá acima do QR Code..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#B85414]"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {MESSAGE_PRESETS.map((preset, idx) => {
                  const isSelected = message === preset;
                  const shortLabels = [
                    'Geral / Cifras',
                    'Culto do Dia',
                    'Aponte a Câmara',
                    'Equipa / Escalas',
                  ];
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMessage(preset)}
                      className={`min-h-[44px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] ${
                        isSelected
                          ? 'border-[#0F2445] bg-[#0F2445] text-white dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {shortLabels[idx]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="qr-subtitle-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Texto de Rodapé (opcional)
              </label>
              <input
                id="qr-subtitle-input"
                type="text"
                maxLength={60}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Ex: Cultos aos Domingos · 18h30"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#B85414]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Formato
                </span>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setFormat('square')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] ${
                      format === 'square'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Post 1:1
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('story')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] ${
                      format === 'story'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Story 9:16
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Visual
                </span>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setCardTheme('navy')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] ${
                      cardTheme === 'navy'
                        ? 'bg-[#0F2445] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Azul IEBH
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardTheme('light')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] ${
                      cardTheme === 'light'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Claro
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-1 space-y-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleDownloadPoster()}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#0F2445] hover:bg-[#183A6A] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Baixar Imagem para Redes Sociais</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => void handleSharePoster()}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#2F523E] hover:bg-[#244030] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Partilhar Agora</span>
                </button>

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => void handleDownloadRawQR()}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <QrCode className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Só o QR Code</span>
                </button>
              </div>

              {shareFeedback && (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {shareFeedback}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-mono truncate">louvor-horta.vercel.app</span>
              <button
                type="button"
                onClick={() => void handleCopyUrl()}
                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold inline-flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414]"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Live High-Res Canvas Preview */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/60 p-3 sm:p-4">
            <canvas
              ref={canvasRef}
              aria-label="Pré-visualização do cartão com QR Code do Louvor IEB Horta"
              className={`rounded-xl shadow-md border border-slate-200/80 dark:border-slate-800 ${
                format === 'story'
                  ? 'w-auto max-h-[360px] sm:max-h-[430px] aspect-[9/16]'
                  : 'w-full max-w-[320px] aspect-square'
              }`}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 text-center">
              O QR Code aponta diretamente para{' '}
              <span className="font-mono">louvor-horta.vercel.app</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
