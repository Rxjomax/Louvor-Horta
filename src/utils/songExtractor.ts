export interface CifraSearchCandidate {
  title: string;
  artist: string;
  artistSlug: string;
  songSlug: string;
  cifraClubUrl: string;
}

export interface ExtractedSongData {
  title: string;
  artist: string;
  originalKey: string;
  concertKey?: string;
  capoCasa?: number;
  bpm?: number;
  youtubeUrl?: string;
  sourceUrl: string;
  cifra: string;
  candidates: CifraSearchCandidate[];
}

const VALID_KEYS = new Set([
  'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
  'Am', 'Bbm', 'Bm', 'Cm', 'C#m', 'Dm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m',
]);

function normalizeKeySymbol(raw: string): string {
  const cleaned = raw.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  if (VALID_KEYS.has(cleaned)) return cleaned;
  const enharmonicMap: Record<string, string> = {
    'D#': 'Eb',
    'G#': 'Ab',
    'A#': 'Bb',
    'D#m': 'Em',
    'A#m': 'Bbm',
    'Ebm': 'Dm',
    'Abm': 'G#m',
    'Dbm': 'C#m',
  };
  return enharmonicMap[cleaned] ?? 'C';
}

/**
 * Cleans a raw YouTube video title into a clean song + artist search query.
 */
