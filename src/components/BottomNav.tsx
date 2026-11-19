import { CalendarDays, ListMusic, Music2, PlusCircle } from 'lucide-react';
import { AppTab } from '../types/music';

interface BottomNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  playlistCount: number;
}

export function BottomNav({
  activeTab,
  onSelectTab,
  playlistCount,
}: BottomNavProps) {
  const tabs: {
    id: AppTab;
    label: string;
    icon: typeof Music2;
    badge?: number;
  }[] = [
    { id: 'schedule', label: 'Escala', icon: CalendarDays },
    {
      id: 'playlist',
      label: 'Culto do Dia',
      icon: ListMusic,
      badge: playlistCount,
    },
    { id: 'repertoire', label: 'Repertório', icon: Music2 },
    { id: 'add', label: 'Adicionar', icon: PlusCircle },
  ];

  return (
    <nav
      aria-label="Menu inferior"
      className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B1D3A]/95 backdrop-blur-md border-t border-[#D7E2F0] dark:border-[#1F3B68] pb-safe"
    >
      <div className="grid grid-cols-4 h-14 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative min-h-[44px] h-full flex flex-col items-center justify-center gap-0.5 px-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                isActive
                  ? 'text-[#10284F] dark:text-[#E4B84F] font-semibold'
                  : 'text-[#526886] dark:text-[#9BB2CE] hover:text-[#0B1D3A] dark:hover:text-[#F4F8FC]'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-3 right-3 h-0.5 rounded-full bg-[#DCA93B] dark:bg-[#E4B84F]"
                />
              )}
              <div className="relative flex items-center justify-center">
                <Icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2.25 : 1.75}
                  aria-hidden="true"
                />
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-4 text-[10px] font-bold tabular-nums leading-none">
                    ({tab.badge})
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium tracking-tight leading-none whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
