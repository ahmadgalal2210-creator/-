import type {
  ExternalCorrespondence,
  IncomingMessage,
  IndexedFile,
  IndexedImage,
  ProjectFolder,
  SearchFocusTarget,
  WorkDraft,
  WorkMemo,
  WorkOrder,
} from '../types';

export interface TextMatchRange {
  start: number;
  end: number;
}

export function findTextMatches(text: string, query: string): TextMatchRange[] {
  const q = query.trim();
  if (!text || !q) return [];
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const matches: TextMatchRange[] = [];
  let idx = 0;
  while (idx < lowerText.length) {
    const found = lowerText.indexOf(lowerQ, idx);
    if (found === -1) break;
    matches.push({ start: found, end: found + lowerQ.length });
    idx = found + Math.max(1, lowerQ.length);
    if (matches.length >= 100) break;
  }
  return matches;
}

function buildSnippet(text: string, query: string): string {
  const matches = findTextMatches(text, query);
  if (matches.length === 0) return text.slice(0, 130);
  const first = matches[0];
  const start = Math.max(0, first.start - 40);
  const end = Math.min(text.length, first.end + 80);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

export interface SearchHit {
  key: string;
  kind: 'correspondence' | 'file' | 'image' | 'memo' | 'draft' | 'order' | 'message';
  id: string;
  title: string;
  subtitle: string;
  snippet: string;
  matchCount: number;
  focusSearch: SearchFocusTarget;
}

export function searchAcrossWorkspace(
  query: string,
  data: {
    correspondences: ExternalCorrespondence[];
    files: IndexedFile[];
    images: IndexedImage[];
    memos: WorkMemo[];
    drafts: WorkDraft[];
    orders: WorkOrder[];
    messages: IncomingMessage[];
    projects: ProjectFolder[];
  }
): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const hits: SearchHit[] = [];

  for (const c of data.correspondences) {
    const combined = `${c.entityName} ${c.refNumber} ${c.subject} ${c.body}`;
    const matches = findTextMatches(combined, q);
    if (matches.length > 0) {
      hits.push({
        key: `corr_${c.id}`,
        kind: 'correspondence',
        id: c.id,
        title: c.subject,
        subtitle: `مراسلة ${c.direction === 'incoming' ? 'واردة من' : 'صادرة إلى'} ${c.entityName}`,
        snippet: buildSnippet(c.body || c.subject, q),
        matchCount: matches.length,
        focusSearch: { query: q, sourceField: 'body' },
      });
    }
  }

  for (const f of data.files) {
    const sheetHitIndex =
      f.sheetPreview?.findIndex(
        (s) =>
          findTextMatches(s.sheetName, q).length > 0 ||
          s.headers.some((h) => findTextMatches(h, q).length > 0) ||
          s.rows.some((r) => r.some((cell) => findTextMatches(cell, q).length > 0))
      ) ?? -1;
    const textMatches = findTextMatches(
      `${f.title} ${f.fileName} ${f.notes} ${f.extractedText || ''}`,
      q
    );
    if (textMatches.length > 0 || sheetHitIndex !== -1) {
      hits.push({
        key: `file_${f.id}`,
        kind: 'file',
        id: f.id,
        title: f.title,
        subtitle: `ملف (${f.fileName})`,
        snippet: buildSnippet(f.extractedText || f.notes || f.title, q),
        matchCount: Math.max(1, textMatches.length),
        focusSearch: {
          query: q,
          sheetIndex: sheetHitIndex !== -1 ? sheetHitIndex : undefined,
          sourceField: 'extractedText',
        },
      });
    }
  }

  for (const img of data.images) {
    const matches = findTextMatches(`${img.title} ${img.fileName} ${img.caption}`, q);
    if (matches.length > 0) {
      hits.push({
        key: `img_${img.id}`,
        kind: 'image',
        id: img.id,
        title: img.title,
        subtitle: 'صورة مؤرشفة',
        snippet: buildSnippet(img.caption || img.title, q),
        matchCount: matches.length,
        focusSearch: { query: q, sourceField: 'caption' },
      });
    }
  }

  for (const m of data.memos) {
    const matches = findTextMatches(`${m.title} ${m.content} ${m.departmentName || ''}`, q);
    if (matches.length > 0) {
      hits.push({
        key: `memo_${m.id}`,
        kind: 'memo',
        id: m.id,
        title: m.title,
        subtitle: `مذكرة مصنع (${m.direction === 'incoming' ? 'وارد' : 'صادر'})`,
        snippet: buildSnippet(m.content || m.title, q),
        matchCount: matches.length,
        focusSearch: { query: q, sourceField: 'content' },
      });
    }
  }

  for (const d of data.drafts) {
    const matches = findTextMatches(`${d.title} ${d.content}`, q);
    if (matches.length > 0) {
      hits.push({
        key: `draft_${d.id}`,
        kind: 'draft',
        id: d.id,
        title: d.title,
        subtitle: `مسودة (${d.scope === 'private' ? 'خاص' : 'المصنع'})`,
        snippet: buildSnippet(d.content || d.title, q),
        matchCount: matches.length,
        focusSearch: { query: q, sourceField: 'content' },
      });
    }
  }

  for (const o of data.orders) {
    const matches = findTextMatches(
      `${o.refCode} ${o.title} ${o.details} ${o.subDepartment || ''} ${(o.technicians || []).join(' ')}`,
      q
    );
    if (matches.length > 0) {
      hits.push({
        key: `ord_${o.id}`,
        kind: 'order',
        id: o.id,
        title: `${o.refCode} — ${o.title}`,
        subtitle: `مذكرة الأعمال · ${o.subDepartment || o.assigneeOrUnit}`,
        snippet: buildSnippet(o.details || o.title, q),
        matchCount: matches.length,
        focusSearch: { query: q, sourceField: 'details' },
      });
    }
  }

  for (const msg of data.messages) {
    const matches = findTextMatches(`${msg.senderName} ${msg.subject} ${msg.body}`, q);
    if (matches.length > 0) {
      hits.push({
        key: `msg_${msg.id}`,
        kind: 'message',
        id: msg.id,
        title: msg.subject,
        subtitle: `رسالة من ${msg.senderName}`,
        snippet: buildSnippet(msg.body || msg.subject, q),
        matchCount: matches.length,
        focusSearch: { query: q, sourceField: 'body' },
      });
    }
  }

  return hits.slice(0, 40);
}
