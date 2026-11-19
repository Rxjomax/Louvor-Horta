import {
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'mobile-bar' | 'card';
}

type InstallPlatform = 'android' | 'ios';

const OFFICIAL_APP_URL = 'https://louvor-horta.vercel.app/';

export function PWAInstallButton({ variant = 'header' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, iosBrowser, install } = usePWAInstall();
  const [modalPlatform, setModalPlatform] = useState<InstallPlatform | null>(
    null
  );
  const [copiedLink, setCopiedLink] = useState(false);

  // Hide when already running inside the installed standalone app
  if (isInstalled) {
    return null;
  }

  const handleAndroidClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setModalPlatform('android');
      }
      return;
    }
    setModalPlatform('android');
  };

  const handleIOSClick = () => {
    setModalPlatform('ios');
  };

  const isInIframe =
    typeof window !== 'undefined' && window.self !== window.top;
  const isDifferentOrigin =
    typeof window !== 'undefined' &&
    window.location.origin !== 'https://louvor-horta.vercel.app';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(OFFICIAL_APP_URL);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = OFFICIAL_APP_URL;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedLink(true);
        window.setTimeout(() => setCopiedLink(false), 3000);
      } catch {
        // Ignore clipboard errors gracefully
      }
    }
  };

  return (
    <>
      {variant === 'card' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => void handleAndroidClick()}
            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#1668A3] hover:bg-[#125587] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C2F6]"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Baixar App (Android)</span>
          </button>

          <button
            type="button"
            onClick={handleIOSClick}
            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[#10284F] dark:border-[#E4B84F]/60 bg-[#10284F] hover:bg-[#183A6E] dark:bg-[#E4B84F] dark:hover:bg-[#EBC467] text-white dark:text-[#0B1D3A] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4B84F]"
          >
            <Share className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Baixar App (iOS)</span>
          </button>
        </div>
      )}

      {variant === 'header' && (
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleAndroidClick()}
            aria-label="Baixar aplicativo Louvor IEB Horta para Android"
            title="Baixar aplicativo direto no Android"
            className="min-h-[44px] px-3 py-2 inline-flex items-center gap-1.5 rounded-lg border border-[#75C2F6]/45 bg-[#75C2F6]/12 text-[#D8EEFD] hover:bg-[#75C2F6] hover:text-[#0B1D3A] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C2F6]"
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Baixar App (Android)</span>
          </button>

          <button
            type="button"
            onClick={handleIOSClick}
            aria-label="Tutorial para baixar aplicativo Louvor IEB Horta no iPhone (iOS)"
            title="Como adicionar ao ecrã principal no iOS"
            className="min-h-[44px] px-3 py-2 inline-flex items-center gap-1.5 rounded-lg border border-[#E4B84F]/50 bg-[#E4B84F]/14 text-[#F6DE9B] hover:bg-[#E4B84F] hover:text-[#0B1D3A] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4B84F]"
          >
            <Share className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Baixar App (iOS)</span>
          </button>
        </div>
      )}

      {variant === 'mobile-bar' && (
        <div className="lg:hidden border-t border-[#1F3B68] bg-[#10284F]">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleAndroidClick()}
              aria-label="Baixar aplicativo Louvor IEB Horta para Android"
              className="flex-1 min-h-[44px] px-2 sm:px-3 py-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#75C2F6]/45 bg-[#75C2F6]/15 text-[#D8EEFD] hover:bg-[#75C2F6] hover:text-[#0B1D3A] text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C2F6]"
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Baixar App (Android)</span>
            </button>

            <button
              type="button"
              onClick={handleIOSClick}
              aria-label="Tutorial para baixar aplicativo Louvor IEB Horta no iPhone (iOS)"
              className="flex-1 min-h-[44px] px-2 sm:px-3 py-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E4B84F]/50 bg-[#E4B84F]/15 text-[#F6DE9B] hover:bg-[#E4B84F] hover:text-[#0B1D3A] text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4B84F]"
            >
              <Share className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Baixar App (iOS)</span>
            </button>
          </div>
        </div>
      )}

      {modalPlatform && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          className="no-print fixed inset-0 z-50 bg-[#061022]/70 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-5 sm:p-6 space-y-4 shadow-xl text-[#0B1D3A] dark:text-[#F4F8FC]">
            <div className="flex items-start justify-between gap-3 border-b border-[#D7E2F0] dark:border-[#1F3B68] pb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src="/pwa-192x192.png"
                  alt="Ícone do aplicativo Louvor IEB Horta"
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-xl border border-[#D7E2F0] dark:border-[#284A7F] bg-[#0B1D3A] shrink-0 object-cover"
                />
                <div className="min-w-0">
                  <h2
                    id="pwa-install-title"
                    className="text-base sm:text-lg font-bold text-[#0B1D3A] dark:text-white truncate"
                  >
                    Louvor IEB Horta
                  </h2>
                  <p className="text-xs sm:text-sm text-[#465B78] dark:text-[#9BB2CE]">
                    {modalPlatform === 'ios'
                      ? 'Tutorial para iPhone / iPad (iOS)'
                      : 'Instalar no Android'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPlatform(null)}
                aria-label="Fechar instruções de instalação"
                className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 inline-flex items-center justify-center rounded-lg text-[#526886] hover:text-[#0B1D3A] dark:text-[#9BB2CE] dark:hover:text-white"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {modalPlatform === 'android' && isInstallable && (
              <button
                type="button"
                onClick={() => void install()}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#1668A3] hover:bg-[#125587] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C2F6]"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Instalar Aplicativo Agora</span>
              </button>
            )}

            <div className="space-y-3 text-sm text-[#243B5A] dark:text-[#C4D5EB] leading-relaxed">
              {(isInIframe || isDifferentOrigin) && (
                <div className="rounded-xl border border-[#DCA93B]/55 dark:border-[#E4B84F]/45 bg-[#FDF6E3] dark:bg-[#E4B84F]/10 p-3.5 space-y-2.5 text-xs text-[#6B4706] dark:text-[#F6DE9B]">
                  <p className="font-semibold">
                    {isInIframe
                      ? 'Está a abrir dentro de uma pré-visualização:'
                      : 'Para instalar o app oficial da igreja:'}
                  </p>
                  <p>
                    Abra a página direta oficial{' '}
                    <span className="font-mono font-semibold">
                      louvor-horta.vercel.app
                    </span>{' '}
                    no navegador (Safari no iPhone ou Chrome no Android) antes de
                    instalar.
                  </p>
                  <a
                    href={OFFICIAL_APP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#10284F] hover:bg-[#183A6E] dark:bg-[#E4B84F] dark:text-[#0B1D3A] text-white font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Abrir Página Direta</span>
                  </a>
                </div>
              )}

              {modalPlatform === 'ios' ? (
                <div className="space-y-3">
                  {iosBrowser === 'in-app' && (
                    <div className="rounded-xl border border-[#DCA93B]/60 dark:border-[#E4B84F]/45 bg-[#FDF6E3] dark:bg-[#E4B84F]/10 p-3.5 space-y-2 text-xs text-[#6B4706] dark:text-[#F6DE9B]">
                      <div className="flex items-center gap-2 font-bold">
                        <Compass className="w-4 h-4 text-[#8F620B] dark:text-[#E4B84F] shrink-0" />
                        <span>Abra no Safari para instalar no iPhone</span>
                      </div>
                      <p className="leading-relaxed">
                        Abriu este link dentro do <strong>WhatsApp</strong>,{' '}
                        <strong>Instagram</strong> ou outro app — por limitação
                        da Apple, a opção de instalar não aparece aqui.
                      </p>
                      <ol className="list-decimal list-inside space-y-1 font-medium">
                        <li>
                          Toque no ícone de <strong>bússola (Safari)</strong> ou
                          nos <strong>3 pontinhos (•••)</strong> e escolha{' '}
                          <strong>Abrir no Safari</strong>.
                        </li>
                        <li>
                          Ou toque em <strong>Copiar Link</strong> abaixo e cole
                          no <strong>Safari</strong>.
                        </li>
                      </ol>
                    </div>
                  )}

                  {iosBrowser === 'other-browser' && (
                    <div className="rounded-xl border border-[#DCA93B]/60 dark:border-[#E4B84F]/45 bg-[#FDF6E3] dark:bg-[#E4B84F]/10 p-3.5 space-y-2 text-xs text-[#6B4706] dark:text-[#F6DE9B]">
                      <div className="flex items-center gap-2 font-bold">
                        <Compass className="w-4 h-4 text-[#8F620B] dark:text-[#E4B84F] shrink-0" />
                        <span>Use o Safari ou o Partilhar no topo</span>
                      </div>
                      <p className="leading-relaxed">
                        No Chrome/Edge do iPhone, o botão{' '}
                        <strong>Partilhar (quadrado com seta ↑)</strong> fica no{' '}
                        <strong>canto superior direito</strong>, ao lado do
                        endereço. Se não aparecer a opção de adicionar ao ecrã,
                        copie o link abaixo e abra no <strong>Safari</strong>.
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-[#F4F8FC] dark:bg-[#0B1D3A]/80 p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2 font-semibold text-[#0B1D3A] dark:text-white">
                      <Share
                        className="w-4 h-4 text-[#8F620B] dark:text-[#E4B84F] shrink-0"
                        aria-hidden="true"
                      />
                      <span>Como adicionar ao Ecrã Principal no iOS:</span>
                    </div>
                    <p className="text-xs text-[#465B78] dark:text-[#9BB2CE]">
                      No iPhone e iPad, a Apple não permite download direto por
                      botão; basta seguir estes passos no <strong>Safari</strong>:
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm">
                      <li>
                        Abra{' '}
                        <span className="font-mono font-semibold text-[#0B1D3A] dark:text-white break-all">
                          louvor-horta.vercel.app
                        </span>{' '}
                        no <strong>Safari</strong>.
                      </li>
                      <li>
                        Toque no botão{' '}
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#E4EEF9] dark:bg-[#1B3C71] font-semibold">
                          <Share className="w-3.5 h-3.5 inline" aria-hidden="true" />
                          Partilhar
                        </span>{' '}
                        (quadrado com seta ↑ na barra inferior, ou dentro de{' '}
                        <strong>•••</strong>).
                      </li>
                      <li>
                        Role as opções para baixo e toque em{' '}
                        <strong>Adicionar ao Ecrã Principal</strong>{' '}
                        <span className="text-[#526886] dark:text-[#9BB2CE]">
                          (ou <strong>Adicionar à Tela de Início</strong>)
                        </span>
                        .
                      </li>
                      <li>
                        Toque em <strong>Adicionar</strong> no canto superior
                        direito — o ícone azul da IEBH aparecerá junto dos seus
                        outros aplicativos.
                      </li>
                    </ol>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D7E2F0] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#E7F0FA] dark:hover:bg-[#153463] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    {copiedLink ? (
                      <>
                        <Check
                          className="w-4 h-4 text-[#1668A3] dark:text-[#75C2F6] shrink-0"
                          aria-hidden="true"
                        />
                        <span>Link copiado! Agora abra no Safari</span>
                      </>
                    ) : (
                      <>
                        <Copy
                          className="w-4 h-4 text-[#8F620B] dark:text-[#E4B84F] shrink-0"
                          aria-hidden="true"
                        />
                        <span>Copiar Link para Abrir no Safari</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-[#F4F8FC] dark:bg-[#0B1D3A]/80 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-[#0B1D3A] dark:text-white">
                    <Smartphone
                      className="w-4 h-4 text-[#1668A3] dark:text-[#75C2F6] shrink-0"
                      aria-hidden="true"
                    />
                    <span>Como instalar no Android (Chrome / Edge):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm">
                    <li>
                      Abra esta página no navegador <strong>Chrome</strong> ou{' '}
                      <strong>Edge</strong>.
                    </li>
                    <li>
                      Toque no menu <strong>⋮</strong> no canto superior direito
                      do navegador.
                    </li>
                    <li>
                      Escolha <strong>Instalar aplicação</strong> ou{' '}
                      <strong>Adicionar à tela inicial</strong>.
                    </li>
                    <li>
                      Confirme em <strong>Instalar</strong> para guardar com o
                      ícone azul da IEBH no telemóvel.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalPlatform(null)}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#D7E2F0] dark:border-[#284A7F] text-sm font-semibold text-[#10284F] dark:text-[#F4F8FC] hover:bg-[#F4F8FC] dark:hover:bg-[#153463] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
