import { Download, Share, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card';
}

export function PWAInstallButton({ variant = 'header' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Hide when already running inside the installed standalone app
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuideModal(true);
      }
      return;
    }
    setShowGuideModal(true);
  };

  const isInIframe =
    typeof window !== 'undefined' && window.self !== window.top;

  return (
    <>
      {variant === 'card' ? (
        <button
          type="button"
          onClick={() => void handleClick()}
          className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#2F523E] hover:bg-[#244030] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Baixar Aplicativo no Telemóvel</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleClick()}
          aria-label="Baixar aplicativo Louvor IEB Horta no telemóvel"
          title="Baixar aplicativo no telemóvel"
          className="min-h-[44px] px-2.5 sm:px-3.5 py-2 inline-flex items-center gap-1.5 rounded-lg border border-[#B85414]/35 dark:border-amber-500/40 bg-[#B85414]/10 dark:bg-amber-500/15 text-[#B85414] dark:text-amber-300 hover:bg-[#B85414] hover:text-white dark:hover:bg-amber-500 dark:hover:text-slate-950 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-400"
        >
          <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="sm:hidden">App</span>
          <span className="hidden sm:inline">Baixar App</span>
        </button>
      )}

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          className="no-print fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src="/pwa-192x192.png"
                  alt="Ícone do aplicativo Louvor IEB Horta"
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#0F2445] shrink-0 object-cover"
                />
                <div className="min-w-0">
                  <h2
                    id="pwa-install-title"
                    className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate"
                  >
                    Louvor IEB Horta
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    Instalar como aplicativo no telemóvel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Fechar instruções de instalação"
                className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {isInstallable && (
              <button
                type="button"
                onClick={() => void install()}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#B85414] hover:bg-[#9E460F] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414]"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Instalar Aplicativo Agora</span>
              </button>
            )}

            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {isInIframe && (
                <div className="rounded-xl border border-amber-300/70 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                  Se estiver a abrir dentro de uma pré-visualização, abra primeiro a ligação direta da aplicação no navegador do telemóvel (Chrome ou Safari) para concluir a instalação.
                </div>
              )}

              {isIOS ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <Share
                      className="w-4 h-4 text-[#B85414] dark:text-amber-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>No iPhone / iPad (Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm">
                    <li>
                      Toque no botão <strong>Partilhar</strong> na barra do Safari.
                    </li>
                    <li>
                      Desça e toque em <strong>Adicionar ao Ecrã Principal</strong>.
                    </li>
                    <li>
                      Confirme em <strong>Adicionar</strong> — ficará com o ícone da IEBH no ecrã inicial e funcionará mesmo sem internet.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                      <Smartphone
                        className="w-4 h-4 text-[#2F523E] dark:text-emerald-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span>No Android (Chrome / Edge):</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm">
                      <li>
                        Toque no menu <strong>⋮</strong> no canto superior direito do navegador.
                      </li>
                      <li>
                        Escolha <strong>Instalar aplicação</strong> ou <strong>Adicionar ao ecrã principal</strong>.
                      </li>
                      <li>
                        Confirme em <strong>Instalar</strong> para guardar com o ícone da IEBH no telemóvel.
                      </li>
                    </ol>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                      <Share
                        className="w-4 h-4 text-[#B85414] dark:text-amber-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span>No iPhone / iPad (Safari):</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Toque em <strong>Partilhar</strong> e depois em <strong>Adicionar ao Ecrã Principal</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
