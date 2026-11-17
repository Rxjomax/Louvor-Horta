import { Song } from '../types/music';
import { parseCifraLines, stripChords, transposeKey } from './chords';

/**
 * Encodes a Unicode string into WinAnsi (Windows-1252 / Latin-1) escaped octals
 * for standard PDF Type1 fonts (Helvetica, Courier), preserving Portuguese accents.
 */
function encodePdfString(text: string): string {
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

/**
 * Generates a clean, multi-page A4 PDF binary (Uint8Array) of the song's chord sheet,
 * keeping monospace chord-over-syllable alignment and terracotta chord highlights.
 */
export function generateSongPdfBytes(
  song: Song,
  transposeOffset: number,
  lyricsOnly = false
): Uint8Array {
  const activeKey = transposeKey(song.originalKey, transposeOffset);
  const pageWidth = 595.28; // A4 width in pt
  const pageHeight = 841.89; // A4 height in pt
  const marginX = 42;
  const topY = pageHeight - 46;
  const bottomY = 44;

  const pages: string[][] = [[]];
  let currentY = topY;

  const currentStream = () => pages[pages.length - 1];

  const ensureSpace = (neededPt: number) => {
    if (currentY - neededPt < bottomY) {
      pages.push([]);
      currentY = topY;
    }
  };

  // Document Header on Page 1
  const titlePrefix = song.number !== undefined ? `#${song.number} - ` : '';
  const fullTitle = `${titlePrefix}${song.title}`;
  currentStream().push(
    `BT /F1 16 Tf 0.06 0.09 0.16 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(fullTitle)} Tj ET`
  );
  currentY -= 18;

  const metaParts: string[] = [song.artist];
  if (song.originalKey !== '—' && !lyricsOnly) {
    metaParts.push(`Tom: ${activeKey}`);
  }
  if (song.bpm && song.bpm > 0) {
    metaParts.push(`${song.bpm} BPM`);
  }
  metaParts.push(song.category);

  currentStream().push(
    `BT /F2 10 Tf 0.39 0.45 0.55 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(metaParts.join('  ·  '))} Tj ET`
  );
  currentY -= 10;

  // Thin 1pt divider line
  currentStream().push(
    `0.82 0.84 0.88 RG 0.75 w ${marginX} ${currentY.toFixed(2)} m ${(pageWidth - marginX).toFixed(2)} ${currentY.toFixed(2)} l S`
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
          `BT /F1 9.5 Tf 0.72 0.33 0.08 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(label)} Tj ET`
        );
        currentY -= 14;
      } else {
        ensureSpace(15);
        currentStream().push(
          `BT /F2 11 Tf 0.06 0.09 0.16 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(line)} Tj ET`
        );
        currentY -= 15;
      }
    }
  } else {
    const parsed = parseCifraLines(song.cifra, transposeOffset, song.originalKey);
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
          `BT /F1 9.5 Tf 0.39 0.45 0.55 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(label)} Tj ET`
        );
        currentY -= 13;
        continue;
      }

      if (line.type === 'chords') {
        // Keep chord line together with its following lyric line across page breaks
        const nextIsLyrics = i + 1 < parsed.length && parsed[i + 1].type === 'lyrics';
        ensureSpace(nextIsLyrics ? 26 : 13);
        currentStream().push(
          `BT /F3 10 Tf 0.72 0.33 0.08 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(line.raw)} Tj ET`
        );
        currentY -= 12;
        continue;
      }

      ensureSpace(14);
      currentStream().push(
        `BT /F4 10 Tf 0.06 0.09 0.16 rg ${marginX} ${currentY.toFixed(2)} Td ${encodePdfString(line.raw)} Tj ET`
      );
      currentY -= 13.5;
    }
  }

  // Assemble PDF objects
  // Obj 1: Catalog, Obj 2: Pages, Obj 3..6: Fonts (/F1 Helvetica-Bold, /F2 Helvetica, /F3 Courier-Bold, /F4 Courier)
  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  const catalogObjId = addObject(''); // placeholder 1
  const pagesObjId = addObject(''); // placeholder 2
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

export function downloadSongPdf(
  song: Song,
  transposeOffset: number,
  lyricsOnly = false
): void {
  const bytes = generateSongPdfBytes(song, transposeOffset, lyricsOnly);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const safeSlug = song.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const numPrefix = song.number !== undefined ? `${song.number}-` : '';
  const a = document.createElement('a');
  a.href = url;
  a.download = `cifra-${numPrefix}${safeSlug || 'musica'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
