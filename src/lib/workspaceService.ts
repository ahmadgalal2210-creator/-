import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  waitForPendingWrites,
  writeBatch,
  type QuerySnapshot,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  hasFirestoreConfigured,
  OperationType,
} from './firebase';
import { EMPTY_WORKSPACE } from './localWorkspaceService';
import { sanitizeWorkspaceForSync } from './syncEngine';
import type {
  CorrespondenceEntity,
  ExternalCorrespondence,
  IncomingMessage,
  IndexedFile,
  IndexedImage,
  ProjectFolder,
  SheetPreviewData,
  WorkDraft,
  WorkMemo,
  WorkOrder,
  WorkOrderStatus,
  WorkspaceState,
} from '../types';

function tsToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'object' && val !== null && 'toDate' in val) {
    try {
      return (val as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  return typeof val === 'string' ? val : new Date().toISOString();
}

function packSheetPreview(sheets?: SheetPreviewData[]) {
  return (sheets || []).slice(0, 10).map((s) => ({
    sheetName: String(s.sheetName || 'ورقة').slice(0, 95),
    headers: (s.headers || []).slice(0, 50).map((h) => String(h ?? '').slice(0, 120)),
    rows: (s.rows || []).slice(0, 60).map((r) => ({
      cells: (Array.isArray(r) ? r : []).slice(0, 50).map((c) => String(c ?? '').slice(0, 120)),
    })),
  }));
}

function unpackSheetPreview(raw: unknown): SheetPreviewData[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const s = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const rawRows = Array.isArray(s.rows) ? s.rows : [];
    const rows = rawRows.map((r) => {
      if (Array.isArray(r)) return r.map((c) => String(c ?? ''));
      if (r && typeof r === 'object' && 'cells' in r && Array.isArray((r as { cells: unknown[] }).cells)) {
        return (r as { cells: unknown[] }).cells.map((c) => String(c ?? ''));
      }
      return [];
    });
    return {
      sheetName: String(s.sheetName || 'ورقة'),
      headers: Array.isArray(s.headers) ? s.headers.map((h) => String(h ?? '')) : [],
      rows,
    };
  });
}

function mapProjectDoc(data: Record<string, unknown>): ProjectFolder {
  return {
    id: String(data.id || ''),
    name: String(data.name || ''),
    domain: data.domain === 'university' ? 'university' : 'company',
    code: String(data.code || ''),
    description: String(data.description || ''),
    createdAt: tsToIso(data.createdAt),
  };
}

function mapFileDoc(data: Record<string, unknown>): IndexedFile {
  return {
    id: String(data.id || ''),
    title: String(data.title || ''),
    fileName: String(data.fileName || ''),
    category:
      data.category === 'word' || data.category === 'excel' || data.category === 'pdf'
        ? data.category
        : 'other',
    domain: data.domain === 'university' ? 'university' : 'company',
    projectId: String(data.projectId || ''),
    sizeBytes: Number(data.sizeBytes) || 0,
    updatedAt: tsToIso(data.updatedAt),
    notes: String(data.notes || ''),
    hasBlob: Boolean(data.hasBlob),
    mimeType: String(data.mimeType || ''),
    extractedText: String(data.extractedText || ''),
    sheetPreview: unpackSheetPreview(data.sheetPreview),
    starred: Boolean(data.starred),
    researchKind:
      data.researchKind === 'masters' ||
      data.researchKind === 'phd' ||
      data.researchKind === 'paper' ||
      data.researchKind === 'book'
        ? data.researchKind
        : 'none',
    headings: Array.isArray(data.headings) ? data.headings.map((h) => String(h)) : [],
  };
}

function mapImageDoc(data: Record<string, unknown>): IndexedImage {
  const thumb = String(data.thumbnailDataUrl || '');
  return {
    id: String(data.id || ''),
    title: String(data.title || ''),
    fileName: String(data.fileName || ''),
    domain: data.domain === 'university' ? 'university' : 'company',
    projectId: String(data.projectId || ''),
    sizeBytes: Number(data.sizeBytes) || 0,
    capturedAt: String(data.capturedAt || ''),
    caption: String(data.caption || ''),
    hasBlob: Boolean(data.hasBlob),
    thumbnailDataUrl: thumb,
    dataUrl: thumb,
    width: Number(data.width) || 0,
    height: Number(data.height) || 0,
    starred: Boolean(data.starred),
  };
}

function mapMemoDoc(data: Record<string, unknown>): WorkMemo {
  return {
    id: String(data.id || ''),
    title: String(data.title || ''),
    content: String(data.content || ''),
    domain: data.domain === 'university' ? 'university' : 'company',
    projectId: String(data.projectId || ''),
    updatedAt: tsToIso(data.updatedAt),
    pinned: Boolean(data.pinned),
    linkedFileIds: Array.isArray(data.linkedFileIds)
      ? data.linkedFileIds.map((x) => String(x))
      : [],
    direction: data.direction === 'incoming' ? 'incoming' : 'outgoing',
    departmentName: String(data.departmentName || ''),
    replyToId: String(data.replyToId || ''),
    threadId: String(data.threadId || ''),
  };
}

