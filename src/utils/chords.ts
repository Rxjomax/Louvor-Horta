import { CifraStyle, Song } from '../types/music';

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const NOTE_TO_INDEX: Record<string, number> = {
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

const FLAT_KEYS = new Set([
  'F',
  'Bb',
  'Eb',
  'Ab',
  'Db',
  'Gb',
  'Dm',
  'Gm',
  'Cm',
  'Fm',
  'Bbm',
  'Ebm',
]);

// Regex for a single chord symbol (optionally wrapped in parentheses)
const CHORD_CORE_REGEX =
  /^([A-G][#b]?)(m|min|maj|dim|aug|sus|add|M|[0-9]|[°º+#b\-()]|\/[0-9#b+\-]+)*(?:[\/\\]([A-Ga-g][#b]?m?))?$/;

// Strict validator ensuring suffixes are plausible musical chord extensions
const VALID_SUFFIX_REGEX =
  /^(?:m(?!aj)|min|maj|dim|aug|sus|add|M|[0-9]|[°º]|\+|#5|b5|#9|b9|#11|b13|\/[0-9#b+\-]+|\((?:add|sus|maj|min|m|[0-9#bM+\-/])+\)|-)*$/;

const REPEAT_OR_BAR_TOKEN =
  /^(\|\|:|:\|\|(?:[xX]?[0-9]+|\))?|\|:|\:\||\|\||\||\/|\/\/|»|-|–|\.\.\.|[xX][0-9]+|[0-9]+[xX]|\([xX]?[0-9]+[xX]?\)|\(?(?:5#|#5|b5|13|9|11)\)?|[0-9]+[Tt]?|Trans:|Fim:|Tag:)$/i;

const SECTION_PREFIX_REGEX =
  /^(\s*(?:\|\|:\s*)?(?:\[[^\]]+\]|\((?:Intro|Verso|Estrofe|Refrão|Pré-Refrão|Pré-Ponte|Ponte|Solo|Instrumental|Interlúdio|Passagem|Final|Fim|Turnaround|Contra-?canto)[^)]*\)|(?:Intro|Introdução|Re-?intro|Solo|Turnaround|Instrumental|Interlúdio|Passagem|Contra-?canto|Final|Fim|Trans|Modulação|P\/\s*repetir|Base|Riff(?:\s+notas)?|Subida(?:\s+de\s+(?:meio-)?tom)?|(?:1ª|2ª|3ª)\s*\.?\s*vez)\s*:))(.*)$/i;

const SECTION_ONLY_REGEX =
  /^\s*(\[[^\]]+\]|\((?:Refrão(?:\s+\d+(?:\s*e\s*\d+)?)?\s*:?|Pré-?refrão(?:\s+\d+)?|Ponte(?:\s+\d+)?|Intro|Introdução|Bis|2x|3x|1ª\s*vez|2ª\s*vez)\)|\(Subida\s+de\s+(?:meio-)?tom\)\s*:?|\|\|:\s*(?:Refrão|Coro)\s*:\|\||(?:Intro|Introdução|Re-?intro|Verso(?:\s+\d+)?|Estrofe(?:\s+\d+)?|Pré-Refrão(?:\s+\d+)?|Pré-Ponte(?:\s+\d+)?|Refrão(?:\s*\d+(?:\s*e\s*\d+)?|\*)?|Coro(?:\s+\d+)?|Ponte(?:\s+\d+)?|Solo|Instrumental|Interlúdio|Passagem|Contra-?canto|Coda|Final|Fim|Tag|Declaração|Subida\s+de\s+(?:meio-)?tom)\s*:?)\s*$/i;

const CHORD_CUE_LABEL_REGEX =
  /^(\s*(?:Para\s+(?:bridge|ponte|refrão)|P\/\s*(?:voltar(?:\s+ao\s+in[íi]cio)?|repetir(?:\s+tudo)?|pré-ponte|subir(?:\s+de\s+tom)?)|Transição|Tag|Trans|Fim|Intro|Solo|Riff)\s*:)(.*)$/i;
const PURE_TEXT_CUE_REGEX =
  /^(?:subida(?:\s+de\s+(?:meio-)?tom)?|c\/\s*subida|no\s+fim|fim|final|normal|in[íi]cio|intro|introdução|refrão|pré-refrão|ponte|verso|estrofe|solo|instrumental|contra-?canto(?:\s*[xX]?\d+)?|bis|rep(?:ete|etir)?(?:\s+tudo)?|ad\.?\s*lib\.?|(?:\d+\s*[ªº]\s*vez)|(?:\d+\s*[xX]|[xX]\s*\d+))$/i;

/**
 * Splits a chord-line segment into plain chord runs vs standalone parenthetical cue blocks.
 * A `(...)` preceded immediately by a non-whitespace chord character (e.g. `G(add9)`, `C7(b9)`, `B7(sus4)/E`)
 * stays attached to its chord token rather than being split off as a separate cue.
 */
function splitCueSegments(input: string): Array<{ text: string; isCue: boolean }> {
  const result: Array<{ text: string; isCue: boolean }> = [];
  let cursor = 0;
  let plainStart = 0;

  while (cursor < input.length) {
    const ch = input[cursor];
    const prev = cursor > 0 ? input[cursor - 1] : '';
    const isStandaloneOpen = ch === '(' && (cursor === 0 || /\s|\|/.test(prev));
    if (isStandaloneOpen) {
      let depth = 0;
      let j = cursor;
      while (j < input.length) {
        if (input[j] === '(') depth++;
        else if (input[j] === ')') {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (j < input.length && depth === 0) {
        // If immediately followed by non-whitespace chord suffix/slash (e.g. `(G)/B`), keep attached
        const after = j + 1 < input.length ? input[j + 1] : '';
        if (after === '' || /\s|\||,|;|\./.test(after)) {
          if (cursor > plainStart) {
            result.push({ text: input.slice(plainStart, cursor), isCue: false });
          }
          result.push({ text: input.slice(cursor, j + 1), isCue: true });
          cursor = j + 1;
          plainStart = cursor;
          continue;
        }
      }
    }
    cursor++;
  }

  if (plainStart < input.length) {
    result.push({ text: input.slice(plainStart), isCue: false });
  }
  return result;
}

export function normalizeSemitones(semitones: number): number {
  return ((Math.round(semitones) % 12) + 12) % 12;
}

export function shouldUseFlatsForKey(key: string): boolean {
  const cleaned = key.trim();
  return FLAT_KEYS.has(cleaned);
}

function parseSingleChordCore(rawToken: string): {
  leading: string;
  root: string;
  suffix: string;
  bass?: string;
  bassSep?: '/' | '\\';
  bassMinor?: string;
  isStandaloneBass?: boolean;
  trailing: string;
} | null {
  let leading = '';
  let trailing = '';
  let core = rawToken;

  const leadBar = core.match(/^(\|\|:|\|:|\|+|:)(.*)$/);
  if (leadBar) {
    leading += leadBar[1];
    core = leadBar[2];
  }

  const trailBar = core.match(/^(.*?)(:\|\|(?:\))?|:\||\|+|\*)$/);
  if (trailBar && trailBar[1]) {
    core = trailBar[1];
    trailing = trailBar[2] + trailing;
  }

  const trailPunct = core.match(/^(.*?)([|,.;]+)$/);
  if (trailPunct) {
    core = trailPunct[1];
    trailing = trailPunct[2] + trailing;
  }

  if (core.startsWith('(') && core.endsWith(')') && core.length > 2) {
    leading += '(';
    trailing = ')' + trailing;
    core = core.slice(1, -1);
  }

  if (!core) return null;

  // Standalone slash/backslash bass token e.g. /G# or \D
  const standaloneBassMatch = core.match(/^([/\\])([A-G][#b]?)$/);
  if (standaloneBassMatch && NOTE_TO_INDEX[standaloneBassMatch[2]] !== undefined) {
    return {
      leading: `${leading}${standaloneBassMatch[1]}`,
      root: standaloneBassMatch[2],
      suffix: '',
      isStandaloneBass: true,
      trailing,
    };
  }

  // Split optional bass note at the last '/' or '\' if what follows is a note name
  let mainPart = core;
  let bass: string | undefined;
  let bassSep: '/' | '\\' | undefined;
  let bassMinor = '';

  const lastSlash = core.lastIndexOf('/');
  const lastBackslash = core.lastIndexOf('\\');
  const slashIdx = Math.max(lastSlash, lastBackslash);
  if (slashIdx > 0) {
    const sep = core[slashIdx] as '/' | '\\';
    const potentialBass = core.slice(slashIdx + 1);
    const bassMatch = potentialBass.match(/^([A-Ga-g][#b]?)(m?)$/);
    if (bassMatch) {
      const normalizedNote = bassMatch[1][0].toUpperCase() + bassMatch[1].slice(1);
      if (NOTE_TO_INDEX[normalizedNote] !== undefined) {
        bass = normalizedNote;
        bassSep = sep;
        bassMinor = bassMatch[2];
        mainPart = core.slice(0, slashIdx);
      }
    }
  }

  const rootMatch = mainPart.match(/^([A-G][#b]?)(.*)$/);
  if (!rootMatch) return null;

  const [, root, suffix] = rootMatch;
  if (NOTE_TO_INDEX[root] === undefined) return null;
  if (!VALID_SUFFIX_REGEX.test(suffix)) return null;
  if (!CHORD_CORE_REGEX.test(core)) return null;

  return { leading, root, suffix, bass, bassSep, bassMinor, trailing };
}

function splitCompoundChordToken(rawToken: string): string[] | null {
  if (
    !rawToken.includes('_') &&
    !rawToken.includes('..') &&
    !rawToken.includes('»') &&
    !/^\.[A-G]/.test(rawToken)
  ) {
    return null;
  }
  const pieces = rawToken.split(/([._»]+)/).filter((p) => p.length > 0);
  if (pieces.length <= 1) return null;

  let hasChord = false;
  for (const piece of pieces) {
    if (/^[._»]+$/.test(piece)) continue;
    if (!parseSingleChordCore(piece)) return null;
    hasChord = true;
  }
  return hasChord ? pieces : null;
}

export function parseChordToken(rawToken: string): {
  leading: string;
  root: string;
  suffix: string;
  bass?: string;
  bassSep?: '/' | '\\';
  bassMinor?: string;
  isStandaloneBass?: boolean;
  trailing: string;
} | null {
  return parseSingleChordCore(rawToken);
}

export function isChordToken(rawToken: string): boolean {
  return parseSingleChordCore(rawToken) !== null || splitCompoundChordToken(rawToken) !== null;
}

function transposePitch(note: string, semitones: number, preferFlats: boolean): string {
  const idx = NOTE_TO_INDEX[note];
  if (idx === undefined) return note;
  const targetIdx = (idx + normalizeSemitones(semitones)) % 12;
  return preferFlats ? FLAT_SCALE[targetIdx] : SHARP_SCALE[targetIdx];
}

export function transposeChord(
  rawToken: string,
  semitones: number,
  preferFlats = false
): string {
  const step = normalizeSemitones(semitones);
  const compound = splitCompoundChordToken(rawToken);
  if (compound) {
    if (step === 0) return rawToken;
    return compound
      .map((piece) => (/^[._»]+$/.test(piece) ? piece : transposeChord(piece, step, preferFlats)))
      .join('');
  }

  const parsed = parseSingleChordCore(rawToken);
  if (!parsed) return rawToken;
  if (step === 0) return rawToken;

  const newRoot = transposePitch(parsed.root, step, preferFlats);
  const newBass = parsed.bass
    ? transposePitch(parsed.bass, step, preferFlats)
    : undefined;
  const bassSep = parsed.bassSep ?? '/';
  const bassMinor = parsed.bassMinor ?? '';

  return `${parsed.leading}${newRoot}${parsed.suffix}${newBass ? `${bassSep}${newBass}${bassMinor}` : ''}${parsed.trailing}`;
}

function simplifyChordSuffix(suffix: string): string {
  if (!suffix) return '';
  const cleaned = suffix.trim();
  // Minor chords (e.g. m, min, m7, m9, m7(11), m7(b5), m11) -> clean "m"
  if (/^(?:m(?!aj)|min)/i.test(cleaned)) {
    return 'm';
  }
  // Major 7th (7M, M7, maj7) -> clean major triad ""
  if (/^(?:7M|M7|maj)/i.test(cleaned)) {
    return '';
  }
  // Dominant 7th (e.g. 7, 7(9), 7/4, 7sus4, 7b9, 7#5) -> keep clean "7"
  if (/^7/.test(cleaned)) {
    return '7';
  }
  // Diminished (° / º / dim) -> clean "m" or keep simple triad
  if (/^(?:dim|[°º])/i.test(cleaned)) {
    return 'm';
  }
  // All other tensions/suspensions (add9, sus4, sus2, 4, 9, 11, 13, 6, +, aug) -> clean major triad ""
  return '';
}

export function simplifyChordToken(rawToken: string): string {
  const compound = splitCompoundChordToken(rawToken);
  if (compound) {
    const simplifiedPieces = compound.map((piece) =>
      /^[._»]+$/.test(piece) ? piece : simplifyChordToken(piece)
    );
    // Drop empty pieces (e.g. standalone bass /D in /D»D7) and their dangling separators
    const cleaned: string[] = [];
    for (let i = 0; i < simplifiedPieces.length; i++) {
      const p = simplifiedPieces[i];
      if (p === '') {
        if (cleaned.length > 0 && /^[._»]+$/.test(cleaned[cleaned.length - 1])) {
          cleaned.pop();
        }
        continue;
      }
      if (/^[._»]+$/.test(p) && cleaned.length === 0) {
        continue;
      }
      cleaned.push(p);
    }
    return cleaned.join('');
  }

  const parsed = parseSingleChordCore(rawToken);
  if (!parsed) return rawToken;
  if (parsed.isStandaloneBass) return '';

  const simpleSuffix = simplifyChordSuffix(parsed.suffix);
  return `${parsed.leading}${parsed.root}${simpleSuffix}${parsed.trailing}`;
}

export function transposeKey(originalKey: string, semitones: number): string {
  const trimmed = originalKey.trim();
  if (!trimmed || trimmed === '—') return trimmed || '—';

  const step = normalizeSemitones(semitones);
  if (step === 0) return trimmed;

  const match = trimmed.match(/^([A-G][#b]?)(m?)$/);
  if (!match) return trimmed;

  const [, root, minor] = match;
  const idx = NOTE_TO_INDEX[root];
  if (idx === undefined) return trimmed;

  const targetIdx = (idx + step) % 12;
  // Choose natural key spelling for standard 12 keys
  const sharpCandidate = `${SHARP_SCALE[targetIdx]}${minor}`;
  const flatCandidate = `${FLAT_SCALE[targetIdx]}${minor}`;

  // Prefer Eb, Bb, Ab, F, Gm, Cm, Fm over D#, A#, G#, E#, etc.
  if (FLAT_KEYS.has(flatCandidate) && !['F#', 'F#m', 'C#m', 'G#m'].includes(sharpCandidate)) {
    return flatCandidate;
  }
  return sharpCandidate;
}

function areTokensAllChords(tokens: string[]): number {
  let chordCount = 0;
  for (const token of tokens) {
    if (isChordToken(token)) {
      chordCount++;
    } else if (REPEAT_OR_BAR_TOKEN.test(token)) {
      continue;
    } else {
      return 0;
    }
  }
  return chordCount;
}

function stripValidParentheticalCues(content: string): {
  remaining: string;
  cueHasChords: boolean;
} | null {
  let cueHasChords = false;
  const parts: string[] = [];

  for (const seg of splitCueSegments(content)) {
    if (!seg.isCue) {
      parts.push(seg.text);
      continue;
    }
    const inner = seg.text.slice(1, -1);
    const trimmedInner = inner.trim();
    if (PURE_TEXT_CUE_REGEX.test(trimmedInner)) {
      parts.push(' ');
      continue;
    }
    const labelMatch = trimmedInner.match(CHORD_CUE_LABEL_REGEX);
    if (labelMatch) {
      const restTokens = labelMatch[2].trim().split(/\s+/).filter(Boolean);
      if (restTokens.length > 0 && areTokensAllChords(restTokens) > 0) {
        cueHasChords = true;
        parts.push(' ');
        continue;
      }
    }
    const innerTokens = trimmedInner.split(/\s+/).filter(Boolean);
    if (innerTokens.length > 0 && areTokensAllChords(innerTokens) > 0) {
      cueHasChords = true;
      parts.push(' ');
      continue;
    }
    if (/^(?:5#|#5|b5|13|9|11)$/i.test(trimmedInner)) {
      parts.push(seg.text);
      continue;
    }
    return null;
  }

  return { remaining: parts.join(''), cueHasChords };
}

export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (SECTION_ONLY_REGEX.test(trimmed)) return false;

  // Handle stacked section prefixes like "||: Intro: Riff notas: E F# G# A"
  let contentToCheck = trimmed;
  while (true) {
    const prefixMatch = contentToCheck.match(SECTION_PREFIX_REGEX);
    if (!prefixMatch) break;
    contentToCheck = prefixMatch[2].trim();
  }
  if (!contentToCheck) return false;

  const cueCheck = stripValidParentheticalCues(contentToCheck);
  if (!cueCheck) return false;

  const tokens = cueCheck.remaining.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return cueCheck.cueHasChords;

  const chordCount = areTokensAllChords(tokens);
  if (chordCount === 0) return false;

  // Guard against bare numeric lines (e.g. "1." or "2") without real chords
  const realChords = tokens.filter((t) => isChordToken(t)).length;
  return realChords > 0;
}

export function transposeLinePreservingAlignment(
  line: string,
  semitones: number,
  preferFlats = false
): string {
  if (normalizeSemitones(semitones) === 0) return line;

  // Preserve leading stacked section prefixes untouched
  let prefixAcc = '';
  let rest = line;
  while (true) {
    const prefixMatch = rest.match(SECTION_PREFIX_REGEX);
    if (!prefixMatch) break;
    prefixAcc += prefixMatch[1];
    rest = prefixMatch[2];
  }

  return prefixAcc + transposeSegmentWithCues(rest, semitones, preferFlats);
}

function transposeSegmentWithCues(
  segment: string,
  semitones: number,
  preferFlats: boolean
): string {
  return splitCueSegments(segment)
    .map((seg) => {
      if (!seg.isCue) {
        return transposeTokensWithSpacing(seg.text, semitones, preferFlats);
      }
      const inner = seg.text.slice(1, -1);
      if (PURE_TEXT_CUE_REGEX.test(inner.trim())) {
        return seg.text;
      }
      const labelMatch = inner.match(CHORD_CUE_LABEL_REGEX);
      if (labelMatch) {
        return `(${labelMatch[1]}${transposeTokensWithSpacing(labelMatch[2], semitones, preferFlats)})`;
      }
      const innerTokens = inner.trim().split(/\s+/).filter(Boolean);
      if (innerTokens.length > 0 && areTokensAllChords(innerTokens) > 0) {
        return `(${transposeTokensWithSpacing(inner, semitones, preferFlats)})`;
      }
      return seg.text;
    })
    .join('');
}

function transposeTokensWithSpacing(
  segment: string,
  semitones: number,
  preferFlats: boolean
): string {
  // Match alternating whitespace and non-whitespace chunks
  const parts = segment.match(/(\s+|\S+)/g);
  if (!parts) return segment;

  let result = '';
  let pendingDrift = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (/^\s+$/.test(part)) {
      if (pendingDrift > 0) {
        // Previous chord grew longer; absorb from trailing spaces while keeping at least 1 space
        const keep = Math.max(1, part.length - pendingDrift);
        result += ' '.repeat(keep);
        pendingDrift = 0;
      } else if (pendingDrift < 0) {
        // Previous chord got shorter; add extra spaces to keep next chord aligned
        result += part + ' '.repeat(Math.abs(pendingDrift));
        pendingDrift = 0;
      } else {
        result += part;
      }
    } else {
      if (isChordToken(part)) {
        const transposed = transposeChord(part, semitones, preferFlats);
        pendingDrift = transposed.length - part.length;
        result += transposed;
      } else {
        pendingDrift = 0;
        result += part;
      }
    }
  }

  return result;
}

function simplifySegmentWithCues(segment: string): string {
  return splitCueSegments(segment)
    .map((seg) => {
      if (!seg.isCue) {
        return simplifyTokensWithSpacing(seg.text);
      }
      const inner = seg.text.slice(1, -1);
      if (PURE_TEXT_CUE_REGEX.test(inner.trim())) {
        return seg.text;
      }
      const labelMatch = inner.match(CHORD_CUE_LABEL_REGEX);
      if (labelMatch) {
        return `(${labelMatch[1]}${simplifyTokensWithSpacing(labelMatch[2])})`;
      }
      const innerTokens = inner.trim().split(/\s+/).filter(Boolean);
      if (innerTokens.length > 0 && areTokensAllChords(innerTokens) > 0) {
        return `(${simplifyTokensWithSpacing(inner)})`;
      }
      return seg.text;
    })
    .join('');
}

function simplifyTokensWithSpacing(segment: string): string {
  const parts = segment.match(/(\s+|\S+)/g);
  if (!parts) return segment;

  let result = '';
  let pendingDrift = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (/^\s+$/.test(part)) {
      if (pendingDrift > 0) {
        const keep = Math.max(1, part.length - pendingDrift);
        result += ' '.repeat(keep);
        pendingDrift = 0;
      } else if (pendingDrift < 0) {
        result += part + ' '.repeat(Math.abs(pendingDrift));
        pendingDrift = 0;
      } else {
        result += part;
      }
    } else {
      if (isChordToken(part)) {
        const simplified = simplifyChordToken(part);
        if (simplified === '') {
          // Standalone bass token removed: preserve exact column width with spaces
          result += ' '.repeat(part.length);
          pendingDrift = 0;
        } else {
          pendingDrift = simplified.length - part.length;
          result += simplified;
        }
      } else {
        pendingDrift = 0;
        result += part;
      }
    }
  }

  return result;
}

export function simplifyLinePreservingAlignment(line: string): string {
  let prefixAcc = '';
  let rest = line;
  while (true) {
    const prefixMatch = rest.match(SECTION_PREFIX_REGEX);
    if (!prefixMatch) break;
    prefixAcc += prefixMatch[1];
    rest = prefixMatch[2];
  }
  return prefixAcc + simplifySegmentWithCues(rest);
}

const OPEN_FRIENDLY_MAJOR_KEYS = new Set(['G', 'C', 'D', 'A', 'E']);
const OPEN_FRIENDLY_MINOR_KEYS = new Set(['Em', 'Am', 'Dm']);
const EASY_OPEN_SHAPES = new Set([
  'C', 'D', 'E', 'G', 'A',
  'Am', 'Dm', 'Em',
  'C7', 'D7', 'E7', 'G7', 'A7', 'B7',
]);

function isBarreShape(chordToken: string): boolean {
  const simple = simplifyChordToken(chordToken).replace(/[()|:*.,;]/g, '');
  if (!simple) return false;
  return !EASY_OPEN_SHAPES.has(simple);
}

/**
 * Recommends the most comfortable guitar Capo fret (1..9) for the song's sounding key
 * by minimizing barre chords and favoring classic open guitar shapes (G, C, D, A, E, Em, Am, Dm).
 */
export function recommendCapoFret(
  cifraText: string,
  soundingKey: string
): number {
  const sampleChords: string[] = [];
  const rawLines = cifraText.replace(/\r\n/g, '\n').split('\n');
  for (const line of rawLines) {
    if (!isChordLine(line)) continue;
    const chunks = line.trim().split(/\s+/);
    for (const chunk of chunks) {
      if (isChordToken(chunk)) {
        sampleChords.push(chunk);
        if (sampleChords.length >= 60) break;
      }
    }
    if (sampleChords.length >= 60) break;
  }

  let bestFret = 1;
  let bestScore = -Infinity;

  for (let fret = 1; fret <= 9; fret++) {
    const fingeredKey = transposeKey(soundingKey, -fret);
    const preferFlats = shouldUseFlatsForKey(fingeredKey);

    let barreCount = 0;
    for (const ch of sampleChords) {
      const shifted = transposeChord(ch, -fret, preferFlats);
      if (isBarreShape(shifted)) barreCount++;
    }

    const total = Math.max(1, sampleChords.length);
    const openRatio = 1 - barreCount / total;
    let score = openRatio * 100;

    if (OPEN_FRIENDLY_MAJOR_KEYS.has(fingeredKey) || OPEN_FRIENDLY_MINOR_KEYS.has(fingeredKey)) {
      score += 24;
    }
    // Prefer lower frets (1..5) for comfort and tone
    if (fret <= 5) score += 10 - fret * 1.2;
    else if (fret <= 7) score += 2 - (fret - 5);
    else score -= (fret - 6) * 8;

    if (score > bestScore) {
      bestScore = score;
      bestFret = fret;
    }
  }

  return bestFret;
}

export interface EffectiveCifraParams {
  style: CifraStyle;
  soundingKey: string;
  fingeredKey: string;
  capoFret: number;
  effectiveTransposeOffset: number;
  simplify: boolean;
  shortLabel: string;
  fullLabel: string;
}

export function getEffectiveCifraParams(
  song: Song,
  transposeOffset: number,
  cifraStyle: CifraStyle = 'original',
  capoFret?: number
): EffectiveCifraParams {
  const soundingKey = transposeKey(song.originalKey, transposeOffset);
  if (song.originalKey === '—') {
    return {
      style: 'original',
      soundingKey: '—',
      fingeredKey: '—',
      capoFret: 0,
      effectiveTransposeOffset: transposeOffset,
      simplify: false,
      shortLabel: 'Só letra',
      fullLabel: 'Só letra',
    };
  }

  if (cifraStyle === 'capo') {
    const resolvedFret =
      capoFret !== undefined && capoFret >= 1 && capoFret <= 9
        ? Math.round(capoFret)
        : recommendCapoFret(
            // Recommend relative to sounding key
            transposeOffset === 0
              ? song.cifra
              : song.cifra
                  .split('\n')
                  .map((l) =>
                    isChordLine(l)
                      ? transposeLinePreservingAlignment(
                          l,
                          transposeOffset,
                          shouldUseFlatsForKey(soundingKey)
                        )
                      : l
                  )
                  .join('\n'),
            soundingKey
          );
    const fingeredKey = transposeKey(soundingKey, -resolvedFret);
    return {
      style: 'capo',
      soundingKey,
      fingeredKey,
      capoFret: resolvedFret,
      effectiveTransposeOffset: transposeOffset - resolvedFret,
      simplify: false,
      shortLabel: `Capo ${resolvedFret}ª (${fingeredKey})`,
      fullLabel: `Capo ${resolvedFret}ª casa · Formas em ${fingeredKey} (soa em ${soundingKey})`,
    };
  }

  if (cifraStyle === 'simplified') {
    return {
      style: 'simplified',
      soundingKey,
      fingeredKey: soundingKey,
      capoFret: 0,
      effectiveTransposeOffset: transposeOffset,
      simplify: true,
      shortLabel: 'Simplificada',
      fullLabel: 'Cifra Simplificada',
    };
  }

  return {
    style: 'original',
    soundingKey,
    fingeredKey: soundingKey,
    capoFret: 0,
    effectiveTransposeOffset: transposeOffset,
    simplify: false,
    shortLabel: 'Completa',
    fullLabel: 'Cifra Completa',
  };
}

export type ParsedLineType = 'section' | 'chords' | 'lyrics' | 'empty';

export interface LineSegment {
  text: string;
  isChord: boolean;
}

export interface ParsedCifraLine {
  type: ParsedLineType;
  raw: string;
  segments: LineSegment[];
}

export function parseCifraLines(
  cifraText: string,
  semitones = 0,
  originalKey = 'C',
  simplify = false
): ParsedCifraLine[] {
  const targetKey = transposeKey(originalKey, semitones);
  const preferFlats = shouldUseFlatsForKey(targetKey);
  const rawLines = cifraText.replace(/\r\n/g, '\n').split('\n');

  return rawLines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return { type: 'empty', raw: '', segments: [] };
    }

    if (SECTION_ONLY_REGEX.test(trimmed)) {
      return {
        type: 'section',
        raw: trimmed,
        segments: [{ text: trimmed, isChord: false }],
      };
    }

    if (isChordLine(line)) {
      const transposedLine = transposeLinePreservingAlignment(
        line,
        semitones,
        preferFlats
      );
      const renderedLine = simplify
        ? simplifyLinePreservingAlignment(transposedLine)
        : transposedLine;
      const segments: LineSegment[] = [];

      let body = renderedLine;
      while (true) {
        const prefixMatch = body.match(SECTION_PREFIX_REGEX);
        if (!prefixMatch) break;
        segments.push({ text: prefixMatch[1], isChord: false });
        body = prefixMatch[2];
      }

      // Tokenize body while keeping parenthetical cues readable and highlighting chords inside them
      for (const seg of splitCueSegments(body)) {
        if (seg.isCue) {
          const inner = seg.text.slice(1, -1);
          const labelMatch = inner.match(CHORD_CUE_LABEL_REGEX);
          if (labelMatch) {
            segments.push({ text: `(${labelMatch[1]}`, isChord: false });
            const chunks = labelMatch[2].match(/(\s+|\S+)/g) ?? [];
            for (const chunk of chunks) {
              segments.push({
                text: chunk,
                isChord: !/^\s+$/.test(chunk) && isChordToken(chunk),
              });
            }
            segments.push({ text: ')', isChord: false });
            continue;
          }
          const innerTokens = inner.trim().split(/\s+/).filter(Boolean);
          if (innerTokens.length > 0 && areTokensAllChords(innerTokens) > 0) {
            segments.push({ text: seg.text, isChord: true });
            continue;
          }
          segments.push({ text: seg.text, isChord: false });
          continue;
        }

        const chunks = seg.text.match(/(\s+|\S+)/g) ?? [];
        for (const chunk of chunks) {
          if (/^\s+$/.test(chunk)) {
            segments.push({ text: chunk, isChord: false });
          } else {
            segments.push({ text: chunk, isChord: isChordToken(chunk) });
          }
        }
      }

      return {
        type: 'chords',
        raw: renderedLine,
        segments,
      };
    }

    return {
      type: 'lyrics',
      raw: line,
      segments: [{ text: line, isChord: false }],
    };
  });
}

export function stripChords(cifraText: string): string[] {
  const rawLines = cifraText.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // Avoid consecutive empty lines
      if (output.length > 0 && output[output.length - 1] !== '') {
        output.push('');
      }
      continue;
    }

    if (SECTION_ONLY_REGEX.test(trimmed)) {
      // Keep lyrical sections, skip pure instrumental section headers like [Intro] / [Solo]
      if (!/^\[?(Intro|Introdução|Solo|Instrumental|Turnaround)\]?:?$/i.test(trimmed)) {
        output.push(trimmed);
      }
      continue;
    }

    if (isChordLine(line)) {
      continue;
    }

    output.push(line);
  }

  while (output.length > 0 && output[output.length - 1] === '') {
    output.pop();
  }

  return output;
}
