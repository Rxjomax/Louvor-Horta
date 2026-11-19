import {
  CifraStyle,
  PlaylistItem,
  ScheduleEntry,
  ScheduleRole,
  Song,
} from '../types/music';
import {
  getEffectiveCifraParams,
  parseCifraLines,
  stripChords,
} from './chords';

/**
 * Encodes a Unicode string into WinAnsi (Windows-1252 / Latin-1) escaped octals
 * for standard PDF Type1 fonts (Helvetica, Courier), preserving Portuguese accents.
 */
export function encodePdfString(text: string): string {
  const cp1252Map: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
  };

  let out = '(';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    let byte = 0x20;
    if (code >= 0x20 && code <= 0x7e) {
      if (code === 0x28 || code === 0x29 || code === 0x5c) {
        out += '\\' + String.fromCharCode(code);
        continue;
      }
      out += String.fromCharCode(code);
      continue;
    } else if (code >= 0xa0 && code <= 0xff) {
      byte = code;
    } else if (cp1252Map[code] !== undefined) {
      byte = cp1252Map[code];
    } else {
      byte = 0x20;
    }
    out += '\\' + byte.toString(8).padStart(3, '0');
  }
  out += ')';
  return out;
}

function sanitizePdfText(text: string): string {
  // Collapse unsupported surrogate-pair emojis cleanly so WinAnsi text has no odd spacing
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateCharWidth(ch: string, fontSize: number, bold: boolean): number {
  const narrow = "ilíìîïjtfr.,;:'\"!| ";
  const wide = 'MWmwÓÔÕÖÒÚÛÜÙÁÂÃÀÉÊÈÍÎÌÇ@%&';
  let ratio = bold ? 0.56 : 0.51;
  if (narrow.includes(ch)) ratio = 0.28;
  else if (wide.includes(ch)) ratio = bold ? 0.78 : 0.72;
  else if (ch >= 'A' && ch <= 'Z') ratio = bold ? 0.68 : 0.64;
  return ratio * fontSize;
}

function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    width += estimateCharWidth(text[i], fontSize, bold);
  }
  return width;
}

function wrapTextToWidth(
  text: string,
  maxWidthPt: number,
  fontSize: number,
  bold = false
): string[] {
  const clean = sanitizePdfText(text);
  if (!clean) return [];

  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  const pushSplitWord = (word: string) => {
    let chunk = '';
    for (const ch of word) {
      const candidate = chunk + ch;
      if (
        chunk.length > 0 &&
        estimateTextWidth(candidate, fontSize, bold) > maxWidthPt
      ) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = candidate;
      }
    }
    if (chunk) current = chunk;
  };

  for (const word of words) {
    if (!current) {
      if (estimateTextWidth(word, fontSize, bold) <= maxWidthPt) {
        current = word;
      } else {
        pushSplitWord(word);
      }
      continue;
    }

    const candidate = `${current} ${word}`;
    if (estimateTextWidth(candidate, fontSize, bold) <= maxWidthPt) {
      current = candidate;
    } else {
      lines.push(current);
      current = '';
      if (estimateTextWidth(word, fontSize, bold) <= maxWidthPt) {
        current = word;
      } else {
        pushSplitWord(word);
      }
    }
  }

  if (current) lines.push(current);
  return lines;
}

/**
 * Assembles an array of page command streams into a valid PDF 1.4 binary.
 * Standard Type1 fonts embedded:
 * /F1 Helvetica-Bold, /F2 Helvetica, /F3 Courier-Bold, /F4 Courier
 */