function mapDraftDoc(data: Record<string, unknown>): WorkDraft {
  return {
    id: String(data.id || ''),
    title: String(data.title || ''),
    content: String(data.content || ''),
    scope: data.scope === 'private' ? 'private' : 'factory',
    projectId: String(data.projectId || ''),
    linkedWordFileId: String(data.linkedWordFileId || ''),
    pinned: Boolean(data.pinned),
    updatedAt: tsToIso(data.updatedAt),
  };
}

function mapOrderDoc(data: Record<string, unknown>): WorkOrder {
  return {
    id: String(data.id || ''),
    refCode: String(data.refCode || ''),
    title: String(data.title || ''),
    details: String(data.details || ''),
    domain: data.domain === 'university' ? 'university' : 'company',
    projectId: String(data.projectId || ''),
    issuer: String(data.issuer || ''),
    assigneeOrUnit: String(data.assigneeOrUnit || ''),
    subDepartment: String(data.subDepartment || ''),
    technicians: Array.isArray(data.technicians)
      ? data.technicians.map((x) => String(x))
      : [],
    isAssigned: Boolean(data.isAssigned),
    priority:
      data.priority === 'urgent' || data.priority === 'high' ? data.priority : 'normal',
    status:
      data.status === 'in_progress' || data.status === 'review' || data.status === 'done'
        ? data.status
        : 'new',
    dueDate: String(data.dueDate || ''),
    createdAt: tsToIso(data.createdAt),
    linkedFileIds: Array.isArray(data.linkedFileIds)
      ? data.linkedFileIds.map((x) => String(x))
      : [],
    sourceMessageId: String(data.sourceMessageId || ''),
  };
}

function mapMessageDoc(data: Record<string, unknown>): IncomingMessage {
  return {
    id: String(data.id || ''),
    senderName: String(data.senderName || ''),
    senderRole: String(data.senderRole || ''),
    subject: String(data.subject || ''),
    body: String(data.body || ''),
    channel:
      data.channel === 'university_email' ||
      data.channel === 'whatsapp' ||
      data.channel === 'teams'
        ? data.channel
        : 'company_email',
    domain: data.domain === 'university' ? 'university' : 'company',
    projectId: String(data.projectId || ''),
    receivedAt: String(data.receivedAt || ''),
    isRead: Boolean(data.isRead),
    starred: Boolean(data.starred),
    convertedOrderId: String(data.convertedOrderId || ''),
    convertedMemoId: String(data.convertedMemoId || ''),
  };
}

function mapEntityDoc(data: Record<string, unknown>): CorrespondenceEntity {
  return {
    id: String(data.id || ''),
    name: String(data.name || ''),
    category: String(data.category || ''),
    contactInfo: String(data.contactInfo || ''),
    notes: String(data.notes || ''),
    createdAt: tsToIso(data.createdAt),
  };
}

function mapCorrespondenceDoc(data: Record<string, unknown>): ExternalCorrespondence {
  return {
    id: String(data.id || ''),
    entityId: String(data.entityId || ''),
    entityName: String(data.entityName || ''),
    direction: data.direction === 'outgoing' ? 'outgoing' : 'incoming',
    refNumber: String(data.refNumber || ''),
    subject: String(data.subject || ''),
    body: String(data.body || ''),
    date: String(data.date || ''),
    subDepartment: String(data.subDepartment || ''),
    linkedFileIds: Array.isArray(data.linkedFileIds)
      ? data.linkedFileIds.map((x) => String(x))
      : [],
    pinned: Boolean(data.pinned),
    updatedAt: tsToIso(data.updatedAt),
    replyToId: String(data.replyToId || ''),
    threadId: String(data.threadId || ''),
  };
}

export async function ensureUserProfile(user: User): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = (user.displayName || 'د. أيمن عبد الحميد').slice(0, 120);
    const email = (user.email || 'user@company.local').slice(0, 160);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: user.uid,
        displayName,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        email,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function flushPendingFirestoreWrites(): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  try {
    await waitForPendingWrites(db);
  } catch {
    // non-fatal
  }
}

