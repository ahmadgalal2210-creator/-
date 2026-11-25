import { useEffect, useState } from 'react';
import {
  FileText,
  FolderPlus,
  Loader2,
  Mic,
  Reply,
  Sparkles,
  Square,
  Upload,
  X,
} from 'lucide-react';
import {
  formatVoiceSeconds,
  useVoiceDictation,
} from '../hooks/useVoiceDictation';
import { saveLocalBlob } from '../lib/blobStore';
import {
  cleanFileTitle,
  generateWordDocxBlob,
  isImageFile,
  makeSafeId,
  parseDocumentFile,
  processImageFile,
} from '../lib/fileParser';
import { downloadMemoPdf } from '../lib/pdfExporter';
import { SUB_DEPARTMENTS } from '../types';
import type {
  CorrespondenceEntity,
  DraftScope,
  ExternalCorrespondence,
  IndexedFile,
  IndexedImage,
  ItemDomain,
  MemoDirection,
  PriorityLevel,
  ProjectFolder,
  ResearchKind,
  WorkDraft,
  WorkMemo,
  WorkOrder,
  WorkOrderStatus,
} from '../types';
import type { PrintableMemoData } from './MemoA4PrintSheet';
import { PrintAsMenu } from './PrintAsMenu';

export type ModalType =
  | 'entity'
  | 'correspondence'
  | 'project'
  | 'file'
  | 'research'
  | 'image'
  | 'memo'
  | 'draft'
  | 'order'
  | null;

interface WorkspaceModalsProps {
  modal: ModalType;
  projects: ProjectFolder[];
  entities: CorrespondenceEntity[];
  defaultProjectId?: string;
  defaultMemoDirection?: MemoDirection;
  defaultDraftScope?: DraftScope;
  defaultSubDepartment?: string;
  defaultEntityId?: string;
  editingProject?: ProjectFolder | null;
  replyToMemo?: WorkMemo | null;
  replyToCorrespondence?: ExternalCorrespondence | null;
  onClose: () => void;
  onCreateEntity: (ent: Omit<CorrespondenceEntity, 'createdAt'>) => Promise<void>;
  onCreateCorrespondence: (c: Omit<ExternalCorrespondence, 'updatedAt'>) => Promise<void>;
  onCreateProject: (p: Omit<ProjectFolder, 'createdAt'>) => Promise<void>;
  onUpdateProject: (
    id: string,
    updates: Partial<Pick<ProjectFolder, 'name' | 'code' | 'description' | 'domain'>>
  ) => Promise<void>;
  onCreateFile: (f: Omit<IndexedFile, 'updatedAt'>) => Promise<void>;
  onCreateImage: (img: IndexedImage) => Promise<void>;
  onCreateMemo: (m: Omit<WorkMemo, 'updatedAt'>) => Promise<void>;
  onCreateDraft: (d: Omit<WorkDraft, 'updatedAt'>) => Promise<void>;
  onCreateOrder: (o: Omit<WorkOrder, 'createdAt'>) => Promise<void>;
  onPrintMemo: (data: PrintableMemoData, options?: { previewOnly?: boolean }) => void;
  onToast: (msg: string) => void;
}