function assemblePdfBytes(
  pages: string[][],
  pageWidth: number,
  pageHeight: number
): Uint8Array {
  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  const catalogObjId = addObject('');
  const pagesObjId = addObject('');
  const font1Id = addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  );
  const font2Id = addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  );
  const font3Id = addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>'
  );
  const font4Id = addObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'
  );

  const pageObjIds: number[] = [];
  for (const commands of pages) {
    const streamContent = commands.join('\n');
    const contentObjId = addObject(
      `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`
    );
    const pageObjId = addObject(
      `<< /Type /Page /Parent ${pagesObjId} 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R /F3 ${font3Id} 0 R /F4 ${font4Id} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    pageObjIds.push(pageObjId);
  }

  objects[catalogObjId - 1] = `<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`;
  objects[pagesObjId - 1] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function slugifyFilename(value: string, fallback: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return slug || fallback;
}

function triggerPdfDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/pdf',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function appendSongPages(
  pages: string[][],
  song: Song,
  transposeOffset: number,
  lyricsOnly: boolean,
  pageWidth: number,
  pageHeight: number,
  kickerLabel?: string,
  startOnExistingPageAtY?: number,
  cifraStyle: CifraStyle = 'original',
  capoFret?: number
): number {
  const params = getEffectiveCifraParams(
    song,
    transposeOffset,
    cifraStyle,
    capoFret
  );
  const marginX = 42;
  const topY = pageHeight - 46;
  const bottomY = 44;

  let currentY: number;
  if (
    startOnExistingPageAtY !== undefined &&
    pages.length > 0 &&
    startOnExistingPageAtY - 120 >= bottomY
  ) {
    currentY = startOnExistingPageAtY;
  } else {
    pages.push([]);
    currentY = topY;
  }

  const currentStream = () => pages[pages.length - 1];
  const ensureSpace = (neededPt: number) => {
    if (currentY - neededPt < bottomY) {
      pages.push([]);
      currentY = topY;
    }
  };

  if (kickerLabel) {
    currentStream().push(
      `BT /F1 8.5 Tf 0.086 0.408 0.639 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(kickerLabel.toUpperCase())} Tj ET`
    );
    currentY -= 15;
  }

  const titlePrefix = song.number !== undefined ? `#${song.number} - ` : '';
  const fullTitle = `${titlePrefix}${song.title}`;
  const titleLines = wrapTextToWidth(fullTitle, pageWidth - marginX * 2, 16, true);
  for (const tLine of titleLines) {
    currentStream().push(
      `BT /F1 16 Tf 0.043 0.114 0.227 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(tLine)} Tj ET`
    );
    currentY -= 19;
  }

  const metaParts: string[] = [song.artist];
  if (song.originalKey !== '—' && !lyricsOnly) {
    if (params.style === 'capo') {
      metaParts.push(
        `Tom real: ${params.soundingKey}`,
        `Capo ${params.capoFret}ª casa (formas em ${params.fingeredKey})`
      );
    } else if (params.style === 'simplified') {
      metaParts.push(`Tom: ${params.soundingKey}`, 'Cifra Simplificada');
    } else {
      metaParts.push(`Tom: ${params.soundingKey}`);
    }
  }
  if (song.bpm && song.bpm > 0) {
    metaParts.push(`${song.bpm} BPM`);
  }
  metaParts.push(song.category);

  const metaLines = wrapTextToWidth(
    metaParts.join('  ·  '),
    pageWidth - marginX * 2,
    10,
    false
  );
  for (const mLine of metaLines) {
    currentStream().push(
      `BT /F2 10 Tf 0.275 0.357 0.471 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(mLine)} Tj ET`
    );
    currentY -= 12;
  }
  currentY += 2;

  currentStream().push(
    `0.843 0.886 0.941 RG 0.75 w ${marginX} ${currentY.toFixed(2)} m ${(pageWidth - marginX).toFixed(2)} ${currentY.toFixed(2)} l S`
  );
  currentY -= 18;

  if (lyricsOnly) {
    const stripped = stripChords(song.cifra);
    for (const line of stripped) {
      if (!line.trim()) {
        currentY -= 8;
        continue;
      }
      const isSection = /^\[.+\]$/.test(line.trim());
      if (isSection) {
        ensureSpace(26);
        currentY -= 4;
        const label = line.trim().replace(/^\[|\]$/g, '').toUpperCase();
        currentStream().push(
          `BT /F1 9.5 Tf 0.561 0.384 0.043 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(label)} Tj ET`
        );
        currentY -= 14;
      } else {
        ensureSpace(15);
        currentStream().push(
          `BT /F2 11 Tf 0.043 0.114 0.227 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(line)} Tj ET`
        );
        currentY -= 15;
      }
    }
  } else {
    const parsed = parseCifraLines(
      song.cifra,
      params.effectiveTransposeOffset,
      song.originalKey,
      params.simplify
    );
    for (let i = 0; i < parsed.length; i++) {
      const line = parsed[i];
      if (line.type === 'empty') {
        currentY -= 8;
        continue;
      }

      if (line.type === 'section') {
        ensureSpace(28);
        currentY -= 4;
        const label = line.raw.replace(/^\[|\]$/g, '').toUpperCase();
        currentStream().push(
          `BT /F1 9.5 Tf 0.086 0.408 0.639 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(label)} Tj ET`
        );
        currentY -= 13;
        continue;
      }

      if (line.type === 'chords') {
        const nextIsLyrics = i + 1 < parsed.length && parsed[i + 1].type === 'lyrics';
        ensureSpace(nextIsLyrics ? 26 : 13);
        currentStream().push(
          `BT /F3 10 Tf 0.561 0.384 0.043 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(line.raw)} Tj ET`
        );
        currentY -= 12;
        continue;
      }

      ensureSpace(14);
      currentStream().push(
        `BT /F4 10 Tf 0.043 0.114 0.227 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(line.raw)} Tj ET`
      );
      currentY -= 13.5;
    }
  }

  return currentY;
}

