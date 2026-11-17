import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { ChordViewer } from './components/ChordViewer';
import { Header } from './components/Header';
import { PlaylistView } from './components/PlaylistView';
import { RepertoireView } from './components/RepertoireView';
import { ScheduleView } from './components/ScheduleView';
import { SongFormView } from './components/SongFormView';
import {
  User,
  auth,
  deleteSharedCustomSong,
  ensureAndSyncSharedWorkspace,
  onAuthStateChanged,
  saveSharedCustomSong,
  signInWithGoogle,
  signOutGoogle,
  subscribeToSharedSongs,
  subscribeToSharedWorkspace,
  updateSharedWorkspace,
} from './firebase';
import {
  AppTab,
  PlaylistState,
  ScheduleEntry,
  ScheduleState,
  Song,
  ThemeMode,
} from './types/music';
import { generateBalancedSetlist } from './utils/setlist';
import {
  FullAppBackup,
  applySongDeltas,
  computeSongDeltas,
  createFullBackupPayload,
  loadActiveTab,
  loadPlaylist,
  loadRandomCount,
  loadRepertoireTranspose,
  loadSchedule,
  loadSongs,
  loadTheme,
  saveActiveTab,
  savePlaylist,
  saveRandomCount,
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

  const [user, setUser] = useState<User | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date>(() => new Date());

  const isApplyingRemoteUpdateRef = useRef(false);
  const cloudBootstrappedRef = useRef(false);

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

  // Automatically connect ALL visitors/devices to the shared church workspace on boot
  useEffect(() => {
    let isCancelled = false;
    let unsubWorkspace: (() => void) | undefined;
    let unsubSongs: (() => void) | undefined;

    const currentDeltas = computeSongDeltas(songs);
    const initialSnapshot = {
      playlist,
      repertoireTranspose,
      deletedSongIds: currentDeltas.deletedIds,
      schedule,
      randomCount: loadRandomCount(),
    };

    const bootstrapSharedCloud = async () => {
      setIsSyncing(true);
      try {
        const remoteWorkspace =
          await ensureAndSyncSharedWorkspace(initialSnapshot);

        if (isCancelled) return;

        if (remoteWorkspace) {
          isApplyingRemoteUpdateRef.current = true;
          setPlaylist(remoteWorkspace.playlist);
          setRepertoireTranspose(remoteWorkspace.repertoireTranspose);
          setSchedule(remoteWorkspace.schedule);
          saveRandomCount(remoteWorkspace.randomCount);
          const mergedDeltas = {
            upserted: computeSongDeltas(songs).upserted,
            deletedIds: remoteWorkspace.deletedSongIds,
          };
          setSongs(applySongDeltas(mergedDeltas));
          setTimeout(() => {
            isApplyingRemoteUpdateRef.current = false;
          }, 120);
        }

        // Upload any local custom/edited songs to the shared subcollection
        const upsertedList = Object.values(currentDeltas.upserted);
        for (const customSong of upsertedList) {
          await saveSharedCustomSong(customSong);
        }

        cloudBootstrappedRef.current = true;
        setIsCloudConnected(true);

        unsubWorkspace = subscribeToSharedWorkspace(
          initialSnapshot,
          (cloudState) => {
            isApplyingRemoteUpdateRef.current = true;
            setPlaylist(cloudState.playlist);
            setRepertoireTranspose(cloudState.repertoireTranspose);
            setSchedule(cloudState.schedule);
            saveRandomCount(cloudState.randomCount);
            setSongs((prevSongs) => {
              const latestDeltas = computeSongDeltas(prevSongs);
              return applySongDeltas({
                upserted: latestDeltas.upserted,
                deletedIds: cloudState.deletedSongIds,
              });
            });
            setLastSavedAt(new Date());
            setTimeout(() => {
              isApplyingRemoteUpdateRef.current = false;
            }, 120);
          }
        );

        unsubSongs = subscribeToSharedSongs((remoteUpserted) => {
          isApplyingRemoteUpdateRef.current = true;
          setSongs((prevSongs) => {
            const latestDeltas = computeSongDeltas(prevSongs);
            return applySongDeltas({
              upserted: {
                ...latestDeltas.upserted,
                ...remoteUpserted,
              },
              deletedIds: latestDeltas.deletedIds,
            });
          });
          setLastSavedAt(new Date());
          setTimeout(() => {
            isApplyingRemoteUpdateRef.current = false;
          }, 120);
        });
      } finally {
        if (!isCancelled) {
          setIsSyncing(false);
        }
      }
    };

    void bootstrapSharedCloud();

    return () => {
      isCancelled = true;
      if (unsubWorkspace) unsubWorkspace();
      if (unsubSongs) unsubSongs();
    };
  }, []);

  // Debounced sync of shared workspace state changes to Firestore whenever anyone edits
  useEffect(() => {
    if (!cloudBootstrappedRef.current) return;
    if (isApplyingRemoteUpdateRef.current) return;

    const timer = window.setTimeout(() => {
      const deltas = computeSongDeltas(songs);
      setIsSyncing(true);
      void updateSharedWorkspace({
        playlist,
        repertoireTranspose,
        deletedSongIds: deltas.deletedIds,
        schedule,
        randomCount: loadRandomCount(),
      }).finally(() => {
        setIsSyncing(false);
        setLastSavedAt(new Date());
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [playlist, repertoireTranspose, schedule, songs]);

  const playlistSongIds = useMemo(
    () => new Set(playlist.items.map((item) => item.songId)),
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
    setPlaylist((prev) => {
      const exists = prev.items.some((item) => item.songId === songId);
      if (exists) {
        return {
          ...prev,
          items: prev.items.filter((item) => item.songId !== songId),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          { songId, transposeOffset: repertoireTranspose[songId] ?? 0 },
        ],
      };
    });
  };

  const handleGenerateRandomSetlist = (count: number) => {
    const selected = generateBalancedSetlist(songs, count);
    setPlaylist((prev) => ({
      ...prev,
      items: selected.map((song) => ({
        songId: song.id,
        transposeOffset: 0,
      })),
    }));
  };

  const handleMovePlaylistItem = (index: number, direction: 'up' | 'down') => {
    setPlaylist((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.items.length) return prev;
      const nextItems = [...prev.items];
      const [moved] = nextItems.splice(index, 1);
      nextItems.splice(targetIndex, 0, moved);
      return { ...prev, items: nextItems };
    });
  };

  const handleRemovePlaylistItem = (songId: string) => {
    setPlaylist((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.songId !== songId),
    }));
  };

  const handleClearPlaylist = () => {
    setPlaylist((prev) => ({ ...prev, items: [] }));
  };

  const handleSaveSong = (
    data: Omit<Song, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      let updatedSongObj: Song | null = null;
      setSongs((prev) =>
        prev.map((s) => {
          if (s.id === existingId) {
            updatedSongObj = { ...s, ...data };
            return updatedSongObj;
          }
          return s;
        })
      );
      if (updatedSongObj) {
        void saveSharedCustomSong(updatedSongObj);
      }
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
      void saveSharedCustomSong(newSong);
      setEditingSong(null);
      setActiveTab('repertoire');
    }
  };

  const handleDeleteSong = (songId: string) => {
    setSongs((prev) => prev.filter((s) => s.id !== songId));
    setPlaylist((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.songId !== songId),
    }));
    void deleteSharedCustomSong(songId);
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

  const handleExportBackup = () => {
    const payload = createFullBackupPayload({
      songs,
      playlist,
      schedule,
      repertoireTranspose,
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

      if (parsed.songDeltas && typeof parsed.songDeltas === 'object') {
        const restoredSongs = applySongDeltas(parsed.songDeltas);
        setSongs(restoredSongs);
        for (const custom of Object.values(parsed.songDeltas.upserted || {})) {
          await saveSharedCustomSong(custom);
        }
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
    return `salvo às ${hh}:${mm}:${ss}`;
  }, [lastSavedAt]);

  // Viewer Mode
  if (viewer) {
    const activeSong = songsById.get(viewer.songId);
    if (activeSong) {
      const playlistItems = playlist.items.filter((i) => songsById.has(i.songId));
      const playlistIdx =
        viewer.source === 'playlist'
          ? playlistItems.findIndex((i) => i.songId === activeSong.id)
          : -1;

      const currentOffset =
        viewer.source === 'playlist' && playlistIdx >= 0
          ? playlistItems[playlistIdx].transposeOffset
          : repertoireTranspose[activeSong.id] ?? 0;

      const handleChangeTranspose = (delta: number) => {
        const nextOffset = currentOffset + delta;
        if (viewer.source === 'playlist' && playlistIdx >= 0) {
          setPlaylist((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              item.songId === activeSong.id
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
        if (viewer.source === 'playlist' && playlistIdx >= 0) {
          setPlaylist((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
              item.songId === activeSong.id ? { ...item, transposeOffset: 0 } : item
            ),
          }));
        } else {
          setRepertoireTranspose((prev) => ({
            ...prev,
            [activeSong.id]: 0,
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
          onChangeTranspose={handleChangeTranspose}
          onResetTranspose={handleResetTranspose}
          theme={theme}
          onToggleTheme={toggleTheme}
          onBack={() => setViewer(null)}
          onEdit={handleStartEdit}
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

  const validPlaylistCount = playlist.items.filter((i) =>
    songsById.has(i.songId)
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-50 transition-colors duration-150">
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        playlistCount={validPlaylistCount}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        isCloudConnected={isCloudConnected}
        isSyncing={isSyncing}
        lastSavedText={lastSavedText}
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
            onUpdateTitle={(title) =>
              setPlaylist((prev) => ({ ...prev, title }))
            }
            onGenerateRandom={handleGenerateRandomSetlist}
            onMoveItem={handleMovePlaylistItem}
            onRemoveItem={handleRemovePlaylistItem}
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
            onUpdateSchedule={setSchedule}
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
    </div>
  );
}
