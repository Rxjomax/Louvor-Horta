import { Song } from '../types/music';
import { CHILDREN_SONGS } from './childrenSongs';
import { HYMN_SONGS } from './hymnSongs';
import { NORMAL_SONGS } from './normalSongs';

export const INITIAL_SONGS: Song[] = [
  ...NORMAL_SONGS,
  ...HYMN_SONGS,
  ...CHILDREN_SONGS,
];
