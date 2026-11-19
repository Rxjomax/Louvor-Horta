import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  hasPendingSync?: boolean;
}

export function OfflineIndicator({ hasPendingSync = false }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();

  if (isOnline && !hasPendingSync) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-16 md:bottom-4 left-4 right-4 sm:right-auto z-50 inline-flex items-center gap-2 rounded-xl border border-[#E4B84F]/50 bg-[#0B1D3A]/95 text-[#F4F8FC] px-3.5 py-2 text-xs font-medium shadow-lg"
    >
      <WifiOff className="w-4 h-4 text-[#E4B84F] shrink-0" aria-hidden="true" />
      <span>
        {!isOnline
          ? hasPendingSync
            ? 'Sem internet — alterações guardadas no telemóvel para enviar ao voltar a ligação.'
            : 'Modo offline — repertório e cifras guardados disponíveis.'
          : 'Aguardar envio das alterações guardadas para todo o grupo...'}
      </span>
    </div>
  );
}
