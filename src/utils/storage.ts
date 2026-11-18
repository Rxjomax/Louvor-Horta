import { INITIAL_SONGS } from '../data/initialSongs';
import {
  AppTab,
  CifraStylePref,
  PlaylistState,
  ScheduleState,
  Song,
  SongCategory,
  ThemeMode,
} from '../types/music';

const SONGS_KEY = 'ieb_horta_songs_v1';
const SONG_DELTAS_KEY = 'ieb_horta_song_deltas_v1';
const SEEDED_IDS_KEY = 'ieb_horta_seeded_ids_v1';
const PLAYLIST_KEY = 'ieb_horta_playlist_v1';
const THEME_KEY = 'ieb_horta_theme';
const RANDOM_COUNT_KEY = 'ieb_horta_random_count_v1';
const SCHEDULE_KEY = 'ieb_horta_schedule_v1';
const REPERTOIRE_TRANSPOSE_KEY = 'ieb_horta_repertoire_transpose_v1';
const REPERTOIRE_CIFRA_PREFS_KEY = 'ieb_horta_repertoire_cifra_prefs_v1';
const ACTIVE_TAB_KEY = 'ieb_horta_active_tab_v1';
const VIEWER_PREFS_KEY = 'ieb_horta_viewer_prefs_v1';

const VALID_CATEGORIES = new Set<SongCategory>(['Normal', 'Crianças', 'Hinos']);
const VALID_TABS = new Set<AppTab>(['repertoire', 'playlist', 'schedule', 'add']);

const REMOVED_SAMPLE_IDS = new Set([
  'song-lugar-secreto',
  'song-bondade-de-deus',
  'song-grande-e-o-senhor',
  'song-a-casa-e-sua',
  'song-todavia-me-alegrarei',
  'song-santo-pra-sempre',
]);

export interface SongDeltas {
  upserted: Record<string, Song>;
  deletedIds: string[];
}

export interface ViewerPrefs {
  fontSize: number;
  lyricsOnly: boolean;
  speedIndex: number;
}

const INITIAL_SONGS_BY_ID = new Map<string, Song>(
  INITIAL_SONGS.map((s) => [s.id, s])
);

function normalizeSongCategory(song: Song): Song {
  if (VALID_CATEGORIES.has(song.category)) {
    return song;
  }
  return { ...song, category: 'Normal' };
}

function isSongModifiedFromCatalog(song: Song, catalog: Song): boolean {
  return (
    song.title !== catalog.title ||
    song.artist !== catalog.artist ||
    song.originalKey !== catalog.originalKey ||
    song.bpm !== catalog.bpm ||
    song.category !== catalog.category ||
    (song.youtubeUrl ?? '') !== (catalog.youtubeUrl ?? '') ||
    song.cifra !== catalog.cifra
  );
}

export function computeSongDeltas(songs: Song[]): SongDeltas {
  const upserted: Record<string, Song> = {};
  const presentIds = new Set<string>();

  for (const rawSong of songs) {
    if (REMOVED_SAMPLE_IDS.has(rawSong.id)) continue;
    const song = normalizeSongCategory(rawSong);
    presentIds.add(song.id);
    const catalogSong = INITIAL_SONGS_BY_ID.get(song.id);
    if (!catalogSong || isSongModifiedFromCatalog(song, catalogSong)) {
      upserted[song.id] = song;
    }
  }

  const deletedIds: string[] = [];
  for (const catalogSong of INITIAL_SONGS) {
    if (!presentIds.has(catalogSong.id)) {
      deletedIds.push(catalogSong.id);
    }
  }

  return { upserted, deletedIds };
}