function wrapMultilineNote(
  note: string | undefined,
  maxWidthPt: number,
  fontSize: number
): string[] {
  if (!note || !note.trim()) return [];
  const paragraphs = note.split(/\r?\n/);
  const result: string[] = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      if (result.length > 0 && result[result.length - 1] !== '') {
        result.push('');
      }
      continue;
    }
    result.push(...wrapTextToWidth(trimmed, maxWidthPt, fontSize, false));
  }
  while (result.length > 0 && result[result.length - 1] === '') {
    result.pop();
  }
  return result;
}

/**
 * Generates a clean, multi-page A4 PDF binary (Uint8Array) of the song's chord sheet,
 * keeping monospace chord-over-syllable alignment and terracotta chord highlights.
 */
export function generateSongPdfBytes(
  song: Song,
  transposeOffset: number,
  lyricsOnly = false,
  cifraStyle: CifraStyle = 'original',
  capoFret?: number
): Uint8Array {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const pages: string[][] = [];
  appendSongPages(
    pages,
    song,
    transposeOffset,
    lyricsOnly,
    pageWidth,
    pageHeight,
    undefined,
    undefined,
    cifraStyle,
    capoFret
  );
  return assemblePdfBytes(pages, pageWidth, pageHeight);
}

export function downloadSongPdf(
  song: Song,
  transposeOffset: number,
  lyricsOnly = false,
  cifraStyle: CifraStyle = 'original',
  capoFret?: number
): void {
  const params = getEffectiveCifraParams(
    song,
    transposeOffset,
    cifraStyle,
    capoFret
  );
  const bytes = generateSongPdfBytes(
    song,
    transposeOffset,
    lyricsOnly,
    params.style,
    params.capoFret
  );
  const safeSlug = slugifyFilename(song.title, 'musica');
  const numPrefix = song.number !== undefined ? `${song.number}-` : '';
  const styleSuffix =
    !lyricsOnly && params.style === 'simplified'
      ? '-simplificada'
      : !lyricsOnly && params.style === 'capo'
        ? `-capo-${params.capoFret}`
        : '';
  triggerPdfDownload(bytes, `cifra-${numPrefix}${safeSlug}${styleSuffix}.pdf`);
}

/**
 * Generates an A4 Portrait PDF for "Culto do Dia":
 * - Page 1: Clean setlist summary including songs (with exact key & cifra style) AND custom service moments/intervals in order.
 * - If includeChords = true: appends full transposed chord sheets in each song's chosen style and every moment/interval block in exact chronological order.
 */