export function subscribeWorkspace(
  userId: string,
  onPartial: (partial: Partial<WorkspaceState>) => void,
  onReady: () => void,
  onError: (err: Error) => void
): () => void {
  if (!hasFirestoreConfigured || !db) {
    onReady();
    return () => {};
  }
  const pending = new Set([
    'projects',
    'files',
    'images',
    'memos',
    'drafts',
    'orders',
    'messages',
    'correspondenceEntities',
    'correspondences',
  ]);

  const markReady = (key: string) => {
    pending.delete(key);
    if (pending.size === 0) onReady();
  };

  const watch = <T>(
    colName: string,
    mapper: (data: Record<string, unknown>) => T,
    key: keyof WorkspaceState
  ) => {
    const path = `users/${userId}/${colName}`;
    return onSnapshot(
      collection(db, 'users', userId, colName),
      (snap: QuerySnapshot) => {
        const items = snap.docs.map((d) =>
          mapper({ ...d.data(), id: d.id } as Record<string, unknown>)
        );
        onPartial({ [key]: items } as Partial<WorkspaceState>);
        markReady(colName);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );
  };

  const unsubs = [
    watch('projects', mapProjectDoc, 'projects'),
    watch('files', mapFileDoc, 'files'),
    watch('images', mapImageDoc, 'images'),
    watch('memos', mapMemoDoc, 'memos'),
    watch('drafts', mapDraftDoc, 'drafts'),
    watch('orders', mapOrderDoc, 'orders'),
    watch('messages', mapMessageDoc, 'messages'),
    watch('correspondenceEntities', mapEntityDoc, 'correspondenceEntities'),
    watch('correspondences', mapCorrespondenceDoc, 'correspondences'),
  ];

  return () => {
    unsubs.forEach((u) => u());
  };
}

async function getCollectionDocs(userId: string, colName: string) {
  const path = `users/${userId}/${colName}`;
  const ref = collection(db, 'users', userId, colName);
  try {
    try {
      return await getDocsFromServer(ref);
    } catch {
      return await getDocs(ref);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchCloudWorkspaceOnce(userId: string): Promise<WorkspaceState> {
  if (!hasFirestoreConfigured || !db) {
    return EMPTY_WORKSPACE;
  }
  const [
    projSnap,
    fileSnap,
    imgSnap,
    memoSnap,
    draftSnap,
    ordSnap,
    msgSnap,
    entSnap,
    corrSnap,
  ] = await Promise.all([
    getCollectionDocs(userId, 'projects'),
    getCollectionDocs(userId, 'files'),
    getCollectionDocs(userId, 'images'),
    getCollectionDocs(userId, 'memos'),
    getCollectionDocs(userId, 'drafts'),
    getCollectionDocs(userId, 'orders'),
    getCollectionDocs(userId, 'messages'),
    getCollectionDocs(userId, 'correspondenceEntities'),
    getCollectionDocs(userId, 'correspondences'),
  ]);

  return {
    projects: projSnap.docs.map((d) => mapProjectDoc({ ...d.data(), id: d.id })),
    files: fileSnap.docs.map((d) => mapFileDoc({ ...d.data(), id: d.id })),
    images: imgSnap.docs.map((d) => mapImageDoc({ ...d.data(), id: d.id })),
    memos: memoSnap.docs.map((d) => mapMemoDoc({ ...d.data(), id: d.id })),
    drafts: draftSnap.docs.map((d) => mapDraftDoc({ ...d.data(), id: d.id })),
    orders: ordSnap.docs.map((d) => mapOrderDoc({ ...d.data(), id: d.id })),
    messages: msgSnap.docs.map((d) => mapMessageDoc({ ...d.data(), id: d.id })),
    correspondenceEntities: entSnap.docs.map((d) => mapEntityDoc({ ...d.data(), id: d.id })),
    correspondences: corrSnap.docs.map((d) => mapCorrespondenceDoc({ ...d.data(), id: d.id })),
  };
}

type BatchOp = (batch: ReturnType<typeof writeBatch>) => void;

async function commitOpsInChunks(ops: BatchOp[]): Promise<void> {
  for (let i = 0; i < ops.length; i += 350) {
    const batch = writeBatch(db);
    ops.slice(i, i + 350).forEach((fn) => fn(batch));
    await batch.commit();
  }
}

export async function seedWorkspaceBatch(
  user: User,
  rawSeed: WorkspaceState
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  await ensureUserProfile(user);
  const userId = user.uid;
  const seed = sanitizeWorkspaceForSync(rawSeed);
  const parentOps: BatchOp[] = [];
  const childOps: BatchOp[] = [];

  seed.projects.forEach((p) => {
    parentOps.push((batch) =>
      batch.set(doc(db, 'users', userId, 'projects', p.id), {
        id: p.id,
        ownerId: userId,
        name: p.name,
        domain: p.domain,
        code: p.code,
        description: p.description,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  seed.correspondenceEntities.forEach((e) => {
    parentOps.push((batch) =>
      batch.set(doc(db, 'users', userId, 'correspondenceEntities', e.id), {
        id: e.id,
        ownerId: userId,
        name: e.name,
        category: e.category,
        contactInfo: e.contactInfo,
        notes: e.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  seed.files.forEach((f) => {
    childOps.push((batch) =>
      batch.set(doc(db, 'users', userId, 'files', f.id), {
        id: f.id,
        ownerId: userId,
        title: f.title,
        fileName: f.fileName,
        category: f.category,
        domain: f.domain,
        projectId: f.projectId,
        sizeBytes: f.sizeBytes,
        notes: f.notes,
        hasBlob: f.hasBlob,
        mimeType: f.mimeType,
        extractedText: f.extractedText || '',
        sheetPreview: packSheetPreview(f.sheetPreview),
        starred: Boolean(f.starred),
        researchKind: f.researchKind || 'none',
        headings: f.headings || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  seed.images.forEach((img) => {
    childOps.push((batch) =>
      batch.set(doc(db, 'users', userId, 'images', img.id), {
        id: img.id,
        ownerId: userId,
        title: img.title,
        fileName: img.fileName,
        domain: img.domain,
        projectId: img.projectId,
        sizeBytes: img.sizeBytes,
        capturedAt: img.capturedAt,
        caption: img.caption,
        hasBlob: img.hasBlob,
        thumbnailDataUrl: (img.thumbnailDataUrl || '').slice(0, 245000),
        width: img.width || 0,
        height: img.height || 0,
        starred: Boolean(img.starred),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  seed.memos.forEach((m) => {
    childOps.push((batch) =>
      batch.set(doc(db, 'users', userId, 'memos', m.id), {
        id: m.id,
        ownerId: userId,
        title: m.title,
        content: m.content,
        domain: m.domain,
        projectId: m.projectId,
        pinned: Boolean(m.pinned),
        linkedFileIds: m.linkedFileIds || [],
        direction: m.direction || 'outgoing',
        departmentName: m.departmentName || '',
        replyToId: m.replyToId || '',
        threadId: m.threadId || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  seed.drafts.forEach((d) => {
    childOps.push((batch) =>
      batch.set(doc(db, 'users', userId, 'drafts', d.id), {
        id: d.id,
        ownerId: userId,
        title: d.title,
        content: d.content,
        scope: d.scope || 'factory',
        projectId: d.projectId,
        linkedWordFileId: d.linkedWordFileId || '',
        pinned: Boolean(d.pinned),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  seed.orders.forEach((o) => {
    childOps.push((batch) =>
      batch.set(doc(db, 'users', userId, 'orders', o.id), {
        id: o.id,
        ownerId: userId,
        refCode: o.refCode,
        title: o.title,
        details: o.details,
        domain: o.domain,
        projectId: o.projectId,
        issuer: o.issuer,
        assigneeOrUnit: o.assigneeOrUnit,
        subDepartment: o.subDepartment || o.assigneeOrUnit,
        technicians: o.technicians || [],
        isAssigned: Boolean(o.isAssigned),
        priority: o.priority,
        status: o.status,
        dueDate: o.dueDate,
        linkedFileIds: o.linkedFileIds || [],
        sourceMessageId: o.sourceMessageId || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  seed.messages.forEach((msg) => {
    childOps.push((batch) =>
      batch.set(doc(db, 'users', userId, 'messages', msg.id), {
        id: msg.id,
        ownerId: userId,
        senderName: msg.senderName,
        senderRole: msg.senderRole,
        subject: msg.subject,
        body: msg.body,
        channel: msg.channel,
        domain: msg.domain,
        projectId: msg.projectId,
        receivedAt: msg.receivedAt,
        isRead: Boolean(msg.isRead),
        starred: Boolean(msg.starred),
        convertedOrderId: msg.convertedOrderId || '',
        convertedMemoId: msg.convertedMemoId || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  seed.correspondences.forEach((c) => {
    childOps.push((batch) =>
      batch.set(doc(db, 'users', userId, 'correspondences', c.id), {
        id: c.id,
        ownerId: userId,
        entityId: c.entityId,
        entityName: c.entityName,
        direction: c.direction,
        refNumber: c.refNumber,
        subject: c.subject,
        body: c.body,
        date: c.date,
        subDepartment: c.subDepartment || '',
        linkedFileIds: c.linkedFileIds || [],
        pinned: Boolean(c.pinned),
        replyToId: c.replyToId || '',
        threadId: c.threadId || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  try {
    if (parentOps.length > 0) await commitOpsInChunks(parentOps);
    if (childOps.length > 0) await commitOpsInChunks(childOps);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

export async function syncMergedToCloud(
  user: User,
  cloudRaw: WorkspaceState,
  mergedRaw: WorkspaceState
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  await ensureUserProfile(user);
  const userId = user.uid;
  const merged = sanitizeWorkspaceForSync(mergedRaw);
  const cloud = sanitizeWorkspaceForSync(cloudRaw);

  const cloudProjIds = new Set(cloud.projects.map((x) => x.id));
  const cloudEntIds = new Set(cloud.correspondenceEntities.map((x) => x.id));
  const cloudFileIds = new Set(cloud.files.map((x) => x.id));
  const cloudImageIds = new Set(cloud.images.map((x) => x.id));
  const cloudMemoIds = new Set(cloud.memos.map((x) => x.id));
  const cloudDraftIds = new Set(cloud.drafts.map((x) => x.id));
  const cloudOrderMap = new Map(cloud.orders.map((x) => [x.id, x]));
  const cloudMsgIds = new Set(cloud.messages.map((x) => x.id));
  const cloudCorrIds = new Set(cloud.correspondences.map((x) => x.id));

  const parentOps: BatchOp[] = [];
  const childOps: BatchOp[] = [];

  merged.projects.forEach((p) => {
    const ref = doc(db, 'users', userId, 'projects', p.id);
    if (!cloudProjIds.has(p.id)) {
      parentOps.push((b) =>
        b.set(ref, {
          id: p.id,
          ownerId: userId,
          name: p.name,
          domain: p.domain,
          code: p.code,
          description: p.description,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      parentOps.push((b) =>
        b.update(ref, {
          name: p.name,
          domain: p.domain,
          code: p.code,
          description: p.description,
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  merged.correspondenceEntities.forEach((e) => {
    const ref = doc(db, 'users', userId, 'correspondenceEntities', e.id);
    if (!cloudEntIds.has(e.id)) {
      parentOps.push((b) =>
        b.set(ref, {
          id: e.id,
          ownerId: userId,
          name: e.name,
          category: e.category,
          contactInfo: e.contactInfo,
          notes: e.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      parentOps.push((b) =>
        b.update(ref, {
          name: e.name,
          category: e.category,
          contactInfo: e.contactInfo,
          notes: e.notes,
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  merged.files.forEach((f) => {
    const ref = doc(db, 'users', userId, 'files', f.id);
    if (!cloudFileIds.has(f.id)) {
      childOps.push((b) =>
        b.set(ref, {
          id: f.id,
          ownerId: userId,
          title: f.title,
          fileName: f.fileName,
          category: f.category,
          domain: f.domain,
          projectId: f.projectId,
          sizeBytes: f.sizeBytes,
          notes: f.notes,
          hasBlob: f.hasBlob,
          mimeType: f.mimeType,
          extractedText: f.extractedText || '',
          sheetPreview: packSheetPreview(f.sheetPreview),
          starred: Boolean(f.starred),
          researchKind: f.researchKind || 'none',
          headings: f.headings || [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      childOps.push((b) =>
        b.update(ref, {
          title: f.title,
          domain: f.domain,
          projectId: f.projectId,
          notes: f.notes,
          starred: Boolean(f.starred),
          researchKind: f.researchKind || 'none',
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  merged.images.forEach((img) => {
    const ref = doc(db, 'users', userId, 'images', img.id);
    if (!cloudImageIds.has(img.id)) {
      childOps.push((b) =>
        b.set(ref, {
          id: img.id,
          ownerId: userId,
          title: img.title,
          fileName: img.fileName,
          domain: img.domain,
          projectId: img.projectId,
          sizeBytes: img.sizeBytes,
          capturedAt: img.capturedAt,
          caption: img.caption,
          hasBlob: img.hasBlob,
          thumbnailDataUrl: (img.thumbnailDataUrl || '').slice(0, 245000),
          width: img.width || 0,
          height: img.height || 0,
          starred: Boolean(img.starred),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      childOps.push((b) =>
        b.update(ref, {
          title: img.title,
          domain: img.domain,
          projectId: img.projectId,
          caption: img.caption,
          starred: Boolean(img.starred),
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  merged.memos.forEach((m) => {
    const ref = doc(db, 'users', userId, 'memos', m.id);
    if (!cloudMemoIds.has(m.id)) {
      childOps.push((b) =>
        b.set(ref, {
          id: m.id,
          ownerId: userId,
          title: m.title,
          content: m.content,
          domain: m.domain,
          projectId: m.projectId,
          pinned: Boolean(m.pinned),
          linkedFileIds: m.linkedFileIds || [],
          direction: m.direction || 'outgoing',
          departmentName: m.departmentName || '',
          replyToId: m.replyToId || '',
          threadId: m.threadId || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      childOps.push((b) =>
        b.update(ref, {
          title: m.title,
          content: m.content,
          domain: m.domain,
          projectId: m.projectId,
          pinned: Boolean(m.pinned),
          linkedFileIds: m.linkedFileIds || [],
          direction: m.direction || 'outgoing',
          departmentName: m.departmentName || '',
          replyToId: m.replyToId || '',
          threadId: m.threadId || '',
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  merged.drafts.forEach((d) => {
    const ref = doc(db, 'users', userId, 'drafts', d.id);
    if (!cloudDraftIds.has(d.id)) {
      childOps.push((b) =>
        b.set(ref, {
          id: d.id,
          ownerId: userId,
          title: d.title,
          content: d.content,
          scope: d.scope || 'factory',
          projectId: d.projectId,
          linkedWordFileId: d.linkedWordFileId || '',
          pinned: Boolean(d.pinned),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      childOps.push((b) =>
        b.update(ref, {
          title: d.title,
          content: d.content,
          scope: d.scope || 'factory',
          projectId: d.projectId,
          linkedWordFileId: d.linkedWordFileId || '',
          pinned: Boolean(d.pinned),
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  merged.orders.forEach((o) => {
    const ref = doc(db, 'users', userId, 'orders', o.id);
    const cloudExisting = cloudOrderMap.get(o.id);
    if (!cloudExisting) {
      childOps.push((b) =>
        b.set(ref, {
          id: o.id,
          ownerId: userId,
          refCode: o.refCode,
          title: o.title,
          details: o.details,
          domain: o.domain,
          projectId: o.projectId,
          issuer: o.issuer,
          assigneeOrUnit: o.assigneeOrUnit,
          subDepartment: o.subDepartment || o.assigneeOrUnit,
          technicians: o.technicians || [],
          isAssigned: Boolean(o.isAssigned),
          priority: o.priority,
          status: o.status,
          dueDate: o.dueDate,
          linkedFileIds: o.linkedFileIds || [],
          sourceMessageId: o.sourceMessageId || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else if (cloudExisting.status !== 'done') {
      childOps.push((b) =>
        b.update(ref, {
          refCode: o.refCode,
          title: o.title,
          details: o.details,
          domain: o.domain,
          projectId: o.projectId,
          issuer: o.issuer,
          assigneeOrUnit: o.assigneeOrUnit,
          subDepartment: o.subDepartment || o.assigneeOrUnit,
          technicians: o.technicians || [],
          isAssigned: Boolean(o.isAssigned),
          priority: o.priority,
          status: o.status,
          dueDate: o.dueDate,
          linkedFileIds: o.linkedFileIds || [],
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  merged.messages.forEach((msg) => {
    const ref = doc(db, 'users', userId, 'messages', msg.id);
    if (!cloudMsgIds.has(msg.id)) {
      childOps.push((b) =>
        b.set(ref, {
          id: msg.id,
          ownerId: userId,
          senderName: msg.senderName,
          senderRole: msg.senderRole,
          subject: msg.subject,
          body: msg.body,
          channel: msg.channel,
          domain: msg.domain,
          projectId: msg.projectId,
          receivedAt: msg.receivedAt,
          isRead: Boolean(msg.isRead),
          starred: Boolean(msg.starred),
          convertedOrderId: msg.convertedOrderId || '',
          convertedMemoId: msg.convertedMemoId || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      childOps.push((b) =>
        b.update(ref, {
          senderName: msg.senderName,
          senderRole: msg.senderRole,
          subject: msg.subject,
          body: msg.body,
          channel: msg.channel,
          domain: msg.domain,
          projectId: msg.projectId,
          receivedAt: msg.receivedAt,
          isRead: Boolean(msg.isRead),
          starred: Boolean(msg.starred),
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  merged.correspondences.forEach((c) => {
    const ref = doc(db, 'users', userId, 'correspondences', c.id);
    if (!cloudCorrIds.has(c.id)) {
      childOps.push((b) =>
        b.set(ref, {
          id: c.id,
          ownerId: userId,
          entityId: c.entityId,
          entityName: c.entityName,
          direction: c.direction,
          refNumber: c.refNumber,
          subject: c.subject,
          body: c.body,
          date: c.date,
          subDepartment: c.subDepartment || '',
          linkedFileIds: c.linkedFileIds || [],
          pinned: Boolean(c.pinned),
          replyToId: c.replyToId || '',
          threadId: c.threadId || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      childOps.push((b) =>
        b.update(ref, {
          entityId: c.entityId,
          entityName: c.entityName,
          direction: c.direction,
          refNumber: c.refNumber,
          subject: c.subject,
          body: c.body,
          date: c.date,
          subDepartment: c.subDepartment || '',
          linkedFileIds: c.linkedFileIds || [],
          pinned: Boolean(c.pinned),
          replyToId: c.replyToId || '',
          threadId: c.threadId || '',
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  try {
    if (parentOps.length > 0) await commitOpsInChunks(parentOps);
    if (childOps.length > 0) await commitOpsInChunks(childOps);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

export async function clearWorkspaceBatch(
  userId: string,
  ws: WorkspaceState
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const ops: BatchOp[] = [];
  const queueDelete = (colName: string, id: string) => {
    ops.push((b) => b.delete(doc(db, 'users', userId, colName, id)));
  };

  ws.correspondences.forEach((x) => queueDelete('correspondences', x.id));
  ws.messages.forEach((x) => queueDelete('messages', x.id));
  ws.orders.forEach((x) => queueDelete('orders', x.id));
  ws.drafts.forEach((x) => queueDelete('drafts', x.id));
  ws.memos.forEach((x) => queueDelete('memos', x.id));
  ws.images.forEach((x) => queueDelete('images', x.id));
  ws.files.forEach((x) => queueDelete('files', x.id));
  ws.correspondenceEntities.forEach((x) => queueDelete('correspondenceEntities', x.id));
  ws.projects.forEach((x) => queueDelete('projects', x.id));

  try {
    if (ops.length > 0) await commitOpsInChunks(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
  }
}

export async function clearDiffRemovedCloudBatch(
  userId: string,
  beforeWs: WorkspaceState,
  afterWs: WorkspaceState
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const ops: BatchOp[] = [];
  const diffDel = <T extends { id: string }>(
    colName: string,
    prev: T[],
    next: T[]
  ) => {
    const keep = new Set(next.map((x) => x.id));
    prev.forEach((item) => {
      if (!keep.has(item.id)) {
        ops.push((b) => b.delete(doc(db, 'users', userId, colName, item.id)));
      }
    });
  };
  diffDel('correspondences', beforeWs.correspondences, afterWs.correspondences);
  diffDel('messages', beforeWs.messages, afterWs.messages);
  diffDel('orders', beforeWs.orders, afterWs.orders);
  diffDel('drafts', beforeWs.drafts, afterWs.drafts);
  diffDel('memos', beforeWs.memos, afterWs.memos);
  diffDel('images', beforeWs.images, afterWs.images);
  diffDel('files', beforeWs.files, afterWs.files);
  diffDel(
    'correspondenceEntities',
    beforeWs.correspondenceEntities,
    afterWs.correspondenceEntities
  );
  diffDel('projects', beforeWs.projects, afterWs.projects);

  try {
    if (ops.length > 0) await commitOpsInChunks(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
  }
}

// Individual CRUD operations
export async function saveProject(
  userId: string,
  p: Omit<ProjectFolder, 'createdAt'>
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/projects/${p.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'projects', p.id), {
      id: p.id,
      ownerId: userId,
      name: p.name.slice(0, 155),
      domain: p.domain,
      code: p.code.slice(0, 38),
      description: p.description.slice(0, 590),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProject(
  userId: string,
  projectId: string,
  updates: Partial<Pick<ProjectFolder, 'name' | 'code' | 'description' | 'domain'>>
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'projects', projectId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeProject(userId: string, projectId: string): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCorrespondenceEntity(
  userId: string,
  ent: Omit<CorrespondenceEntity, 'createdAt'>
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/correspondenceEntities/${ent.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'correspondenceEntities', ent.id), {
      id: ent.id,
      ownerId: userId,
      name: ent.name.slice(0, 155),
      category: ent.category.slice(0, 78),
      contactInfo: ent.contactInfo.slice(0, 195),
      notes: ent.notes.slice(0, 980),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeCorrespondenceEntity(
  userId: string,
  entityId: string
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/correspondenceEntities/${entityId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'correspondenceEntities', entityId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveExternalCorrespondence(
  userId: string,
  corr: Omit<ExternalCorrespondence, 'updatedAt'>
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/correspondences/${corr.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'correspondences', corr.id), {
      id: corr.id,
      ownerId: userId,
      entityId: corr.entityId,
      entityName: corr.entityName.slice(0, 155),
      direction: corr.direction,
      refNumber: corr.refNumber.slice(0, 58),
      subject: corr.subject.slice(0, 235),
      body: corr.body.slice(0, 29000),
      date: corr.date.slice(0, 38),
      subDepartment: (corr.subDepartment || '').slice(0, 155),
      linkedFileIds: (corr.linkedFileIds || []).slice(0, 20),
      pinned: Boolean(corr.pinned),
      replyToId: corr.replyToId || '',
      threadId: corr.threadId || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateExternalCorrespondence(
  userId: string,
  id: string,
  updates: Partial<
    Pick<
      ExternalCorrespondence,
      | 'entityId'
      | 'entityName'
      | 'direction'
      | 'refNumber'
      | 'subject'
      | 'body'
      | 'date'
      | 'subDepartment'
      | 'linkedFileIds'
      | 'pinned'
      | 'replyToId'
      | 'threadId'
    >
  >
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/correspondences/${id}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'correspondences', id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeExternalCorrespondence(
  userId: string,
  id: string
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/correspondences/${id}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'correspondences', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveIndexedFile(
  userId: string,
  f: Omit<IndexedFile, 'updatedAt'>
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/files/${f.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'files', f.id), {
      id: f.id,
      ownerId: userId,
      title: f.title.slice(0, 195),
      fileName: f.fileName.slice(0, 255),
      category: f.category,
      domain: f.domain,
      projectId: f.projectId,
      sizeBytes: f.sizeBytes,
      notes: f.notes.slice(0, 1950),
      hasBlob: Boolean(f.hasBlob),
      mimeType: f.mimeType.slice(0, 155),
      extractedText: (f.extractedText || '').slice(0, 29000),
      sheetPreview: packSheetPreview(f.sheetPreview),
      starred: Boolean(f.starred),
      researchKind: f.researchKind || 'none',
      headings: (f.headings || []).slice(0, 60),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateIndexedFileMeta(
  userId: string,
  id: string,
  updates: Partial<
    Pick<
      IndexedFile,
      'title' | 'domain' | 'projectId' | 'notes' | 'starred' | 'researchKind' | 'headings'
    >
  >
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/files/${id}`;
  const { headings: _omitHeadings, ...allowedUpdates } = updates;
  try {
    await updateDoc(doc(db, 'users', userId, 'files', id), {
      ...allowedUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeIndexedFile(userId: string, id: string): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/files/${id}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'files', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveIndexedImage(
  userId: string,
  img: IndexedImage
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/images/${img.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'images', img.id), {
      id: img.id,
      ownerId: userId,
      title: img.title.slice(0, 195),
      fileName: img.fileName.slice(0, 255),
      domain: img.domain,
      projectId: img.projectId,
      sizeBytes: img.sizeBytes,
      capturedAt: img.capturedAt.slice(0, 38),
      caption: img.caption.slice(0, 980),
      hasBlob: Boolean(img.hasBlob),
      thumbnailDataUrl: (img.thumbnailDataUrl || img.dataUrl || '').slice(0, 245000),
      width: img.width || 0,
      height: img.height || 0,
      starred: Boolean(img.starred),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateIndexedImageMeta(
  userId: string,
  id: string,
  updates: Partial<Pick<IndexedImage, 'title' | 'domain' | 'projectId' | 'caption' | 'starred'>>
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/images/${id}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'images', id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeIndexedImage(userId: string, id: string): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/images/${id}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'images', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveMemo(
  userId: string,
  m: Omit<WorkMemo, 'updatedAt'>
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/memos/${m.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'memos', m.id), {
      id: m.id,
      ownerId: userId,
      title: m.title.slice(0, 195),
      content: m.content.slice(0, 39000),
      domain: m.domain,
      projectId: m.projectId,
      pinned: Boolean(m.pinned),
      linkedFileIds: (m.linkedFileIds || []).slice(0, 20),
      direction: m.direction || 'outgoing',
      departmentName: (m.departmentName || '').slice(0, 155),
      replyToId: m.replyToId || '',
      threadId: m.threadId || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateMemo(
  userId: string,
  id: string,
  updates: Partial<
    Pick<
      WorkMemo,
      | 'title'
      | 'content'
      | 'domain'
      | 'projectId'
      | 'pinned'
      | 'linkedFileIds'
      | 'direction'
      | 'departmentName'
      | 'replyToId'
      | 'threadId'
    >
  >
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/memos/${id}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'memos', id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeMemo(userId: string, id: string): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/memos/${id}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'memos', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveDraft(
  userId: string,
  d: Omit<WorkDraft, 'updatedAt'>
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/drafts/${d.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'drafts', d.id), {
      id: d.id,
      ownerId: userId,
      title: d.title.slice(0, 195),
      content: d.content.slice(0, 39000),
      scope: d.scope || 'factory',
      projectId: d.projectId,
      linkedWordFileId: d.linkedWordFileId || '',
      pinned: Boolean(d.pinned),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDraft(
  userId: string,
  id: string,
  updates: Partial<
    Pick<WorkDraft, 'title' | 'content' | 'projectId' | 'scope' | 'linkedWordFileId' | 'pinned'>
  >
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/drafts/${id}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'drafts', id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeDraft(userId: string, id: string): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/drafts/${id}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'drafts', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveWorkOrder(
  userId: string,
  o: Omit<WorkOrder, 'createdAt'>
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/orders/${o.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'orders', o.id), {
      id: o.id,
      ownerId: userId,
      refCode: o.refCode.slice(0, 38),
      title: o.title.slice(0, 195),
      details: o.details.slice(0, 4900),
      domain: o.domain,
      projectId: o.projectId,
      issuer: o.issuer.slice(0, 155),
      assigneeOrUnit: o.assigneeOrUnit.slice(0, 155),
      subDepartment: (o.subDepartment || o.assigneeOrUnit).slice(0, 155),
      technicians: (o.technicians || []).slice(0, 20),
      isAssigned: Boolean(o.isAssigned),
      priority: o.priority,
      status: o.status,
      dueDate: o.dueDate.slice(0, 38),
      linkedFileIds: (o.linkedFileIds || []).slice(0, 20),
      sourceMessageId: o.sourceMessageId || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWorkOrder(
  userId: string,
  id: string,
  updates: Partial<
    Pick<
      WorkOrder,
      | 'refCode'
      | 'title'
      | 'details'
      | 'domain'
      | 'projectId'
      | 'issuer'
      | 'assigneeOrUnit'
      | 'subDepartment'
      | 'technicians'
      | 'isAssigned'
      | 'priority'
      | 'status'
      | 'dueDate'
      | 'linkedFileIds'
    >
  >
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/orders/${id}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'orders', id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateWorkOrderStatus(
  userId: string,
  id: string,
  status: WorkOrderStatus
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/orders/${id}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'orders', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeWorkOrder(userId: string, id: string): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/orders/${id}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'orders', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateMessage(
  userId: string,
  id: string,
  updates: Partial<
    Pick<IncomingMessage, 'isRead' | 'starred' | 'convertedOrderId' | 'convertedMemoId'>
  >
): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/messages/${id}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'messages', id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeMessage(userId: string, id: string): Promise<void> {
  if (!hasFirestoreConfigured || !db) return;
  const path = `users/${userId}/messages/${id}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'messages', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
