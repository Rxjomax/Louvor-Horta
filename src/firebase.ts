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
  collection,
  deleteDoc,
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
  schedule: ScheduleState;
  randomCount: number;
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

  for (const item of state.playlist.items.slice(0, 100)) {
    const safeSongId = sanitizeId(item.songId, 'song');
    playlistSongIds.push(safeSongId);
    const offset = Number.isFinite(item.transposeOffset)
      ? Math.max(-24, Math.min(24, Math.round(item.transposeOffset)))
      : 0;
    playlistTranspose[safeSongId] = offset;
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
    repertoireTranspose,
    deletedSongIds,
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
    : fallback.playlist.items.map((i) => i.songId);

  const rawPlaylistTranspose =
    data.playlistTranspose && typeof data.playlistTranspose === 'object'
      ? (data.playlistTranspose as Record<string, number>)
      : {};

  const playlist: PlaylistState = {
    title: playlistTitle,
    items: rawSongIds.map((songId) => ({
      songId: String(songId),
      transposeOffset:
        typeof rawPlaylistTranspose[songId] === 'number'
          ? rawPlaylistTranspose[songId]
          : 0,
    })),
  };

  const repertoireTranspose =
    data.repertoireTranspose && typeof data.repertoireTranspose === 'object'
      ? (data.repertoireTranspose as Record<string, number>)
      : fallback.repertoireTranspose;

  const deletedSongIds = Array.isArray(data.deletedSongIds)
    ? (data.deletedSongIds as string[]).map(String)
    : fallback.deletedSongIds;

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
        repertoireTranspose: sanitized.repertoireTranspose,
        deletedSongIds: sanitized.deletedSongIds,
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

export async function saveSharedCustomSong(song: Song): Promise<void> {
  const safeSongId = sanitizeId(song.id, 'song');
  const path = `workspaces/${SHARED_WORKSPACE_ID}/songs/${safeSongId}`;
  const ref = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'songs', safeSongId);

  const category: SongCategory = VALID_CATEGORIES.has(song.category)
    ? song.category
    : 'Normal';

  const payload = {
    id: safeSongId,
    workspaceId: SHARED_WORKSPACE_ID,
    updatedByUid: getActorUid(),
    title: clampString(song.title, 1, 200, 'Sem Título'),
    artist: clampString(song.artist, 1, 200, 'IEB Horta'),
    originalKey: clampString(song.originalKey, 1, 20, 'C'),
    bpm:
      typeof song.bpm === 'number' && Number.isFinite(song.bpm)
        ? Math.max(0, Math.min(300, Math.round(song.bpm)))
        : 0,
    category,
    youtubeUrl: clampString(song.youtubeUrl ?? '', 0, 500, ''),
    cifra: clampString(song.cifra, 1, 50000, song.title || 'Letra'),
    songUpdatedAt: Number.isFinite(song.createdAt)
      ? Math.max(0, Math.round(song.createdAt))
      : Date.now(),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        updatedByUid: payload.updatedByUid,
        title: payload.title,
        artist: payload.artist,
        originalKey: payload.originalKey,
        bpm: payload.bpm,
        category: payload.category,
        youtubeUrl: payload.youtubeUrl,
        cifra: payload.cifra,
        songUpdatedAt: payload.songUpdatedAt,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSharedCustomSong(songId: string): Promise<void> {
  const safeSongId = sanitizeId(songId, 'song');
  const path = `workspaces/${SHARED_WORKSPACE_ID}/songs/${safeSongId}`;
  const ref = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'songs', safeSongId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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

export function subscribeToSharedSongs(
  onUpdate: (upsertedSongs: Record<string, Song>) => void
): Unsubscribe {
  const path = `workspaces/${SHARED_WORKSPACE_ID}/songs`;
  const colRef = collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'songs');
  return onSnapshot(
    colRef,
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      const upserted: Record<string, Song> = {};
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const category: SongCategory = VALID_CATEGORIES.has(
          d.category as SongCategory
        )
          ? (d.category as SongCategory)
          : 'Normal';
        upserted[docSnap.id] = {
          id: String(d.id ?? docSnap.id),
          title: String(d.title ?? 'Sem Título'),
          artist: String(d.artist ?? 'IEB Horta'),
          originalKey: String(d.originalKey ?? 'C'),
          bpm: typeof d.bpm === 'number' ? d.bpm : 0,
          category,
          youtubeUrl: d.youtubeUrl ? String(d.youtubeUrl) : undefined,
          cifra: String(d.cifra ?? ''),
          createdAt:
            typeof d.songUpdatedAt === 'number' ? d.songUpdatedAt : Date.now(),
        };
      });
      onUpdate(upserted);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
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
