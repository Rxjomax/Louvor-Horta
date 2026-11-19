import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { ChordViewer } from './components/ChordViewer';
import { Header } from './components/Header';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PlaylistView } from './components/PlaylistView';
import { RepertoireView } from './components/RepertoireView';
import { ScheduleView } from './components/ScheduleView';
import { SongFormView } from './components/SongFormView';
import {
  CloudWorkspaceSnapshot,
  User,
  auth,
  computeWorkspaceSignature,
  ensureAndSyncSharedWorkspace,
  fetchLatestSharedWorkspace,
  onAuthStateChanged,
  signInWithGoogle,
  signOutGoogle,
  subscribeToSharedWorkspace,
  updateSharedWorkspace,
} from './firebase';
import {
  AppTab,
  CifraStyle,
  CifraStylePref,
  PlaylistSongItem,
  PlaylistState,
  ScheduleEntry,
  ScheduleState,
  Song,
  ThemeMode,
} from './types/music';
import { getEffectiveCifraParams } from './utils/chords';
import { generateBalancedSetlist, isPlaylistMoment } from './utils/setlist';
import {
  FullAppBackup,
  applySongDeltas,
  computeSongDeltas,
  createFullBackupPayload,
  loadActiveTab,
  loadPendingCloudSync,
  loadPlaylist,
  loadRandomCount,
  loadRepertoireCifraPrefs,
  loadRepertoireTranspose,
  loadSchedule,
  loadSongs,
  loadTheme,
  saveActiveTab,
  savePendingCloudSync,
  savePlaylist,
  saveRandomCount,
  saveRepertoireCifraPrefs,
  saveRepertoireTranspose,
  saveSchedule,
  saveSongs,
  saveTheme,
} from './utils/storage';

interface ActiveViewerState {
  songId: string;
  source: 'repertoire' | 'playlist';
}

