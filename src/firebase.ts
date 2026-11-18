import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Timestamp,
  Unsubscribe,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  CifraStyle,
  PlaylistItem,
  PlaylistState,
  ScheduleEntry,
  ScheduleRole,
  ScheduleState,
  Song,
  SongCategory,
} from './types/music';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const SHARED_WORKSPACE_ID = 'ieb_horta_main';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: boolean | string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
      displayName?: string | null;
      photoURL?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoURL: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const VALID_CATEGORIES = new Set<SongCategory>(['Normal', 'Crianças', 'Hinos']);

export function sanitizeId(rawId: string, fallbackPrefix = 'item'): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  if (cleaned.length >= 1 && ID_PATTERN.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now()}`;
}

function clampString(
  val: string,
  minLen: number,
  maxLen: number,
  fallback: string
): string {
  const trimmed = (val ?? '').slice(0, maxLen);
  if (trimmed.length < minLen) {
    return fallback.slice(0, maxLen);
  }
  return trimmed;
}

function getActorUid(): string {
  const currentUid = auth.currentUser?.uid;
  if (currentUid) {
    return sanitizeId(currentUid, 'user');
  }
  return 'membro-ieb-horta';
}

export interface CloudWorkspaceSnapshot {
  playlist: PlaylistState;
  repertoireTranspose: Record<string, number>;
  deletedSongIds: string[];
  upsertedSongs: Record<string, Song>;
  schedule: ScheduleState;
  randomCount: number;
}

function sanitizeSongForMap(song: Song): Record<string, unknown> {
  const safeId = sanitizeId(song.id, 'song');
  const category: SongCategory = VALID_CATEGORIES.has(song.category)
    ? song.category
    : 'Normal';
  const bpm =
    typeof song.bpm === 'number' && Number.isFinite(song.bpm)
      ? Math.max(0, Math.min(300, Math.round(song.bpm)))
      : 0;
  return {
    id: safeId,
    title: clampString(song.title, 1, 200, 'Sem Título'),
    artist: clampString(song.artist, 1, 200, 'IEB Horta'),
    originalKey: clampString(song.originalKey, 1, 20, 'C'),
    bpm,
    category,
    youtubeUrl: clampString(song.youtubeUrl ?? '', 0, 500, ''),
    cifra: clampString(song.cifra, 1, 45000, song.title || 'Letra'),
    createdAt: Number.isFinite(song.createdAt)
      ? Math.max(0, Math.round(song.createdAt))
      : Date.now(),
  };
}

function buildSanitizedWorkspaceFields(state: CloudWorkspaceSnapshot) {
  const playlistTitle = clampString(
    state.playlist.title,
    1,
    200,
    'Culto de Domingo - 18h30'
  );
  const playlistSongIds: string[] = [];
  const playlistTranspose: Record<string, number> = {};
  const playlistEntries: Record<string, unknown>[] = [];

  for (const item of state.playlist.items.slice(0, 150)) {
    if (item.kind === 'moment') {
      playlistEntries.push({
        kind: 'moment',
        id: sanitizeId(item.id, 'moment'),
        title: clampString(item.title, 0, 160, ''),
        note: clampString(item.note ?? '', 0, 500, ''),
      });
      continue;
    }

    const safeSongId = sanitizeId(item.songId, 'song');
    const offset = Number.isFinite(item.transposeOffset)
      ? Math.max(-24, Math.min(24, Math.round(item.transposeOffset)))
      : 0;
    const cifraStyle: CifraStyle =
      item.cifraStyle === 'simplified' || item.cifraStyle === 'capo'
        ? item.cifraStyle
        : 'original';
    const entryPayload: Record<string, unknown> = {
      kind: 'song',
      songId: safeSongId,
      transposeOffset: offset,
      cifraStyle,
    };
    if (
      cifraStyle === 'capo' &&
      typeof item.capoFret === 'number' &&
      Number.isFinite(item.capoFret)
    ) {
      entryPayload.capoFret = Math.max(1, Math.min(9, Math.round(item.capoFret)));
    }
    if (playlistSongIds.length < 100) {
      playlistSongIds.push(safeSongId);
      playlistTranspose[safeSongId] = offset;
    }
    playlistEntries.push(entryPayload);
  }

  const repertoireTranspose: Record<string, number> = {};
  const repEntries = Object.entries(state.repertoireTranspose || {}).slice(
    0,
    1000
  );
  for (const [songId, offset] of repEntries) {
    const safeSongId = sanitizeId(songId, 'song');
    if (Number.isFinite(offset) && offset !== 0) {
      repertoireTranspose[safeSongId] = Math.max(
        -24,
        Math.min(24, Math.round(offset))
      );
    }
  }

  const deletedSongIds = (state.deletedSongIds || [])
    .slice(0, 500)
    .map((id) => sanitizeId(id, 'song'));

  const upsertedSongs: Record<string, Record<string, unknown>> = {};
  const upsertedEntries = Object.entries(state.upsertedSongs || {}).slice(
    0,
    200
  );
  for (const [rawId, songObj] of upsertedEntries) {
    const safeSongId = sanitizeId(rawId, 'song');
    upsertedSongs[safeSongId] = sanitizeSongForMap(songObj);
  }

  const scheduleRoles: ScheduleRole[] = (state.schedule.roles || [])
    .slice(0, 30)
    .map((r) => ({
      id: sanitizeId(r.id, 'role'),
      label: clampString(r.label, 1, 80, 'Função'),
    }));

  const scheduleMembers: string[] = (state.schedule.members || [])
    .slice(0, 100)
    .map((m) => clampString(m, 1, 100, 'Integrante'));

  const scheduleEntries: ScheduleEntry[] = (state.schedule.entries || [])
    .slice(0, 200)
    .map((e) => {
      const safeAssignments: Record<string, string> = {};
      for (const [roleId, member] of Object.entries(e.assignments || {}).slice(
        0,
        30
      )) {
        safeAssignments[sanitizeId(roleId, 'role')] = clampString(
          member,
          0,
          100,
          ''
        );
      }
      return {
        id: sanitizeId(e.id, 'sched'),
        month: clampString(e.month, 0, 40, 'Novembro'),
        day: clampString(e.day, 0, 20, ''),
        passage: clampString(e.passage, 0, 160, ''),
        theme: clampString(e.theme, 0, 160, ''),
        assignments: safeAssignments,
      };
    });

  const randomCount = Number.isFinite(state.randomCount)
    ? Math.max(1, Math.min(50, Math.round(state.randomCount)))
    : 4;

  return {
    workspaceId: SHARED_WORKSPACE_ID,
    updatedByUid: getActorUid(),
    playlistTitle,
    playlistSongIds,
    playlistTranspose,
    playlistEntries,
    repertoireTranspose,
    deletedSongIds,
    upsertedSongs,
    scheduleRoles,
    scheduleMembers,
    scheduleEntries,
    randomCount,
  };
}

export async function ensureAndSyncSharedWorkspace(
  localState: CloudWorkspaceSnapshot
): Promise<CloudWorkspaceSnapshot | null> {
  const path = `workspaces/${SHARED_WORKSPACE_ID}`;
  const ref = doc(db, 'workspaces', SHARED_WORKSPACE_ID);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const sanitized = buildSanitizedWorkspaceFields(localState);
      await setDoc(ref, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return null;
    }
    const data = snap.data();
    return parseCloudWorkspaceDoc(data, localState);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function parseCloudWorkspaceDoc(
  data: Record<string, unknown>,
  fallback: CloudWorkspaceSnapshot
): CloudWorkspaceSnapshot {
  const playlistTitle =
    typeof data.playlistTitle === 'string' && data.playlistTitle.trim()
      ? data.playlistTitle
      : fallback.playlist.title;

  const rawSongIds = Array.isArray(data.playlistSongIds)
    ? (data.playlistSongIds as string[])
    : fallback.playlist.items
        .filter((i): i is Extract<PlaylistItem, { songId: string }> => i.kind !== 'moment')
        .map((i) => i.songId);

  const rawPlaylistTranspose =
    data.playlistTranspose && typeof data.playlistTranspose === 'object'
      ? (data.playlistTranspose as Record<string, number>)
      : {};

  let items: PlaylistItem[];
  if (Array.isArray(data.playlistEntries)) {
    items = [];
    for (const rawEntry of data.playlistEntries as Record<string, unknown>[]) {
      if (!rawEntry || typeof rawEntry !== 'object') continue;
      if (rawEntry.kind === 'moment') {
        items.push({
          kind: 'moment',
          id: String(rawEntry.id ?? `moment-${items.length}`),
          title: String(rawEntry.title ?? ''),
          note: rawEntry.note ? String(rawEntry.note) : '',
        });
      } else if (typeof rawEntry.songId === 'string') {
        const cifraStyle: CifraStyle =
          rawEntry.cifraStyle === 'simplified' || rawEntry.cifraStyle === 'capo'
            ? rawEntry.cifraStyle
            : 'original';
        const capoFret =
          cifraStyle === 'capo' &&
          typeof rawEntry.capoFret === 'number' &&
          Number.isFinite(rawEntry.capoFret)
            ? Math.max(1, Math.min(9, Math.round(rawEntry.capoFret)))
            : undefined;
        items.push({
          kind: 'song',
          songId: String(rawEntry.songId),
          transposeOffset:
            typeof rawEntry.transposeOffset === 'number'
              ? rawEntry.transposeOffset
              : 0,
          cifraStyle,
          ...(capoFret !== undefined ? { capoFret } : {}),
        });
      }
    }
  } else {
    items = rawSongIds.map((songId) => ({
      kind: 'song',
      songId: String(songId),
      transposeOffset:
        typeof rawPlaylistTranspose[songId] === 'number'
          ? rawPlaylistTranspose[songId]
          : 0,
    }));
  }

  const playlist: PlaylistState = {
    title: playlistTitle,
    items,
  };

  const repertoireTranspose =
    data.repertoireTranspose && typeof data.repertoireTranspose === 'object'
      ? (data.repertoireTranspose as Record<string, number>)
      : fallback.repertoireTranspose;

  const deletedSongIds = Array.isArray(data.deletedSongIds)
    ? (data.deletedSongIds as string[]).map(String)
    : fallback.deletedSongIds;

  const upsertedSongs: Record<string, Song> = {};
  if (data.upsertedSongs && typeof data.upsertedSongs === 'object') {
    for (const [id, rawSong] of Object.entries(
      data.upsertedSongs as Record<string, Record<string, unknown>>
    )) {
      if (!rawSong || typeof rawSong !== 'object') continue;
      const category: SongCategory = VALID_CATEGORIES.has(
        rawSong.category as SongCategory
      )
        ? (rawSong.category as SongCategory)
        : 'Normal';
      upsertedSongs[id] = {
        id: String(rawSong.id ?? id),
        title: String(rawSong.title ?? 'Sem Título'),
        artist: String(rawSong.artist ?? 'IEB Horta'),
        originalKey: String(rawSong.originalKey ?? 'C'),
        bpm: typeof rawSong.bpm === 'number' ? rawSong.bpm : 0,
        category,
        youtubeUrl: rawSong.youtubeUrl ? String(rawSong.youtubeUrl) : undefined,
        cifra: String(rawSong.cifra ?? ''),
        createdAt:
          typeof rawSong.createdAt === 'number'
            ? rawSong.createdAt
            : Date.now(),
      };
    }
  }

  const schedule: ScheduleState = {
    roles: Array.isArray(data.scheduleRoles)
      ? (data.scheduleRoles as ScheduleRole[])
      : fallback.schedule.roles,
    members: Array.isArray(data.scheduleMembers)
      ? (data.scheduleMembers as string[])
      : fallback.schedule.members,
    entries: Array.isArray(data.scheduleEntries)
      ? (data.scheduleEntries as ScheduleEntry[])
      : fallback.schedule.entries,
  };

  const randomCount =
    typeof data.randomCount === 'number' &&
    data.randomCount >= 1 &&
    data.randomCount <= 50
      ? data.randomCount
      : fallback.randomCount;

  return {
    playlist,
    repertoireTranspose,
    deletedSongIds,
    upsertedSongs,
    schedule,
    randomCount,
  };
}

export async function updateSharedWorkspace(
  state: CloudWorkspaceSnapshot
): Promise<void> {
  const path = `workspaces/${SHARED_WORKSPACE_ID}`;
  const ref = doc(db, 'workspaces', SHARED_WORKSPACE_ID);
  const sanitized = buildSanitizedWorkspaceFields(state);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        updatedByUid: sanitized.updatedByUid,
        playlistTitle: sanitized.playlistTitle,
        playlistSongIds: sanitized.playlistSongIds,
        playlistTranspose: sanitized.playlistTranspose,
        playlistEntries: sanitized.playlistEntries,
        repertoireTranspose: sanitized.repertoireTranspose,
        deletedSongIds: sanitized.deletedSongIds,
        upsertedSongs: sanitized.upsertedSongs,
        scheduleRoles: sanitized.scheduleRoles,
        scheduleMembers: sanitized.scheduleMembers,
        scheduleEntries: sanitized.scheduleEntries,
        randomCount: sanitized.randomCount,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToSharedWorkspace(
  fallback: CloudWorkspaceSnapshot,
  onUpdate: (snapshot: CloudWorkspaceSnapshot, updatedAtMs: number) => void
): Unsubscribe {
  const path = `workspaces/${SHARED_WORKSPACE_ID}`;
  const ref = doc(db, 'workspaces', SHARED_WORKSPACE_ID);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.data();
      const updatedAt =
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toMillis()
          : Date.now();
      onUpdate(parseCloudWorkspaceDoc(data, fallback), updatedAt);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { User };
