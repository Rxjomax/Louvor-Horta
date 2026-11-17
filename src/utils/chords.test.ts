import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isChordLine,
  isChordToken,
  parseCifraLines,
  stripChords,
  transposeChord,
  transposeKey,
  transposeLinePreservingAlignment,
} from './chords';

test('recognizes standard, extended, and slash chords', () => {
  assert.equal(isChordToken('G'), true);
  assert.equal(isChordToken('D/F#'), true);
  assert.equal(isChordToken('Em7'), true);
  assert.equal(isChordToken('C9'), true);
  assert.equal(isChordToken('A7M'), true);
  assert.equal(isChordToken('Bm7(11)'), true);
  assert.equal(isChordToken('G4'), true);
  assert.equal(isChordToken('(D/F#)'), true);
  assert.equal(isChordToken('casa'), false);
  assert.equal(isChordToken('Senhor'), false);
});

test('transposes chords accurately including slash bass notes', () => {
  assert.equal(transposeChord('G', 2, false), 'A');
  assert.equal(transposeChord('D/F#', 1, true), 'Eb/G');
  assert.equal(transposeChord('Em7', 2, false), 'F#m7');
  assert.equal(transposeChord('C9', -1, false), 'B9');
  assert.equal(transposeChord('Am7/G', 3, true), 'Cm7/Bb');
  assert.equal(transposeChord('(D/F#)', 2, false), '(E/G#)');
});

test('transposes musical keys with clean enharmonic spelling', () => {
  assert.equal(transposeKey('G', 2), 'A');
  assert.equal(transposeKey('D', 1), 'Eb');
  assert.equal(transposeKey('C', -2), 'Bb');
  assert.equal(transposeKey('Am', 2), 'Bm');
  assert.equal(transposeKey('Em', 1), 'Fm');
});

test('never mistakes Portuguese lyrics for chord lines', () => {
  assert.equal(isChordLine('A casa é Sua, pode entrar'), false);
  assert.equal(isChordLine('Em espírito e em verdade'), false);
  assert.equal(isChordLine('E não há outro igual a Ti'), false);
  assert.equal(isChordLine('Grande é o Senhor'), false);
  assert.equal(isChordLine('G        D/F#     Em7       C9'), true);
  assert.equal(isChordLine('[Intro] G  D/F#  Em7  C9'), true);
  assert.equal(isChordLine('[Refrão]'), false);
});

test('preserves column alignment when transposed chord changes width', () => {
  const line = 'G      D/F#   Em7';
  const transposed = transposeLinePreservingAlignment(line, 1, true);
  // G -> Ab (+1 char), so 6 spaces become 5 spaces, keeping D/F# -> Eb/G at the same column
  assert.equal(transposed.indexOf('Eb/G'), line.indexOf('D/F#'));
  assert.equal(transposed.indexOf('Fm7'), line.indexOf('Em7'));
});

test('parseCifraLines transposes chord lines while leaving lyrics untouched', () => {
  const sample = [
    '[Verso 1]',
    'G              D/F#',
    'A casa é Sua, pode entrar',
  ].join('\n');

  const parsed = parseCifraLines(sample, 2, 'G');
  assert.equal(parsed[0].type, 'section');
  assert.equal(parsed[1].type, 'chords');
  assert.equal(parsed[1].raw.trim().startsWith('A'), true);
  assert.equal(parsed[1].raw.includes('E/G#'), true);
  assert.equal(parsed[2].type, 'lyrics');
  assert.equal(parsed[2].raw, 'A casa é Sua, pode entrar');
});

test('stripChords removes chord lines and instrumental headers for backing vocals', () => {
  const sample = [
    '[Intro]',
    'G  D/F#  Em7  C9',
    '',
    '[Verso 1]',
    'G           D/F#',
    'A Tua bondade me seguirá',
  ].join('\n');

  const lyricsOnly = stripChords(sample);
  assert.deepEqual(lyricsOnly, [
    '[Verso 1]',
    'A Tua bondade me seguirá',
  ]);
});