export function generatePlaylistPdfBytes(
  playlistTitle: string,
  items: PlaylistItem[],
  songsById: Map<string, Song>,
  includeChords = false
): Uint8Array {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 42;
  const contentWidth = pageWidth - marginX * 2;
  const topY = pageHeight - 48;
  const bottomY = 48;

  type ResolvedPdfEntry =
    | {
        kind: 'song';
        song: Song;
        transposeOffset: number;
        activeKey: string;
        cifraStyle: CifraStyle;
        capoFret: number;
        styleSummaryLabel: string;
        songOrder: number;
      }
    | {
        kind: 'moment';
        title: string;
        note: string;
      };

  const resolved: ResolvedPdfEntry[] = [];
  let songCounter = 0;
  let momentCounter = 0;

  for (const item of items) {
    if (item.kind === 'moment') {
      momentCounter++;
      resolved.push({
        kind: 'moment',
        title: item.title.trim() || 'Momento / Intervalo no Culto',
        note: (item.note ?? '').trim(),
      });
      continue;
    }

    const song = songsById.get(item.songId);
    if (!song) continue;
    songCounter++;
    const params = getEffectiveCifraParams(
      song,
      item.transposeOffset,
      item.cifraStyle,
      item.capoFret
    );
    const styleSummaryLabel =
      params.soundingKey === '—'
        ? 'Só letra'
        : params.style === 'simplified'
          ? 'Cifra Simplificada'
          : params.style === 'capo'
            ? `Capo ${params.capoFret}ª casa (formas em ${params.fingeredKey})`
            : 'Cifra Completa';
    resolved.push({
      kind: 'song',
      song,
      transposeOffset: item.transposeOffset,
      activeKey: params.soundingKey,
      cifraStyle: params.style,
      capoFret: params.capoFret,
      styleSummaryLabel,
      songOrder: songCounter,
    });
  }

  const pages: string[][] = [[]];
  let currentY = topY;
  const currentStream = () => pages[pages.length - 1];

  const ensureSpace = (neededPt: number) => {
    if (currentY - neededPt < bottomY) {
      pages.push([]);
      currentY = topY;
    }
  };

  // Header brand kicker
  currentStream().push(
    `BT /F1 9.5 Tf 0.086 0.408 0.639 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString('LOUVOR IEB HORTA  ·  ORDEM DO CULTO')} Tj ET`
  );
  currentY -= 20;

  const mainTitle = sanitizePdfText(playlistTitle) || 'Culto do Dia';
  const titleLines = wrapTextToWidth(mainTitle, contentWidth, 18, true);
  for (const line of titleLines) {
    currentStream().push(
      `BT /F1 18 Tf 0.043 0.114 0.227 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(line)} Tj ET`
    );
    currentY -= 22;
  }

  const todayStr = new Date().toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const countParts = [
    `${songCounter} ${songCounter === 1 ? 'música' : 'músicas'}`,
  ];
  if (momentCounter > 0) {
    countParts.push(
      `${momentCounter} ${momentCounter === 1 ? 'momento' : 'momentos'}`
    );
  }
  const summarySubtitle = `${countParts.join('  ·  ')}  ·  ${
    includeChords ? 'Lista + Cifras completas' : 'Lista do culto'
  }  ·  Gerado a ${todayStr}`;
  currentStream().push(
    `BT /F2 9.5 Tf 0.275 0.357 0.471 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(summarySubtitle)} Tj ET`
  );
  currentY -= 12;

  // IEBH Deep Navy & Gold accent rule
  currentStream().push(
    `0.043 0.114 0.227 RG 1.4 w ${marginX} ${currentY.toFixed(2)} m ${(pageWidth - marginX).toFixed(2)} ${currentY.toFixed(2)} l S`
  );
  currentY -= 20;

  if (resolved.length === 0) {
    currentStream().push(
      `BT /F2 11 Tf 0.275 0.357 0.471 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString('Nenhum item adicionado à lista deste culto.')} Tj ET`
    );
  } else {
    resolved.forEach((entry, idx) => {
      if (entry.kind === 'moment') {
        const momentTitleLines = wrapTextToWidth(
          entry.title,
          contentWidth - 28,
          11.5,
          true
        );
        const noteLines = wrapMultilineNote(entry.note, contentWidth - 28, 9.5);
        const noteHeight = noteLines.reduce(
          (acc, l) => acc + (l === '' ? 6 : 13),
          0
        );
        const boxHeight =
          18 +
          momentTitleLines.length * 14.5 +
          (noteLines.length > 0 ? 4 + noteHeight : 0) +
          10;

        ensureSpace(boxHeight + 8);

        const boxBottom = currentY - boxHeight + 10;
        currentStream().push(
          `0.922 0.961 0.996 rg ${marginX} ${boxBottom.toFixed(2)} ${contentWidth.toFixed(2)} ${boxHeight.toFixed(2)} re f`
        );
        currentStream().push(
          `0.086 0.408 0.639 RG 0.8 w ${marginX} ${boxBottom.toFixed(2)} ${contentWidth.toFixed(2)} ${boxHeight.toFixed(2)} re S`
        );

        let textY = currentY - 3;
        currentStream().push(
          `BT /F1 8 Tf 0.086 0.408 0.639 rg ${(marginX + 12).toFixed(2)} ${textY.toFixed(2)} Td ${encodePdfString('MOMENTO / INTERVALO DO CULTO')} Tj ET`
        );
        textY -= 14;

        for (const tLine of momentTitleLines) {
          currentStream().push(
            `BT /F1 11.5 Tf 0.043 0.114 0.227 rg ${(marginX + 12).toFixed(2)} ${textY.toFixed(2)} Td ${encodePdfString(tLine)} Tj ET`
          );
          textY -= 14.5;
        }

        if (noteLines.length > 0) {
          textY -= 2;
          for (const nLine of noteLines) {
            if (nLine === '') {
              textY -= 6;
              continue;
            }
            currentStream().push(
              `BT /F2 9.5 Tf 0.200 0.282 0.396 rg ${(marginX + 12).toFixed(2)} ${textY.toFixed(2)} Td ${encodePdfString(nLine)} Tj ET`
            );
            textY -= 13;
          }
        }

        currentY -= boxHeight + 8;
        return;
      }

      const orderStr = String(entry.songOrder).padStart(2, '0');
      const titlePrefix = entry.song.number !== undefined ? `#${entry.song.number} ` : '';
      const songTitleLines = wrapTextToWidth(
        `${titlePrefix}${entry.song.title}`,
        contentWidth - 115,
        12,
        true
      );

      const metaParts = [entry.song.artist];
      if (entry.activeKey !== '—') {
        metaParts.push(entry.styleSummaryLabel);
      }
      if (entry.transposeOffset !== 0) {
        const sign = entry.transposeOffset > 0 ? '+' : '';
        metaParts.push(`Transposição: ${sign}${entry.transposeOffset} st`);
      }
      if (entry.song.bpm && entry.song.bpm > 0) {
        metaParts.push(`${entry.song.bpm} BPM`);
      }
      metaParts.push(entry.song.category);

      const songMetaLines = wrapTextToWidth(
        metaParts.join('  ·  '),
        contentWidth - 48,
        9.5,
        false
      );

      const rowHeight = Math.max(
        40,
        songTitleLines.length * 15 + songMetaLines.length * 12 + 10
      );
      ensureSpace(rowHeight + 6);

      if (idx % 2 === 1) {
        currentStream().push(
          `0.957 0.973 0.988 rg ${marginX} ${(currentY - rowHeight + 10).toFixed(2)} ${contentWidth.toFixed(2)} ${rowHeight.toFixed(2)} re f`
        );
      }

      currentStream().push(
        `BT /F3 12 Tf 0.086 0.408 0.639 rg ${(marginX + 8).toFixed(2)} ${(currentY - 4).toFixed(2)} Td ${encodePdfString(orderStr)} Tj ET`
      );

      const keyDisplay =
        entry.activeKey === '—' ? 'Letra' : `Tom: ${entry.activeKey}`;
      const keyWidth = estimateTextWidth(keyDisplay, 11, true);
      currentStream().push(
        `BT /F1 11 Tf 0.561 0.384 0.043 rg ${(pageWidth - marginX - keyWidth - 8).toFixed(2)} ${(currentY - 4).toFixed(2)} Td ${encodePdfString(keyDisplay)} Tj ET`
      );

      let titleY = currentY - 4;
      for (const tLine of songTitleLines) {
        currentStream().push(
          `BT /F1 12 Tf 0.043 0.114 0.227 rg ${(marginX + 36).toFixed(2)} ${titleY.toFixed(2)} Td ${encodePdfString(tLine)} Tj ET`
        );
        titleY -= 15;
      }

      let metaY = titleY + 1;
      for (const mLine of songMetaLines) {
        currentStream().push(
          `BT /F2 9.5 Tf 0.275 0.357 0.471 rg ${(marginX + 36).toFixed(2)} ${metaY.toFixed(2)} Td ${encodePdfString(mLine)} Tj ET`
        );
        metaY -= 12;
      }

      currentY -= rowHeight;

      currentStream().push(
        `0.843 0.886 0.941 RG 0.5 w ${marginX} ${(currentY + 10).toFixed(2)} m ${(pageWidth - marginX).toFixed(2)} ${(currentY + 10).toFixed(2)} l S`
      );
    });
  }

  // Append full chord sheets and all moments/intervals chronologically when includeChords = true
  if (includeChords && resolved.length > 0) {
    let bookletPageHasSong = true; // Page 1 (index 0) is summary -> force new page before booklet starts
    let bookletY = bottomY;

    const renderBookletMoment = (
      moment: Extract<ResolvedPdfEntry, { kind: 'moment' }>,
      contextKicker: string
    ) => {
      const mTitleLines = wrapTextToWidth(
        moment.title,
        contentWidth - 28,
        13,
        true
      );
      const mNoteLines = wrapMultilineNote(moment.note, contentWidth - 28, 10.5);
      const noteHeight = mNoteLines.reduce(
        (acc, l) => acc + (l === '' ? 6 : 14),
        0
      );
      const boxHeight =
        22 +
        mTitleLines.length * 16 +
        (mNoteLines.length > 0 ? 5 + noteHeight : 0) +
        12;

      if (pages.length <= 1 || bookletY - boxHeight - 10 < bottomY) {
        pages.push([]);
        bookletY = pageHeight - 46;
        bookletPageHasSong = false;
      } else {
        bookletY -= 12;
      }

      const stream = pages[pages.length - 1];
      const boxBottom = bookletY - boxHeight + 8;

      stream.push(
        `0.922 0.961 0.996 rg ${marginX} ${boxBottom.toFixed(2)} ${contentWidth.toFixed(2)} ${boxHeight.toFixed(2)} re f`
      );
      stream.push(
        `0.086 0.408 0.639 RG 1 w ${marginX} ${boxBottom.toFixed(2)} ${contentWidth.toFixed(2)} ${boxHeight.toFixed(2)} re S`
      );

      let textY = bookletY - 6;
      stream.push(
        `BT /F1 8.5 Tf 0.086 0.408 0.639 rg ${(marginX + 14).toFixed(2)} ${textY.toFixed(2)} Td ${encodePdfString(contextKicker.toUpperCase())} Tj ET`
      );
      textY -= 16;

      for (const tLine of mTitleLines) {
        stream.push(
          `BT /F1 13 Tf 0.043 0.114 0.227 rg ${(marginX + 14).toFixed(2)} ${textY.toFixed(2)} Td ${encodePdfString(tLine)} Tj ET`
        );
        textY -= 16;
      }

      if (mNoteLines.length > 0) {
        textY -= 3;
        for (const nLine of mNoteLines) {
          if (nLine === '') {
            textY -= 6;
            continue;
          }
          stream.push(
            `BT /F2 10.5 Tf 0.200 0.282 0.396 rg ${(marginX + 14).toFixed(2)} ${textY.toFixed(2)} Td ${encodePdfString(nLine)} Tj ET`
          );
          textY -= 14;
        }
      }

      bookletY = boxBottom - 16;
    };

    resolved.forEach((entry, idx) => {
      if (entry.kind === 'moment') {
        const hasPrevSong = resolved.slice(0, idx).some((e) => e.kind === 'song');
        const nextSong = resolved
          .slice(idx + 1)
          .find((e): e is Extract<ResolvedPdfEntry, { kind: 'song' }> => e.kind === 'song');
        const contextLabel = !hasPrevSong
          ? 'Momento Inicial do Culto'
          : nextSong
            ? `Intervalo no Culto (Antes da Música ${nextSong.songOrder})`
            : 'Momento Final do Culto';
        renderBookletMoment(entry, contextLabel);
        return;
      }

      const kicker = `${mainTitle}  ·  Música ${entry.songOrder} de ${songCounter}`;
      bookletY = appendSongPages(
        pages,
        entry.song,
        entry.transposeOffset,
        false,
        pageWidth,
        pageHeight,
        kicker,
        !bookletPageHasSong ? bookletY : undefined,
        entry.cifraStyle,
        entry.capoFret
      );
      bookletPageHasSong = true;
    });
  }

  // Add subtle page footer numbers across all pages
  const totalPages = pages.length;
  for (let p = 0; p < totalPages; p++) {
    const footer = `Louvor IEB Horta  ·  Página ${p + 1} de ${totalPages}`;
    const footerWidth = estimateTextWidth(footer, 8, false);
    pages[p].push(
      `BT /F2 8 Tf 0.55 0.60 0.68 rg ${((pageWidth - footerWidth) / 2).toFixed(2)} 24 Td ${encodePdfString(footer)} Tj ET`
    );
  }

  return assemblePdfBytes(pages, pageWidth, pageHeight);
}

