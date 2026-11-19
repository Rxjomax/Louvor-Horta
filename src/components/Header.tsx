import {
  Cloud,
  Download,
  LogIn,
  LogOut,
  Moon,
  QrCode,
  RefreshCw,
  Sun,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { ChangeEvent, useRef, useState } from 'react';
import { User } from '../firebase';
import { AppTab, ThemeMode } from '../types/music';
import { PWAInstallButton } from './PWAInstallButton';
import { SocialQRModal } from './SocialQRModal';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  playlistCount: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  user: User | null;
  isCloudConnected: boolean;
  isSyncing: boolean;
  hasPendingSync: boolean;
  lastSavedText: string;
  onForceSync: () => Promise<void>;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onExportBackup: () => void;
  onImportBackup: (file: File) => Promise<boolean>;
}

export function Header({
  activeTab,
  onSelectTab,
  playlistCount,
  theme,
  onToggleTheme,
  user,
  isCloudConnected,
  isSyncing,
  hasPendingSync,
  lastSavedText,
  onForceSync,
  onSignIn,
  onSignOut,
  onExportBackup,
  onImportBackup,
}: HeaderProps) {
  const isDark = theme === 'dark';
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const navItems: { id: AppTab; label: string }[] = [
    { id: 'schedule', label: 'Escala' },
    { id: 'playlist', label: `Culto do Dia (${playlistCount})` },
    { id: 'repertoire', label: 'Repertório' },
    { id: 'add', label: 'Adicionar Música' },
  ];

  const handleSignInClick = async () => {
    setAuthError(null);
    try {
      await onSignIn();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível iniciar sessão.';
      setAuthError(msg);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await onImportBackup(file);
    setImportStatus(
      ok
        ? 'Cópia de segurança restaurada e partilhada com sucesso!'
        : 'Ficheiro inválido. Selecione um ficheiro .json válido.'
    );
    e.target.value = '';
    setTimeout(() => setImportStatus(null), 4000);
  };

  return (
    <>
      <header className="no-print border-b border-[#1F3B68] bg-[#0B1D3A] text-white transition-colors duration-150">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-3 lg:gap-4">
          <button
            type="button"
            onClick={() => onSelectTab('schedule')}
            className="text-sm sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4B84F] rounded-md py-1"
          >
            Louvor IEB Horta
          </button>

          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-4 lg:gap-5"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative min-h-[44px] px-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4B84F] rounded-md ${
                    isActive
                      ? 'text-[#E4B84F] font-semibold'
                      : 'text-[#C4D5EB] hover:text-white'
                  }`}
                >
                  <span className="tabular-nums">{item.label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E4B84F]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton variant="header" />

            <button
              type="button"
              onClick={() => setShowQRModal(true)}
              aria-label="Gerar QR Code para redes sociais"
              title="Gerar QR Code para redes sociais"
              className="min-h-[44px] min-w-[44px] px-2.5 2xl:px-3 py-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#284A7F] bg-[#132C55] text-[#F4F8FC] hover:bg-[#1B3C71] text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4B84F]"
            >
              <QrCode
                className="w-4 h-4 text-[#E4B84F] shrink-0"
                aria-hidden="true"
              />
              <span className="hidden 2xl:inline">QR Code</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              aria-label="Sincronização partilhada do grupo de louvor"
              className={`min-h-[44px] min-w-[44px] px-2.5 2xl:px-3 py-2 inline-flex items-center justify-center gap-1.5 rounded-lg border text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4B84F] ${
                hasPendingSync
                  ? 'border-[#E4B84F]/60 bg-[#E4B84F]/15 text-[#F6DE9B] hover:bg-[#E4B84F]/25'
                  : isCloudConnected
                    ? 'border-[#75C2F6]/45 bg-[#75C2F6]/15 text-[#D8EEFD] hover:bg-[#75C2F6]/25'
                    : 'border-[#284A7F] bg-[#132C55] text-[#C4D5EB] hover:bg-[#1B3C71]'
              }`}
            >
              <Cloud
                className={`w-4 h-4 shrink-0 ${
                  hasPendingSync
                    ? 'text-[#E4B84F]'
                    : isCloudConnected
                      ? 'text-[#75C2F6]'
                      : 'text-[#9BB2CE]'
                }`}
              />
              <span className="hidden 2xl:inline">
                {isSyncing
                  ? 'A sincronizar...'
                  : hasPendingSync
                    ? 'Pendente p/ nuvem'
                    : isCloudConnected
                      ? 'Sincronizado p/ Todos'
                      : 'Guardado Localmente'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={
                isDark ? 'Ativar Modo Claro' : 'Ativar Modo Palco (Escuro)'
              }
              className="min-h-[44px] min-w-[44px] px-2.5 2xl:px-3.5 py-2 inline-flex items-center justify-center gap-2 rounded-lg border border-[#284A7F] bg-[#132C55] text-[#F4F8FC] hover:bg-[#1B3C71] text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4B84F]"
            >
              {isDark ? (
                <>
                  <Sun
                    className="w-4 h-4 text-[#E4B84F] shrink-0"
                    aria-hidden="true"
                  />
                  <span className="hidden 2xl:inline">Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon
                    className="w-4 h-4 text-[#75C2F6] shrink-0"
                    aria-hidden="true"
                  />
                  <span className="hidden 2xl:inline">Modo Palco</span>
                </>
              )}
            </button>
          </div>
        </div>
        <PWAInstallButton variant="mobile-bar" />
      </header>

      {showSyncModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-modal-title"
          className="no-print fixed inset-0 z-50 bg-[#061022]/70 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#D7E2F0] dark:border-[#1F3B68] pb-4">
              <div>
                <h2
                  id="sync-modal-title"
                  className="text-base sm:text-lg font-bold text-[#0B1D3A] dark:text-white"
                >
                  Sincronizado para Todo o Grupo
                </h2>
                <p className="text-xs sm:text-sm text-[#465B78] dark:text-[#9BB2CE] mt-0.5">
                  Todos os que abrem o site ou a aplicação instalada no telemóvel
                  veem o mesmo Repertório, Culto do Dia e Escala em tempo real.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                aria-label="Fechar janela de sincronização"
                className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 inline-flex items-center justify-center rounded-lg text-[#526886] hover:text-[#0B1D3A] dark:text-[#9BB2CE] dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className={`rounded-xl border p-3.5 space-y-2.5 ${
                hasPendingSync
                  ? 'border-[#DCA93B]/50 dark:border-[#E4B84F]/40 bg-[#FDF6E3] dark:bg-[#E4B84F]/10'
                  : 'border-[#BBD9F0] dark:border-[#75C2F6]/30 bg-[#EAF4FC] dark:bg-[#75C2F6]/10'
              }`}
            >
              <div
                className={`flex items-center gap-2 text-xs sm:text-sm font-semibold ${
                  hasPendingSync
                    ? 'text-[#7A5207] dark:text-[#F6DE9B]'
                    : 'text-[#10284F] dark:text-[#D8EEFD]'
                }`}
              >
                <Users
                  className={`w-4 h-4 shrink-0 ${
                    hasPendingSync
                      ? 'text-[#8F620B] dark:text-[#E4B84F]'
                      : 'text-[#1668A3] dark:text-[#75C2F6]'
                  }`}
                />
                <span>
                  {hasPendingSync
                    ? 'Alterações Guardadas no Telemóvel (Aguardando Internet)'
                    : 'Base de Dados Partilhada IEB Horta Ativa'}
                </span>
              </div>
              <p
                className={`text-xs leading-relaxed ${
                  hasPendingSync
                    ? 'text-[#7A5207] dark:text-[#F0D388]'
                    : 'text-[#284A7F] dark:text-[#C4D5EB]'
                }`}
              >
                {hasPendingSync
                  ? 'As suas alterações já estão guardadas neste dispositivo e serão enviadas automaticamente para todo o grupo assim que a ligação voltar.'
                  : `Qualquer alteração feita na Escala, no Culto do Dia ou nas Músicas (no site ou na app instalada) é guardada automaticamente na nuvem (${lastSavedText}) e aparece para todos os músicos.`}
              </p>
              <button
                type="button"
                onClick={() => void onForceSync()}
                disabled={isSyncing}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D7E2F0] dark:border-[#284A7F] bg-white dark:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#F4F8FC] dark:hover:bg-[#153463] text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#1668A3] dark:text-[#E4B84F] ${
                    isSyncing ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {isSyncing ? 'A sincronizar agora...' : 'Sincronizar Agora'}
                </span>
              </button>
            </div>

            <div className="pt-1 space-y-2.5">
              <PWAInstallButton variant="card" />
              <button
                type="button"
                onClick={() => {
                  setShowSyncModal(false);
                  setShowQRModal(true);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[#D7E2F0] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#E7F0FA] dark:hover:bg-[#153463] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
              >
                <QrCode
                  className="w-4 h-4 text-[#8F620B] dark:text-[#E4B84F] shrink-0"
                  aria-hidden="true"
                />
                <span>Gerar QR Code para Redes Sociais</span>
              </button>
            </div>

            <div className="space-y-2.5 pt-1 border-t border-[#D7E2F0] dark:border-[#1F3B68]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#526886] dark:text-[#9BB2CE]">
                Cópia de Segurança em Ficheiro
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D7E2F0] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#E7F0FA] dark:hover:bg-[#153463] text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 text-[#1668A3] dark:text-[#75C2F6]" />
                  <span>Transferir Cópia (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D7E2F0] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#E7F0FA] dark:hover:bg-[#153463] text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4 text-[#8F620B] dark:text-[#E4B84F]" />
                  <span>Restaurar Cópia</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => void handleFileChange(e)}
                  className="hidden"
                />
              </div>
              {importStatus && (
                <p className="text-xs font-medium text-[#1668A3] dark:text-[#75C2F6]">
                  {importStatus}
                </p>
              )}
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#D7E2F0] dark:border-[#1F3B68]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#526886] dark:text-[#9BB2CE]">
                Identificação Opcional
              </h3>
              {user ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[#D7E2F0] dark:border-[#1F3B68] bg-[#F4F8FC] dark:bg-[#0B1D3A]/80 p-3">
                  <div className="text-xs min-w-0">
                    <p className="font-semibold text-[#0B1D3A] dark:text-white truncate">
                      {user.displayName || user.email}
                    </p>
                    <p className="text-[#526886] dark:text-[#9BB2CE] truncate">
                      Sessão iniciada
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[#C6D6E8] dark:border-[#284A7F] text-xs font-semibold text-[#10284F] dark:text-[#F4F8FC] inline-flex items-center gap-1.5 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Terminar sessão</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSignInClick()}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D7E2F0] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#E7F0FA] dark:hover:bg-[#153463] text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4 text-[#1668A3] dark:text-[#E4B84F]" />
                  <span>Iniciar sessão com Google (Opcional)</span>
                </button>
              )}
              {authError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {authError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <SocialQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
      />
    </>
  );
}