test('handles PDF children-book chord notations accurately', () => {
  assert.equal(isChordToken('Fº/D'), true);
  assert.equal(isChordToken('A#º'), true);
  assert.equal(isChordToken('B64'), true);
  assert.equal(isChordToken('G5+'), true);
  assert.equal(isChordToken('D*'), true);
  assert.equal(isChordToken('/G#'), true);
  assert.equal(isChordToken('Bb_F'), true);
  assert.equal(isChordToken('D_G_D'), true);
  assert.equal(isChordToken('..G...D......G'), true);
  assert.equal(isChordToken('||:Em'), true);
  assert.equal(isChordToken('D:||'), true);

  assert.equal(transposeChord('Fº/D', 2, false), 'Gº/E');
  assert.equal(transposeChord('Bb_F', 2, false), 'C_G');
  assert.equal(transposeChord('..G...D......G', 2, false), '..A...E......A');
  assert.equal(transposeChord('D*', 2, false), 'E*');
  assert.equal(transposeChord('/G#', 2, false), '/A#');
  assert.equal(transposeKey('—', 2), '—');

  assert.equal(isChordLine('..G...D......G'), true);
  assert.equal(isChordLine('||: Intro: Riff notas: E  F#  G#  A'), true);
  assert.equal(isChordLine('Dm   F/G   C   (Para bridge: Am7(9) Bb F/A G)'), true);
  assert.equal(isChordLine('F   C/E   Dm   Bb9   (Subida de tom)'), true);
  assert.equal(isChordLine('* - Um toque em cada nota'), false);

  const transposedIntro = transposeLinePreservingAlignment(
    '||: Intro: Riff notas: E  F#  G#  A',
    2,
    false
  );
  assert.equal(transposedIntro, '||: Intro: Riff notas: F# G#  A#  B');

  const transposedCue = transposeLinePreservingAlignment(
    'Dm  F/G  C  (Para bridge: Am7(9) Bb F/A G)',
    2,
    false
  );
  assert.equal(transposedCue, 'Em  G/A  D  (Para bridge: Bm7(9) C  G/B A)');

  assert.equal(isChordLine('D Trans: G/A A D'), true);
  assert.equal(
    transposeLinePreservingAlignment('D Trans: G/A A D', 2, false),
    'E Trans: A/B B E'
  );
  assert.equal(isChordLine('(Subida de tom):'), false);
  const parsedSubida = parseCifraLines('(Subida de tom):\nG  D/F#  Em');
  assert.equal(parsedSubida[0]?.type, 'section');
  assert.equal(parsedSubida[1]?.type, 'chords');
});

test('handles Normal binder notations (backslash bass, guillemets, extended slash)', () => {
  assert.equal(isChordToken('F\\G'), true);
  assert.equal(isChordToken('\\D'), true);
  assert.equal(isChordToken('C4»C'), true);
  assert.equal(isChordToken('/D»D7'), true);
  assert.equal(isChordToken('Gm7»C'), true);
  assert.equal(isChordToken('A7/5-'), true);
  assert.equal(isChordToken('Am9/13'), true);
  assert.equal(isChordToken('Am9/6-'), true);
  assert.equal(isChordToken('B7(sus4)'), true);
  assert.equal(isChordToken('A(add9)/E'), true);
  assert.equal(isChordToken('C#5+/F'), true);
  assert.equal(isChordToken(':Ab7+'), true);
  assert.equal(isChordToken('Bm|'), true);

  assert.equal(transposeChord('F\\G', 2, false), 'G\\A');
  assert.equal(transposeChord('\\D', 2, false), '\\E');
  assert.equal(transposeChord('C4»C', 2, false), 'D4»D');
  assert.equal(transposeChord('/D»D7', 2, false), '/E»E7');
  assert.equal(transposeChord('A(add9)/E', 2, false), 'B(add9)/F#');
  assert.equal(transposeChord('C#5+/F', 2, false), 'D#5+/G');
  assert.equal(transposeChord(':Ab7+', 2, true), ':Bb7+');

  assert.equal(isChordLine('Gm » /F » C/E'), true);
  assert.equal(isChordLine('Bm7 (#5) E7 » A'), true);
  assert.equal(isChordLine('Intro: A/E  D/A  E/B  D/A  A/E'), true);
  assert.equal(
    transposeLinePreservingAlignment('Gm » /F » C/E', 2, false),
    'Am » /G » D/F#'
  );
  assert.equal(isChordLine('Pré-refrão:'), false);
  assert.equal(isChordLine('Refrão 1:'), false);
  assert.equal(isChordLine('(Refrão 1 e 2)'), false);
});

test('handles Hinos section markers without misclassifying inline Refrão: lyrics', () => {
  const parsed = parseCifraLines(
    '(Refrão:)\nRefrão:a, mas de espinhos, a cruz que padeceu.\nÉ o santo Refrão: dando glória a Deus.'
  );
  assert.equal(parsed[0]?.type, 'section');
  assert.equal(parsed[1]?.type, 'lyrics');
  assert.equal(parsed[2]?.type, 'lyrics');
});