export function cleanYoutubeTitleForSearch(
  rawTitle: string,
  authorName?: string
): string {
  let cleaned = (rawTitle || '')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(
      /\b(?:clipe\s+oficial|v[íi]deo\s+oficial|official\s+music\s+video|official\s+video|lyric\s+video|com\s+letra|em\s+portugu[êe]s|ao\s+vivo|live\s+session|dvd|hd|4k|letra\s+e\s+m[úu]sica|legendado|playback|karaoke|cifra\s+simplificada|áudio\s+oficial|audio\s+oficial)\b/gi,
      ' '
    )
    .replace(/[|•—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    authorName &&
    !/vevo|topic|oficial|letra|louvor|gospel|music|records|adoração|hinos|canal/i.test(
      authorName
    )
  ) {
    const cleanAuthor = authorName.replace(/\s*-\s*Topic$/i, '').trim();
    if (
      cleanAuthor &&
      !cleaned.toLowerCase().includes(cleanAuthor.toLowerCase())
    ) {
      cleaned = `${cleaned} ${cleanAuthor}`.trim();
    }
  }

  return cleaned;
}

/**
 * Fetches YouTube video title and channel name via noembed.com (CORS-friendly).
 */
export async function fetchYouTubeMetadata(
  youtubeUrl: string
): Promise<{ title: string; authorName: string } | null> {
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(youtubeUrl.trim())}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
    };
    if (!data.title) return null;
    return {
      title: data.title,
      authorName: data.author_name ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * Searches Cifra Club's public Solr index (CORS-enabled) for matching songs.
 */
export async function searchCifraClubCandidates(
  query: string
): Promise<CifraSearchCandidate[]> {
  const cleaned = query.trim();
  if (!cleaned) return [];

  try {
    const res = await fetch(
      `https://solr.sscdn.co/cc/h2/?q=${encodeURIComponent(cleaned)}`
    );
    if (!res.ok) return [];
    const text = await res.text();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) return [];

    const json = JSON.parse(text.slice(firstBrace, lastBrace + 1)) as {
      response?: {
        docs?: Array<{
          m?: string;
          a?: string;
          d?: string;
          u?: string;
          t?: string;
        }>;
      };
    };

    const docs = json.response?.docs ?? [];
    const results: CifraSearchCandidate[] = [];
    const seen = new Set<string>();

    for (const doc of docs) {
      if (!doc.m || !doc.a || !doc.d || !doc.u) continue;
      const slugKey = `${doc.d}/${doc.u}`;
      if (seen.has(slugKey)) continue;
      seen.add(slugKey);
      results.push({
        title: doc.m.trim(),
        artist: doc.a.trim(),
        artistSlug: doc.d.trim(),
        songSlug: doc.u.trim(),
        cifraClubUrl: `https://www.cifraclub.com.br/${doc.d.trim()}/${doc.u.trim()}/`,
      });
      if (results.length >= 6) break;
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Parses the plain-text print output of a Cifra Club page into clean metadata and
 * aligned chord-over-lyric text, stripping out strumming instructions, ASCII guitar
 * tablatures, and bottom chord diagram footers.
 */
export function parseCifraClubPrintText(
  rawText: string,
  fallbackTitle = '',
  fallbackArtist = ''
): {
  title: string;
  artist: string;
  originalKey: string;
  concertKey?: string;
  capoCasa?: number;
  bpm?: number;
  cifra: string;
} {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  let title = fallbackTitle;
  let artist = fallbackArtist;
  let originalKey = 'C';
  let concertKey: string | undefined;
  let capoCasa: number | undefined;
  let bpm: number | undefined;

  for (let i = 0; i < Math.min(lines.length, 35); i++) {
    const l = lines[i].trim();

    // e.g. "Tom: D (com forma de C)" or "Tom: Am"
    const tomWithShape = l.match(
      /^Tom:\s*([A-G][#b]?m?)\s*\((?:com\s+)?forma\s+(?:dos\s+acordes\s+no\s+tom\s+)?de\s+([A-G][#b]?m?)\)/i
    );
    if (tomWithShape) {
      concertKey = normalizeKeySymbol(tomWithShape[1]);
      originalKey = normalizeKeySymbol(tomWithShape[2]);
    } else {
      const tomMatch = l.match(/^Tom:\s*([A-G][#b]?m?)/i);
      if (tomMatch) {
        originalKey = normalizeKeySymbol(tomMatch[1]);
      }
    }

    const capoMatch = l.match(/^Capotraste:\s*(\d+)/i);
    if (capoMatch) {
      capoCasa = Number.parseInt(capoMatch[1], 10);
    }

    const bpmMatch = l.match(/^(\d{2,3})\s*bpm$/i);
    if (bpmMatch && !bpm) {
      bpm = Number.parseInt(bpmMatch[1], 10);
    }
  }

  // Extract top header lines if fallbackTitle / fallbackArtist not provided
  const topLines = lines
    .slice(0, 8)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!title && topLines[0] && !/^Title:|^URL Source:/i.test(topLines[0])) {
    title = topLines[0];
  }
  if (
    !artist &&
    topLines[1] &&
    !/^Composição|^Tom:|^Afinação:/i.test(topLines[1])
  ) {
    artist = topLines[1];
  }

  // Find where the header ends (within the first 28 lines)
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 28); i++) {
    const t = lines[i].trim();
    if (/^Tom:/i.test(t) || /^Afinação:/i.test(t) || /^Capotraste:/i.test(t)) {
      startIdx = i + 1;
    }
  }

  const bodyLines: string[] = [];
  let inTabBlock = false;

  for (let i = startIdx; i < lines.length; i++) {
    const rawLine = lines[i];
    const t = rawLine.trim();

    // Stop at print footer / chord diagrams controls
    if (
      /^\*?\s*Acordes\s*$/i.test(t) ||
      /^Tamanho do papel$/i.test(t) ||
      /^Restaurar padrões$/i.test(t) ||
      /^Opções de impressão$/i.test(t)
    ) {
      break;
    }

    // Stop if we hit the bottom print toolbar ("Tom" followed shortly by "Capotraste" / "Afinação")
    if (
      i > startIdx + 6 &&
      /^Tom$/i.test(t) &&
      /Capotraste|Afinação|Diagramas/i.test(lines.slice(i, i + 12).join(' '))
    ) {
      break;
    }

    // Skip rhythm/strumming descriptions and page counters
    if (
      /^Tempo \d+:/i.test(t) ||
      /^Batida /i.test(t) ||
      /^\[Ritmo /i.test(t) ||
      /^\[Padrão\]$/i.test(t) ||
      /^\[Intro,\s*Primeira/i.test(t)
    ) {
      continue;
    }
    if (/^\d{2,3}\s*bpm$/i.test(t)) continue;
    if (/^Página \d+\s*\/\s*\d+$/i.test(t)) continue;
    if (/^_+$/i.test(t)) continue;

    // Skip ASCII guitar tablature blocks
    if (/^\[Tab/i.test(t) || /^Parte \d+ de \d+$/i.test(t)) {
      inTabBlock = true;
      continue;
    }
    if (inTabBlock) {
      if (/^[EBGDAE]\|[-0-9hpb/~\s|]+$/i.test(t) || t === '') {
        if (t === '') inTabBlock = false;
        continue;
      }
      inTabBlock = false;
    }
    if (/^[EBGDAE]\|[-0-9hpb/~\s|]{5,}/i.test(t)) continue;

    bodyLines.push(rawLine);
  }

  // Strip trailing chord diagram fret labels at the bottom (e.g. "Am7" followed by "*2")
  while (bodyLines.length >= 2) {
    const last = bodyLines[bodyLines.length - 1].trim();
    const prev = bodyLines[bodyLines.length - 2].trim();
    if (!last) {
      bodyLines.pop();
      continue;
    }
    if (/^\*\d+[ªa]?$/i.test(last)) {
      bodyLines.pop();
      if (/^[A-G][#b]?[a-zA-Z0-9()/+#-]*$/.test(prev)) {
        bodyLines.pop();
      }
      continue;
    }
    break;
  }

  // Also strip trailing isolated chord list if the last several lines are single chords right before diagram footer
  while (bodyLines.length > 0 && !bodyLines[0].trim()) {
    bodyLines.shift();
  }
  while (bodyLines.length > 0 && !bodyLines[bodyLines.length - 1].trim()) {
    bodyLines.pop();
  }

  // Collapse 3+ consecutive empty lines into at most 1 empty line
  const cleanedLines: string[] = [];
  for (const line of bodyLines) {
    if (!line.trim()) {
      if (
        cleanedLines.length > 0 &&
        cleanedLines[cleanedLines.length - 1].trim() !== ''
      ) {
        cleanedLines.push('');
      }
    } else {
      cleanedLines.push(line);
    }
  }

  if (capoCasa && concertKey && concertKey !== originalKey) {
    cleanedLines.unshift(
      `(Capotraste na ${capoCasa}ª casa — Acordes na forma de ${originalKey}, soa em ${concertKey})`,
      ''
    );
  }

  return {
    title: title || fallbackTitle || 'Nova Música',
    artist: artist || fallbackArtist || 'IEB Horta',
    originalKey,
    concertKey,
    capoCasa,
    bpm,
    cifra: cleanedLines.join('\n'),
  };
}

/**
 * Fetches a Cifra Club song by its artistSlug and songSlug using r.jina.ai's
 * CORS-enabled plain text reader on the /imprimir.html endpoint.
 */
export async function fetchCifraClubSongBySlugs(
  artistSlug: string,
  songSlug: string,
  fallbackTitle = '',
  fallbackArtist = ''
): Promise<{
  title: string;
  artist: string;
  originalKey: string;
  concertKey?: string;
  capoCasa?: number;
  bpm?: number;
  sourceUrl: string;
  cifra: string;
}> {
  const sourceUrl = `https://www.cifraclub.com.br/${artistSlug}/${songSlug}/`;
  const printUrl = `${sourceUrl}imprimir.html`;

  const res = await fetch(`https://r.jina.ai/${printUrl}`, {
    headers: {
      'X-Return-Format': 'text',
    },
  });

  if (!res.ok) {
    throw new Error('Não foi possível carregar a cifra a partir do Cifra Club.');
  }

  const rawText = await res.text();
  const parsed = parseCifraClubPrintText(rawText, fallbackTitle, fallbackArtist);

  if (!parsed.cifra.trim()) {
    throw new Error('A página não contém uma cifra de texto válida.');
  }

  return {
    ...parsed,
    sourceUrl,
  };
}

/**
 * Main automatic song extractor: accepts a YouTube URL, a Cifra Club URL, any other
 * lyrics/chords URL, or a song title/artist search query, and automatically resolves
 * the song metadata, chords, lyrics, key, and BPM.
 */
export async function extractSongFromLinkOrQuery(
  rawInput: string
): Promise<ExtractedSongData> {
  const input = rawInput.trim();
  if (!input) {
    throw new Error('Cole uma ligação (YouTube ou Cifra Club) ou escreva o nome da música.');
  }

  // Case 1: Direct Cifra Club URL (e.g. https://www.cifraclub.com.br/artista/musica/...)
  const ccMatch = input.match(
    /cifraclub\.com(?:\.br)?\/([a-z0-9-]+)\/([a-z0-9-]+)\/?/i
  );
  if (ccMatch && ccMatch[1] !== 'musico' && ccMatch[1] !== 'enviar') {
    const [, artistSlug, songSlug] = ccMatch;
    const extracted = await fetchCifraClubSongBySlugs(artistSlug, songSlug);
    const candidates = await searchCifraClubCandidates(
      `${extracted.title} ${extracted.artist}`
    );
    return {
      ...extracted,
      candidates,
    };
  }

  // Case 2: YouTube URL (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)
  const isYouTubeUrl =
    /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(input);
  if (isYouTubeUrl) {
    const ytMeta = await fetchYouTubeMetadata(input);
    if (!ytMeta) {
      throw new Error(
        'Não foi possível identificar o título deste vídeo do YouTube. Verifique a ligação ou pesquise pelo nome da música.'
      );
    }

    const searchQuery = cleanYoutubeTitleForSearch(
      ytMeta.title,
      ytMeta.authorName
    );
    let candidates = await searchCifraClubCandidates(searchQuery);

    // Fallback: if full cleaned title + channel returned nothing, try only the video title cleaned
    if (candidates.length === 0) {
      const titleOnly = cleanYoutubeTitleForSearch(ytMeta.title, '');
      candidates = await searchCifraClubCandidates(titleOnly);
    }

    if (candidates.length === 0) {
      throw new Error(
        `Vídeo identificado («${ytMeta.title}»), mas não foi encontrada cifra correspondente. Tente escrever apenas o nome da música.`
      );
    }

    const best = candidates[0];
    const extracted = await fetchCifraClubSongBySlugs(
      best.artistSlug,
      best.songSlug,
      best.title,
      best.artist
    );

    return {
      ...extracted,
      youtubeUrl: input,
      candidates,
    };
  }

  // Case 3: Another website URL (e.g. letras.mus.br, hinario, etc.)
  if (/^https?:\/\//i.test(input)) {
    const res = await fetch(`https://r.jina.ai/${input}`);
    if (!res.ok) {
      throw new Error('Não foi possível ler a ligação indicada.');
    }
    const text = await res.text();
    const titleMatch = text.match(/^Title:\s*(.+)$/m);
    const pageTitle = titleMatch
      ? titleMatch[1]
          .replace(/\s*[-|–]\s*(?:Letras\.mus\.br|Vagalume|Cifras|YouTube).*$/i, '')
          .trim()
      : '';

    if (pageTitle) {
      const candidates = await searchCifraClubCandidates(pageTitle);
      if (candidates.length > 0) {
        const best = candidates[0];
        const extracted = await fetchCifraClubSongBySlugs(
          best.artistSlug,
          best.songSlug,
          best.title,
          best.artist
        );
        return {
          ...extracted,
          candidates,
        };
      }
    }

    // Fallback to raw extracted markdown content if not on Cifra Club
    const mdIdx = text.indexOf('Markdown Content:');
    const body =
      mdIdx !== -1 ? text.slice(mdIdx + 'Markdown Content:'.length).trim() : text.trim();

    return {
      title: pageTitle || 'Música Importada',
      artist: 'IEB Horta',
      originalKey: 'C',
      sourceUrl: input,
      cifra: body.slice(0, 15000),
      candidates: [],
    };
  }

  // Case 4: Plain song name / artist search query
  const candidates = await searchCifraClubCandidates(input);
  if (candidates.length === 0) {
    throw new Error(
      `Não foi encontrada nenhuma cifra para «${input}». Verifique o nome da música ou cole a ligação do Cifra Club / YouTube.`
    );
  }

  const best = candidates[0];
  const extracted = await fetchCifraClubSongBySlugs(
    best.artistSlug,
    best.songSlug,
    best.title,
    best.artist
  );

  return {
    ...extracted,
    candidates,
  };
}
