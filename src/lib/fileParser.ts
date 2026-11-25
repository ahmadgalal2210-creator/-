import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  PageBorderDisplay,
  PageBorderOffsetFrom,
  PageBorderZOrder,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
} from 'docx';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import type { FileCategory, SheetPreviewData } from '../types';

export function makeSafeId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'item';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${cleanPrefix}_${Date.now().toString(36)}_${rand}`;
}

export function cleanFileTitle(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || fileName;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDateAr(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  try {
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function isImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name)
  );
}

function detectCategory(file: File): FileCategory {
  const name = file.name.toLowerCase();
  if (/\.(docx?|rtf|odt)$/i.test(name) || file.type.includes('word')) return 'word';
  if (/\.(xlsx?|csv|ods)$/i.test(name) || file.type.includes('sheet') || file.type.includes('excel')) {
    return 'excel';
  }
  if (/\.pdf$/i.test(name) || file.type === 'application/pdf') return 'pdf';
  return 'other';
}

function extractHeadingsFromLines(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 4 && l.length <= 120);
  const headings: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const looksLikeHeading =
      /^(\d+[\.\-\)]|أولاً|ثانياً|ثالثاً|رابعاً|خامساً|الفصل|الباب|المبحث|القسم|مقدمة|خاتمة|النتائج|التوصيات|الموضوع|الملخص|Chapter|Section|Abstract|Conclusion)/i.test(
        line
      ) ||
      (line.length <= 65 && !/[.،؛?!]$/.test(line));
    if (looksLikeHeading && !seen.has(line)) {
      seen.add(line);
      headings.push(line);
      if (headings.length >= 40) break;
    }
  }
  return headings;
}

function extractReadablePdfStrings(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer.slice(0, 600_000));
    const decoded = new TextDecoder('latin1').decode(bytes);
    const chunks: string[] = [];
    const regex = /\(([^()\\]{3,160})\)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(decoded)) !== null) {
      const cleaned = m[1]
        .replace(/[^\u0600-\u06FFa-zA-Z0-9\s.,:\-\/()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length >= 4 && /[a-zA-Z\u0600-\u06FF]{2,}/.test(cleaned)) {
        chunks.push(cleaned);
      }
      if (chunks.length >= 160) break;
    }
    return chunks.join('\n').slice(0, 15000);
  } catch {
    return '';
  }
}

export function buildSummaryFromParsed(params: {
  title: string;
  fileName: string;
  category: FileCategory;
  headings: string[];
  extractedText: string;
  sheetPreview: SheetPreviewData[];
}): string {
  const { title, fileName, category, headings, extractedText, sheetPreview } = params;
  if (category === 'excel' && sheetPreview.length > 0) {
    const sheetSummaries = sheetPreview.slice(0, 5).map((s) => {
      const cols = s.headers.filter(Boolean).slice(0, 6).join('، ');
      return `• ورقة «${s.sheetName}»: (${s.rows.length} صف) — الأعمدة: ${cols || 'بيانات جدولية'}`;
    });
    return `ملخص ملف الإكسيل (${fileName}):\nالعنوان: ${title}\n${sheetSummaries.join('\n')}`;
  }
  if (extractedText.trim()) {
    const cleanLines = extractedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 3);
    const previewLines = cleanLines.slice(0, 6).join('\n');
    const headingNote =
      headings.length > 0 ? `\nأبرز العناوين: ${headings.slice(0, 4).join(' · ')}` : '';
    return `ملخص المحتوى (${title}):\n${previewLines}${headingNote}`.slice(0, 2200);
  }
  if (category === 'pdf') {
    return `ملخص مستند PDF المرفق (${fileName}):\nالعنوان: ${title}\nتم تجهيز الملف للعرض والرد عليه وتحويله إلى صيغة Word قابلة للتعديل والطباعة.`;
  }
  return `ملخص الملف المرفق (${fileName}):\nالعنوان: ${title}`;
}

export async function parseDocumentFile(file: File): Promise<{
  category: FileCategory;
  suggestedTitle: string;
  headings: string[];
  extractedText: string;
  sheetPreview: SheetPreviewData[];
  summaryText: string;
}> {
  const category = detectCategory(file);
  const baseTitle = cleanFileTitle(file.name);
  let extractedText = '';
  let headings: string[] = [];
  let sheetPreview: SheetPreviewData[] = [];

  try {
    if (category === 'word' && /\.docx$/i.test(file.name)) {
      const buf = await file.arrayBuffer();
      const raw = await mammoth.extractRawText({ arrayBuffer: buf });
      extractedText = (raw.value || '').trim().slice(0, 28000);
      headings = extractHeadingsFromLines(extractedText);
    } else if (category === 'excel') {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetNames = wb.SheetNames.slice(0, 10);
      headings = sheetNames.map((n) => `ورقة: ${n}`);
      const textParts: string[] = [];
      sheetPreview = sheetNames.map((name) => {
        const ws = wb.Sheets[name];
        const rowsRaw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          defval: '',
        });
        const normalizedRows = rowsRaw
          .slice(0, 61)
          .map((r) =>
            (Array.isArray(r) ? r : [])
              .slice(0, 50)
              .map((cell) => String(cell ?? '').trim().slice(0, 120))
          );
        const headers = normalizedRows[0] || [];
        const rows = normalizedRows.slice(1, 61);
        textParts.push(
          `[${name}]\n${headers.join(' | ')}\n${rows
            .slice(0, 15)
            .map((r) => r.join(' | '))
            .join('\n')}`
        );
        return { sheetName: name, headers, rows };
      });
      extractedText = textParts.join('\n\n').slice(0, 28000);
    } else if (category === 'pdf') {
      const buf = await file.arrayBuffer();
      extractedText = extractReadablePdfStrings(buf);
      headings = extractHeadingsFromLines(extractedText);
    } else if (/text|json|csv|markdown/i.test(file.type) || /\.(txt|md|csv|log)$/i.test(file.name)) {
      extractedText = (await file.text()).slice(0, 28000);
      headings = extractHeadingsFromLines(extractedText);
    }
  } catch {
    // Graceful fallback if binary parser encounters an unusual format
  }

  const firstMeaningfulLine = extractedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length >= 5 && l.length <= 120 && !/^\[/.test(l));

  const suggestedTitle =
    headings[0]?.replace(/^ورقة:\s*/, '') || firstMeaningfulLine || baseTitle;

  const summaryText = buildSummaryFromParsed({
    title: suggestedTitle,
    fileName: file.name,
    category,
    headings,
    extractedText,
    sheetPreview,
  });

  return {
    category,
    suggestedTitle: suggestedTitle.slice(0, 190),
    headings: headings.slice(0, 60),
    extractedText,
    sheetPreview,
    summaryText,
  };
}

export async function processImageFile(file: File): Promise<{
  thumbnailDataUrl: string;
  width: number;
  height: number;
  summaryText: string;
}> {
  const title = cleanFileTitle(file.name);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 900;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetW, targetH);
          let dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          if (dataUrl.length > 220000) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.45);
          }
          resolve({
            thumbnailDataUrl: dataUrl.slice(0, 245000),
            width: img.width,
            height: img.height,
            summaryText: `ملخص الصورة المرفقة (${file.name}):\nالعنوان: ${title}\nالأبعاد: ${img.width} × ${img.height} بكسل — جاهزة للعرض والتحويل لمستند رد Word.`,
          });
          return;
        }
        resolve({
          thumbnailDataUrl: '',
          width: img.width,
          height: img.height,
          summaryText: `ملخص الصورة المرفقة (${file.name}): ${title}`,
        });
      };
      img.onerror = () =>
        resolve({
          thumbnailDataUrl: '',
          width: 0,
          height: 0,
          summaryText: `ملخص الصورة المرفقة (${file.name}): ${title}`,
        });
      img.src = String(reader.result || '');
    };
    reader.onerror = () =>
      resolve({
        thumbnailDataUrl: '',
        width: 0,
        height: 0,
        summaryText: `ملخص الصورة المرفقة (${file.name}): ${title}`,
      });
    reader.readAsDataURL(file);
  });
}

const CAIRO_FONT = {
  name: 'Cairo',
  ascii: 'Cairo',
  hAnsi: 'Cairo',
  cs: 'Cairo',
  eastAsia: 'Cairo',
};

const BODY_FONT = {
  name: 'IBM Plex Sans Arabic',
  ascii: 'IBM Plex Sans Arabic',
  hAnsi: 'IBM Plex Sans Arabic',
  cs: 'IBM Plex Sans Arabic',
  eastAsia: 'IBM Plex Sans Arabic',
};

const MONO_FONT = {
  name: 'IBM Plex Mono',
  ascii: 'IBM Plex Mono',
  hAnsi: 'IBM Plex Mono',
  cs: 'IBM Plex Sans Arabic',
  eastAsia: 'IBM Plex Mono',
};

function isDocxSubheadingLine(line: string): boolean {
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

export async function generateWordDocxBlob(params: {
  title: string;
  departmentName?: string;
  refNumber?: string;
  bodyText: string;
  subTitle?: string;
  headerMode?: 'memo' | 'draft';
  direction?: 'incoming' | 'outgoing';
  projectName?: string;
  updatedAt?: string;
  linkedFileNames?: string[];
}): Promise<Blob> {
  const {
    title,
    departmentName,
    refNumber,
    bodyText,
    subTitle,
    headerMode,
    direction,
    projectName,
    updatedAt,
    linkedFileNames,
  } = params;

  const isDraft =
    headerMode === 'draft' || Boolean(subTitle && subTitle.includes('مسودة'));
  const accentHex = isDraft ? '047857' : '1D4ED8';
  const accentSoftHex = isDraft ? 'ECFDF5' : 'EFF6FF';
  const accentBorderHex = isDraft ? 'A7F3D0' : 'BFDBFE';
  const subheadingColorHex = isDraft ? '065F46' : '1E3A8A';

  const resolvedSubTitle =
    subTitle ||
    (isDraft
      ? 'إدارة البيئة — مسودة عمل'
      : 'الإدارة العامة للبيئة والسلامة المهنية');

  const formattedDate = formatDateAr(updatedAt || new Date().toISOString());

  // Metadata rows inside left header card
  const metaParagraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'التاريخ: ',
          bold: true,
          size: 19,
          color: '475569',
          font: BODY_FONT,
          rightToLeft: true,
        }),
        new TextRun({
          text: formattedDate,
          bold: true,
          size: 19,
          color: '0F172A',
          font: BODY_FONT,
          rightToLeft: true,
        }),
      ],
    }),
  ];

  if (isDraft || direction) {
    metaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: 'التصنيف: ',
            bold: true,
            size: 19,
            color: '475569',
            font: BODY_FONT,
            rightToLeft: true,
          }),
          new TextRun({
            text: isDraft
              ? 'مسودة عمل'
              : direction === 'incoming'
                ? 'وارد'
                : 'صادر',
            bold: true,
            size: 19,
            color: isDraft ? '047857' : direction === 'incoming' ? 'B45309' : '1D4ED8',
            font: CAIRO_FONT,
            rightToLeft: true,
          }),
        ],
      })
    );
  }

  if (departmentName) {
    metaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: 'الجهة / الإدارة: ',
            bold: true,
            size: 19,
            color: '475569',
            font: BODY_FONT,
            rightToLeft: true,
          }),
          new TextRun({
            text: departmentName,
            bold: true,
            size: 19,
            color: '0F172A',
            font: BODY_FONT,
            rightToLeft: true,
          }),
        ],
      })
    );
  }

  if (refNumber) {
    metaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: 'رقم القيد / المرجع: ',
            bold: true,
            size: 19,
            color: '475569',
            font: BODY_FONT,
            rightToLeft: true,
          }),
          new TextRun({
            text: refNumber,
            bold: true,
            size: 19,
            color: '0F172A',
            font: MONO_FONT,
          }),
        ],
      })
    );
  }

  if (projectName) {
    metaParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 20 },
        children: [
          new TextRun({
            text: 'المجلد: ',
            bold: true,
            size: 19,
            color: '475569',
            font: BODY_FONT,
            rightToLeft: true,
          }),
          new TextRun({
            text: projectName,
            bold: true,
            size: 19,
            color: '0F172A',
            font: BODY_FONT,
            rightToLeft: true,
          }),
        ],
      })
    );
  }

  const noBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: 'FFFFFF',
  };

  // Top Executive Accent Strip + 2-column RTL Header Table
  const topAccentRule = new Paragraph({
    spacing: { before: 0, after: 160 },
    border: {
      top: {
        style: BorderStyle.SINGLE,
        size: 36,
        color: accentHex,
        space: 4,
      },
    },
    children: [],
  });

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    visuallyRightToLeft: true,
    borders: {
      top: noBorder,
      bottom: { style: BorderStyle.SINGLE, size: 18, color: accentHex },
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: [
      new TableRow({
        children: [
          // Right side in RTL: Company & General Directorate branding
          new TableCell({
            width: { size: 58, type: WidthType.PERCENTAGE },
            margins: {
              top: 60,
              bottom: 160,
              left: 160,
              right: 40,
            },
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: 'شركة الدقهلية لصناعة وتكرير السكر',
                    bold: true,
                    size: 30,
                    color: '0F172A',
                    font: CAIRO_FONT,
                    rightToLeft: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: resolvedSubTitle,
                    bold: true,
                    size: 23,
                    color: accentHex,
                    font: CAIRO_FONT,
                    rightToLeft: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: 'مكتب المدير العام',
                    size: 18,
                    color: '64748B',
                    font: BODY_FONT,
                    rightToLeft: true,
                  }),
                ],
              }),
            ],
          }),
          // Left side in RTL: Metadata card
          new TableCell({
            width: { size: 42, type: WidthType.PERCENTAGE },
            shading: {
              type: ShadingType.CLEAR,
              fill: 'F8FAFC',
              color: 'auto',
            },
            margins: {
              top: 120,
              bottom: 120,
              left: 160,
              right: 160,
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 18, color: accentHex },
            },
            children: metaParagraphs,
          }),
        ],
      }),
    ],
  });

  // Styled Document Title Banner matching app UI
  const titleBannerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    visuallyRightToLeft: true,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: {
              type: ShadingType.CLEAR,
              fill: accentSoftHex,
              color: 'auto',
            },
            margins: {
              top: 160,
              bottom: 160,
              left: 200,
              right: 200,
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: accentBorderHex },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: accentBorderHex },
              left: { style: BorderStyle.SINGLE, size: 24, color: accentHex },
              right: { style: BorderStyle.SINGLE, size: 24, color: accentHex },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({
                    text: title || (isDraft ? 'مسودة عمل' : 'مذكرة عمل'),
                    bold: true,
                    size: 30,
                    color: '0F172A',
                    font: CAIRO_FONT,
                    rightToLeft: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const children: Array<Paragraph | Table> = [
    topAccentRule,
    headerTable,
    new Paragraph({
      spacing: { before: 140, after: 180 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 4 },
      },
      children: [],
    }),
    titleBannerTable,
    new Paragraph({
      spacing: { before: 0, after: 180 },
      children: [],
    }),
  ];

  // Format body lines with subheading detection & clean Arabic typography
  const bodyLines = (bodyText || '').split(/\r?\n/);
  for (const rawLine of bodyLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { after: 100 },
          children: [],
        })
      );
      continue;
    }

    if (isDocxSubheadingLine(trimmed)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { before: 180, after: 90 },
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: 'E2E8F0',
              space: 4,
            },
          },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 25,
              color: subheadingColorHex,
              font: CAIRO_FONT,
              rightToLeft: true,
            }),
          ],
        })
      );
      continue;
    }

    const isBullet = /^[-•*]\s+/.test(trimmed);
    const cleanText = isBullet
      ? `•  ${trimmed.replace(/^[-•*]\s+/, '')}`
      : trimmed;

    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        indent: isBullet ? { right: convertMillimetersToTwip(5) } : undefined,
        spacing: { after: 110, line: 360 },
        children: [
          new TextRun({
            text: cleanText,
            size: 23,
            color: '1E293B',
            font: BODY_FONT,
            rightToLeft: true,
          }),
        ],
      })
    );
  }

  // Attachments box if linkedFileNames exist
  if (linkedFileNames && linkedFileNames.length > 0) {
    const attParagraphs: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: `المرفقات والملفات المرتبطة (${linkedFileNames.length}):`,
            bold: true,
            size: 22,
            color: '0F172A',
            font: CAIRO_FONT,
            rightToLeft: true,
          }),
        ],
      }),
      ...linkedFileNames.map(
        (fname) =>
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            indent: { right: convertMillimetersToTwip(4) },
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: `•  ${fname}`,
                size: 20,
                color: '334155',
                font: BODY_FONT,
                rightToLeft: true,
              }),
            ],
          })
      ),
    ];

    children.push(
      new Paragraph({ spacing: { before: 180, after: 60 }, children: [] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        visuallyRightToLeft: true,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: {
                  type: ShadingType.CLEAR,
                  fill: 'F8FAFC',
                  color: 'auto',
                },
                margins: {
                  top: 120,
                  bottom: 120,
                  left: 160,
                  right: 160,
                },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
                  bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
                  left: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
                  right: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
                },
                children: attParagraphs,
              }),
            ],
          }),
        ],
      })
    );
  }

  const pageMarginTwips = convertMillimetersToTwip(16);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: pageMarginTwips,
              right: pageMarginTwips,
              bottom: pageMarginTwips,
              left: pageMarginTwips,
              header: convertMillimetersToTwip(8),
              footer: convertMillimetersToTwip(10),
            },
            borders: {
              pageBorders: {
                display: PageBorderDisplay.ALL_PAGES,
                offsetFrom: PageBorderOffsetFrom.PAGE,
                zOrder: PageBorderZOrder.FRONT,
              },
              pageBorderTop: {
                style: BorderStyle.DOUBLE,
                size: 12,
                space: 18,
                color: '0F172A',
              },
              pageBorderRight: {
                style: BorderStyle.DOUBLE,
                size: 12,
                space: 18,
                color: '0F172A',
              },
              pageBorderBottom: {
                style: BorderStyle.DOUBLE,
                size: 12,
                space: 18,
                color: '0F172A',
              },
              pageBorderLeft: {
                style: BorderStyle.DOUBLE,
                size: 12,
                space: 18,
                color: '0F172A',
              },
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                layout: TableLayoutType.FIXED,
                visuallyRightToLeft: true,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 8, color: 'CBD5E1' },
                  bottom: noBorder,
                  left: noBorder,
                  right: noBorder,
                  insideHorizontal: noBorder,
                  insideVertical: noBorder,
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 48, type: WidthType.PERCENTAGE },
                        margins: { top: 80, bottom: 0, left: 40, right: 40 },
                        borders: {
                          top: noBorder,
                          bottom: noBorder,
                          left: noBorder,
                          right: noBorder,
                        },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            bidirectional: true,
                            children: [
                              new TextRun({
                                text: 'إدارة البيئة والسلامة المهنية — السكرتارية',
                                size: 18,
                                bold: true,
                                color: '475569',
                                font: BODY_FONT,
                                rightToLeft: true,
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 52, type: WidthType.PERCENTAGE },
                        margins: { top: 80, bottom: 0, left: 40, right: 40 },
                        borders: {
                          top: noBorder,
                          bottom: noBorder,
                          left: noBorder,
                          right: noBorder,
                        },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.LEFT,
                            bidirectional: true,
                            children: [
                              new TextRun({
                                text: 'د. أيمن عبد الحميد — مدير عام البيئة والسلامة المهنية',
                                size: 18,
                                bold: true,
                                color: '475569',
                                font: BODY_FONT,
                                rightToLeft: true,
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
