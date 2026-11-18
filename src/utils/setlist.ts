import { PlaylistItem, PlaylistMomentItem, Song } from '../types/music';
import { getEffectiveCifraParams } from './chords';

export function isPlaylistMoment(
  item: PlaylistItem
): item is PlaylistMomentItem {
  return item.kind === 'moment';
}

function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Gera uma playlist equilibrada para o culto com base nas 3 categorias do repertório
 * (Normal, Crianças e Hinos):
 * - Combina músicas de andamento mais rápido (BPM >= 105) e adoração/hinos (BPM < 105 ou Hinos).
 * - Inclui ao menos 1 hino quando houver hinos disponíveis e o setlist pedir 3+ faixas.
 * - Ordena naturalmente para o fluxo do culto (ritmo mais rápido primeiro, depois adoração/hinos).
 * - Evita repetições.
 */
export function generateBalancedSetlist(
  songs: Song[],
  count: number,
  rng: () => number = Math.random
): Song[] {
  if (songs.length === 0 || count <= 0) return [];

  const targetCount = Math.min(count, songs.length);

  const upbeatPool = shuffleArray(
    songs.filter((s) => s.bpm !== undefined && s.bpm >= 105),
    rng
  );
  const hymnPool = shuffleArray(
    songs.filter((s) => s.category === 'Hinos' && (s.bpm === undefined || s.bpm < 105)),
    rng
  );
  const worshipPool = shuffleArray(
    songs.filter(
      (s) =>
        s.category !== 'Hinos' &&
        (s.bpm === undefined || s.bpm < 105)
    ),
    rng
  );

  // Target split: for 3 -> 1 upbeat + 2 worship/hymn, for 4 -> 2+2, for 5 -> 2+3
  const desiredUpbeat = Math.floor(targetCount / 2);

  const picked: Song[] = [];
  const pickedIds = new Set<string>();

  for (const song of upbeatPool) {
    if (picked.length >= desiredUpbeat) break;
    picked.push(song);
    pickedIds.add(song.id);
  }

  // Reserve 1 hymn slot when hymns exist and targetCount >= 3 (or if worshipPool is empty)
  if (targetCount >= 3 && hymnPool.length > 0 && picked.length < targetCount) {
    for (const song of hymnPool) {
      if (!pickedIds.has(song.id)) {
        picked.push(song);
        pickedIds.add(song.id);
        break;
      }
    }
  }

  // Fill remaining worship/hymn slots interleaving worship songs and hymns
  const mixedReflective = shuffleArray([...worshipPool, ...hymnPool], rng);
  for (const song of mixedReflective) {
    if (picked.length >= targetCount) break;
    if (!pickedIds.has(song.id)) {
      picked.push(song);
      pickedIds.add(song.id);
    }
  }

  // Fill any remaining slots if pools had fewer songs than requested
  if (picked.length < targetCount) {
    const remaining = shuffleArray(
      songs.filter((s) => !pickedIds.has(s.id)),
      rng
    );
    for (const song of remaining) {
      if (picked.length >= targetCount) break;
      picked.push(song);
      pickedIds.add(song.id);
    }
  }

  const paceRank = (song: Song): number => {
    if (song.bpm !== undefined && song.bpm >= 105) return 0;
    if (song.category === 'Hinos') return 2;
    return 1;
  };

  return picked.sort((a, b) => {
    const rankDiff = paceRank(a) - paceRank(b);
    if (rankDiff !== 0) return rankDiff;
    // Faster tempo first when items share the same rank
    return (b.bpm ?? 0) - (a.bpm ?? 0);
  });
}

export function formatWhatsAppSetlist(
  playlistTitle: string,
  items: PlaylistItem[],
  songsById: Map<string, Song>
): string {
  const headerTitle = playlistTitle.trim() || 'Culto - Louvor IEB Horta';
  const lines: string[] = [
    `*Louvor IEB Horta*`,
    `*${headerTitle}*`,
    '',
  ];

  let index = 1;
  let hasContent = false;
  for (const item of items) {
    if (isPlaylistMoment(item)) {
      const label = item.title.trim() || 'Intervalo / Momento';
      const detail = (item.note ?? '').trim().replace(/\r?\n+/g, ' · ');
      lines.push(
        detail ? `— *${label}* (${detail}) —` : `— *${label}* —`
      );
      hasContent = true;
      continue;
    }

    const song = songsById.get(item.songId);
    if (!song) continue;
    const params = getEffectiveCifraParams(
      song,
      item.transposeOffset,
      item.cifraStyle,
      item.capoFret
    );
    const keyLabel =
      params.soundingKey === '—' ? 'Letra' : `Tom: *${params.soundingKey}*`;
    const styleSuffix =
      params.style === 'simplified'
        ? ' · _Simplificada_'
        : params.style === 'capo'
          ? ` · _Capo ${params.capoFret}ª casa (formas em ${params.fingeredKey})_`
          : '';
    lines.push(`${index}. *${song.title}* (${song.artist}) — ${keyLabel}${styleSuffix}`);
    index++;
    hasContent = true;
  }

  if (!hasContent) {
    lines.push('Nenhuma música selecionada ainda.');
  }

  return lines.join('\n');
}

export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
