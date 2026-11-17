import test from 'node:test';
import assert from 'node:assert/strict';
import { Song } from '../types/music';
import { formatWhatsAppSetlist, generateBalancedSetlist } from './setlist';

const mockSongs: Song[] = [
  {
    id: '1',
    number: 10,
    title: 'Grande é o Senhor',
    artist: 'Adhemar de Campos',
    originalKey: 'A',
    bpm: 112,
    category: 'Normal',
    cifra: 'A',
    createdAt: 1,
  },
  {
    id: '2',
    number: 11,
    title: 'Todavia Me Alegrarei',
    artist: 'Samuel Messias',
    originalKey: 'E',
    bpm: 124,
    category: 'Normal',
    cifra: 'E',
    createdAt: 2,
  },
  {
    id: '3',
    number: 1,
    title: 'Tua fidelidade é grande',
    artist: 'Marcos Witt',
    originalKey: 'C',
    bpm: 60,
    category: 'Normal',
    cifra: 'C',
    createdAt: 3,
  },
  {
    id: '4',
    number: 3,
    title: 'Deus está aqui',
    artist: 'Coletânea IEBH',
    originalKey: 'C',
    bpm: 73,
    category: 'Normal',
    cifra: 'C',
    createdAt: 4,
  },
  {
    id: '5',
    number: 1,
    title: 'Antífona',
    artist: 'William Henry Monk',
    originalKey: 'D',
    bpm: 72,
    category: 'Hinos',
    cifra: 'D',
    createdAt: 5,
  },
  {
    id: '6',
    number: 375,
    title: 'Segurança',
    artist: 'Fanny Jane Crosby',
    originalKey: 'C',
    bpm: 85,
    category: 'Hinos',
    cifra: 'C',
    createdAt: 6,
  },
];

test('generateBalancedSetlist returns exact count with no duplicates and worship flow', () => {
  const seededRng = () => 0.42;
  const setlist4 = generateBalancedSetlist(mockSongs, 4, seededRng);

  assert.equal(setlist4.length, 4);
  const uniqueIds = new Set(setlist4.map((s) => s.id));
  assert.equal(uniqueIds.size, 4);

  const upbeatCount = setlist4.filter((s) => (s.bpm ?? 0) >= 105).length;
  const hymnCount = setlist4.filter((s) => s.category === 'Hinos').length;

  assert.equal(upbeatCount, 2);
  assert.ok(hymnCount >= 1);

  // Flow order: faster songs precede slower worship/hymns
  assert.ok((setlist4[0].bpm ?? 0) >= 105);
  assert.ok((setlist4[3].bpm ?? 0) < 105);
});

test('generateBalancedSetlist handles requesting more songs than available', () => {
  const smallPool = mockSongs.slice(0, 2);
  const result = generateBalancedSetlist(smallPool, 5);
  assert.equal(result.length, 2);
});

test('formatWhatsAppSetlist formats title, order, and transposed keys cleanly', () => {
  const byId = new Map(mockSongs.map((s) => [s.id, s]));
  const text = formatWhatsAppSetlist(
    'Culto de Domingo - 18h30',
    [
      { songId: '1', transposeOffset: 0 },
      { songId: '5', transposeOffset: 2 },
    ],
    byId
  );

  assert.ok(text.includes('*Louvor IEB Horta*'));
  assert.ok(text.includes('*Culto de Domingo - 18h30*'));
  assert.ok(text.includes('1. *Grande é o Senhor* (Adhemar de Campos) — Tom: *A*'));
  assert.ok(text.includes('2. *Antífona* (William Henry Monk) — Tom: *E*'));
});

test('supports Crianças category and lyric-only songs in setlist and WhatsApp output', () => {
  const kidsSongs: Song[] = [
    {
      id: 'k1',
      number: 89,
      title: 'Aos Olhos Do Pai',
      artist: 'Ana Paula Valadão',
      originalKey: 'C',
      category: 'Crianças',
      cifra: 'C\nAos olhos do Pai',
      createdAt: 10,
    },
    {
      id: 'k2',
      number: 112,
      title: 'Mé mé mé faz a ovelha',
      artist: 'Coletânea IEBH',
      originalKey: '—',
      category: 'Crianças',
      cifra: 'Mé mé mé faz a ovelha',
      createdAt: 11,
    },
  ];

  const picked = generateBalancedSetlist(kidsSongs, 2, () => 0.1);
  assert.equal(picked.length, 2);

  const byId = new Map(kidsSongs.map((s) => [s.id, s]));
  const text = formatWhatsAppSetlist(
    'Culto Infantil',
    [
      { songId: 'k1', transposeOffset: 0 },
      { songId: 'k2', transposeOffset: 2 },
    ],
    byId
  );
  assert.ok(text.includes('1. *Aos Olhos Do Pai* (Ana Paula Valadão) — Tom: *C*'));
  assert.ok(text.includes('2. *Mé mé mé faz a ovelha* (Coletânea IEBH) — Letra'));
});

test('includes Normal and Hinos category songs using BPM pacing in balanced setlist', () => {
  const mixedPool: Song[] = [
    {
      id: 'n-fast',
      number: 10,
      title: 'Celebração Rápida',
      artist: 'IEBH',
      originalKey: 'D',
      bpm: 124,
      category: 'Normal',
      cifra: 'D\nExemplo',
      createdAt: 20,
    },
    {
      id: 'h-slow',
      number: 1,
      title: 'Antífona',
      artist: 'William Henry Monk',
      originalKey: 'D',
      bpm: 72,
      category: 'Hinos',
      cifra: 'D\nA Ti ó Deus',
      createdAt: 21,
    },
  ];
  const picked = generateBalancedSetlist(mixedPool, 2, () => 0.3);
  assert.equal(picked.length, 2);
  assert.equal(picked[0].id, 'n-fast');
  assert.equal(picked[1].id, 'h-slow');
});

test('generateBalancedSetlist supports arbitrary configurable counts such as 1 and 6 without duplicates', () => {
  const one = generateBalancedSetlist(mockSongs, 1, () => 0.5);
  assert.equal(one.length, 1);

  const six = generateBalancedSetlist(mockSongs, 6, () => 0.5);
  assert.equal(six.length, 6);
  assert.equal(new Set(six.map((s) => s.id)).size, 6);
});