export function downloadPlaylistPdf(
  playlistTitle: string,
  items: PlaylistItem[],
  songsById: Map<string, Song>,
  includeChords = false
): void {
  const bytes = generatePlaylistPdfBytes(
    playlistTitle,
    items,
    songsById,
    includeChords
  );
  const slug = slugifyFilename(playlistTitle, 'culto-do-dia');
  const suffix = includeChords ? '-com-cifras' : '';
  triggerPdfDownload(bytes, `culto-${slug}${suffix}.pdf`);
}

export interface SchedulePdfFilters {
  month?: string;
  day?: string;
  member?: string;
}

/**
 * Generates an A4 Landscape PDF table of the Worship Team Schedule ("Escala"),
 * matching the IEBH Deep Navy header aesthetic (#0B1D3A) and supporting dynamic roles & filters.
 */
export function generateSchedulePdfBytes(
  entries: ScheduleEntry[],
  roles: ScheduleRole[],
  filters: SchedulePdfFilters = {}
): Uint8Array {
  // A4 Landscape
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const marginX = 28;
  const tableWidth = pageWidth - marginX * 2; // 785.89pt
  const topY = pageHeight - 36;
  const bottomY = 38;

  const activeMonth = filters.month && filters.month !== 'Todos' ? filters.month : 'Todos os meses';
  const activeDay = filters.day && filters.day !== 'Todas' ? `Dia ${filters.day}` : '';
  const activeMember = filters.member && filters.member !== 'Todos' ? filters.member : '';
  const highlightedMember = filters.member && filters.member !== 'Todos'
    ? filters.member.trim().toLowerCase()
    : null;

  const filterSummaryParts = [activeMonth];
  if (activeDay) filterSummaryParts.push(activeDay);
  if (activeMember) filterSummaryParts.push(`Elemento: ${activeMember}`);
  filterSummaryParts.push(`${entries.length} ${entries.length === 1 ? 'culto' : 'cultos'}`);

  // Compute responsive column widths
  const totalCols = 4 + roles.length;
  const bodyFontSize = totalCols > 12 ? 7.5 : 8.5;
  const headerFontSize = totalCols > 12 ? 7.5 : 8.5;
  const cellPadX = 5;
  const lineHeight = bodyFontSize + 2.8;

  const coreBase = totalCols > 12
    ? { month: 46, day: 30, passage: 64, theme: 98 }
    : { month: 54, day: 34, passage: 76, theme: 118 };

  const coreTotal = coreBase.month + coreBase.day + coreBase.passage + coreBase.theme;
  const remainingForRoles = Math.max(120, tableWidth - coreTotal);
  const roleWidth = roles.length > 0 ? remainingForRoles / roles.length : 0;

  interface PdfColumn {
    label: string;
    width: number;
    align: 'left' | 'center';
    getValue: (e: ScheduleEntry) => string;
  }

  const columns: PdfColumn[] = [
    { label: 'Mês', width: coreBase.month, align: 'left', getValue: (e) => e.month || '—' },
    { label: 'Data', width: coreBase.day, align: 'center', getValue: (e) => e.day || '—' },
    { label: 'Passagem', width: coreBase.passage, align: 'left', getValue: (e) => e.passage || '—' },
    { label: 'Tema', width: coreBase.theme, align: 'left', getValue: (e) => e.theme || '—' },
    ...roles.map((r): PdfColumn => ({
      label: r.label,
      width: roleWidth,
      align: 'center',
      getValue: (e) => (e.assignments[r.id] ?? '').trim() || '—',
    })),
  ];

  const pages: string[][] = [[]];
  let currentY = topY;
  const currentStream = () => pages[pages.length - 1];

  const drawPageTitleHeader = (isContinuation: boolean) => {
    const title = isContinuation
      ? 'Louvor IEB Horta  ·  Escala do Grupo de Louvor (continuação)'
      : 'Louvor IEB Horta  ·  Escala do Grupo de Louvor';
    currentStream().push(
      `BT /F1 13.5 Tf 0.043 0.114 0.227 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(title)} Tj ET`
    );
    currentY -= 15;

    const todayStr = new Date().toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const subtitle = `Filtro: ${filterSummaryParts.join('  ·  ')}  ·  Emitido a ${todayStr}`;
    currentStream().push(
      `BT /F2 8.5 Tf 0.275 0.357 0.471 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(subtitle)} Tj ET`
    );
    currentY -= 12;
  };

  const drawTableHeader = () => {
    // Wrap header labels if narrow
    const headerWrapped = columns.map((col) => {
      const lines = wrapTextToWidth(col.label, col.width - cellPadX * 2, headerFontSize, true);
      return lines.length > 0 ? lines : [col.label];
    });
    const maxHeaderLines = Math.max(1, ...headerWrapped.map((l) => l.length));
    const headerHeight = Math.max(22, maxHeaderLines * (headerFontSize + 2.5) + 8);

    // Solid IEBH Deep Navy header background (#0B1D3A)
    currentStream().push(
      `0.043 0.114 0.227 rg ${marginX} ${(currentY - headerHeight).toFixed(2)} ${tableWidth.toFixed(2)} ${headerHeight.toFixed(2)} re f`
    );

    let cursorX = marginX;
    columns.forEach((col, cIdx) => {
      const lines = headerWrapped[cIdx];
      const textBlockHeight = lines.length * (headerFontSize + 2);
      let textY = currentY - (headerHeight - textBlockHeight) / 2 - headerFontSize + 1.5;

      for (const line of lines) {
        const lineW = estimateTextWidth(line, headerFontSize, true);
        const textX =
          col.align === 'center'
            ? cursorX + Math.max(cellPadX, (col.width - lineW) / 2)
            : cursorX + cellPadX;
        currentStream().push(
          `BT /F1 ${headerFontSize} Tf 1 1 1 rg ${textX.toFixed(2)} ${textY.toFixed(2)} Td ${encodePdfString(line)} Tj ET`
        );
        textY -= headerFontSize + 2;
      }

      // Vertical column border inside header
      if (cIdx > 0) {
        currentStream().push(
          `0.122 0.231 0.408 RG 0.5 w ${cursorX.toFixed(2)} ${currentY.toFixed(2)} m ${cursorX.toFixed(2)} ${(currentY - headerHeight).toFixed(2)} l S`
        );
      }
      cursorX += col.width;
    });

    currentY -= headerHeight;
  };

  drawPageTitleHeader(false);
  drawTableHeader();

  if (entries.length === 0) {
    const emptyH = 34;
    currentStream().push(
      `0.957 0.973 0.988 rg ${marginX} ${(currentY - emptyH).toFixed(2)} ${tableWidth.toFixed(2)} ${emptyH.toFixed(2)} re f`
    );
    currentStream().push(
      `0.843 0.886 0.941 RG 0.5 w ${marginX} ${(currentY - emptyH).toFixed(2)} ${tableWidth.toFixed(2)} ${emptyH.toFixed(2)} re S`
    );
    currentStream().push(
      `BT /F2 9.5 Tf 0.275 0.357 0.471 rg ${(marginX + 10).toFixed(2)} ${(currentY - 21).toFixed(2)} Td ${encodePdfString('Nenhuma data encontrada para os filtros selecionados.')} Tj ET`
    );
  } else {
    entries.forEach((entry, rowIdx) => {
      const cellLines = columns.map((col, cIdx) => {
        const rawVal = col.getValue(entry);
        const isBoldCol = cIdx === 0 || cIdx === 1;
        const lines = wrapTextToWidth(
          rawVal,
          col.width - cellPadX * 2,
          bodyFontSize,
          isBoldCol
        );
        return lines.length > 0 ? lines : ['—'];
      });

      const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowHeight = Math.max(20, maxLines * lineHeight + 8);

      if (currentY - rowHeight < bottomY) {
        pages.push([]);
        currentY = topY;
        drawPageTitleHeader(true);
        drawTableHeader();
      }

      // Alternating row fill (#F4F8FC on odd rows, crisp white on even)
      if (rowIdx % 2 === 1) {
        currentStream().push(
          `0.957 0.973 0.988 rg ${marginX} ${(currentY - rowHeight).toFixed(2)} ${tableWidth.toFixed(2)} ${rowHeight.toFixed(2)} re f`
        );
      } else {
        currentStream().push(
          `1 1 1 rg ${marginX} ${(currentY - rowHeight).toFixed(2)} ${tableWidth.toFixed(2)} ${rowHeight.toFixed(2)} re f`
        );
      }

      let cursorX = marginX;
      columns.forEach((col, cIdx) => {
        const rawVal = col.getValue(entry);
        const isHighlighted =
          highlightedMember !== null &&
          cIdx >= 4 &&
          rawVal.trim().toLowerCase() === highlightedMember;

        if (isHighlighted) {
          currentStream().push(
            `0.984 0.957 0.875 rg ${cursorX.toFixed(2)} ${(currentY - rowHeight).toFixed(2)} ${col.width.toFixed(2)} ${rowHeight.toFixed(2)} re f`
          );
        }

        const lines = cellLines[cIdx];
        const useBold = cIdx <= 1 || isHighlighted;
        const fontTag = useBold ? '/F1' : '/F2';
        const colorCmd = isHighlighted
          ? '0.561 0.384 0.043 rg'
          : cIdx === 2 || cIdx === 3
            ? '0.200 0.282 0.396 rg'
            : '0.043 0.114 0.227 rg';

        const blockHeight = lines.length * lineHeight;
        let textY = currentY - (rowHeight - blockHeight) / 2 - bodyFontSize + 1.5;

        for (const line of lines) {
          const lineW = estimateTextWidth(line, bodyFontSize, useBold);
          const textX =
            col.align === 'center'
              ? cursorX + Math.max(cellPadX, (col.width - lineW) / 2)
              : cursorX + cellPadX;
          currentStream().push(
            `BT ${fontTag} ${bodyFontSize} Tf ${colorCmd} ${textX.toFixed(2)} ${textY.toFixed(2)} Td ${encodePdfString(line)} Tj ET`
          );
          textY -= lineHeight;
        }

        // Cell grid border
        currentStream().push(
          `0.843 0.886 0.941 RG 0.45 w ${cursorX.toFixed(2)} ${currentY.toFixed(2)} m ${cursorX.toFixed(2)} ${(currentY - rowHeight).toFixed(2)} l S`
        );
        cursorX += col.width;
      });

      // Outer right border + bottom row border
      currentStream().push(
        `0.843 0.886 0.941 RG 0.45 w ${(marginX + tableWidth).toFixed(2)} ${currentY.toFixed(2)} m ${(marginX + tableWidth).toFixed(2)} ${(currentY - rowHeight).toFixed(2)} l S`
      );
      currentStream().push(
        `0.843 0.886 0.941 RG 0.45 w ${marginX} ${(currentY - rowHeight).toFixed(2)} m ${(marginX + tableWidth).toFixed(2)} ${(currentY - rowHeight).toFixed(2)} l S`
      );

      currentY -= rowHeight;
    });
  }

  // Footer across pages
  const totalPages = pages.length;
  for (let p = 0; p < totalPages; p++) {
    const footer = `Louvor IEB Horta  ·  Escala de Louvor  ·  Página ${p + 1} de ${totalPages}`;
    const footerW = estimateTextWidth(footer, 8, false);
    pages[p].push(
      `BT /F2 8 Tf 0.420 0.510 0.631 rg ${((pageWidth - footerW) / 2).toFixed(2)} 18 Td ${encodePdfString(footer)} Tj ET`
    );
  }

  return assemblePdfBytes(pages, pageWidth, pageHeight);
}

export function downloadSchedulePdf(
  entries: ScheduleEntry[],
  roles: ScheduleRole[],
  filters: SchedulePdfFilters = {}
): void {
  const bytes = generateSchedulePdfBytes(entries, roles, filters);
  const parts = ['escala-louvor-ieb-horta'];
  if (filters.month && filters.month !== 'Todos') {
    parts.push(slugifyFilename(filters.month, 'mes'));
  }
  if (filters.member && filters.member !== 'Todos') {
    parts.push(slugifyFilename(filters.member, 'elemento'));
  }
  triggerPdfDownload(bytes, `${parts.join('-')}.pdf`);
}