export function applySongDeltas(deltas: SongDeltas): Song[] {
  const deletedSet = new Set(deltas.deletedIds || []);
  const upsertedMap = deltas.upserted || {};

  // Custom songs not in INITIAL_SONGS go first (newest first)
  const customSongs: Song[] = [];
  for (const [id, song] of Object.entries(upsertedMap)) {
    if (!INITIAL_SONGS_BY_ID.has(id) && !deletedSet.has(id) && !REMOVED_SAMPLE_IDS.has(id)) {
      customSongs.push(normalizeSongCategory(song));
    }
  }
  customSongs.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  // Catalog songs with edits overlaid
  const catalogSongs: Song[] = [];
  for (const baseSong of INITIAL_SONGS) {
    if (deletedSet.has(baseSong.id)) continue;
    const override = upsertedMap[baseSong.id];
    if (override) {
      // If an older saved entry had '—' key, upgrade its key/cifra from catalog
      if (override.originalKey === '—' && baseSong.originalKey !== '—') {
        catalogSongs.push({
          ...normalizeSongCategory(override),
          number: override.number ?? baseSong.number,
          youtubeUrl: override.youtubeUrl || baseSong.youtubeUrl,
          originalKey: baseSong.originalKey,
          cifra: baseSong.cifra,
        });
      } else {
        catalogSongs.push({
          ...normalizeSongCategory(override),
          number: override.number ?? baseSong.number,
          youtubeUrl: override.youtubeUrl || baseSong.youtubeUrl,
        });
      }
    } else {
      catalogSongs.push(baseSong);
    }
  }

  return [...customSongs, ...catalogSongs];
}

export function loadSongDeltas(): SongDeltas {
  try {
    const rawDeltas = localStorage.getItem(SONG_DELTAS_KEY);
    if (rawDeltas) {
      const parsed = JSON.parse(rawDeltas) as SongDeltas;
      if (parsed && typeof parsed.upserted === 'object' && Array.isArray(parsed.deletedIds)) {
        return parsed;
      }
    }

    // Migrate from legacy full SONGS_KEY if present
    const legacyRaw = localStorage.getItem(SONGS_KEY);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        const cleaned: Song[] = [];
        for (const entry of parsedLegacy as Song[]) {
          if (REMOVED_SAMPLE_IDS.has(entry.id)) continue;
          let current = normalizeSongCategory(entry);
          const catalogSong = INITIAL_SONGS_BY_ID.get(current.id);
          if (
            catalogSong &&
            current.originalKey === '—' &&
            catalogSong.originalKey !== '—'
          ) {
            current = {
              ...current,
              originalKey: catalogSong.originalKey,
              cifra: catalogSong.cifra,
            };
          }
          cleaned.push(current);
        }
        const deltas = computeSongDeltas(cleaned);
        localStorage.setItem(SONG_DELTAS_KEY, JSON.stringify(deltas));
        // Free up 1.5MB of redundant catalog storage so localStorage never hits quota
        localStorage.removeItem(SONGS_KEY);
        localStorage.removeItem(SEEDED_IDS_KEY);
        return deltas;
      }
    }
  } catch {
    // Fallback to empty deltas
  }
  return { upserted: {}, deletedIds: [] };
}

export function loadSongs(): Song[] {
  const deltas = loadSongDeltas();
  return applySongDeltas(deltas);
}

export function saveSongs(songs: Song[]): SongDeltas {
  const deltas = computeSongDeltas(songs);
  try {
    // Remove legacy bulky cache first so delta write always succeeds
    localStorage.removeItem(SONGS_KEY);
    localStorage.removeItem(SEEDED_IDS_KEY);
    localStorage.setItem(SONG_DELTAS_KEY, JSON.stringify(deltas));
  } catch (err) {
    console.warn('Erro ao salvar alterações de músicas no armazenamento local:', err);
  }
  return deltas;
}

const DEFAULT_PLAYLIST: PlaylistState = {
  title: 'Culto de Domingo - 18h30',
  items: [
    { songId: 'song-normal-001-tua-fidelidade-e-grande', transposeOffset: 0 },
    { songId: 'song-hinos-001-antifona-d', transposeOffset: 0 },
    { songId: 'song-normal-003-deus-esta-aqui', transposeOffset: 0 },
  ],
};

