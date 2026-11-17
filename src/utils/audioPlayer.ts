import { Song } from '../types/music';
import { ParsedCifraLine, parseChordToken, stripChords } from './chords';

export type InstrumentSound = 'guitar' | 'piano';

const NOTE_SEMITONES: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  'E#': 5,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Converts a chord token (e.g. "G", "D/F#", "Am7", "C9", "F#m7") into a balanced
 * 4-to-5 note voicing in MIDI note numbers suitable for guitar strumming or piano.
 */
export function chordToMidiNotes(rawChord: string): number[] {
  const parsed = parseChordToken(rawChord);
  const cleanFallbackRoot = rawChord.trim().match(/^([A-G][#b]?)/);
  const rootName = parsed?.root ?? cleanFallbackRoot?.[1] ?? 'C';
  const suffix = parsed?.suffix ?? '';
  const bassName = parsed?.bass;

  const rootSemi = NOTE_SEMITONES[rootName] ?? 0;
  // Base root around C3..B3 (MIDI 48..59)
  const rootMidi = 48 + rootSemi;

  // Determine third (minor vs major vs sus)
  let thirdInterval = 4; // major 3rd
  if (/sus2/i.test(suffix)) {
    thirdInterval = 2;
  } else if (/sus4|sus|4/i.test(suffix) && !/maj|m(?!aj)/i.test(suffix)) {
    thirdInterval = 5;
  } else if (/^(?:m(?!aj)|min)/i.test(suffix) || /dim|°|º/i.test(suffix)) {
    thirdInterval = 3; // minor 3rd
  }

  // Determine fifth
  let fifthInterval = 7;
  if (/dim|°|º|b5/i.test(suffix)) {
    fifthInterval = 6;
  } else if (/aug|\+|#5/i.test(suffix)) {
    fifthInterval = 8;
  }

  // Optional 7th or 9th color note
  let extensionInterval: number | null = null;
  if (/maj7|M7|7M/i.test(suffix)) {
    extensionInterval = 11;
  } else if (/7/i.test(suffix)) {
    extensionInterval = 10;
  } else if (/6/i.test(suffix)) {
    extensionInterval = 9;
  } else if (/9|2/i.test(suffix)) {
    extensionInterval = 14;
  }

  // Bass note (around E2..D#3, MIDI 40..51)
  let bassMidi = rootMidi - 12;
  if (bassName && NOTE_SEMITONES[bassName] !== undefined) {
    const bassSemi = NOTE_SEMITONES[bassName];
    bassMidi = 36 + bassSemi;
    if (bassMidi < 40) bassMidi += 12;
  } else if (bassMidi < 40) {
    bassMidi += 12;
  }

  const notes = [
    bassMidi,
    rootMidi,
    rootMidi + fifthInterval,
    rootMidi + 12 + thirdInterval,
  ];

  if (extensionInterval !== null) {
    notes.push(rootMidi + extensionInterval);
  } else {
    notes.push(rootMidi + 12);
  }

  return notes;
}

/**
 * Plays a single chord with either a warm acoustic guitar strum or soft stage piano voicing.
 */
export function playChordSound(
  chordToken: string,
  instrument: InstrumentSound = 'guitar',
  durationSec = 1.65
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const midiNotes = chordToMidiNotes(chordToken);
  const now = ctx.currentTime;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.28, now);
  masterGain.connect(ctx.destination);

  midiNotes.forEach((midi, idx) => {
    const stagger = instrument === 'guitar' ? idx * 0.028 : idx * 0.006;
    const startTime = now + stagger;
    const freq = midiToFreq(midi);

    const noteGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(
      instrument === 'guitar' ? 2400 : 1800,
      startTime
    );
    filter.frequency.exponentialRampToValueAtTime(
      instrument === 'guitar' ? 420 : 600,
      startTime + durationSec
    );

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();

    if (instrument === 'guitar') {
      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      osc2.detune.setValueAtTime(3.5, startTime);
    } else {
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc2.detune.setValueAtTime(-2.5, startTime);
    }

    osc1.frequency.setValueAtTime(freq, startTime);
    osc2.frequency.setValueAtTime(freq, startTime);

    const osc2Mix = ctx.createGain();
    osc2Mix.gain.setValueAtTime(instrument === 'guitar' ? 0.22 : 0.35, startTime);

    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(
      idx === 0 ? 0.36 : 0.24,
      startTime + (instrument === 'guitar' ? 0.012 : 0.02)
    );
    noteGain.gain.exponentialRampToValueAtTime(
      0.0008,
      startTime + durationSec
    );

    osc1.connect(filter);
    osc2.connect(osc2Mix);
    osc2Mix.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(masterGain);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + durationSec + 0.05);
    osc2.stop(startTime + durationSec + 0.05);
  });
}

export interface ChordStepWithLyric {
  chord: string;
  section: string;
  lyricLine: string;
}

/**
 * Extracts the exact ordered chord progression of the song paired with its corresponding
 * lyric line and section name, plus the list of unique chords in the song.
 */
export function extractSongChords(parsedLines: ParsedCifraLine[]): {
  sequence: string[];
  steps: ChordStepWithLyric[];
  unique: string[];
} {
  const sequence: string[] = [];
  const steps: ChordStepWithLyric[] = [];
  const seen = new Set<string>();
  const unique: string[] = [];

  let currentSection = 'Início';

  for (let i = 0; i < parsedLines.length; i++) {
    const line = parsedLines[i];
    if (line.type === 'section') {
      currentSection = line.raw.replace(/^\[|\]$|:$/g, '').trim() || currentSection;
      continue;
    }
    if (line.type !== 'chords') continue;

    // Look ahead for the next lyric line immediately below this chord line
    let pairedLyric = '';
    for (let j = i + 1; j <= Math.min(i + 2, parsedLines.length - 1); j++) {
      if (parsedLines[j].type === 'lyrics') {
        pairedLyric = parsedLines[j].raw.trim();
        break;
      }
      if (parsedLines[j].type === 'chords' || parsedLines[j].type === 'section') {
        break;
      }
    }

    for (const seg of line.segments) {
      if (!seg.isChord) continue;
      const tokens = seg.text
        .replace(/[|():._»]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);

      for (const token of tokens) {
        const parsed = parseChordToken(token);
        if (!parsed || parsed.isStandaloneBass) continue;
        const normalized = `${parsed.root}${parsed.suffix}${
          parsed.bass ? `/${parsed.bass}${parsed.bassMinor ?? ''}` : ''
        }`;
        sequence.push(normalized);
        steps.push({
          chord: normalized,
          section: currentSection,
          lyricLine: pairedLyric || currentSection,
        });
        if (!seen.has(normalized)) {
          seen.add(normalized);
          unique.push(normalized);
        }
      }
    }
  }

  return {
    sequence: sequence.slice(0, 96),
    steps: steps.slice(0, 96),
    unique: unique.slice(0, 28),
  };
}

export interface YouTubeEmbedInfo {
  videoId: string;
  startSeconds: number;
  embedUrl: string;
}

function parseStartTimeParam(rawUrl: string): number {
  const tMatch = rawUrl.match(/[?&](?:t|start)=([0-9hms]+)/i);
  if (!tMatch) return 0;
  const val = tMatch[1];
  if (/^\d+$/.test(val)) {
    return Number.parseInt(val, 10);
  }
  let total = 0;
  const h = val.match(/(\d+)h/i);
  const m = val.match(/(\d+)m/i);
  const s = val.match(/(\d+)s/i);
  if (h) total += Number.parseInt(h[1], 10) * 3600;
  if (m) total += Number.parseInt(m[1], 10) * 60;
  if (s) total += Number.parseInt(s[1], 10);
  if (!h && !m && !s) {
    const num = Number.parseInt(val, 10);
    if (Number.isFinite(num)) total = num;
  }
  return total;
}

/**
 * Extracts a YouTube video ID AND exact timestamp offset (e.g. ?t=1408 or &t=81s)
 * so the embedded player plays the exact right song at the exact right starting second.
 */
export function parseYouTubeEmbedInfo(url?: string): YouTubeEmbedInfo | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  let videoId: string | null = null;

  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) videoId = shortMatch[1];

  if (!videoId) {
    const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) videoId = watchMatch[1];
  }

  if (!videoId) {
    const embedMatch = trimmed.match(
      /youtube\.com\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/
    );
    if (embedMatch) videoId = embedMatch[1];
  }

  if (!videoId) return null;

  const startSeconds = parseStartTimeParam(trimmed);
  const startParam = startSeconds > 0 ? `&start=${startSeconds}` : '';

  return {
    videoId,
    startSeconds,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0${startParam}`,
  };
}

export function extractYouTubeVideoId(url?: string): string | null {
  return parseYouTubeEmbedInfo(url)?.videoId ?? null;
}

export interface SongListeningLinks {
  cleanTitle: string;
  firstLyricSnippet: string;
  exactSearchSummary: string;
  originalYoutube: string;
  acousticYoutube: string;
  tutorialYoutube: string;
  playbackYoutube: string;
  spotifySearch: string;
}

function extractFirstLyricSnippet(cifra: string): string {
  const lines = stripChords(cifra);
  const collected: string[] = [];

  for (const raw of lines) {
    const cleaned = raw
      .replace(/^\d+\s*[-–.]\s*/, '')
      .replace(/\|\|:|:\|\||2x|3x|\(2x\)|\(3x\)/gi, '')
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .replace(/[-–]{2,}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (
      cleaned.length >= 5 &&
      !/^(intro|introdução|estrofe|verso|refrão|coro|ponte|final|fim|solo|instrumental|subida)/i.test(
        cleaned
      )
    ) {
      collected.push(cleaned);
      if (collected.join(' ').length >= 34 || collected.length >= 2) {
        break;
      }
    }
  }

  return collected.join(' ').slice(0, 68).trim();
}

/**
 * Builds highly specific search/listen URLs using the song's cleaned title, category,
 * real artist (ignoring internal binder labels like "Coletânea IEBH" or Bible refs),
 * and the first sung verse phrase from the lyrics so results always match the exact song.
 */
export function buildSongListeningLinks(song: Song): SongListeningLinks {
  const cleanTitle = song.title
    .replace(/\((?:CMA|Tom|CSPC|v\d|[A-G][#b]?m?)[^)]*\)/gi, '')
    .replace(/^(?:Refrão:\s*)/i, '')
    .replace(/^\d+\s*[-–.]?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const firstLyricSnippet = extractFirstLyricSnippet(song.cifra);
  const rawArtist = (song.artist ?? '').trim();

  const isGenericOrBinderArtist =
    !rawArtist ||
    /coletânea|iebh|ieb\s*horta|igreja lusitana|libro de liturgia|medley|desconhecido|autor desconhecido|hinário|cántico|salmos|isaías|crónicas|samuel|mateus|joão|apocalipse|romanos|coríntios|\d+:\d+/i.test(
      rawArtist
    );

  let coreIdentityQuery = '';
  let spotifyQuery = '';

  if (song.category === 'Hinos') {
    const hinoNum = song.number ? `${song.number}` : '';
    coreIdentityQuery = `Cantor Cristão ${hinoNum} ${cleanTitle} ${firstLyricSnippet}`.trim();
    spotifyQuery = `Cantor Cristão ${cleanTitle}`.trim();
  } else if (song.category === 'Crianças') {
    const isAPEC = /APEC/i.test(rawArtist);
    coreIdentityQuery = `${cleanTitle} ${firstLyricSnippet} ${
      isAPEC ? 'APEC' : 'música infantil evangélica'
    }`.trim();
    spotifyQuery = `${cleanTitle} ${firstLyricSnippet}`.trim();
  } else if (isGenericOrBinderArtist) {
    coreIdentityQuery = `${cleanTitle} ${firstLyricSnippet} louvor`.trim();
    spotifyQuery = `${cleanTitle} ${firstLyricSnippet}`.trim();
  } else {
    const cleanArtist = rawArtist
      .replace(/Original:|Composer:|Música:|Tradução:|·.*|\(.*?\)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    coreIdentityQuery = `${cleanTitle} ${cleanArtist}`.trim();
    spotifyQuery = `${cleanTitle} ${cleanArtist}`.trim();
  }

  return {
    cleanTitle,
    firstLyricSnippet,
    exactSearchSummary: coreIdentityQuery,
    originalYoutube:
      song.youtubeUrl && /youtu\.?be/.test(song.youtubeUrl)
        ? song.youtubeUrl
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(
            coreIdentityQuery
          )}`,
    acousticYoutube: `https://www.youtube.com/results?search_query=${encodeURIComponent(
      `${cleanTitle} ${firstLyricSnippet} acústico voz e violão guitarra`
    )}`,
    tutorialYoutube: `https://www.youtube.com/results?search_query=${encodeURIComponent(
      `como tocar ${cleanTitle} ${firstLyricSnippet} cifra aula`
    )}`,
    playbackYoutube: `https://www.youtube.com/results?search_query=${encodeURIComponent(
      `${coreIdentityQuery} playback instrumental`
    )}`,
    spotifySearch: `https://open.spotify.com/search/${encodeURIComponent(
      spotifyQuery
    )}`,
  };
}