export default function App() {
  const [songs, setSongs] = useState<Song[]>(() => loadSongs());
  const [playlist, setPlaylist] = useState<PlaylistState>(() => loadPlaylist());
  const [schedule, setSchedule] = useState<ScheduleState>(() => loadSchedule());
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [activeTab, setActiveTab] = useState<AppTab>(() => loadActiveTab());
  const [viewer, setViewer] = useState<ActiveViewerState | null>(null);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [repertoireTranspose, setRepertoireTranspose] = useState<
    Record<string, number>
  >(() => loadRepertoireTranspose());
  const [repertoireCifraPrefs, setRepertoireCifraPrefs] = useState<
    Record<string, CifraStylePref>
  >(() => loadRepertoireCifraPrefs());

  const [user, setUser] = useState<User | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasPendingCloudSync, setHasPendingCloudSync] = useState<boolean>(() =>
    loadPendingCloudSync()
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date>(() => new Date());

  const cloudBootstrappedRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const localMutationSeqRef = useRef(0);
  const lastLocalEditAtRef = useRef(0);
  const hasDirtyLocalChangesRef = useRef<boolean>(loadPendingCloudSync());
  const lastUploadedSigRef = useRef<string | null>(null);
  const syncDebounceTimerRef = useRef<number | null>(null);
  const latestStateRef = useRef({
    songs,
    playlist,
    schedule,
    repertoireTranspose,
    repertoireCifraPrefs,
  });

  latestStateRef.current = {
    songs,
    playlist,
    schedule,
    repertoireTranspose,
    repertoireCifraPrefs,
  };

  const buildCurrentSnapshot = useCallback((): CloudWorkspaceSnapshot => {
    const current = latestStateRef.current;
    const deltas = computeSongDeltas(current.songs);
    return {
      playlist: current.playlist,
      repertoireTranspose: current.repertoireTranspose,
      repertoireCifraPrefs: current.repertoireCifraPrefs,
      deletedSongIds: deltas.deletedIds,
      upsertedSongs: deltas.upserted,
      schedule: current.schedule,
      randomCount: loadRandomCount(),
    };
  }, []);

  const applyRemoteSnapshot = useCallback(
    (remote: CloudWorkspaceSnapshot) => {
      // Never overwrite unsynced local edits or active typing
      if (hasDirtyLocalChangesRef.current || loadPendingCloudSync()) {
        return;
      }
      const msSinceLastEdit = Date.now() - lastLocalEditAtRef.current;
      if (msSinceLastEdit < 2500) {
        return;
      }
      const activeEl =
        typeof document !== 'undefined' ? document.activeElement : null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        msSinceLastEdit < 5000
      ) {
        return;
      }

      const remoteSig = computeWorkspaceSignature(remote);
      if (remoteSig === lastUploadedSigRef.current) {
        return;
      }
      const currentSig = computeWorkspaceSignature(buildCurrentSnapshot());
      if (remoteSig === currentSig) {
        return;
      }

      setPlaylist(remote.playlist);
      setRepertoireTranspose(remote.repertoireTranspose);
      setRepertoireCifraPrefs(remote.repertoireCifraPrefs);
      setSchedule(remote.schedule);
      saveRandomCount(remote.randomCount);
      setSongs(
        applySongDeltas({
          upserted: remote.upsertedSongs,
          deletedIds: remote.deletedSongIds,
        })
      );
      setLastSavedAt(new Date());
    },
    [buildCurrentSnapshot]
  );

  // Save songs deltas locally on every change
  useEffect(() => {
    saveSongs(songs);
    setLastSavedAt(new Date());
  }, [songs]);

  // Save playlist locally on every change
  useEffect(() => {
    savePlaylist(playlist);
    setLastSavedAt(new Date());
  }, [playlist]);

  // Save schedule locally on every change
  useEffect(() => {
    saveSchedule(schedule);
    setLastSavedAt(new Date());
  }, [schedule]);

  // Save repertoire transpose map locally on every change
  useEffect(() => {
    saveRepertoireTranspose(repertoireTranspose);
    setLastSavedAt(new Date());
  }, [repertoireTranspose]);

  // Save repertoire cifra style preferences locally
  useEffect(() => {
    saveRepertoireCifraPrefs(repertoireCifraPrefs);
    setLastSavedAt(new Date());
  }, [repertoireCifraPrefs]);

  // Save active navigation tab locally
  useEffect(() => {
    saveActiveTab(activeTab);
  }, [activeTab]);

  // Save theme locally and update document root class
  useEffect(() => {
    saveTheme(theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Optional Firebase Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  const syncWithCloud = useCallback(
    async (preferServerFetch = false) => {
      if (syncInFlightRef.current) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsCloudConnected(false);
        return;
      }

      syncInFlightRef.current = true;
      setIsSyncing(true);
      let shouldFlushAgain = false;

      try {
        const snapshot = buildCurrentSnapshot();
        const seqBefore = localMutationSeqRef.current;

        if (hasDirtyLocalChangesRef.current || loadPendingCloudSync()) {
          lastUploadedSigRef.current = computeWorkspaceSignature(snapshot);
          await updateSharedWorkspace(snapshot);
          if (localMutationSeqRef.current === seqBefore) {
            hasDirtyLocalChangesRef.current = false;
            savePendingCloudSync(false);
            setHasPendingCloudSync(false);
          } else {
            shouldFlushAgain = true;
          }
          setIsCloudConnected(true);
          setLastSavedAt(new Date());
        } else {
          const remoteWorkspace = preferServerFetch
            ? await fetchLatestSharedWorkspace(snapshot)
            : await ensureAndSyncSharedWorkspace(snapshot);

          if (
            remoteWorkspace &&
            localMutationSeqRef.current === seqBefore &&
            !hasDirtyLocalChangesRef.current &&
            !loadPendingCloudSync()
          ) {
            applyRemoteSnapshot(remoteWorkspace);
          }
          setIsCloudConnected(true);
        }
      } catch (err) {
        console.warn('Sincronização em espera (tentará novamente ao ligar):', err);
        setIsCloudConnected(false);
      } finally {
        cloudBootstrappedRef.current = true;
        syncInFlightRef.current = false;
        setIsSyncing(false);
        if (shouldFlushAgain && !syncDebounceTimerRef.current) {
          syncDebounceTimerRef.current = window.setTimeout(() => {
            syncDebounceTimerRef.current = null;
            void syncWithCloud(false);
          }, 450);
        }
      }
    },
    [applyRemoteSnapshot, buildCurrentSnapshot]
  );

  const markLocalMutation = useCallback(() => {
    localMutationSeqRef.current += 1;
    lastLocalEditAtRef.current = Date.now();
    hasDirtyLocalChangesRef.current = true;
    savePendingCloudSync(true);
    setHasPendingCloudSync(true);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsCloudConnected(false);
      return;
    }

    if (syncDebounceTimerRef.current !== null) {
      window.clearTimeout(syncDebounceTimerRef.current);
    }
    syncDebounceTimerRef.current = window.setTimeout(() => {
      syncDebounceTimerRef.current = null;
      if (!cloudBootstrappedRef.current) return;
      void syncWithCloud(false);
    }, 900);
  }, [syncWithCloud]);

  // Automatically connect ALL visitors/devices (web and installed PWA) to the shared church workspace
  useEffect(() => {
    let isCancelled = false;

    const unsubWorkspace = subscribeToSharedWorkspace(
      buildCurrentSnapshot(),
      (cloudState, _updatedAtMs, meta) => {
        if (isCancelled) return;
        if (!meta.fromCache) {
          setIsCloudConnected(true);
        }
        applyRemoteSnapshot(cloudState);
      },
      (meta) => {
        if (isCancelled) return;
        if (!meta.fromCache && !meta.hasPendingWrites) {
          setIsCloudConnected(true);
        }
      },
      () => {
        if (isCancelled) return;
        setIsCloudConnected(false);
      }
    );

    void syncWithCloud(false);

    const handleOnline = () => {
      void syncWithCloud(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (hasDirtyLocalChangesRef.current || loadPendingCloudSync()) {
          if (syncDebounceTimerRef.current !== null) {
            window.clearTimeout(syncDebounceTimerRef.current);
            syncDebounceTimerRef.current = null;
          }
          void syncWithCloud(false);
        }
      } else if (document.visibilityState === 'visible') {
        if (hasDirtyLocalChangesRef.current || loadPendingCloudSync()) {
          void syncWithCloud(false);
        } else {
          void syncWithCloud(true);
        }
      }
    };

    const handlePageHide = () => {
      if (hasDirtyLocalChangesRef.current || loadPendingCloudSync()) {
        if (syncDebounceTimerRef.current !== null) {
          window.clearTimeout(syncDebounceTimerRef.current);
          syncDebounceTimerRef.current = null;
        }
        void syncWithCloud(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isCancelled = true;
      unsubWorkspace();
      if (syncDebounceTimerRef.current !== null) {
        window.clearTimeout(syncDebounceTimerRef.current);
        syncDebounceTimerRef.current = null;
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyRemoteSnapshot, buildCurrentSnapshot, syncWithCloud]);

  // Periodic retry while there are pending local edits waiting to reach the cloud
  useEffect(() => {
    if (!hasPendingCloudSync) return;
    const interval = window.setInterval(() => {
      if (
        (typeof navigator === 'undefined' || navigator.onLine) &&
        Date.now() - lastLocalEditAtRef.current >= 900
      ) {
        void syncWithCloud(false);
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [hasPendingCloudSync, syncWithCloud]);

  const playlistSongIds = useMemo(
    () =>
      new Set(
        playlist.items
          .filter((item): item is PlaylistSongItem => !isPlaylistMoment(item))
          .map((item) => item.songId)
      ),
    [playlist.items]
  );

  const songsById = useMemo(
    () => new Map(songs.map((s) => [s.id, s])),
    [songs]
  );

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleTogglePlaylistSong = (songId: string) => {
    markLocalMutation();
    setPlaylist((prev) => {
      const exists = prev.items.some(
        (item) => !isPlaylistMoment(item) && item.songId === songId
      );
      if (exists) {
        return {
          ...prev,
          items: prev.items.filter(
            (item) => isPlaylistMoment(item) || item.songId !== songId
          ),
        };
      }
      const pref = repertoireCifraPrefs[songId];
      const newSongItem: PlaylistSongItem = {
        kind: 'song',
        songId,
        transposeOffset: repertoireTranspose[songId] ?? 0,
        ...(pref?.style ? { cifraStyle: pref.style } : {}),
        ...(pref?.style === 'capo' && pref.capoFret !== undefined
          ? { capoFret: pref.capoFret }
          : {}),
      };
      return {
        ...prev,
        items: [...prev.items, newSongItem],
      };
    });
  };

  const handleGenerateRandomSetlist = (count: number) => {
    markLocalMutation();
    const selected = generateBalancedSetlist(songs, count);
    setPlaylist((prev) => ({
      ...prev,
      items: selected.map((song) => ({
        kind: 'song',
        songId: song.id,
        transposeOffset: 0,
      })),
    }));
  };

  const handleMovePlaylistItem = (index: number, direction: 'up' | 'down') => {
    markLocalMutation();
    setPlaylist((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.items.length) return prev;
      const nextItems = [...prev.items];
      const [moved] = nextItems.splice(index, 1);
      nextItems.splice(targetIndex, 0, moved);
      return { ...prev, items: nextItems };
    });
  };

  const handleRemovePlaylistItemAt = (index: number) => {
    markLocalMutation();
    setPlaylist((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleInsertPlaylistMoment = (
    atIndex: number,
    initialTitle = '',
    initialNote = ''
  ): string => {
    markLocalMutation();
    const momentId = `moment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setPlaylist((prev) => {
      const clampedIndex = Math.max(0, Math.min(prev.items.length, atIndex));
      const nextItems = [...prev.items];
      nextItems.splice(clampedIndex, 0, {
        kind: 'moment',
        id: momentId,
        title: initialTitle,
        note: initialNote,
      });
      return { ...prev, items: nextItems };
    });
    return momentId;
  };

  const handleUpdatePlaylistMoment = (
    momentId: string,
    patch: { title?: string; note?: string }
  ) => {
    markLocalMutation();
    setPlaylist((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        isPlaylistMoment(item) && item.id === momentId
          ? { ...item, ...patch }
          : item
      ),
    }));
  };

  const handleUpdatePlaylistSongCifra = (
    originalIndex: number,
    cifraStyle: CifraStyle,
    capoFret?: number
  ) => {
    markLocalMutation();
    setPlaylist((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => {
        if (idx !== originalIndex || isPlaylistMoment(item)) return item;
        return {
          ...item,
          cifraStyle,
          capoFret: cifraStyle === 'capo' ? capoFret : undefined,
        };
      }),
    }));
  };

  const handleClearPlaylist = () => {
    markLocalMutation();
    setPlaylist((prev) => ({ ...prev, items: [] }));
  };

  const handleSaveSong = (
    data: Omit<Song, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    markLocalMutation();
    if (existingId) {
      setSongs((prev) =>
        prev.map((s) => (s.id === existingId ? { ...s, ...data } : s))
      );
      setEditingSong(null);
      if (viewer && viewer.songId === existingId) {
        return;
      }
      setActiveTab('repertoire');
    } else {
      const newSong: Song = {
        ...data,
        id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
      };
      setSongs((prev) => [newSong, ...prev]);
      setEditingSong(null);
      setActiveTab('repertoire');
    }
  };

  const handleDeleteSong = (songId: string) => {
    markLocalMutation();
    setSongs((prev) => prev.filter((s) => s.id !== songId));
    setPlaylist((prev) => ({
      ...prev,
      items: prev.items.filter(
        (item) => isPlaylistMoment(item) || item.songId !== songId
      ),
    }));
    setEditingSong(null);
    if (viewer?.songId === songId) {
      setViewer(null);
    }
    setActiveTab('repertoire');
  };

  const handleStartEdit = (song: Song) => {
    setViewer(null);
    setEditingSong(song);
    setActiveTab('add');
  };

  const handleSelectTab = (tab: AppTab) => {
    if (tab !== 'add') {
      setEditingSong(null);
    }
    setViewer(null);
    setActiveTab(tab);
  };

  const handleUseScheduleEntryInCulto = (entry: ScheduleEntry) => {
    markLocalMutation();
    const parts = [`Culto ${entry.day ? `${entry.day} de ` : ''}${entry.month}`];
    if (entry.theme.trim()) {
      parts.push(entry.theme.trim());
    }
    const leader = (entry.assignments['ordem'] ?? '').trim();
    if (leader) {
      parts.push(`Ordem: ${leader}`);
    }
    setPlaylist((prev) => ({
      ...prev,
      title: parts.join(' — '),
    }));
    setActiveTab('playlist');
  };

  const handleUpdateSchedule = (
    updater: (prev: ScheduleState) => ScheduleState
  ) => {
    markLocalMutation();
    setSchedule(updater);
  };

  const handleExportBackup = () => {
    const payload = createFullBackupPayload({
      songs,
      playlist,
      schedule,
      repertoireTranspose,
      repertoireCifraPrefs,
      theme,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `louvor-ieb-horta-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<FullAppBackup>;
      if (!parsed || typeof parsed !== 'object') return false;

      markLocalMutation();
      if (parsed.songDeltas && typeof parsed.songDeltas === 'object') {
        const restoredSongs = applySongDeltas(parsed.songDeltas);
        setSongs(restoredSongs);
      }
      if (parsed.playlist && Array.isArray(parsed.playlist.items)) {
        setPlaylist(parsed.playlist);
      }
      if (parsed.schedule && Array.isArray(parsed.schedule.entries)) {
        setSchedule(parsed.schedule);
      }
      if (
        parsed.repertoireTranspose &&
        typeof parsed.repertoireTranspose === 'object'
      ) {
        setRepertoireTranspose(parsed.repertoireTranspose);
      }
      if (
        parsed.repertoireCifraPrefs &&
        typeof parsed.repertoireCifraPrefs === 'object'
      ) {
        setRepertoireCifraPrefs(parsed.repertoireCifraPrefs);
      }
      if (typeof parsed.randomCount === 'number') {
        saveRandomCount(parsed.randomCount);
      }
      if (parsed.theme === 'dark' || parsed.theme === 'light') {
        setTheme(parsed.theme);
      }
      return true;
    } catch {
      return false;
    }
  };

  const lastSavedText = useMemo(() => {
    const hh = String(lastSavedAt.getHours()).padStart(2, '0');
    const mm = String(lastSavedAt.getMinutes()).padStart(2, '0');
    const ss = String(lastSavedAt.getSeconds()).padStart(2, '0');
    return `guardado às ${hh}:${mm}:${ss}`;
  }, [lastSavedAt]);

  // Viewer Mode
  if (viewer) {
    const activeSong = songsById.get(viewer.songId);
    if (activeSong) {
      const playlistItems = playlist.items.filter(
        (i): i is PlaylistSongItem =>
          !isPlaylistMoment(i) && songsById.has(i.songId)
      );
      const playlistIdx =
        viewer.source === 'playlist'
          ? playlistItems.findIndex((i) => i.songId === activeSong.id)
          : -1;

      const currentOffset =
        viewer.source === 'playlist' && playlistIdx >= 0
          ? playlistItems[playlistIdx].transposeOffset
          : repertoireTranspose[activeSong.id] ?? 0;

      const currentCifraStyle: CifraStyle =
        viewer.source === 'playlist' && playlistIdx >= 0
          ? playlistItems[playlistIdx].cifraStyle ?? 'original'
          : repertoireCifraPrefs[activeSong.id]?.style ?? 'original';

      const currentCapoFret: number | undefined =
        viewer.source === 'playlist' && playlistIdx >= 0
          ? playlistItems[playlistIdx].capoFret
          : repertoireCifraPrefs[activeSong.id]?.capoFret;

      const handleChangeTranspose = (delta: number) => {
        markLocalMutation();
        const nextOffset = currentOffset + delta;
        if (viewer.source === 'playlist' && playlistIdx >= 0) {
          setPlaylist((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              !isPlaylistMoment(item) && item.songId === activeSong.id
                ? { ...item, transposeOffset: nextOffset }
                : item
            ),
          }));
        } else {
          setRepertoireTranspose((prev) => ({
            ...prev,
            [activeSong.id]: nextOffset,
          }));
        }
      };

      const handleResetTranspose = () => {
        markLocalMutation();
        if (viewer.source === 'playlist' && playlistIdx >= 0) {
          setPlaylist((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              !isPlaylistMoment(item) && item.songId === activeSong.id
                ? { ...item, transposeOffset: 0 }
                : item
            ),
          }));
        } else {
          setRepertoireTranspose((prev) => ({
            ...prev,
            [activeSong.id]: 0,
          }));
        }
      };

      const handleChangeCifraStyle = (nextStyle: CifraStyle, recommendedFret?: number) => {
        markLocalMutation();
        const resolvedFret =
          nextStyle === 'capo'
            ? recommendedFret ??
              currentCapoFret ??
              getEffectiveCifraParams(activeSong, currentOffset, 'capo').capoFret
            : undefined;

        if (viewer.source === 'playlist' && playlistIdx >= 0) {
          setPlaylist((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              !isPlaylistMoment(item) && item.songId === activeSong.id
                ? {
                    ...item,
                    cifraStyle: nextStyle,
                    capoFret: resolvedFret,
                  }
                : item
            ),
          }));
        } else {
          setRepertoireCifraPrefs((prev) => ({
            ...prev,
            [activeSong.id]: {
              style: nextStyle,
              ...(resolvedFret !== undefined ? { capoFret: resolvedFret } : {}),
            },
          }));
        }
      };

      const handleChangeCapoFret = (nextFret: number) => {
        markLocalMutation();
        const clamped = Math.max(1, Math.min(9, Math.round(nextFret)));
        if (viewer.source === 'playlist' && playlistIdx >= 0) {
          setPlaylist((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              !isPlaylistMoment(item) && item.songId === activeSong.id
                ? { ...item, cifraStyle: 'capo', capoFret: clamped }
                : item
            ),
          }));
        } else {
          setRepertoireCifraPrefs((prev) => ({
            ...prev,
            [activeSong.id]: { style: 'capo', capoFret: clamped },
          }));
        }
      };

      const prevItem = playlistIdx > 0 ? playlistItems[playlistIdx - 1] : undefined;
      const nextItem =
        playlistIdx >= 0 && playlistIdx < playlistItems.length - 1
          ? playlistItems[playlistIdx + 1]
          : undefined;

      return (
        <ChordViewer
          song={activeSong}
          transposeOffset={currentOffset}
          cifraStyle={currentCifraStyle}
          capoFret={currentCapoFret}
          onChangeCifraStyle={handleChangeCifraStyle}
          onChangeCapoFret={handleChangeCapoFret}
          onChangeTranspose={handleChangeTranspose}
          onResetTranspose={handleResetTranspose}
          theme={theme}
          onToggleTheme={toggleTheme}
          onBack={() => setViewer(null)}
          onEdit={handleStartEdit}
          onUpdateYoutubeUrl={(nextUrl) => {
            markLocalMutation();
            setSongs((prev) =>
              prev.map((s) =>
                s.id === activeSong.id
                  ? { ...s, youtubeUrl: nextUrl.trim() || undefined }
                  : s
              )
            );
          }}
          playlistContext={
            viewer.source === 'playlist' && playlistIdx >= 0
              ? {
                  currentIndex: playlistIdx,
                  total: playlistItems.length,
                  prevTitle: prevItem ? songsById.get(prevItem.songId)?.title : undefined,
                  nextTitle: nextItem ? songsById.get(nextItem.songId)?.title : undefined,
                  onPrev: prevItem
                    ? () =>
                        setViewer({
                          songId: prevItem.songId,
                          source: 'playlist',
                        })
                    : undefined,
                  onNext: nextItem
                    ? () =>
                        setViewer({
                          songId: nextItem.songId,
                          source: 'playlist',
                        })
                    : undefined,
                }
              : undefined
          }
        />
      );
    }
  }

  const validPlaylistCount = playlist.items.filter(
    (i) => !isPlaylistMoment(i) && songsById.has(i.songId)
  ).length;

  return (
    <div className="min-h-screen bg-[#F4F8FC] dark:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC] transition-colors duration-150">
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        playlistCount={validPlaylistCount}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        isCloudConnected={isCloudConnected}
        isSyncing={isSyncing}
        hasPendingSync={hasPendingCloudSync}
        lastSavedText={lastSavedText}
        onForceSync={async () => {
          await syncWithCloud(true);
        }}
        onSignIn={async () => {
          await signInWithGoogle();
        }}
        onSignOut={async () => {
          await signOutGoogle();
        }}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />

      <main>
        {activeTab === 'repertoire' && (
          <RepertoireView
            songs={songs}
            playlistSongIds={playlistSongIds}
            onOpenSong={(songId) =>
              setViewer({ songId, source: 'repertoire' })
            }
            onTogglePlaylist={handleTogglePlaylistSong}
            onEditSong={handleStartEdit}
            onGoToAdd={() => {
              setEditingSong(null);
              setActiveTab('add');
            }}
          />
        )}

        {activeTab === 'playlist' && (
          <PlaylistView
            playlist={playlist}
            songs={songs}
            onUpdateTitle={(title) => {
              markLocalMutation();
              setPlaylist((prev) => ({ ...prev, title }));
            }}
            onGenerateRandom={handleGenerateRandomSetlist}
            onMoveItem={handleMovePlaylistItem}
            onRemoveItemAt={handleRemovePlaylistItemAt}
            onInsertMoment={handleInsertPlaylistMoment}
            onUpdateMoment={handleUpdatePlaylistMoment}
            onUpdateSongCifra={handleUpdatePlaylistSongCifra}
            onClearPlaylist={handleClearPlaylist}
            onOpenSongFromPlaylist={(songId) =>
              setViewer({ songId, source: 'playlist' })
            }
            onGoToRepertoire={() => setActiveTab('repertoire')}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleView
            schedule={schedule}
            onUpdateSchedule={handleUpdateSchedule}
            onUseInCultoDoDia={handleUseScheduleEntryInCulto}
          />
        )}

        {activeTab === 'add' && (
          <SongFormView
            key={editingSong?.id ?? 'new-song'}
            editingSong={editingSong}
            onSaveSong={handleSaveSong}
            onDeleteSong={handleDeleteSong}
            onCancel={() => {
              setEditingSong(null);
              setActiveTab('repertoire');
            }}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        playlistCount={validPlaylistCount}
      />

      <OfflineIndicator hasPendingSync={hasPendingCloudSync} />
    </div>
  );
}
