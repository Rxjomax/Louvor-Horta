import {
  Cloud,
  Download,
  LogIn,
  LogOut,
  Moon,
  Sun,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { ChangeEvent, useRef, useState } from 'react';
import { User } from '../firebase';
import { AppTab, ThemeMode } from '../types/music';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  playlistCount: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  user: User | null;
  isCloudConnected: boolean;
  isSyncing: boolean;
  lastSavedText: string;
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
  lastSavedText,
  onSignIn,
  onSignOut,
  onExportBackup,
  onImportBackup,
}: HeaderProps) {
  const isDark = theme === 'dark';
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const navItems: { id: AppTab; label: string }[] = [
    { id: 'repertoire', label: 'Repertório' },
    { id: 'playlist', label: `Culto do Dia (${playlistCount})` },
    { id: 'schedule', label: 'Escala' },
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
      <header className="no-print border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] transition-colors duration-150">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => onSelectTab('repertoire')}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500 rounded-md py-1"
          >
            Louvor IEB Horta
          </button>

          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-6"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative min-h-[44px] px-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500 rounded-md ${
                    isActive
                      ? 'text-[#B85414] dark:text-amber-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="tabular-nums">{item.label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B85414] dark:bg-amber-400"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              aria-label="Sincronização partilhada do grupo de louvor"
              className={`min-h-[44px] px-3 py-2 inline-flex items-center gap-1.5 rounded-lg border text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500 ${
                isCloudConnected
                  ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-950/60'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">
                {isSyncing
                  ? 'A sincronizar...'
                  : isCloudConnected
                    ? 'Sincronizado p/ Todos'
                    : 'Guardado'}
              </span>
              <span className="sm:hidden">
                {isSyncing ? '...' : 'Guardado'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={
                isDark ? 'Ativar Modo Claro' : 'Ativar Modo Palco (Escuro)'
              }
              className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500"
            >
              {isDark ? (
                <>
                  <Sun
                    className="w-4 h-4 text-amber-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon
                    className="w-4 h-4 text-[#B85414] shrink-0"
                    aria-hidden="true"
                  />
                  <span>Modo Palco</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {showSyncModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-modal-title"
          className="no-print fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2
                  id="sync-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                >
                  Sincronizado para Todo o Grupo
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Todos os que abrem o site veem o mesmo Repertório, Culto do
                  Dia e Escala em tempo real.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                aria-label="Fechar janela de sincronização"
                className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Base de Dados Partilhada IEB Horta Ativa</span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                Qualquer alteração feita na <strong>Escala</strong>, no{' '}
                <strong>Culto do Dia</strong> ou nas <strong>Músicas</strong> é
                guardada automaticamente na nuvem ({lastSavedText}) e aparece de
                imediato para todos os músicos, sem necessidade de iniciar
                sessão.
              </p>
            </div>

            <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cópia de Segurança em Ficheiro
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 text-[#B85414] dark:text-amber-400" />
                  <span>Transferir Cópia (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4 text-[#B85414] dark:text-amber-400" />
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
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {importStatus}
                </p>
              )}
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Identificação Opcional
              </h3>
              {user ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
                  <div className="text-xs min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {user.displayName || user.email}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 truncate">
                      Sessão iniciada
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Terminar sessão</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSignInClick()}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4 text-[#B85414] dark:text-amber-400" />
                  <span>Iniciar sessão com Google (Opcional)</span>
                </button>
              )}
              {authError && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {authError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
