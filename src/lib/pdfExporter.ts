import type { PrintableMemoData } from '../components/MemoA4PrintSheet';
import { formatDateAr } from './fileParser';

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function isSubheadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 90) return false;
  if (/^[-•*]\s+/.test(trimmed)) return false;
  return (
    trimmed.endsWith(':') ||
    trimmed.endsWith('：') ||
    /^(\d+[\.\-\)]|أولاً|ثانياً|ثالثاً|رابعاً|خامساً|سادساً|الموضوع|الملخص|التوصيات|النتائج|الملاحظات|القرار|المطلوب|أبرز المهام)/i.test(
      trimmed
    )
  );
}

function wrapTextRtl(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [''];
  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        current = '';
      }
      // Handle ultra-long single tokens
      if (ctx.measureText(word).width > maxWidth) {
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width <= maxWidth) {
            chunk += ch;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function buildPdfFromJpegPages(
  pages: Array<{ jpegBytes: Uint8Array; pixelW: number; pixelH: number }>
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const offsets: number[] = [0]; // index 0 unused

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const pushStr = (str: string) => {
    pushBytes(encoder.encode(str));
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Object numbering:
  // 1 = Catalog
  // 2 = Pages
  // For page i (0..N-1):
  //   pageObj = 3 + i * 3
  //   contentObj = 4 + i * 3
  //   imageObj = 5 + i * 3
  const pageObjIds = pages.map((_, i) => 3 + i * 3);

  const startObj = (id: number) => {
    offsets[id] = byteLength;
    pushStr(`${id} 0 obj\n`);
  };
  const endObj = () => {
    pushStr('\nendobj\n');
  };

  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  startObj(2);
  pushStr(
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  );
  endObj();

  // A4 dimensions in PDF points: 595.28 x 841.89
  const pdfW = '595.28';
  const pdfH = '841.89';

  pages.forEach((p, idx) => {
    const pageId = 3 + idx * 3;
    const contentId = 4 + idx * 3;
    const imageId = 5 + idx * 3;

    startObj(pageId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    endObj();

    const drawCmd = `q\n${pdfW} 0 0 ${pdfH} 0 0 cm\n/Im0 Do\nQ\n`;
    const drawBytes = encoder.encode(drawCmd);
    startObj(contentId);
    pushStr(`<< /Length ${drawBytes.length} >>\nstream\n`);
    pushBytes(drawBytes);
    pushStr('endstream');
    endObj();

    startObj(imageId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${p.pixelW} /Height ${p.pixelH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.length} >>\nstream\n`
    );
    pushBytes(p.jpegBytes);
    pushStr('\nendstream');
    endObj();
  });

  const xrefOffset = byteLength;
  const totalObjects = 2 + pages.length * 3;
  pushStr(`xref\n0 ${totalObjects + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjects; id++) {
    const off = String(offsets[id] || 0).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  const merged = new Uint8Array(byteLength);
  let pos = 0;
  for (const c of chunks) {
    merged.set(c, pos);
    pos += c.length;
  }
  return new Blob([merged], { type: 'application/pdf' });
}

export async function generateMemoPdfBlob(memo: PrintableMemoData): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness check failure
    }
  }

  // A4 at ~150 DPI (sharp text & crisp borders)
  const W = 1240;
  const H = 1754;
  const OUTER_MARGIN = 48;
  const INNER_PADDING = 44;
  const CONTENT_LEFT = OUTER_MARGIN + INNER_PADDING;
  const CONTENT_RIGHT = W - OUTER_MARGIN - INNER_PADDING;
  const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
  const FOOTER_TOP = H - OUTER_MARGIN - 84;
  const BODY_MAX_Y = FOOTER_TOP - 28;

  const isDraft = memo.headerMode === 'draft';
  const accentHex = isDraft ? '#047857' : '#1D4ED8';
  const accentSoftHex = isDraft ? '#ECFDF5' : '#EFF6FF';
  const accentBorderHex = isDraft ? '#A7F3D0' : '#BFDBFE';

  const pages: Array<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> = [];

  const createPageCanvas = (pageIndex: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.direction = 'rtl';

    // White sheet background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Outer double border frame matching the app sheet
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(OUTER_MARGIN, OUTER_MARGIN, W - OUTER_MARGIN * 2, H - OUTER_MARGIN * 2);

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      OUTER_MARGIN + 8,
      OUTER_MARGIN + 8,
      W - (OUTER_MARGIN + 8) * 2,
      H - (OUTER_MARGIN + 8) * 2
    );

    // Top Executive Accent Bar inside frame
    ctx.fillStyle = accentHex;
    ctx.fillRect(OUTER_MARGIN + 9, OUTER_MARGIN + 9, W - (OUTER_MARGIN + 9) * 2, 10);

    // Continuation header on subsequent pages
    if (pageIndex > 0) {
      ctx.fillStyle = '#475569';
      ctx.font = '700 20px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        `شركة الدقهلية لصناعة وتكرير السكر — تابع: ${(memo.title || 'مذكرة عمل').slice(0, 55)}`,
        CONTENT_RIGHT,
        OUTER_MARGIN + 54
      );
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(CONTENT_LEFT, OUTER_MARGIN + 72);
      ctx.lineTo(CONTENT_RIGHT, OUTER_MARGIN + 72);
      ctx.stroke();
    }

    return { canvas, ctx };
  };

  const drawFooter = (
    ctx: CanvasRenderingContext2D,
    pageNum: number,
    totalPages: number
  ) => {
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(CONTENT_LEFT, FOOTER_TOP);
    ctx.lineTo(CONTENT_RIGHT, FOOTER_TOP);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '600 18px "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      'إدارة البيئة والسلامة المهنية — السكرتارية',
      CONTENT_RIGHT,
      FOOTER_TOP + 34
    );

    ctx.textAlign = 'left';
    ctx.fillText(
      'د. أيمن عبد الحميد — مدير عام البيئة والسلامة المهنية',
      CONTENT_LEFT,
      FOOTER_TOP + 34
    );

    if (totalPages > 1) {
      ctx.fillStyle = '#64748B';
      ctx.font = '600 16px "IBM Plex Mono", "IBM Plex Sans Arabic", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`صفحة ${pageNum} من ${totalPages}`, W / 2, FOOTER_TOP + 60);
    }
  };

  let currentPage = createPageCanvas(0);
  pages.push(currentPage);
  let { ctx } = currentPage;
  let y = OUTER_MARGIN + 58;

  // --- HEADER BAND ON PAGE 1 ---
  // Right Side: Company & Department Brand
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 30px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('شركة الدقهلية لصناعة وتكرير السكر', CONTENT_RIGHT, y);

  ctx.fillStyle = accentHex;
  ctx.font = '700 22px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(
    isDraft
      ? 'إدارة البيئة — مسودة عمل'
      : 'الإدارة العامة للبيئة والسلامة المهنية',
    CONTENT_RIGHT,
    y + 38
  );

  ctx.fillStyle = '#64748B';
  ctx.font = '500 17px "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('مكتب المدير العام', CONTENT_RIGHT, y + 68);

  // Left Side: Metadata Card
  const metaLines: Array<{ label: string; value: string }> = [
    {
      label: 'التاريخ',
      value: formatDateAr(memo.updatedAt || new Date().toISOString()),
    },
  ];
  if (isDraft) {
    metaLines.push({ label: 'النوع', value: 'مسودة عمل' });
  } else if (memo.direction) {
    metaLines.push({
      label: 'التصنيف',
      value: memo.direction === 'incoming' ? 'وارد' : 'صادر',
    });
  }
  if (memo.departmentName) {
    metaLines.push({ label: 'الجهة', value: memo.departmentName.slice(0, 32) });
  }
  if (memo.refNumber) {
    metaLines.push({ label: 'المرجع', value: memo.refNumber.slice(0, 26) });
  }
  if (memo.projectName) {
    metaLines.push({ label: 'المجلد', value: memo.projectName.slice(0, 28) });
  }

  const metaBoxW = 390;
  const metaBoxX = CONTENT_LEFT;
  const metaBoxY = y - 28;
  const metaBoxH = Math.max(94, 24 + metaLines.length * 28);

  drawRoundedRect(ctx, metaBoxX, metaBoxY, metaBoxW, metaBoxH, 10);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  metaLines.forEach((item, idx) => {
    const rowY = metaBoxY + 30 + idx * 28;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = '700 17px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(`${item.label}:`, metaBoxX + metaBoxW - 16, rowY);

    ctx.fillStyle = '#0F172A';
    ctx.font = '600 17px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(item.value, metaBoxX + metaBoxW - 92, rowY);
  });

  y = Math.max(y + 92, metaBoxY + metaBoxH + 18);

  // Strong Dual Divider Rule below header
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CONTENT_LEFT, y);
  ctx.lineTo(CONTENT_RIGHT, y);
  ctx.stroke();

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CONTENT_LEFT, y + 6);
  ctx.lineTo(CONTENT_RIGHT, y + 6);
  ctx.stroke();

  y += 28;

  // --- TITLE BANNER BOX ---
  ctx.font = '800 28px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  const titleLines = wrapTextRtl(
    ctx,
    memo.title || (isDraft ? 'مسودة عمل' : 'مذكرة عمل'),
    CONTENT_WIDTH - 64
  );
  const titleBoxH = 34 + titleLines.length * 42;

  drawRoundedRect(ctx, CONTENT_LEFT, y, CONTENT_WIDTH, titleBoxH, 10);
  ctx.fillStyle = accentSoftHex;
  ctx.fill();
  ctx.strokeStyle = accentBorderHex;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Right & Left thick accent bars on title box
  ctx.fillStyle = accentHex;
  ctx.fillRect(CONTENT_RIGHT - 7, y + 1, 7, titleBoxH - 2);
  ctx.fillRect(CONTENT_LEFT, y + 1, 7, titleBoxH - 2);

  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'center';
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, W / 2, y + 42 + idx * 42);
  });

  y += titleBoxH + 34;

  // --- BODY CONTENT ---
  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > BODY_MAX_Y) {
      currentPage = createPageCanvas(pages.length);
      pages.push(currentPage);
      ctx = currentPage.ctx;
      y = OUTER_MARGIN + 110;
    }
  };

  const rawLines = (memo.content || '').split(/\r?\n/);
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      y += 18;
      continue;
    }

    if (isSubheadingLine(trimmed)) {
      ctx.font = '700 23px "Cairo", "IBM Plex Sans Arabic", sans-serif';
      const subLines = wrapTextRtl(ctx, trimmed, CONTENT_WIDTH - 12);
      ensureSpace(subLines.length * 36 + 24);
      y += 10;
      ctx.fillStyle = isDraft ? '#065F46' : '#1E3A8A';
      ctx.textAlign = 'right';
      for (const sl of subLines) {
        ctx.fillText(sl, CONTENT_RIGHT, y);
        y += 34;
      }
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(CONTENT_LEFT + 120, y - 22);
      ctx.lineTo(CONTENT_RIGHT, y - 22);
      ctx.stroke();
      y += 8;
      continue;
    }

    const isBullet = /^[-•*]\s+/.test(trimmed);
    const displayText = isBullet ? `•  ${trimmed.replace(/^[-•*]\s+/, '')}` : trimmed;
    const indent = isBullet ? 22 : 0;

    ctx.font = '400 21px "IBM Plex Sans Arabic", sans-serif';
    const wrapped = wrapTextRtl(ctx, displayText, CONTENT_WIDTH - indent);
    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'right';

    for (const wl of wrapped) {
      ensureSpace(36);
      ctx.fillText(wl, CONTENT_RIGHT - indent, y);
      y += 35;
    }
    y += 4;
  }

  // --- ATTACHMENTS BOX ---
  if (memo.linkedFileNames && memo.linkedFileNames.length > 0) {
    const attLines = memo.linkedFileNames.slice(0, 12);
    const attBoxH = 54 + attLines.length * 30;
    ensureSpace(attBoxH + 24);
    y += 16;

    drawRoundedRect(ctx, CONTENT_LEFT, y, CONTENT_WIDTH, attBoxH, 10);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 20px "Cairo", "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `المرفقات والملفات المرتبطة (${memo.linkedFileNames.length}):`,
      CONTENT_RIGHT - 18,
      y + 34
    );

    ctx.fillStyle = '#334155';
    ctx.font = '500 18px "IBM Plex Sans Arabic", sans-serif';
    attLines.forEach((fname, idx) => {
      ctx.fillText(`•  ${fname}`, CONTENT_RIGHT - 28, y + 66 + idx * 30);
    });
  }

  // Stamp footer on every page
  pages.forEach((p, idx) => {
    drawFooter(p.ctx, idx + 1, pages.length);
  });

  const jpegPages = pages.map((p) => ({
    jpegBytes: dataUrlToUint8Array(p.canvas.toDataURL('image/jpeg', 0.92)),
    pixelW: p.canvas.width,
    pixelH: p.canvas.height,
  }));

  return buildPdfFromJpegPages(jpegPages);
}

export async function downloadMemoPdf(memo: PrintableMemoData): Promise<void> {
  const blob = await generateMemoPdfBlob(memo);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (memo.title || 'مذكرة_عمل')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 50);
  a.download = `${safeName || 'مذكرة'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
