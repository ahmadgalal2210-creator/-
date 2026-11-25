import type {
  CorrespondenceEntity,
  ExternalCorrespondence,
  IncomingMessage,
  IndexedFile,
  IndexedImage,
  ProjectFolder,
  WorkDraft,
  WorkMemo,
  WorkOrder,
  WorkspaceState,
} from '../types';
import { countWorkspaceItems, normalizeWorkspaceState } from './localWorkspaceService';

export interface SyncDiffSummary {
  localCount: number;
  cloudCount: number;
  mergedCount: number;
  localOnlyCount: number;
  cloudOnlyCount: number;
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function sanitizeId(raw: string, prefix: string, index: number): string {
  const cleaned = String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (VALID_ID_RE.test(cleaned)) return cleaned;
  return `${prefix}_${index}_${Date.now().toString(36)}`;
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val : val == null ? fallback : String(val);
  return s.slice(0, maxLen);
}

function sanitizeStringList(arr: unknown, maxItems: number, maxItemLen = 120): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => clampStr(x, maxItemLen).trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export function sanitizeWorkspaceForSync(raw: WorkspaceState): WorkspaceState {
  const norm = normalizeWorkspaceState(raw);
  const nowIso = new Date().toISOString();

  const projects: ProjectFolder[] = norm.projects.map((p, i) => ({
    id: sanitizeId(p.id, 'proj', i),
    name: clampStr(p.name, 155, 'مجلد').trim() || 'مجلد',
    domain: p.domain === 'university' ? 'university' : 'company',
    code: clampStr(p.code, 38),
    description: clampStr(p.description, 590),
    createdAt: clampStr(p.createdAt, 40) || nowIso,
  }));
  const projectIds = new Set(projects.map((p) => p.id));
  const safeProjectId = (pid: string) => (pid && projectIds.has(pid) ? pid : '');

  const entityMap = new Map<string, CorrespondenceEntity>();
  norm.correspondenceEntities.forEach((e, i) => {
    const id = sanitizeId(e.id, 'ent', i);
    entityMap.set(id, {
      id,
      name: clampStr(e.name, 155, 'جهة مراسلة').trim() || 'جهة مراسلة',
      category: clampStr(e.category, 78),
      contactInfo: clampStr(e.contactInfo, 195),
      notes: clampStr(e.notes, 980),
      createdAt: clampStr(e.createdAt, 40) || nowIso,
    });
  });

  const correspondences: ExternalCorrespondence[] = norm.correspondences.map((c, i) => {
    const eid = sanitizeId(c.entityId || 'ent_general', 'ent', i);
    const ename = clampStr(c.entityName, 155, 'جهة مراسلة').trim() || 'جهة مراسلة';
    if (!entityMap.has(eid)) {
      entityMap.set(eid, {
        id: eid,
        name: ename,
        category: 'جهة مراسلة',
        contactInfo: '',
        notes: '',
        createdAt: nowIso,
      });
    }
    return {
      id: sanitizeId(c.id, 'corr', i),
      entityId: eid,
      entityName: ename,
      direction: c.direction === 'outgoing' ? 'outgoing' : 'incoming',
      refNumber: clampStr(c.refNumber, 58),
      subject: clampStr(c.subject, 235, 'مراسلة').trim() || 'مراسلة',
      body: clampStr(c.body, 29000),
      date: clampStr(c.date, 38) || nowIso.slice(0, 10),
      subDepartment: clampStr(c.subDepartment, 155),
      linkedFileIds: sanitizeStringList(c.linkedFileIds, 20),
      pinned: Boolean(c.pinned),
      updatedAt: clampStr(c.updatedAt, 40) || nowIso,
      replyToId: clampStr(c.replyToId, 120),
      threadId: clampStr(c.threadId, 120),
    };
  });

  const files: IndexedFile[] = norm.files.map((f, i) => ({
    id: sanitizeId(f.id, 'file', i),
    title: clampStr(f.title, 195, 'ملف').trim() || 'ملف',
    fileName: clampStr(f.fileName, 255, 'document.txt').trim() || 'document.txt',
    category:
      f.category === 'word' || f.category === 'excel' || f.category === 'pdf'
        ? f.category
        : 'other',
    domain: f.domain === 'university' ? 'university' : 'company',
    projectId: safeProjectId(f.projectId),
    sizeBytes: Math.max(0, Math.min(500_000_000, Number(f.sizeBytes) || 0)),
    updatedAt: clampStr(f.updatedAt, 40) || nowIso,
    notes: clampStr(f.notes, 1950),
    hasBlob: Boolean(f.hasBlob),
    mimeType: clampStr(f.mimeType, 155, 'application/octet-stream'),
    extractedText: clampStr(f.extractedText, 29000),
    sheetPreview: Array.isArray(f.sheetPreview)
      ? f.sheetPreview.slice(0, 10).map((s) => ({
          sheetName: clampStr(s.sheetName, 95, 'ورقة'),
          headers: Array.isArray(s.headers)
            ? s.headers.slice(0, 50).map((h) => clampStr(h, 120))
            : [],
          rows: Array.isArray(s.rows)
            ? s.rows
                .slice(0, 60)
                .map((r) =>
                  Array.isArray(r) ? r.slice(0, 50).map((c) => clampStr(c, 120)) : []
                )
            : [],
        }))
      : [],
    starred: Boolean(f.starred),
    researchKind:
      f.researchKind === 'masters' ||
      f.researchKind === 'phd' ||
      f.researchKind === 'paper' ||
      f.researchKind === 'book'
        ? f.researchKind
        : 'none',
    headings: sanitizeStringList(f.headings, 60, 120),
  }));

  const images: IndexedImage[] = norm.images.map((img, i) => ({
    id: sanitizeId(img.id, 'img', i),
    title: clampStr(img.title, 195, 'صورة').trim() || 'صورة',
    fileName: clampStr(img.fileName, 255, 'image.jpg').trim() || 'image.jpg',
    domain: img.domain === 'university' ? 'university' : 'company',
    projectId: safeProjectId(img.projectId),
    sizeBytes: Math.max(0, Math.min(100_000_000, Number(img.sizeBytes) || 0)),
    capturedAt: clampStr(img.capturedAt, 38) || nowIso.slice(0, 10),
    caption: clampStr(img.caption, 980),
    hasBlob: Boolean(img.hasBlob),
    thumbnailDataUrl: clampStr(img.thumbnailDataUrl || img.dataUrl, 245000),
    dataUrl: clampStr(img.dataUrl || img.thumbnailDataUrl, 245000),
    width: Math.max(0, Math.min(20000, Number(img.width) || 0)),
    height: Math.max(0, Math.min(20000, Number(img.height) || 0)),
    starred: Boolean(img.starred),
  }));

  const memos: WorkMemo[] = norm.memos.map((m, i) => ({
    id: sanitizeId(m.id, 'memo', i),
    title: clampStr(m.title, 195, 'مذكرة').trim() || 'مذكرة',
    content: clampStr(m.content, 39000),
    domain: m.domain === 'university' ? 'university' : 'company',
    projectId: safeProjectId(m.projectId),
    updatedAt: clampStr(m.updatedAt, 40) || nowIso,
    pinned: Boolean(m.pinned),
    linkedFileIds: sanitizeStringList(m.linkedFileIds, 20),
    direction: m.direction === 'incoming' ? 'incoming' : 'outgoing',
    departmentName: clampStr(m.departmentName, 155),
    replyToId: clampStr(m.replyToId, 120),
    threadId: clampStr(m.threadId, 120),
  }));

  const drafts: WorkDraft[] = norm.drafts.map((d, i) => ({
    id: sanitizeId(d.id, 'draft', i),
    title: clampStr(d.title, 195, 'مسودة').trim() || 'مسودة',
    content: clampStr(d.content, 39000),
    scope: d.scope === 'private' ? 'private' : 'factory',
    projectId: safeProjectId(d.projectId),
    linkedWordFileId: clampStr(d.linkedWordFileId, 120),
    pinned: Boolean(d.pinned),
    updatedAt: clampStr(d.updatedAt, 40) || nowIso,
  }));

  const orders: WorkOrder[] = norm.orders.map((o, i) => ({
    id: sanitizeId(o.id, 'ord', i),
    refCode: clampStr(o.refCode, 38, `BM-${i + 1}`).trim() || `BM-${i + 1}`,
    title: clampStr(o.title, 195, 'مذكرة أعمال').trim() || 'مذكرة أعمال',
    details: clampStr(o.details, 4900),
    domain: o.domain === 'university' ? 'university' : 'company',
    projectId: safeProjectId(o.projectId),
    issuer: clampStr(o.issuer, 155),
    assigneeOrUnit: clampStr(o.assigneeOrUnit, 155),
    subDepartment: clampStr(o.subDepartment, 155),
    technicians: sanitizeStringList(o.technicians, 20, 120),
    isAssigned: Boolean(o.isAssigned),
    priority:
      o.priority === 'urgent' || o.priority === 'high' ? o.priority : 'normal',
    status:
      o.status === 'in_progress' || o.status === 'review' || o.status === 'done'
        ? o.status
        : 'new',
    dueDate: clampStr(o.dueDate, 38),
    createdAt: clampStr(o.createdAt, 40) || nowIso,
    linkedFileIds: sanitizeStringList(o.linkedFileIds, 20),
    sourceMessageId: clampStr(o.sourceMessageId, 120),
  }));

  const messages: IncomingMessage[] = norm.messages.map((msg, i) => ({
    id: sanitizeId(msg.id, 'msg', i),
    senderName: clampStr(msg.senderName, 155, 'مرسل').trim() || 'مرسل',
    senderRole: clampStr(msg.senderRole, 155),
    subject: clampStr(msg.subject, 235, 'رسالة').trim() || 'رسالة',
    body: clampStr(msg.body, 19500),
    channel:
      msg.channel === 'university_email' ||
      msg.channel === 'whatsapp' ||
      msg.channel === 'teams'
        ? msg.channel
        : 'company_email',
    domain: msg.domain === 'university' ? 'university' : 'company',
    projectId: safeProjectId(msg.projectId),
    receivedAt: clampStr(msg.receivedAt, 38) || nowIso,
    isRead: Boolean(msg.isRead),
    starred: Boolean(msg.starred),
    convertedOrderId: clampStr(msg.convertedOrderId, 120),
    convertedMemoId: clampStr(msg.convertedMemoId, 120),
  }));

  return {
    projects,
    files,
    images,
    memos,
    drafts,
    orders,
    messages,
    correspondenceEntities: Array.from(entityMap.values()),
    correspondences,
  };
}

function pickTimestamp(item: { updatedAt?: string; createdAt?: string; capturedAt?: string; receivedAt?: string }): number {
  const s = item.updatedAt || item.createdAt || item.receivedAt || item.capturedAt || '';
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

function mergeCollection<
  T extends { id: string; updatedAt?: string; createdAt?: string; capturedAt?: string; receivedAt?: string }
>(
  localItems: T[],
  cloudItems: T[],
  preferLocalOnTie: boolean,
  onStats: (localOnly: number, cloudOnly: number) => void
): T[] {
  const map = new Map<string, T>();
  const localIds = new Set(localItems.map((x) => x.id));
  const cloudIds = new Set(cloudItems.map((x) => x.id));

  let localOnly = 0;
  let cloudOnly = 0;
  localIds.forEach((id) => {
    if (!cloudIds.has(id)) localOnly++;
  });
  cloudIds.forEach((id) => {
    if (!localIds.has(id)) cloudOnly++;
  });
  onStats(localOnly, cloudOnly);

  cloudItems.forEach((c) => map.set(c.id, c));
  localItems.forEach((l) => {
    const existing = map.get(l.id);
    if (!existing) {
      map.set(l.id, l);
      return;
    }
    const lt = pickTimestamp(l);
    const ct = pickTimestamp(existing);
    if (lt > ct || (lt === ct && preferLocalOnTie)) {
      map.set(l.id, l);
    }
  });
  return Array.from(map.values());
}

export function mergeWorkspaces(
  localRaw: WorkspaceState,
  cloudRaw: WorkspaceState,
  preferLocalOnTie = true
): { merged: WorkspaceState; summary: SyncDiffSummary } {
  const local = sanitizeWorkspaceForSync(localRaw);
  const cloud = sanitizeWorkspaceForSync(cloudRaw);
  let localOnlyCount = 0;
  let cloudOnlyCount = 0;
  const addStats = (l: number, c: number) => {
    localOnlyCount += l;
    cloudOnlyCount += c;
  };

  const merged = sanitizeWorkspaceForSync({
    projects: mergeCollection(local.projects, cloud.projects, preferLocalOnTie, addStats),
    files: mergeCollection(local.files, cloud.files, preferLocalOnTie, addStats),
    images: mergeCollection(local.images, cloud.images, preferLocalOnTie, addStats),
    memos: mergeCollection(local.memos, cloud.memos, preferLocalOnTie, addStats),
    drafts: mergeCollection(local.drafts, cloud.drafts, preferLocalOnTie, addStats),
    orders: mergeCollection(local.orders, cloud.orders, preferLocalOnTie, addStats),
    messages: mergeCollection(local.messages, cloud.messages, preferLocalOnTie, addStats),
    correspondenceEntities: mergeCollection(
      local.correspondenceEntities,
      cloud.correspondenceEntities,
      preferLocalOnTie,
      addStats
    ),
    correspondences: mergeCollection(
      local.correspondences,
      cloud.correspondences,
      preferLocalOnTie,
      addStats
    ),
  });

  return {
    merged,
    summary: {
      localCount: countWorkspaceItems(local),
      cloudCount: countWorkspaceItems(cloud),
      mergedCount: countWorkspaceItems(merged),
      localOnlyCount,
      cloudOnlyCount,
    },
  };
}

const SAMPLE_SEED_IDS = new Set([
  'proj_sugar_env',
  'proj_safety_osh',
  'ent_ministry_env',
  'ent_health_dir',
  'corr_sample_1',
  'corr_sample_2',
  'file_phd_ayman',
  'file_cod_sheet',
  'memo_in_1',
  'memo_out_1',
  'draft_factory_1',
  'draft_private_1',
  'order_sample_1',
]);

export function filterOutSampleAndClutter(ws: WorkspaceState): {
  cleaned: WorkspaceState;
  removedCount: number;
} {
  const norm = normalizeWorkspaceState(ws);
  const before = countWorkspaceItems(norm);
  const cleaned: WorkspaceState = {
    projects: norm.projects.filter((p) => !SAMPLE_SEED_IDS.has(p.id)),
    correspondenceEntities: norm.correspondenceEntities.filter(
      (e) => !SAMPLE_SEED_IDS.has(e.id)
    ),
    correspondences: norm.correspondences.filter(
      (c) => !SAMPLE_SEED_IDS.has(c.id)
    ),
    files: norm.files.filter((f) => !SAMPLE_SEED_IDS.has(f.id)),
    images: norm.images.filter((i) => !SAMPLE_SEED_IDS.has(i.id)),
    memos: norm.memos.filter((m) => !SAMPLE_SEED_IDS.has(m.id)),
    drafts: norm.drafts.filter((d) => !SAMPLE_SEED_IDS.has(d.id) && d.content.trim().length > 0),
    orders: norm.orders.filter((o) => !SAMPLE_SEED_IDS.has(o.id)),
    messages: norm.messages.filter((msg) => !msg.isRead),
  };
  const sanitized = sanitizeWorkspaceForSync(cleaned);
  return {
    cleaned: sanitized,
    removedCount: Math.max(0, before - countWorkspaceItems(sanitized)),
  };
}
