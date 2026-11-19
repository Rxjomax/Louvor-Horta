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
      ctx.fillStyle = isNavy ? '#E4B84F' : '#8F620B';
      ctx.font = `700 ${isStory ? 28 : 22}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOUVOR IEB HORTA', width / 2, kickerY);

      // Custom message text
      const displayMessage =
        message.trim() || 'Aceda ao aplicativo do Louvor IEB Horta';
      const fontSize = isStory ? 54 : 40;
      const lineHeight = isStory ? 68 : 50;
      ctx.fillStyle = isNavy ? '#FFFFFF' : '#0B1D3A';
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
      className="no-print fixed inset-0 z-50 bg-[#061022]/70 flex items-center justify-center p-3 sm:p-4"
    >
      <div className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-4 sm:p-6 space-y-5 shadow-xl text-[#0B1D3A] dark:text-[#F4F8FC]">
        <div className="flex items-start justify-between gap-3 border-b border-[#D7E2F0] dark:border-[#1F3B68] pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0B1D3A] text-[#E4B84F] flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="qr-modal-title"
                className="text-base sm:text-lg font-bold text-[#0B1D3A] dark:text-white"
              >
                QR Code para Redes Sociais
              </h2>
              <p className="text-xs sm:text-sm text-[#465B78] dark:text-[#9BB2CE]">
                Personalize a mensagem e baixe o cartão pronto para Instagram,
                WhatsApp ou cartazes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar gerador de QR Code"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 inline-flex items-center justify-center rounded-lg text-[#526886] hover:text-[#0B1D3A] dark:text-[#9BB2CE] dark:hover:text-white"
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
                className="block text-xs font-semibold text-[#243B5A] dark:text-[#C4D5EB]"
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
                className="w-full rounded-xl border border-[#C6D6E8] dark:border-[#284A7F] bg-white dark:bg-[#08162E] px-3 py-2.5 text-base sm:text-sm text-[#0B1D3A] dark:text-[#F4F8FC] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
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
                      className={`min-h-[44px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                        isSelected
                          ? 'border-[#10284F] bg-[#10284F] text-white dark:border-[#E4B84F] dark:bg-[#E4B84F] dark:text-[#0B1D3A]'
                          : 'border-[#D7E2F0] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#0B1D3A] text-[#243B5A] dark:text-[#C4D5EB] hover:bg-[#E7F0FA] dark:hover:bg-[#153463]'
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
                className="block text-xs font-semibold text-[#243B5A] dark:text-[#C4D5EB]"
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
                className="w-full min-h-[44px] rounded-xl border border-[#C6D6E8] dark:border-[#284A7F] bg-white dark:bg-[#08162E] px-3 py-2 text-base sm:text-sm text-[#0B1D3A] dark:text-[#F4F8FC] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-[#243B5A] dark:text-[#C4D5EB]">
                  Formato
                </span>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#EAF1F8] dark:bg-[#08162E]">
                  <button
                    type="button"
                    onClick={() => setFormat('square')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                      format === 'square'
                        ? 'bg-white dark:bg-[#153463] text-[#0B1D3A] dark:text-white shadow-sm'
                        : 'text-[#526886] dark:text-[#9BB2CE]'
                    }`}
                  >
                    Post 1:1
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('story')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                      format === 'story'
                        ? 'bg-white dark:bg-[#153463] text-[#0B1D3A] dark:text-white shadow-sm'
                        : 'text-[#526886] dark:text-[#9BB2CE]'
                    }`}
                  >
                    Story 9:16
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-[#243B5A] dark:text-[#C4D5EB]">
                  Visual
                </span>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#EAF1F8] dark:bg-[#08162E]">
                  <button
                    type="button"
                    onClick={() => setCardTheme('navy')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                      cardTheme === 'navy'
                        ? 'bg-[#0B1D3A] text-white shadow-sm'
                        : 'text-[#526886] dark:text-[#9BB2CE]'
                    }`}
                  >
                    Azul IEBH
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardTheme('light')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                      cardTheme === 'light'
                        ? 'bg-white dark:bg-[#153463] text-[#0B1D3A] dark:text-white shadow-sm'
                        : 'text-[#526886] dark:text-[#9BB2CE]'
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
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#10284F] hover:bg-[#183A6E] dark:bg-[#E4B84F] dark:hover:bg-[#EBC467] text-white dark:text-[#0B1D3A] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Baixar Imagem para Redes Sociais</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => void handleSharePoster()}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1668A3] hover:bg-[#125587] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Partilhar Agora</span>
                </button>

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => void handleDownloadRawQR()}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-[#D7E2F0] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#E7F0FA] dark:hover:bg-[#153463] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <QrCode className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Só o QR Code</span>
                </button>
              </div>

              {shareFeedback && (
                <p className="text-xs font-medium text-[#1668A3] dark:text-[#75C2F6]">
                  {shareFeedback}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-[#D7E2F0] dark:border-[#1F3B68] flex items-center justify-between gap-2 text-xs text-[#465B78] dark:text-[#9BB2CE]">
              <span className="font-mono truncate">louvor-horta.vercel.app</span>
              <button
                type="button"
                onClick={() => void handleCopyUrl()}
                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[#D7E2F0] dark:border-[#284A7F] hover:bg-[#F4F8FC] dark:hover:bg-[#153463] text-[#0B1D3A] dark:text-[#F4F8FC] font-semibold inline-flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#1668A3] dark:text-[#75C2F6]" />
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-[#EDF4FB] dark:bg-[#08162E] p-3 sm:p-4">
            <canvas
              ref={canvasRef}
              aria-label="Pré-visualização do cartão com QR Code do Louvor IEB Horta"
              className={`rounded-xl shadow-md border border-[#D7E2F0] dark:border-[#1F3B68] ${
                format === 'story'
                  ? 'w-auto max-h-[360px] sm:max-h-[430px] aspect-[9/16]'
                  : 'w-full max-w-[320px] aspect-square'
              }`}
            />
            <p className="text-[11px] text-[#526886] dark:text-[#9BB2CE] mt-2.5 text-center">
              O QR Code aponta diretamente para{' '}
              <span className="font-mono">louvor-horta.vercel.app</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
