export type SongCategory = 'Normal' | 'Crianças' | 'Hinos';

export interface Song {
  id: string;
  number?: number;
  title: string;
  artist: string;
  originalKey: string;
  bpm?: number;
  category: SongCategory;
  youtubeUrl?: string;
  cifra: string;
  createdAt: number;
}

export type CifraStyle = 'original' | 'simplified' | 'capo';

export interface CifraStylePref {
  style: CifraStyle;
  capoFret?: number;
}

export interface PlaylistSongItem {
  kind?: 'song';
  songId: string;
  transposeOffset: number;
  cifraStyle?: CifraStyle;
  capoFret?: number;
}

export interface PlaylistMomentItem {
  kind: 'moment';
  id: string;
  title: string;
  note?: string;
}

export type PlaylistItem = PlaylistSongItem | PlaylistMomentItem;

export interface PlaylistState {
  title: string;
  items: PlaylistItem[];
}

export type AppTab = 'repertoire' | 'playlist' | 'schedule' | 'add';

export type ThemeMode = 'light' | 'dark';

export interface ScheduleRole {
  id: string;
  label: string;
}

export interface ScheduleEntry {
  id: string;
  month: string;
  day: string;
  passage: string;
  theme: string;
  assignments: Record<string, string>;
}

export interface ScheduleState {
  roles: ScheduleRole[];
  members: string[];
  entries: ScheduleEntry[];
}