export function WorkspaceModals({
  modal,
  projects,
  entities,
  defaultProjectId = '',
  defaultMemoDirection = 'outgoing',
  defaultDraftScope = 'factory',
  defaultSubDepartment = SUB_DEPARTMENTS[0].name,
  defaultEntityId = '',
  editingProject = null,
  replyToMemo = null,
  replyToCorrespondence = null,
  onClose,
  onCreateEntity,
  onCreateCorrespondence,
  onCreateProject,
  onUpdateProject,
  onCreateFile,
  onCreateImage,
  onCreateMemo,
  onCreateDraft,
  onCreateOrder,
  onPrintMemo,
  onToast,
}: WorkspaceModalsProps) {
  const [busy, setBusy] = useState(false);

  // Project state
  const [projName, setProjName] = useState('');
  const [projCode, setProjCode] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projDomain, setProjDomain] = useState<ItemDomain>('company');

  // Entity state
  const [entName, setEntName] = useState('');
  const [entCategory, setEntCategory] = useState('جهة حكومية / رقابية');
  const [entContact, setEntContact] = useState('');
  const [entNotes, setEntNotes] = useState('');

  // Correspondence state
  const [corrEntityId, setCorrEntityId] = useState('');
  const [corrDirection, setCorrDirection] = useState<MemoDirection>('outgoing');
  const [corrRef, setCorrRef] = useState('');
  const [corrSubject, setCorrSubject] = useState('');
  const [corrBody, setCorrBody] = useState('');
  const [corrDate, setCorrDate] = useState(new Date().toISOString().slice(0, 10));
  const [corrSubDept, setCorrSubDept] = useState(defaultSubDepartment);
  const [corrLinkedFileIds, setCorrLinkedFileIds] = useState<string[]>([]);

  // File / Research / Image upload state
  const [fileTitle, setFileTitle] = useState('');
  const [fileProjectId, setFileProjectId] = useState(defaultProjectId);
  const [fileNotes, setFileNotes] = useState('');
  const [fileResearchKind, setFileResearchKind] = useState<ResearchKind>('paper');
  const [parsedFileObj, setParsedFileObj] = useState<File | null>(null);
  const [parsedDocMeta, setParsedDocMeta] = useState<Awaited<
    ReturnType<typeof parseDocumentFile>
  > | null>(null);
  const [parsedImgMeta, setParsedImgMeta] = useState<Awaited<
    ReturnType<typeof processImageFile>
  > | null>(null);

  // Memo state
  const [memoDirection, setMemoDirection] = useState<MemoDirection>(defaultMemoDirection);
  const [memoTitle, setMemoTitle] = useState('');
  const [memoDept, setMemoDept] = useState('الإدارة العامة للبيئة والسلامة المهنية');
  const [memoProjectId, setMemoProjectId] = useState(defaultProjectId);
  const [memoContent, setMemoContent] = useState('');
  const [memoLinkedIds, setMemoLinkedIds] = useState<string[]>([]);
  const [memoLinkedNames, setMemoLinkedNames] = useState<string[]>([]);

  // Draft state
  const [draftTitle, setDraftTitle] = useState('');
  const [draftScope, setDraftScope] = useState<DraftScope>(defaultDraftScope);
  const [draftProjectId, setDraftProjectId] = useState(defaultProjectId);
  const [draftContent, setDraftContent] = useState('');

  // Order state
  const [orderRef, setOrderRef] = useState('');
  const [orderTitle, setOrderTitle] = useState('');
  const [orderDetails, setOrderDetails] = useState('');
  const [orderSubDept, setOrderSubDept] = useState(defaultSubDepartment);
  const [orderTechs, setOrderTechs] = useState('');
  const [orderAssigned, setOrderAssigned] = useState(false);
  const [orderPriority, setOrderPriority] = useState<PriorityLevel>('normal');
  const [orderStatus, setOrderStatus] = useState<WorkOrderStatus>('new');
  const [orderDueDate, setOrderDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderProjectId, setOrderProjectId] = useState(defaultProjectId);

  const draftVoice = useVoiceDictation({
    onTranscript: (text) => {
      setDraftContent((prev) => (prev ? `${prev}\n${text}` : text));
    },
    onStatus: onToast,
  });

  const memoVoice = useVoiceDictation({
    onTranscript: (text) => {
      setMemoContent((prev) => (prev ? `${prev}\n${text}` : text));
    },
    onStatus: onToast,
  });

  const corrVoice = useVoiceDictation({
    onTranscript: (text) => {
      setCorrBody((prev) => (prev ? `${prev}\n${text}` : text));
    },
    onStatus: onToast,
  });

  useEffect(() => {
    if (!modal) {
      draftVoice.cancel();
      memoVoice.cancel();
      corrVoice.cancel();
      return;
    }
    setBusy(false);

    if (modal === 'project') {
      if (editingProject) {
        setProjName(editingProject.name);
        setProjCode(editingProject.code);
        setProjDesc(editingProject.description);
        setProjDomain(editingProject.domain);
      } else {
        setProjName('');
        setProjCode('');
        setProjDesc('');
        setProjDomain('company');
      }
    }

    if (modal === 'entity') {
      setEntName('');
      setEntCategory('جهة حكومية / رقابية');
      setEntContact('');
      setEntNotes('');
    }

    if (modal === 'correspondence') {
      if (replyToCorrespondence) {
        setCorrEntityId(replyToCorrespondence.entityId);
        setCorrDirection(
          replyToCorrespondence.direction === 'incoming' ? 'outgoing' : 'incoming'
        );
        setCorrRef(`رد-${replyToCorrespondence.refNumber || Date.now().toString().slice(-4)}`);
        setCorrSubject(
          replyToCorrespondence.subject.startsWith('رداً على:')
            ? replyToCorrespondence.subject
            : `رداً على: ${replyToCorrespondence.subject}`
        );
        setCorrBody(
          `بالإشارة إلى المراسلة رقم (${replyToCorrespondence.refNumber || '—'}) بتاريخ ${replyToCorrespondence.date} بشأن "${replyToCorrespondence.subject}":\n\n`
        );
        setCorrSubDept(replyToCorrespondence.subDepartment || defaultSubDepartment);
      } else {
        setCorrEntityId(defaultEntityId || entities[0]?.id || '');
        setCorrDirection('outgoing');
        setCorrRef(`EXT-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`);
        setCorrSubject('');
        setCorrBody('');
        setCorrSubDept(defaultSubDepartment);
      }
      setCorrDate(new Date().toISOString().slice(0, 10));
      setCorrLinkedFileIds([]);
    }

    if (modal === 'file' || modal === 'research' || modal === 'image') {
      setFileTitle('');
      setFileProjectId(defaultProjectId);
      setFileNotes('');
      setFileResearchKind('paper');
      setParsedFileObj(null);
      setParsedDocMeta(null);
      setParsedImgMeta(null);
    }

    if (modal === 'memo') {
      if (replyToMemo) {
        setMemoDirection(replyToMemo.direction === 'incoming' ? 'outgoing' : 'incoming');
        setMemoTitle(
          replyToMemo.title.startsWith('رداً على:')
            ? replyToMemo.title
            : `رداً على: ${replyToMemo.title}`
        );
        setMemoDept(replyToMemo.departmentName || 'الإدارة العامة للبيئة والسلامة المهنية');
        setMemoProjectId(replyToMemo.projectId || defaultProjectId);
        setMemoContent(
          `رداً على المذكرة (${replyToMemo.direction === 'incoming' ? 'الواردة' : 'الصادرة'}): ${replyToMemo.title}\n\n`
        );
      } else {
        setMemoDirection(defaultMemoDirection);
        setMemoTitle('');
        setMemoDept(
          defaultMemoDirection === 'incoming' ? '' : 'الإدارة العامة للبيئة والسلامة المهنية'
        );
        setMemoProjectId(defaultProjectId);
        setMemoContent('');
      }
      setMemoLinkedIds([]);
      setMemoLinkedNames([]);
    }

    if (modal === 'draft') {
      setDraftTitle('');
      setDraftScope(defaultDraftScope);
      setDraftProjectId(defaultProjectId);
      setDraftContent('');
    }

    if (modal === 'order') {
      setOrderRef(`ENV-${String(Date.now()).slice(-4)}`);
      setOrderTitle('');
      setOrderDetails('');
      setOrderSubDept(defaultSubDepartment || SUB_DEPARTMENTS[0].name);
      setOrderTechs('');
      setOrderAssigned(false);
      setOrderPriority('normal');
      setOrderStatus('new');
      setOrderDueDate(new Date().toISOString().slice(0, 10));
      setOrderProjectId(defaultProjectId);
    }
  }, [
    modal,
    editingProject,
    replyToMemo,
    replyToCorrespondence,
    defaultProjectId,
    defaultMemoDirection,
    defaultDraftScope,
    defaultSubDepartment,
    defaultEntityId,
    entities,
  ]);

  if (!modal) return null;

  const handleSelectUploadFile = async (
    file: File,
    purpose: 'file' | 'research' | 'image' | 'memo' | 'correspondence'
  ) => {
    setBusy(true);
    try {
      if (isImageFile(file)) {
        const imgRes = await processImageFile(file);
        const imgId = makeSafeId('img');
        await saveLocalBlob(imgId, file);

        if (purpose === 'image') {
          setParsedFileObj(file);
          setParsedImgMeta(imgRes);
          if (!fileTitle.trim()) setFileTitle(cleanFileTitle(file.name));
          if (!fileNotes.trim()) setFileNotes(imgRes.summaryText);
        } else {
          // Attach image as indexed image & inject summary into memo/correspondence
          await onCreateImage({
            id: imgId,
            title: cleanFileTitle(file.name),
            fileName: file.name,
            domain: 'company',
            projectId: memoProjectId || defaultProjectId,
            sizeBytes: file.size,
            capturedAt: new Date().toISOString().slice(0, 10),
            caption: imgRes.summaryText,
            hasBlob: true,
            thumbnailDataUrl: imgRes.thumbnailDataUrl,
            dataUrl: imgRes.thumbnailDataUrl,
            width: imgRes.width,
            height: imgRes.height,
          });
          if (purpose === 'memo') {
            if (!memoTitle.trim()) setMemoTitle(cleanFileTitle(file.name));
            setMemoContent((prev) =>
              prev ? `${prev}\n\n${imgRes.summaryText}` : imgRes.summaryText
            );
            setMemoLinkedIds((prev) => [...prev, imgId]);
            setMemoLinkedNames((prev) => [...prev, file.name]);
          } else if (purpose === 'correspondence') {
            if (!corrSubject.trim()) setCorrSubject(cleanFileTitle(file.name));
            setCorrBody((prev) =>
              prev ? `${prev}\n\n${imgRes.summaryText}` : imgRes.summaryText
            );
            setCorrLinkedFileIds((prev) => [...prev, imgId]);
          }
          onToast(`تم تحليل الصورة «${file.name}» وإدراج ملخصها للعرض والتعديل`);
        }
        return;
      }

      const parsed = await parseDocumentFile(file);
      if (purpose === 'file' || purpose === 'research') {
        setParsedFileObj(file);
        setParsedDocMeta(parsed);
        setFileTitle(parsed.suggestedTitle || cleanFileTitle(file.name));
        setFileNotes(parsed.summaryText);
      } else {
        const fid = makeSafeId('file');
        await saveLocalBlob(fid, file);
        await onCreateFile({
          id: fid,
          title: parsed.suggestedTitle || cleanFileTitle(file.name),
          fileName: file.name,
          category: parsed.category,
          domain: 'company',
          projectId: memoProjectId || defaultProjectId,
          sizeBytes: file.size,
          notes: parsed.summaryText,
          hasBlob: true,
          mimeType: file.type || 'application/octet-stream',
          extractedText: parsed.extractedText,
          sheetPreview: parsed.sheetPreview,
          researchKind: 'none',
          headings: parsed.headings,
        });
        if (purpose === 'memo') {
          if (!memoTitle.trim()) setMemoTitle(parsed.suggestedTitle || cleanFileTitle(file.name));
          setMemoContent((prev) =>
            prev ? `${prev}\n\n${parsed.summaryText}` : parsed.summaryText
          );
          setMemoLinkedIds((prev) => [...prev, fid]);
          setMemoLinkedNames((prev) => [...prev, file.name]);
        } else if (purpose === 'correspondence') {
          if (!corrSubject.trim()) {
            setCorrSubject(parsed.suggestedTitle || cleanFileTitle(file.name));
          }
          setCorrBody((prev) =>
            prev ? `${prev}\n\n${parsed.summaryText}` : parsed.summaryText
          );
          setCorrLinkedFileIds((prev) => [...prev, fid]);
        }
        onToast(`تم قراءة الملف «${file.name}» وإنشاء عنوان وملخص قابل للتعديل`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadWordFromMemo = async () => {
    const blob = await generateWordDocxBlob({
      headerMode: 'memo',
      title: memoTitle || 'مذكرة عمل',
      departmentName: memoDept || 'الإدارة العامة للبيئة والسلامة المهنية',
      direction: memoDirection,
      linkedFileNames: memoLinkedNames,
      updatedAt: new Date().toISOString(),
      bodyText: memoContent || memoTitle,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(memoTitle || 'مذكرة').slice(0, 40)}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('تم تحويل المذكرة إلى ملف Word (.docx) جاهز للتعديل');
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600';
  const labelClass = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
            {modal === 'project' && (
              <>
                <FolderPlus className="w-4 h-4 text-blue-700" />
                <span>{editingProject ? 'تعديل المجلد' : 'إنشاء مجلد جديد'}</span>
              </>
            )}
            {modal === 'entity' && 'إضافة جهة مراسلة خارجية'}
            {modal === 'correspondence' &&
              (replyToCorrespondence
                ? 'رد على مراسلة خارجية'
                : 'تسجيل مراسلة خارجية (صادر / وارد)')}
            {modal === 'file' && 'رفع وفهرسة ملف جديد'}
            {modal === 'research' && 'إضافة بحث علمي / رسالة دكتوراه أو ماجستير'}
            {modal === 'image' && 'إضافة صورة وتوثيق ميداني'}
            {modal === 'memo' &&
              (replyToMemo ? 'رد على مذكرة المصنع' : 'مذكرة مصنع جديدة (وارد / صادر)')}
            {modal === 'draft' && 'إضافة مسودة عمل جديدة'}
            {modal === 'order' && 'إضافة مذكرة أعمال وتكليف'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {/* PROJECT MODAL */}
          {modal === 'project' && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!projName.trim()) return;
                setBusy(true);
                try {
                  if (editingProject) {
                    await onUpdateProject(editingProject.id, {
                      name: projName.trim(),
                      code: projCode.trim(),
                      description: projDesc.trim(),
                      domain: projDomain,
                    });
                    onToast('تم تحديث بيانات المجلد');
                  } else {
                    await onCreateProject({
                      id: makeSafeId('proj'),
                      name: projName.trim(),
                      code: projCode.trim() || `ENV-${String(projects.length + 1).padStart(2, '0')}`,
                      description: projDesc.trim(),
                      domain: projDomain,
                    });
                    onToast('تم إنشاء المجلد الجديد بنجاح');
                  }
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div>
                <label className={labelClass}>اسم المجلد *</label>
                <input
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="مثال: تقارير الصرف الصناعي 2026"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>الكود المختصر</label>
                  <input
                    value={projCode}
                    onChange={(e) => setProjCode(e.target.value)}
                    placeholder="ENV-IND-01"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>النطاق</label>
                  <select
                    value={projDomain}
                    onChange={(e) => setProjDomain(e.target.value as ItemDomain)}
                    className={inputClass}
                  >
                    <option value="company">شركة الدقهلية للسكر</option>
                    <option value="university">أبحاث ودراسات</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>وصف المجلد</label>
                <textarea
                  rows={3}
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 disabled:opacity-60"
                >
                  {busy ? 'جاري الحفظ...' : editingProject ? 'حفظ التعديلات' : 'إنشاء المجلد'}
                </button>
              </div>
            </form>
          )}

          {/* ENTITY MODAL */}
          {modal === 'entity' && (
            <div className="space-y-6">
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!entName.trim()) return;
                  setBusy(true);
                  try {
                    await onCreateEntity({
                      id: makeSafeId('ent'),
                      name: entName.trim(),
                      category: entCategory.trim(),
                      contactInfo: entContact.trim(),
                      notes: entNotes.trim(),
                    });
                    onToast('تمت إضافة وتخصيص جهة الاتصال بنجاح');
                    setEntName('');
                    setEntContact('');
                    setEntNotes('');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-blue-700 dark:text-blue-400">قسم الإضافات واستيراد جهات الاتصال</h3>
                  <button
                    type="button"
                    onClick={async () => {
                      if ('contacts' in navigator && 'select' in (navigator as any).contacts) {
                        try {
                          const res = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false });
                          if (res && res[0]) {
                            const cName = res[0].name?.[0] || '';
                            const cTel = res[0].tel?.[0] || '';
                            setEntName(cName);
                            setEntContact(cTel);
                            onToast(`تم استيراد جهة الاتصال من الهاتف: ${cName}`);
                          }
                        } catch {
                          onToast('تعذر الوصول لسجل الهاتف');
                        }
                      } else {
                        const importedName = prompt('أدخل اسم جهة الاتصال المستوردة من سجل الهاتف:');
                        if (importedName) {
                          const importedPhone = prompt('أدخل رقم الهاتف:') || '';
                          setEntName(importedName);
                          setEntContact(importedPhone);
                          onToast('تم استيراد جهة الاتصال وسحب الاسم والرقم بنجاح');
                        }
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1"
                  >
                    <span>📱 استيراد من جهات الاتصال</span>
                  </button>
                </div>

                <div>
                  <label className={labelClass}>تخصيص الاسم داخل التطبيق *</label>
                  <input
                    required
                    value={entName}
                    onChange={(e) => setEntName(e.target.value)}
                    placeholder="يمكنك تعديل وتخصيص اسم جهة الاتصال هنا مع الاحتفاظ بنفس الرقم"
                    className={inputClass}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">يُتيح لك هذا الحقل تخصيص الاسم داخل التطبيق فقط مع الاحتفاظ برقم الهاتف الأصلي.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>التصنيف</label>
                    <input
                      value={entCategory}
                      onChange={(e) => setEntCategory(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>رقم الهاتف / بيان التواصل</label>
                    <input
                      value={entContact}
                      onChange={(e) => setEntContact(e.target.value)}
                      placeholder="رقم الهاتف أو البريد"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>ملاحظات</label>
                  <textarea
                    rows={2}
                    value={entNotes}
                    onChange={(e) => setEntNotes(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  >
                    إغلاق
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
                  >
                    {busy ? 'جاري الحفظ...' : '+ إضافة جهة جديدة'}
                  </button>
                </div>
              </form>

              {/* Contacts Management List */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">إدارة جهات الاتصال المضافة ({entities.length})</h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {entities.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">لا توجد جهات اتصال مضافة بعد.</p>
                  ) : (
                    entities.map((en) => (
                      <div key={en.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-slate-900 dark:text-white">{en.name}</strong>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{en.contactInfo || 'بدون رقم'} · {en.category}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newPhone = prompt('تعديل رقم الهاتف:', en.contactInfo);
                              if (newPhone !== null) {
                                en.contactInfo = newPhone;
                                onToast('تم تحديث رقم جهة الاتصال بنجاح');
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 rounded text-[11px] font-semibold"
                          >
                            تعديل الرقم
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const replacementName = prompt('استبدال الجهة باسم جديد:', en.name);
                              if (replacementName) {
                                en.name = replacementName;
                                onToast('تم استبدال وتحديث اسم الجهة بنجاح');
                              }
                            }}
                            className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded text-[11px] font-semibold"
                          >
                            استبدال
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* EXTERNAL CORRESPONDENCE MODAL */}
          {modal === 'correspondence' && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!corrSubject.trim()) return;
                setBusy(true);
                try {
                  const chosenEntity = entities.find((en) => en.id === corrEntityId);
                  const entityId = chosenEntity?.id || 'ent_general';
                  const entityName = chosenEntity?.name || 'جهة خارجية عامة';
                  if (!chosenEntity) {
                    await onCreateEntity({
                      id: entityId,
                      name: entityName,
                      category: 'جهة مراسلة',
                      contactInfo: '',
                      notes: '',
                    });
                  }
                  const newId = makeSafeId('corr');
                  await onCreateCorrespondence({
                    id: newId,
                    entityId,
                    entityName,
                    direction: corrDirection,
                    refNumber: corrRef.trim(),
                    subject: corrSubject.trim(),
                    body: corrBody.trim(),
                    date: corrDate,
                    subDepartment: corrSubDept,
                    linkedFileIds: corrLinkedFileIds,
                    pinned: false,
                    replyToId: replyToCorrespondence?.id || '',
                    threadId:
                      replyToCorrespondence?.threadId || replyToCorrespondence?.id || newId,
                  });
                  onToast(
                    replyToCorrespondence
                      ? 'تم تسجيل الرد وربطه بسلسلة المراسلة'
                      : 'تم تسجيل المراسلة الخارجية بنجاح'
                  );
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {replyToCorrespondence && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
                  <Reply className="w-4 h-4 shrink-0" />
                  <span>
                    رد مرتبط بالمراسلة: <strong>{replyToCorrespondence.subject}</strong>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>الاتجاه</label>
                  <select
                    value={corrDirection}
                    onChange={(e) => setCorrDirection(e.target.value as MemoDirection)}
                    className={inputClass}
                  >
                    <option value="incoming">وارد من جهة خارجية</option>
                    <option value="outgoing">صادر إلى جهة خارجية</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>جهة المراسلة</label>
                  <select
                    value={corrEntityId}
                    onChange={(e) => setCorrEntityId(e.target.value)}
                    className={inputClass}
                  >
                    {entities.length === 0 && <option value="ent_general">جهة خارجية عامة</option>}
                    {entities.map((en) => (
                      <option key={en.id} value={en.id}>
                        {en.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>رقم القيد / المرجع</label>
                  <input
                    value={corrRef}
                    onChange={(e) => setCorrRef(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>تاريخ المراسلة</label>
                  <input
                    type="date"
                    value={corrDate}
                    onChange={(e) => setCorrDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>الإدارة الفرعية المختصة</label>
                  <select
                    value={corrSubDept}
                    onChange={(e) => setCorrSubDept(e.target.value)}
                    className={inputClass}
                  >
                    {SUB_DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  رفع ملف (Word / Excel / PDF / صورة) لتوليد العنوان والملخص تلقائياً:
                </span>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-50">
                  <Upload className="w-3.5 h-3.5 text-blue-700" />
                  <span>اختيار ملف</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void handleSelectUploadFile(f, 'correspondence');
                    }}
                  />
                </label>
              </div>

              <div>
                <label className={labelClass}>الموضوع *</label>
                <input
                  required
                  value={corrSubject}
                  onChange={(e) => setCorrSubject(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نص المراسلة / الملخص (قابل للتعديل)
                  </label>
                  <button
                    type="button"
                    disabled={corrVoice.state === 'transcribing'}
                    onClick={() => void corrVoice.toggle()}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-70 ${
                      corrVoice.state === 'recording'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : corrVoice.state === 'transcribing'
                          ? 'bg-amber-600 text-white cursor-wait'
                          : 'bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {corrVoice.state === 'recording' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <Square className="w-3 h-3 fill-current" />
                        <span>إيقاف ({formatVoiceSeconds(corrVoice.seconds)})</span>
                      </>
                    ) : corrVoice.state === 'transcribing' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>جاري التحويل لنص...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3" />
                        <span>الكتابة الصوتية</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={corrBody}
                  onChange={(e) => setCorrBody(e.target.value)}
                  placeholder="اكتب نص المراسلة هنا أو اضغط «الكتابة الصوتية» لإملاء النص بالصوت..."
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold"
                >
                  {busy ? 'جاري الحفظ...' : 'حفظ المراسلة'}
                </button>
              </div>
            </form>
          )}

          {/* FILE / RESEARCH / IMAGE MODAL */}
          {(modal === 'file' || modal === 'research' || modal === 'image') && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!parsedFileObj && !fileTitle.trim()) return;
                setBusy(true);
                try {
                  if (modal === 'image') {
                    const imgId = makeSafeId('img');
                    if (parsedFileObj) await saveLocalBlob(imgId, parsedFileObj);
                    await onCreateImage({
                      id: imgId,
                      title: fileTitle.trim() || 'صورة ميدانية',
                      fileName: parsedFileObj?.name || `${fileTitle.trim()}.jpg`,
                      domain: 'company',
                      projectId: fileProjectId,
                      sizeBytes: parsedFileObj?.size || 0,
                      capturedAt: new Date().toISOString().slice(0, 10),
                      caption: fileNotes.trim(),
                      hasBlob: Boolean(parsedFileObj),
                      thumbnailDataUrl: parsedImgMeta?.thumbnailDataUrl || '',
                      dataUrl: parsedImgMeta?.thumbnailDataUrl || '',
                      width: parsedImgMeta?.width || 0,
                      height: parsedImgMeta?.height || 0,
                    });
                    onToast('تمت إضافة الصورة للأرشيف بنجاح');
                  } else {
                    const fid = makeSafeId('file');
                    if (parsedFileObj) await saveLocalBlob(fid, parsedFileObj);
                    await onCreateFile({
                      id: fid,
                      title: fileTitle.trim() || cleanFileTitle(parsedFileObj?.name || 'مستند'),
                      fileName: parsedFileObj?.name || `${fileTitle.trim()}.docx`,
                      category: parsedDocMeta?.category || 'word',
                      domain: modal === 'research' ? 'university' : 'company',
                      projectId: fileProjectId,
                      sizeBytes: parsedFileObj?.size || 0,
                      notes: fileNotes.trim(),
                      hasBlob: Boolean(parsedFileObj),
                      mimeType: parsedFileObj?.type || 'application/octet-stream',
                      extractedText: parsedDocMeta?.extractedText || fileNotes.trim(),
                      sheetPreview: parsedDocMeta?.sheetPreview || [],
                      researchKind: modal === 'research' ? fileResearchKind : 'none',
                      headings: parsedDocMeta?.headings || [],
                    });
                    onToast(
                      modal === 'research'
                        ? 'تم حفظ البحث العلمي وفهرسة تسلسله بنجاح'
                        : 'تم رفع وفهرسة الملف بنجاح'
                    );
                  }
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block p-5 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 text-center cursor-pointer hover:bg-blue-50/70">
                <Upload className="w-6 h-6 text-blue-700 dark:text-blue-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {parsedFileObj
                    ? `تم اختيار الملف: ${parsedFileObj.name}`
                    : modal === 'image'
                      ? 'اضغط لاختيار صورة (JPG / PNG / WebP)'
                      : 'اضغط لاختيار ملف (Word / Excel / PDF / نص)'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  سيتم استخراج العنوان والملخص والفهرس السريع تلقائياً
                </p>
                <input
                  type="file"
                  accept={
                    modal === 'image'
                      ? 'image/*'
                      : '.doc,.docx,.xls,.xlsx,.csv,.pdf,.txt,.md'
                  }
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void handleSelectUploadFile(f, modal);
                  }}
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>العنوان *</label>
                  <input
                    required
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    placeholder="يُملأ تلقائياً عند اختيار الملف..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>المجلد</label>
                  <select
                    value={fileProjectId}
                    onChange={(e) => setFileProjectId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">بدون مجلد محدد</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {modal === 'research' && (
                <div>
                  <label className={labelClass}>نوع البحث / الدراسة</label>
                  <select
                    value={fileResearchKind}
                    onChange={(e) => setFileResearchKind(e.target.value as ResearchKind)}
                    className={inputClass}
                  >
                    <option value="phd">رسالة دكتوراه</option>
                    <option value="masters">رسالة ماجستير</option>
                    <option value="paper">ورقة بحثية محكمة</option>
                    <option value="book">كتاب / مرجع علمي</option>
                  </select>
                </div>
              )}

              <div>
                <label className={labelClass}>الملخص / الوصف (قابل للتعديل)</label>
                <textarea
                  rows={4}
                  value={fileNotes}
                  onChange={(e) => setFileNotes(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>حفظ</span>
                </button>
              </div>
            </form>
          )}

          {/* MEMO MODAL (INCOMING / OUTGOING + REPLY + AUTO-PARSE UPLOAD + WORD CONVERSION) */}
          {modal === 'memo' && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!memoTitle.trim()) return;
                setBusy(true);
                try {
                  const newId = makeSafeId('memo');
                  await onCreateMemo({
                    id: newId,
                    title: memoTitle.trim(),
                    content: memoContent.trim(),
                    domain: 'company',
                    projectId: memoProjectId,
                    pinned: false,
                    linkedFileIds: memoLinkedIds,
                    direction: memoDirection,
                    departmentName: memoDept.trim(),
                    replyToId: replyToMemo?.id || '',
                    threadId: replyToMemo?.threadId || replyToMemo?.id || newId,
                  });
                  onToast(
                    replyToMemo
                      ? 'تم تسجيل الرد في الصادر وربطه بالمذكرة الأصلية'
                      : 'تم حفظ مذكرة المصنع بنجاح'
                  );
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {replyToMemo && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
                  <Reply className="w-4 h-4 shrink-0" />
                  <span>
                    رد على المذكرة ({replyToMemo.direction === 'incoming' ? 'واردة' : 'صادرة'}):{' '}
                    <strong>{replyToMemo.title}</strong>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>تصنيف المذكرة</label>
                  <select
                    value={memoDirection}
                    onChange={(e) => setMemoDirection(e.target.value as MemoDirection)}
                    className={inputClass}
                  >
                    <option value="incoming">مذكرات المصنع — الوارد</option>
                    <option value="outgoing">مذكرات المصنع — الصادر</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>الإدارة / الجهة المرسلة أو المستلمة</label>
                  <input
                    value={memoDept}
                    onChange={(e) => setMemoDept(e.target.value)}
                    placeholder="مثال: إدارة الإنتاج / السلامة"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>المجلد</label>
                  <select
                    value={memoProjectId}
                    onChange={(e) => setMemoProjectId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">بدون مجلد</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Word/Excel/PDF/Image to Auto-Title & Auto-Summarize */}
              <div className="p-3.5 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-200">
                  <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    ارفع ملف (Excel / Word / PDF / صورة) ليتم قراءته ووضع العنوان والملخص تلقائياً:
                  </span>
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold cursor-pointer hover:bg-emerald-800">
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع ملف وقراءته</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void handleSelectUploadFile(f, 'memo');
                    }}
                  />
                </label>
              </div>

              {memoLinkedNames.length > 0 && (
                <div className="text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap gap-1.5">
                  <span className="font-bold">المرفقات:</span>
                  {memoLinkedNames.map((n, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              )}

              <div>
                <label className={labelClass}>عنوان المذكرة *</label>
                <input
                  required
                  value={memoTitle}
                  onChange={(e) => setMemoTitle(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    محتوى المذكرة / الملخص (قابل للتعديل)
                  </label>
                  <button
                    type="button"
                    disabled={memoVoice.state === 'transcribing'}
                    onClick={() => void memoVoice.toggle()}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-70 ${
                      memoVoice.state === 'recording'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : memoVoice.state === 'transcribing'
                          ? 'bg-amber-600 text-white cursor-wait'
                          : 'bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {memoVoice.state === 'recording' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <Square className="w-3 h-3 fill-current" />
                        <span>إيقاف ({formatVoiceSeconds(memoVoice.seconds)})</span>
                      </>
                    ) : memoVoice.state === 'transcribing' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>جاري التحويل لنص...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3" />
                        <span>الكتابة الصوتية</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={memoContent}
                  onChange={(e) => setMemoContent(e.target.value)}
                  placeholder="اكتب محتوى المذكرة هنا أو اضغط «الكتابة الصوتية» لإملاء النص بالصوت..."
                  className={inputClass}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDownloadWordFromMemo()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-bold"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    تحويل كملف Word (.docx)
                  </button>
                  <PrintAsMenu
                    compact
                    onPrintPaperOrPdf={() =>
                      onPrintMemo({
                        headerMode: 'memo',
                        title: memoTitle || 'مذكرة عمل',
                        content: memoContent,
                        domain: 'company',
                        direction: memoDirection,
                        departmentName: memoDept,
                        linkedFileNames: memoLinkedNames,
                      })
                    }
                    onPreviewPrint={() =>
                      onPrintMemo(
                        {
                          headerMode: 'memo',
                          title: memoTitle || 'مذكرة عمل',
                          content: memoContent,
                          domain: 'company',
                          direction: memoDirection,
                          departmentName: memoDept,
                          linkedFileNames: memoLinkedNames,
                        },
                        { previewOnly: true }
                      )
                    }
                    onExportPdf={() =>
                      downloadMemoPdf({
                        headerMode: 'memo',
                        title: memoTitle || 'مذكرة عمل',
                        content: memoContent,
                        domain: 'company',
                        direction: memoDirection,
                        departmentName: memoDept,
                        linkedFileNames: memoLinkedNames,
                      })
                    }
                    onExportWord={handleDownloadWordFromMemo}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold"
                  >
                    {busy ? 'جاري الحفظ...' : 'حفظ المذكرة'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* DRAFT MODAL (FACTORY / PRIVATE, NO VOICE DICTATION BUTTON) */}
          {modal === 'draft' && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!draftTitle.trim()) return;
                setBusy(true);
                try {
                  await onCreateDraft({
                    id: makeSafeId('draft'),
                    title: draftTitle.trim(),
                    content: draftContent.trim(),
                    scope: draftScope,
                    projectId: draftProjectId,
                    pinned: false,
                  });
                  onToast('تم حفظ المسودة بنجاح');
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  شركة الدقهلية لصناعة وتكرير السكر — إدارة البيئة (مسودة)
                </span>
                <span className="text-[11px] text-slate-500">محرر A4</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>تصنيف المسودة *</label>
                  <select
                    value={draftScope}
                    onChange={(e) => setDraftScope(e.target.value as DraftScope)}
                    className={inputClass}
                  >
                    <option value="factory">المصنع</option>
                    <option value="private">خاص</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>المجلد</label>
                  <select
                    value={draftProjectId}
                    onChange={(e) => setDraftProjectId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">بدون مجلد</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>عنوان المسودة *</label>
                <input
                  required
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نص المسودة
                  </label>
                  <button
                    type="button"
                    disabled={draftVoice.state === 'transcribing'}
                    onClick={() => void draftVoice.toggle()}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-70 ${
                      draftVoice.state === 'recording'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : draftVoice.state === 'transcribing'
                          ? 'bg-amber-600 text-white cursor-wait'
                          : 'bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {draftVoice.state === 'recording' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <Square className="w-3 h-3 fill-current" />
                        <span>إيقاف ({formatVoiceSeconds(draftVoice.seconds)})</span>
                      </>
                    ) : draftVoice.state === 'transcribing' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>جاري التحويل لنص...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3" />
                        <span>الكتابة الصوتية</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="اكتب نص المسودة هنا أو اضغط «الكتابة الصوتية» لإملاء المسودة بالصوت..."
                  className={`${inputClass} leading-relaxed`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <PrintAsMenu
                  compact
                  onPrintPaperOrPdf={() =>
                    onPrintMemo({
                      headerMode: 'draft',
                      title: draftTitle || 'مسودة عمل',
                      content: draftContent,
                      domain: 'company',
                    })
                  }
                  onPreviewPrint={() =>
                    onPrintMemo(
                      {
                        headerMode: 'draft',
                        title: draftTitle || 'مسودة عمل',
                        content: draftContent,
                        domain: 'company',
                      },
                      { previewOnly: true }
                    )
                  }
                  onExportPdf={() =>
                    downloadMemoPdf({
                      headerMode: 'draft',
                      title: draftTitle || 'مسودة عمل',
                      content: draftContent,
                      domain: 'company',
                    })
                  }
                  onExportWord={async () => {
                    const blob = await generateWordDocxBlob({
                      headerMode: 'draft',
                      title: draftTitle || 'مسودة عمل',
                      subTitle: 'إدارة البيئة — مسودة عمل',
                      updatedAt: new Date().toISOString(),
                      bodyText: draftContent,
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${(draftTitle || 'مسودة').slice(0, 40)}.docx`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold"
                  >
                    {busy ? 'جاري الحفظ...' : 'حفظ المسودة'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* WORK ORDER MODAL */}
          {modal === 'order' && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!orderTitle.trim()) return;
                setBusy(true);
                try {
                  const techs = orderTechs
                    .split(/[,،\n]+/)
                    .map((t) => t.trim())
                    .filter(Boolean);
                  await onCreateOrder({
                    id: makeSafeId('ord'),
                    refCode: orderRef.trim() || `ENV-${String(Date.now()).slice(-4)}`,
                    title: orderTitle.trim(),
                    details: orderDetails.trim(),
                    domain: 'company',
                    projectId: orderProjectId,
                    issuer: 'د. أيمن عبد الحميد',
                    assigneeOrUnit: orderSubDept,
                    subDepartment: orderSubDept,
                    technicians: techs,
                    isAssigned: orderAssigned,
                    priority: orderPriority,
                    status: orderStatus,
                    dueDate: orderDueDate,
                    linkedFileIds: [],
                  });
                  onToast('تمت إضافة مذكرة الأعمال بنجاح');
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>رقم التكليف</label>
                  <input
                    value={orderRef}
                    onChange={(e) => setOrderRef(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>الإدارة الفرعية</label>
                  <select
                    value={orderSubDept}
                    onChange={(e) => setOrderSubDept(e.target.value)}
                    className={inputClass}
                  >
                    {SUB_DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>الأولوية</label>
                  <select
                    value={orderPriority}
                    onChange={(e) => setOrderPriority(e.target.value as PriorityLevel)}
                    className={inputClass}
                  >
                    <option value="normal">عادي</option>
                    <option value="high">أولوية عالية</option>
                    <option value="urgent">عاجل</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>عنوان العمل / المهمة *</label>
                <input
                  required
                  value={orderTitle}
                  onChange={(e) => setOrderTitle(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>الحالة</label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as WorkOrderStatus)}
                    className={inputClass}
                  >
                    <option value="new">جديد</option>
                    <option value="in_progress">قيد التنفيذ</option>
                    <option value="review">بانتظار المراجعة</option>
                    <option value="done">مكتمل</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>تاريخ التنفيذ المستهدف</label>
                  <input
                    type="date"
                    value={orderDueDate}
                    onChange={(e) => setOrderDueDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>المجلد</label>
                  <select
                    value={orderProjectId}
                    onChange={(e) => setOrderProjectId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">بدون مجلد</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>أسماء الفنيين / المكلفين (افصل بفاصلة أو سطر)</label>
                <input
                  value={orderTechs}
                  onChange={(e) => setOrderTechs(e.target.value)}
                  placeholder="مثال: م. محمد علي، أ. حسن محمود"
                  className={inputClass}
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={orderAssigned}
                  onChange={(e) => setOrderAssigned(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>تم التكليف رسمياً</span>
              </label>

              <div>
                <label className={labelClass}>تفاصيل العمل المطلوب</label>
                <textarea
                  rows={4}
                  value={orderDetails}
                  onChange={(e) => setOrderDetails(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold"
                >
                  {busy ? 'جاري الحفظ...' : 'حفظ مذكرة الأعمال'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
