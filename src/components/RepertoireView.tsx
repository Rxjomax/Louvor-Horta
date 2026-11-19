import { Check, Pencil, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Song, SongCategory } from '../types/music';

interface RepertoireViewProps {
  songs: Song[];
  playlistSongIds: Set<string>;
  onOpenSong: (songId: string) => void;
  onTogglePlaylist: (songId: string) => void;
  onEditSong: (song: Song) => void;
  onGoToAdd: () => void;
}

const CATEGORIES: ('Todas' | SongCategory)[] = [
  'Todas',
  'Normal',
  'Crianças',
  'Hinos',
];

const VISIBLE_BATCH = 60;

export function RepertoireView({
  songs,
  playlistSongIds,
  onOpenSong,
  onTogglePlaylist,
  onEditSong,
  onGoToAdd,
}: RepertoireViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todas' | SongCategory>('Todas');
  const [selectedKey, setSelectedKey] = useState<string>('Todos');
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_BATCH);

  const availableKeys = useMemo(() => {
    const baseKeys = ['G', 'C', 'D', 'A', 'E', 'F', 'B', 'Bb', 'Eb', 'Ab', 'Am', 'Em', 'Bm', 'Dm', 'Gm'];
    const dynamic = Array.from(
      new Set(
        songs
          .map((s) => s.originalKey)
          .filter((k) => k && k !== '—')
      )
    );
    const combined = Array.from(new Set([...baseKeys, ...dynamic]));
    return ['Todos', ...combined];
  }, [songs]);

  const filteredSongs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const numericQuery = query.replace(/^#/, '');
    return songs
      .filter((song) => {
        const matchesSearch =
          !query ||
          song.title.toLowerCase().includes(query) ||
          song.artist.toLowerCase().includes(query) ||
          (numericQuery !== '' &&
            song.number !== undefined &&
            (String(song.number) === numericQuery ||
              `#${song.number}` === query ||
              String(song.number).padStart(2, '0').includes(numericQuery)));

        const matchesCategory =
          selectedCategory === 'Todas' || song.category === selectedCategory;

        const matchesKey =
          selectedKey === 'Todos' || song.originalKey === selectedKey;

        return matchesSearch && matchesCategory && matchesKey;
      })
      .sort((a, b) =>
        a.title.trim().localeCompare(b.title.trim(), 'pt', {
          sensitivity: 'base',
          numeric: true,
        })
      );
  }, [songs, searchQuery, selectedCategory, selectedKey]);

  const displayedSongs = useMemo(
    () => filteredSongs.slice(0, visibleLimit),
    [filteredSongs, visibleLimit]
  );

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'Todas' ||
    selectedKey !== 'Todos';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Todas');
    setSelectedKey('Todos');
    setVisibleLimit(VISIBLE_BATCH);
  };

  return (
    <section
      aria-labelledby="repertoire-heading"
      className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-12"
    >
      {/* Top Section Heading & Count */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[#D7E2F0] dark:border-[#1F3B68]">
        <div>
          <h1
            id="repertoire-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1D3A] dark:text-[#F4F8FC]"
          >
            Repertório Geral
          </h1>
          <p className="mt-1 text-sm sm:text-base text-[#465B78] dark:text-[#9BB2CE]">
            <span className="tabular-nums font-medium text-[#0B1D3A] dark:text-[#F4F8FC]">
              {filteredSongs.length}
            </span>{' '}
            {filteredSongs.length === 1 ? 'música encontrada' : 'músicas disponíveis'} · Toque numa música para ver a cifra e ouvir
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToAdd}
          className="hidden sm:inline-flex min-h-[44px] items-center gap-2 px-4 py-2 rounded-lg bg-[#10284F] dark:bg-[#E4B84F] text-white dark:text-[#0B1D3A] text-sm font-semibold hover:bg-[#183A6E] dark:hover:bg-[#EBC467] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
        >
          <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Nova Música</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="mt-4 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search
            className="w-4 h-4 text-[#526886] dark:text-[#9BB2CE] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="song-search" className="sr-only">
            Pesquisar música ou intérprete
          </label>
          <input
            id="song-search"
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleLimit(VISIBLE_BATCH);
            }}
            placeholder="Pesquisar por nome, número (#89) ou intérprete..."
            className="w-full min-h-[46px] pl-10 pr-11 py-2.5 rounded-xl border border-[#C6D6E8] dark:border-[#284A7F] bg-white dark:bg-[#11264A] text-base text-[#0B1D3A] dark:text-[#F4F8FC] placeholder:text-[#6B82A0] dark:placeholder:text-[#829CBE] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F] focus:border-transparent transition-colors duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setVisibleLimit(VISIBLE_BATCH);
              }}
              aria-label="Limpar pesquisa"
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#526886] hover:text-[#0B1D3A] dark:text-[#9BB2CE] dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] rounded-lg"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Category & Key Filter Strips */}
        <div className="flex flex-col gap-2.5">
          <div
            role="group"
            aria-label="Filtrar por categoria do culto"
            className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible no-scrollbar pb-0.5"
          >
            {CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category);
                    setVisibleLimit(VISIBLE_BATCH);
                  }}
                  aria-pressed={isSelected}
                  className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                    isSelected
                      ? 'bg-[#10284F] dark:bg-[#E4B84F] text-white dark:text-[#0B1D3A] font-semibold'
                      : 'bg-white dark:bg-[#11264A] text-[#243B5A] dark:text-[#C4D5EB] border border-[#D7E2F0] dark:border-[#1F3B68] hover:bg-[#EAF1F8] dark:hover:bg-[#153463]'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          {/* Key Filter Strip */}
          <div
            role="group"
            aria-label="Filtrar por tom original"
            className="flex items-center gap-1 overflow-x-auto sm:flex-wrap sm:overflow-visible no-scrollbar pb-0.5"
          >
            <span className="text-xs font-medium text-[#526886] dark:text-[#9BB2CE] mr-1.5 whitespace-nowrap shrink-0">
              Tom:
            </span>
            {availableKeys.map((keyOption) => {
              const isSelected = selectedKey === keyOption;
              return (
                <button
                  key={keyOption}
                  type="button"
                  onClick={() => {
                    setSelectedKey(keyOption);
                    setVisibleLimit(VISIBLE_BATCH);
                  }}
                  aria-pressed={isSelected}
                  className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg text-sm font-cifra font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                    isSelected
                      ? 'bg-[#1668A3] dark:bg-[#75C2F6] text-white dark:text-[#0B1D3A] font-bold'
                      : 'bg-white dark:bg-[#11264A] text-[#243B5A] dark:text-[#C4D5EB] border border-[#D7E2F0] dark:border-[#1F3B68] hover:bg-[#EAF1F8] dark:hover:bg-[#153463]'
                  }`}
                >
                  {keyOption}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Song List / Grid */}
      {filteredSongs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-8 text-center">
          <p className="text-base font-semibold text-[#0B1D3A] dark:text-[#F4F8FC]">
            Nenhuma música encontrada
          </p>
          <p className="mt-1 text-sm text-[#465B78] dark:text-[#9BB2CE] max-w-md mx-auto">
            Tente outro termo de pesquisa ou limpe os filtros para ver todo o repertório do grupo.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 min-h-[44px] px-5 py-2.5 rounded-lg border border-[#C6D6E8] dark:border-[#284A7F] text-sm font-semibold text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#EAF1F8] dark:hover:bg-[#153463] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <ul
            aria-label="Lista de músicas do repertório"
            className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4"
          >
            {displayedSongs.map((song) => {
            const inPlaylist = playlistSongIds.has(song.id);
            return (
              <li
                key={song.id}
                className="group rounded-xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] hover:border-[#75C2F6] dark:hover:border-[#3A65A3] transition-colors duration-150 flex items-stretch"
              >
                {/* Main clickable card area opens Chord Viewer */}
                <button
                  type="button"
                  onClick={() => onOpenSong(song.id)}
                  className="flex-1 min-w-0 text-left p-3.5 sm:p-4 flex items-center gap-3.5 rounded-l-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
                >
                  {/* Key Block */}
                  <div className="w-11 h-11 rounded-lg bg-[#EDF4FB] dark:bg-[#0B1D3A] border border-[#D7E2F0] dark:border-[#284A7F] flex flex-col items-center justify-center shrink-0">
                    {song.originalKey === '—' ? (
                      <span className="text-[11px] leading-none font-semibold text-[#526886] dark:text-[#9BB2CE]">
                        Letra
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] leading-none text-[#526886] dark:text-[#9BB2CE] font-medium">
                          Tom
                        </span>
                        <span className="font-cifra text-sm font-bold text-[#8F620B] dark:text-[#E4B84F] leading-tight mt-0.5">
                          {song.originalKey}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Title & Unboxed Metadata */}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-[#0B1D3A] dark:text-[#F4F8FC] truncate group-hover:text-[#1668A3] dark:group-hover:text-[#E4B84F] transition-colors duration-150">
                      {song.number !== undefined && (
                        <span className="font-cifra text-xs font-semibold text-[#6B82A0] dark:text-[#829CBE] mr-1.5 tabular-nums">
                          #{String(song.number).padStart(2, '0')}
                        </span>
                      )}
                      {song.title}
                    </h2>
                    <p className="mt-0.5 text-sm font-medium text-[#243B5A] dark:text-[#C4D5EB] truncate">
                      {song.artist}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#526886] dark:text-[#9BB2CE] truncate">
                      {song.bpm && song.bpm > 0 ? (
                        <>
                          <span className="tabular-nums shrink-0">{song.bpm} BPM</span>
                          <span aria-hidden="true">·</span>
                        </>
                      ) : null}
                      {song.originalKey === '—' && (
                        <>
                          <span className="shrink-0">Sem cifra</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="truncate">{song.category}</span>
                    </div>
                  </div>
                </button>

                {/* Right Action Buttons (>= 44px touch targets) */}
                <div className="flex items-center gap-1 pr-2.5 pl-1 border-l border-[#E6EEF8] dark:border-[#1F3B68] shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditSong(song)}
                    aria-label={`Editar ${song.title}`}
                    title={`Editar ${song.title}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#6B82A0] dark:text-[#9BB2CE] hover:text-[#0B1D3A] dark:hover:text-white hover:bg-[#EAF1F8] dark:hover:bg-[#153463] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onTogglePlaylist(song.id)}
                    aria-pressed={inPlaylist}
                    aria-label={
                      inPlaylist
                        ? `Remover ${song.title} da lista do culto`
                        : `Adicionar ${song.title} à lista do culto`
                    }
                    title={inPlaylist ? 'Na lista do culto' : 'Adicionar ao culto'}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                      inPlaylist
                        ? 'bg-[#1668A3]/12 dark:bg-[#75C2F6]/20 text-[#1668A3] dark:text-[#75C2F6] border border-[#1668A3]/35 dark:border-[#75C2F6]/40 hover:bg-[#1668A3]/20'
                        : 'bg-[#EDF4FB] dark:bg-[#0B1D3A] text-[#10284F] dark:text-[#F4F8FC] hover:bg-[#10284F] hover:text-white dark:hover:bg-[#E4B84F] dark:hover:text-[#0B1D3A]'
                    }`}
                  >
                    {inPlaylist ? (
                      <Check className="w-5 h-5" strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      <Plus className="w-5 h-5" strokeWidth={2.25} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

          {filteredSongs.length > visibleLimit && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + VISIBLE_BATCH)}
                className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl border border-[#C6D6E8] dark:border-[#284A7F] bg-white dark:bg-[#11264A] text-sm font-semibold text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#EAF1F8] dark:hover:bg-[#153463] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
              >
                Mostrar mais músicas ({displayedSongs.length} de {filteredSongs.length})
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