export function loadPlaylist(): PlaylistState {
  try {
    const raw = localStorage.getItem(PLAYLIST_KEY);
    if (!raw) {
      localStorage.setItem(PLAYLIST_KEY, JSON.stringify(DEFAULT_PLAYLIST));
      return DEFAULT_PLAYLIST;
    }
    const parsed = JSON.parse(raw) as PlaylistState;
    if (parsed && typeof parsed.title === 'string' && Array.isArray(parsed.items)) {
      const hadRemovedSample = parsed.items.some(
        (item) => item.kind !== 'moment' && REMOVED_SAMPLE_IDS.has(item.songId)
      );
      const validItems = parsed.items.filter((item) => {
        if (item && item.kind === 'moment') {
          return typeof item.id === 'string' && typeof item.title === 'string';
        }
        return (
          item &&
          typeof item.songId === 'string' &&
          !REMOVED_SAMPLE_IDS.has(item.songId)
        );
      });
      if (hadRemovedSample) {
        const migratedPlaylist: PlaylistState =
          validItems.length > 0
            ? { ...parsed, items: validItems }
            : { ...parsed, items: DEFAULT_PLAYLIST.items };
        localStorage.setItem(PLAYLIST_KEY, JSON.stringify(migratedPlaylist));
        return migratedPlaylist;
      }
      return { ...parsed, items: validItems };
    }
    return DEFAULT_PLAYLIST;
  } catch {
    return DEFAULT_PLAYLIST;
  }
}

export function savePlaylist(playlist: PlaylistState): void {
  try {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlist));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadRandomCount(defaultCount = 4): number {
  try {
    const raw = localStorage.getItem(RANDOM_COUNT_KEY);
    if (!raw) return defaultCount;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return defaultCount;
    return Math.min(50, parsed);
  } catch {
    return defaultCount;
  }
}

export function saveRandomCount(count: number): void {
  try {
    const clamped = Math.max(1, Math.min(50, Math.round(count)));
    localStorage.setItem(RANDOM_COUNT_KEY, String(clamped));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadRepertoireTranspose(): Record<string, number> {
  try {
    const raw = localStorage.getItem(REPERTOIRE_TRANSPOSE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, number>;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveRepertoireTranspose(map: Record<string, number>): void {
  try {
    localStorage.setItem(REPERTOIRE_TRANSPOSE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadRepertoireCifraPrefs(): Record<string, CifraStylePref> {
  try {
    const raw = localStorage.getItem(REPERTOIRE_CIFRA_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, CifraStylePref>;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveRepertoireCifraPrefs(
  map: Record<string, CifraStylePref>
): void {
  try {
    localStorage.setItem(REPERTOIRE_CIFRA_PREFS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadActiveTab(): AppTab {
  try {
    const raw = localStorage.getItem(ACTIVE_TAB_KEY) as AppTab | null;
    if (raw && VALID_TABS.has(raw)) {
      return raw;
    }
    return 'schedule';
  } catch {
    return 'schedule';
  }
}

export function saveActiveTab(tab: AppTab): void {
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadViewerPrefs(): ViewerPrefs {
  const defaultFontSize =
    typeof window !== 'undefined' && window.innerWidth < 640 ? 13 : 16;
  try {
    const raw = localStorage.getItem(VIEWER_PREFS_KEY);
    if (!raw) {
      return { fontSize: defaultFontSize, lyricsOnly: false, speedIndex: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<ViewerPrefs>;
    return {
      fontSize:
        typeof parsed.fontSize === 'number' &&
        parsed.fontSize >= 11 &&
        parsed.fontSize <= 24
          ? parsed.fontSize
          : defaultFontSize,
      lyricsOnly: Boolean(parsed.lyricsOnly),
      speedIndex:
        typeof parsed.speedIndex === 'number' &&
        parsed.speedIndex >= 0 &&
        parsed.speedIndex <= 2
          ? parsed.speedIndex
          : 0,
    };
  } catch {
    return { fontSize: defaultFontSize, lyricsOnly: false, speedIndex: 0 };
  }
}

export function saveViewerPrefs(prefs: ViewerPrefs): void {
  try {
    localStorage.setItem(VIEWER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export const DEFAULT_SCHEDULE: ScheduleState = {
  roles: [
    { id: 'ordem', label: 'Ordem de Culto' },
    { id: 'voz1', label: 'Voz' },
    { id: 'voz2', label: '2a voz' },
    { id: 'guitarra1', label: 'Guitarra' },
    { id: 'guitarra2', label: '2a guitarra' },
  ],
  members: ['Marco', 'Lorena', 'Sara', 'Miqueias'],
  entries: [
    {
      id: 'sched-nov-01',
      month: 'Novembro',
      day: '1',
      passage: 'Atos 8:25-40',
      theme: 'Ceia e baptismo',
      assignments: {
        ordem: 'Marco',
        voz1: 'Lorena',
        voz2: 'Marco',
        guitarra1: 'Marco',
        guitarra2: '',
      },
    },
    {
      id: 'sched-nov-08',
      month: 'Novembro',
      day: '8',
      passage: 'Atos 5:42',
      theme: 'Missões Nacionais',
      assignments: {
        ordem: 'Sara',
        voz1: 'Sara',
        voz2: 'Lorena',
        guitarra1: 'Sara',
        guitarra2: '',
      },
    },
    {
      id: 'sched-nov-15',
      month: 'Novembro',
      day: '15',
      passage: '',
      theme: 'Reforma Protestante',
      assignments: {
        ordem: 'Lorena',
        voz1: 'Sara',
        voz2: 'Lorena',
        guitarra1: 'Marco',
        guitarra2: '',
      },
    },
    {
      id: 'sched-nov-22',
      month: 'Novembro',
      day: '22',
      passage: '',
      theme: '',
      assignments: {
        ordem: 'Sara',
        voz1: 'Sara',
        voz2: '',
        guitarra1: 'Marco',
        guitarra2: '',
      },
    },
    {
      id: 'sched-nov-29',
      month: 'Novembro',
      day: '29',
      passage: '',
      theme: '',
      assignments: {
        ordem: 'Marco',
        voz1: 'Marco',
        voz2: 'Miqueias',
        guitarra1: 'Marco',
        guitarra2: 'Miqueias',
      },
    },
  ],
};

export function loadSchedule(): ScheduleState {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (!raw) {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(DEFAULT_SCHEDULE));
      return DEFAULT_SCHEDULE;
    }
    const parsed = JSON.parse(raw) as ScheduleState;
    if (
      parsed &&
      Array.isArray(parsed.roles) &&
      Array.isArray(parsed.members) &&
      Array.isArray(parsed.entries)
    ) {
      return parsed;
    }
    return DEFAULT_SCHEDULE;
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export function saveSchedule(schedule: ScheduleState): void {
  try {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export interface FullAppBackup {
  version: 1;
  exportedAt: string;
  songDeltas: SongDeltas;
  playlist: PlaylistState;
  schedule: ScheduleState;
  repertoireTranspose: Record<string, number>;
  randomCount: number;
  theme: ThemeMode;
}

export function createFullBackupPayload(params: {
  songs: Song[];
  playlist: PlaylistState;
  schedule: ScheduleState;
  repertoireTranspose: Record<string, number>;
  theme: ThemeMode;
}): FullAppBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    songDeltas: computeSongDeltas(params.songs),
    playlist: params.playlist,
    schedule: params.schedule,
    repertoireTranspose: params.repertoireTranspose,
    randomCount: loadRandomCount(),
    theme: params.theme,
  };
}
