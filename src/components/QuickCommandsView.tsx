import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeftRight,
  ArrowRight,
  Bot,
  Building2,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  CloudDownload,
  EyeOff,
  FileAudio,
  FileBarChart2,
  FileEdit,
  FileText,
  Flame,
  HardDrive,
  Lightbulb,
  Loader2,
  Mail,
  MessageCircle,
  Mic,
  Moon,
  MoreVertical,
  Phone,
  Pin,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import {
  formatVoiceSeconds,
  useVoiceDictation,
} from '../hooks/useVoiceDictation';
import { formatDateAr, generateWordDocxBlob, makeSafeId } from '../lib/fileParser';
import { downloadMemoPdf } from '../lib/pdfExporter';
import {
  SUB_DEPARTMENTS,
  type DraftScope,
  type PriorityLevel,
  type WorkDraft,
  type WorkOrder,
  type WorkOrderStatus,
  type WorkspaceState,
} from '../types';
import { ConfirmDeleteInline } from './ConfirmDeleteInline';
import type { PrintableMemoData } from './MemoA4PrintSheet';
import { PrintAsMenu } from './PrintAsMenu';

export type QuickCommandTab =
  | 'team'
  | 'ai'
  | 'notes'
  | 'booking'
  | 'reports'
  | 'ideas';

export interface QuickContact {
  id: string;
  name: string;
  role: string;
  phone: string;
}

export interface QuickIdeaItem {
  id: string;
  text: string;
  importance: 'high' | 'low';
  createdAt: string;
  source: 'voice' | 'audio_file' | 'text';
  savedToDrafts?: boolean;
  draftId?: string;
}

export interface SelectedReportItem {
  id: string;
  type: 'memo' | 'correspondence' | 'draft' | 'note' | 'report' | 'idea';
  title: string;
  subtitle?: string;
  badge: string;
  badgeColor?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
  date?: string;
  content: string;
  department?: string;
  refNumber?: string;
  importance?: 'high' | 'low';
  rawItem?: any;
}

interface AdminNoteItem {
  id: string;
  text: string;
  department: string;
  createdAt: string;
  source: 'voice' | 'text';
}

interface DailyReportSnapshot {
  id: string;
  dateKey: string;
  title: string;
  summary: string;
  createdAt: string;
  openOrdersCount: number;
  completedOrdersCount: number;
  memosCount: number;
  notesCount: number;
}

const CONTACTS_STORAGE_KEY = 'dakahlia_quick_team_contacts_v1';
const NOTES_STORAGE_KEY = 'dakahlia_quick_admin_notes_v1';
const DAILY_REPORTS_STORAGE_KEY = 'dakahlia_quick_daily_reports_v1';
const IGNORED_TASKS_STORAGE_KEY = 'dakahlia_ignored_daily_tasks_v1';

const DEFAULT_TEAM_CONTACTS: QuickContact[] = [
  { id: 'tc-1', name: 'م. أحمد الخولي', role: 'مدير السلامة المهنية', phone: '+201001234567' },
  { id: 'tc-2', name: 'د. سامح الراوي', role: 'مستشار الرصد البيئي', phone: '+201002345678' },
  { id: 'tc-3', name: 'م. خالد المنشاوي', role: 'رئيس قسم معالجة المياه', phone: '+201003456789' },
  { id: 'tc-4', name: 'أ. مروة الشريف', role: 'مدير الشئون الإدارية', phone: '+201004567890' },
  { id: 'tc-5', name: 'م. هاني عثمان', role: 'مسؤول الانبعاثات', phone: '+201005678901' },
  { id: 'tc-6', name: 'د. رانيا البرنس', role: 'مختبر التحاليل البيئية', phone: '+201006789012' },
  { id: 'tc-7', name: 'م. طارق الصعيدي', role: 'الصيانة والتشغيل', phone: '+201007890123' },
  { id: 'tc-8', name: 'أ. نادية فؤاد', role: 'سكرتارية المكتب الفني', phone: '+201008901234' },
  { id: 'tc-9', name: 'م. عادل حسني', role: 'طوارئ المخلفات الخطرة', phone: '+201009012345' },
  { id: 'tc-10', name: 'د. إبراهيم نصر', role: 'التفتيش البيئي', phone: '+201001122334' },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `tc-${i + 11}`,
    name: `مسؤول إداري فرعي ${i + 11}`,
    role: 'إدارة البيئة والسلامة',
    phone: `+2010000000${i + 11}`,
  })),
];

function loadSavedContacts(): QuickContact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!raw) return DEFAULT_TEAM_CONTACTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_TEAM_CONTACTS;
}

function loadSavedNotes(): AdminNoteItem[] {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadSavedDailyReports(): DailyReportSnapshot[] {
  try {
    const raw = localStorage.getItem(DAILY_REPORTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadIgnoredTaskIds(): string[] {
  try {
    const raw = localStorage.getItem(IGNORED_TASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const IDEAS_STORAGE_KEY = 'dakahlia_quick_ideas_v1';

const DEFAULT_SAMPLE_IDEAS: QuickIdeaItem[] = [
  {
    id: 'idea-1',
    text: 'مقترح تركيب مجسات رصد انبعاثات فورية ذكية على مدخنة الغلايات الرئيسية وربطها إلكترونياً بغرفة المراقبة المركزية للبيئة.',
    importance: 'high',
    createdAt: new Date().toISOString(),
    source: 'voice',
    savedToDrafts: false,
  },
  {
    id: 'idea-2',
    text: 'إعداد جدول تدريب ميداني للعاملين على إجراءات السلامة المهنية ومكافحة الانسكابات الكيميائية أثناء موسم التكرير وعصر المحصول.',
    importance: 'low',
    createdAt: new Date().toISOString(),
    source: 'text',
    savedToDrafts: false,
  },
];

function loadSavedIdeas(): QuickIdeaItem[] {
  try {
    const raw = localStorage.getItem(IDEAS_STORAGE_KEY);
    if (!raw) return DEFAULT_SAMPLE_IDEAS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SAMPLE_IDEAS;
  } catch {
    return DEFAULT_SAMPLE_IDEAS;
  }
}

interface QuickCommandsViewProps {
  workspace: WorkspaceState;
  user: User | null;
  localMode: boolean;
  isOnline: boolean;
  darkMode: boolean;
  selectedProjectId: string;
  onToggleDark: () => void;
  onReturnToPortal: () => void;
  onOpenSecretariat: () => void;
  onOpenSyncModal: () => void;
  onCreateDraft: (d: Omit<WorkDraft, 'updatedAt'>) => Promise<void>;
  onUpdateDraft?: (id: string, updates: Partial<WorkDraft>) => Promise<void>;
  onDeleteDraft?: (id: string) => Promise<void>;
  onCreateOrder: (o: Omit<WorkOrder, 'createdAt'>) => Promise<void>;
  onUpdateOrder: (id: string, updates: Partial<WorkOrder>) => Promise<void>;
  onPrintMemo: (data: PrintableMemoData, options?: { previewOnly?: boolean }) => void;
  onToast: (msg: string) => void;
}

export function QuickCommandsView({
  workspace,
  user,
  localMode,
  isOnline,
  darkMode,
  selectedProjectId,
  onToggleDark,
  onReturnToPortal,
  onOpenSecretariat,
  onOpenSyncModal,
  onCreateDraft,
  onUpdateDraft,
  onDeleteDraft,
  onCreateOrder,
  onUpdateOrder,
  onPrintMemo,
  onToast,
}: QuickCommandsViewProps) {
  const [activeTab, setActiveTab] = useState<QuickCommandTab>('team');

  // Team contacts state & long-press action dialog
  const [contacts, setContacts] = useState<QuickContact[]>(loadSavedContacts);
  const [contactSearch, setContactSearch] = useState('');
  const [actionContactId, setActionContactId] = useState<string | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI chat state
  const [chatMessages, setChatMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      text: string;
      isError?: boolean;
      retryPrompt?: string;
    }>
  >([
    {
      role: 'assistant',
      text: 'مرحباً بك د. أيمن عبد الحميد. أنا جاهز لمساعدتك في تحليل اللوائح البيئية، تقارير الصرف والانبعاثات، وصياغة المذكرات الرسمية.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const chatVoice = useVoiceDictation({
    onTranscript: (text) => {
      setChatInput((prev) => (prev ? `${prev} ${text}` : text));
    },
    onStatus: onToast,
  });

  // Admin notes state
  const [notes, setNotes] = useState<AdminNoteItem[]>(loadSavedNotes);
  const [noteInput, setNoteInput] = useState('');
  const [noteDept, setNoteDept] = useState<string>(SUB_DEPARTMENTS[0].name);
  const [noteRecordState, setNoteRecordState] = useState<
    'idle' | 'recording' | 'transcribing'
  >('idle');
  const [noteRecordSeconds, setNoteRecordSeconds] = useState(0);
  const [noteAudioUrl, setNoteAudioUrl] = useState<string | null>(null);
  const [noteSourceMode, setNoteSourceMode] = useState<'voice' | 'text'>('text');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveTranscriptRef = useRef('');
  const noteRecRef = useRef<{ stop: () => void } | null>(null);

  // Work assignment state
  const [bookTitle, setBookTitle] = useState('');
  const [bookDept, setBookDept] = useState<string>(SUB_DEPARTMENTS[0].name);
  const [bookDueDate, setBookDueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [bookPriority, setBookPriority] = useState<PriorityLevel>('high');
  const [bookDetails, setBookDetails] = useState('');
  const [bookDetailsSource, setBookDetailsSource] = useState<'voice' | 'text'>('text');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [selectedTaskModal, setSelectedTaskModal] = useState<WorkOrder | null>(null);

  const bookTitleVoice = useVoiceDictation({
    onTranscript: (text) => {
      setBookTitle((prev) => (prev ? `${prev} ${text}` : text));
    },
    onStatus: onToast,
  });

  const bookDetailsVoice = useVoiceDictation({
    onTranscript: (text) => {
      setBookDetails((prev) => (prev ? `${prev} ${text}` : text));
      setBookDetailsSource('voice');
    },
    onStatus: onToast,
  });

  // Daily report speech synthesis, archive & daily-task ignore state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [dailyReports, setDailyReports] = useState<DailyReportSnapshot[]>(
    loadSavedDailyReports
  );
  const [ignoredTaskIds, setIgnoredTaskIds] = useState<string[]>(
    loadIgnoredTaskIds
  );
  const [showIgnoredTasks, setShowIgnoredTasks] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
    } catch {
      // ignore storage quota errors
    }
  }, [contacts]);

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // ignore storage quota errors
    }
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(
        DAILY_REPORTS_STORAGE_KEY,
        JSON.stringify(dailyReports)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [dailyReports]);

  useEffect(() => {
    try {
      localStorage.setItem(
        IGNORED_TASKS_STORAGE_KEY,
        JSON.stringify(ignoredTaskIds)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [ignoredTaskIds]);

  // Ideas & Drafts chat state
  const [ideas, setIdeas] = useState<QuickIdeaItem[]>(loadSavedIdeas);
  const [ideaInput, setIdeaInput] = useState('');
  const [ideaImportance, setIdeaImportance] = useState<'high' | 'low'>('high');
  const [ideaSourceMode, setIdeaSourceMode] = useState<
    'voice' | 'audio_file' | 'text'
  >('text');
  const [selectedReportItemModal, setSelectedReportItemModal] =
    useState<SelectedReportItem | null>(null);

  const ideaVoice = useVoiceDictation({
    onTranscript: (text) => {
      setIdeaInput((prev) => (prev ? `${prev} ${text}` : text));
      setIdeaSourceMode('voice');
    },
    onStatus: onToast,
  });

  // Inline drafts section under Ideas & Drafts
  const [quickDraftScopeFilter, setQuickDraftScopeFilter] = useState<
    'all' | DraftScope
  >('all');
  const [showNewDraftComposer, setShowNewDraftComposer] = useState(false);
  const [newDraftTitle, setNewDraftTitle] = useState('');
  const [newDraftScope, setNewDraftScope] = useState<DraftScope>('factory');
  const [newDraftContent, setNewDraftContent] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);

  const newDraftVoice = useVoiceDictation({
    onTranscript: (text) => {
      setNewDraftContent((prev) => (prev ? `${prev} ${text}` : text));
    },
    onStatus: onToast,
  });

  const filteredQuickDrafts = useMemo(() => {
    const base = workspace.drafts.filter((d) => {
      if (quickDraftScopeFilter === 'all') return true;
      return (d.scope || 'factory') === quickDraftScopeFilter;
    });
    return [...base].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [workspace.drafts, quickDraftScopeFilter]);

  useEffect(() => {
    try {
      localStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(ideas));
    } catch {
      // ignore storage quota errors
    }
  }, [ideas]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (noteRecRef.current) {
        try {
          noteRecRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (noteAudioUrl) URL.revokeObjectURL(noteAudioUrl);
    };
  }, [noteAudioUrl]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  const activeActionContact = useMemo(
    () => contacts.find((c) => c.id === actionContactId) || null,
    [contacts, actionContactId]
  );

  const openContactMenu = (contactId: string) => {
    setActionContactId(contactId);
    setSwapMode(false);
  };

  const closeContactMenu = () => {
    setActionContactId(null);
    setSwapMode(false);
  };

  const handlePointerDownContact = (contactId: string) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      openContactMenu(contactId);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleDeleteContact = (contactId: string) => {
    const target = contacts.find((c) => c.id === contactId);
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    closeContactMenu();
    if (target) {
      onToast(`تم حذف «${target.name}» من قائمة الاتصال السريع`);
    }
  };

  const handleSwapContacts = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setContacts((prev) => {
      const next = [...prev];
      const i = next.findIndex((c) => c.id === sourceId);
      const j = next.findIndex((c) => c.id === targetId);
      if (i === -1 || j === -1) return prev;
      const temp = next[i];
      next[i] = next[j];
      next[j] = temp;
      return next;
    });
    const src = contacts.find((c) => c.id === sourceId);
    const dst = contacts.find((c) => c.id === targetId);
    closeContactMenu();
    if (src && dst) {
      onToast(`تم تبديل «${src.name}» مع «${dst.name}» في القائمة`);
    }
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) {
      onToast('أدخل الاسم ورقم الهاتف لإضافة جهة الاتصال');
      return;
    }
    const created: QuickContact = {
      id: makeSafeId('tc'),
      name: newContactName.trim(),
      role: newContactRole.trim() || 'فريق البيئة والسلامة',
      phone: newContactPhone.trim(),
    };
    setContacts((prev) => [created, ...prev]);
    setNewContactName('');
    setNewContactRole('');
    setNewContactPhone('');
    setAddContactOpen(false);
    onToast(`تمت إضافة «${created.name}» إلى فريق العمل`);
  };

  const handleSendChat = async (customPrompt?: string) => {
    const text = (customPrompt ?? chatInput).trim();
    if (!text || chatLoading) return;
    if (!customPrompt) setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text }]);
    setChatLoading(true);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
      };
      if (res.ok && data.text) {
        setChatMessages((prev) => [...prev, { role: 'assistant', text: data.text! }]);
      } else {
        const rawErr = data.error || '';
        const friendlyErr =
          rawErr && !rawErr.trim().startsWith('{')
            ? rawErr
            : 'تعذر الاتصال بخدمة الذكاء الاصطناعي حالياً بسبب ضغط مؤقت، يرجى إعادة المحاولة.';
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: friendlyErr,
            isError: true,
            retryPrompt: text,
          },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'تعذر الاتصال بالشبكة أثناء إرسال الطلب، يرجى التحقق من الاتصال وإعادة المحاولة.',
          isError: true,
          retryPrompt: text,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleNoteAudioFileUpload = async (file: File) => {
    if (noteRecordState !== 'idle') return;
    const isAudioExt = /\.(mp3|wav|m4a|ogg|opus|webm|aac|flac)$/i.test(file.name);
    if (!file.type.startsWith('audio/') && !isAudioExt) {
      onToast('يرجى اختيار ملف صوتي صالح (MP3, WAV, M4A, OGG, WebM)');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setNoteAudioUrl(previewUrl);
    setNoteRecordState('transcribing');
    onToast(`جاري تفريغ الملف الصوتي «${file.name}»...`);

    try {
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('read failed'));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64DataUrl,
          mimeType: file.type || 'audio/webm',
          fileName: file.name,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
      };
      const transcribed = (data.text || '').trim();
      if (res.ok && transcribed) {
        setNoteInput((prev) => (prev ? `${prev}\n${transcribed}` : transcribed));
        setNoteSourceMode('voice');
        onToast(`تم تفريغ «${file.name}» وكتابته في الملاحظة بنجاح`);
      } else {
        onToast(
          data.error || 'تعذر تفريغ الملف الصوتي — يمكنك تشغيل المقطع أو تعديل النص'
        );
      }
    } catch {
      onToast('تعذر تفريغ الملف الصوتي حالياً');
    } finally {
      setNoteRecordState('idle');
      setNoteRecordSeconds(0);
    }
  };

  const formatRecordTimer = (sec: number) => {
    const mins = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const secs = (sec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const stopOptionalSpeechRecognition = () => {
    if (noteRecRef.current) {
      try {
        noteRecRef.current.stop();
      } catch {
        // ignore
      }
      noteRecRef.current = null;
    }
  };

  const toggleVoiceForNotes = async () => {
    if (noteRecordState === 'transcribing') return;

    // Stop active recording -> transcribe audio
    if (noteRecordState === 'recording') {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      stopOptionalSpeechRecognition();

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      } else {
        setNoteRecordState('idle');
      }
      return;
    }

    // Start real microphone recording via MediaRecorder
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      onToast('المتصفح لا يدعم الوصول للميكروفون في هذا السياق');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      liveTranscriptRef.current = '';

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedMime =
        typeof MediaRecorder !== 'undefined'
          ? preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || ''
          : '';

      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          audioChunksRef.current.push(evt.data);
        }
      };

      recorder.onstop = async () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;

        const mime = recorder.mimeType || supportedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        audioChunksRef.current = [];

        if (audioBlob.size < 400) {
          setNoteRecordState('idle');
          onToast('التسجيل قصير جداً — اضغط للتسجيل وتحدث بوضوح');
          return;
        }

        const previewUrl = URL.createObjectURL(audioBlob);
        setNoteAudioUrl(previewUrl);
        setNoteRecordState('transcribing');

        try {
          const base64DataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () =>
              typeof reader.result === 'string'
                ? resolve(reader.result)
                : reject(new Error('read failed'));
            reader.onerror = () => reject(new Error('read failed'));
            reader.readAsDataURL(audioBlob);
          });

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64DataUrl,
              mimeType: mime,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            text?: string;
            error?: string;
          };

          const transcribed = (data.text || liveTranscriptRef.current || '').trim();
          if (res.ok && transcribed) {
            setNoteInput((prev) => (prev ? `${prev}\n${transcribed}` : transcribed));
            setNoteSourceMode('voice');
            onToast('تم تسجيل الصوت وتحويله إلى نص بنجاح');
          } else if (liveTranscriptRef.current.trim()) {
            const fallbackText = liveTranscriptRef.current.trim();
            setNoteInput((prev) =>
              prev ? `${prev}\n${fallbackText}` : fallbackText
            );
            setNoteSourceMode('voice');
            onToast('تم تحويل التسجيل الصوتي إلى نص');
          } else {
            onToast('تم حفظ التسجيل الصوتي ويمكنك تشغيله أو كتابة النص يدوياً');
          }
        } catch {
          if (liveTranscriptRef.current.trim()) {
            const fallbackText = liveTranscriptRef.current.trim();
            setNoteInput((prev) =>
              prev ? `${prev}\n${fallbackText}` : fallbackText
            );
            setNoteSourceMode('voice');
            onToast('تم تحويل التسجيل الصوتي إلى نص');
          } else {
            onToast('تم حفظ التسجيل الصوتي أدناه — تعذر التفريغ السحابي حالياً');
          }
        } finally {
          setNoteRecordState('idle');
          setNoteRecordSeconds(0);
        }
      };

      // Optional silent live recognition alongside MediaRecorder (never blocks or shows false error)
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => unknown })
          .webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rec = new (SpeechRecognition as any)();
          rec.lang = 'ar-EG';
          rec.continuous = true;
          rec.interimResults = false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rec.onresult = (evt: any) => {
            const parts: string[] = [];
            for (let i = 0; i < evt.results.length; i++) {
              const t = evt.results[i]?.[0]?.transcript;
              if (t) parts.push(t);
            }
            liveTranscriptRef.current = parts.join(' ').trim();
          };
          rec.onerror = () => {
            // Silently ignore; MediaRecorder handles the actual recording
          };
          rec.start();
          noteRecRef.current = rec;
        } catch {
          // ignore
        }
      }

      recorder.start(250);
      setNoteRecordSeconds(0);
      setNoteRecordState('recording');
      recordTimerRef.current = setInterval(() => {
        setNoteRecordSeconds((s) => s + 1);
      }, 1000);
      onToast('بدأ التسجيل الصوتي — اضغط إيقاف عند الانتهاء');
    } catch (err) {
      setNoteRecordState('idle');
      const errName = (err as { name?: string })?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        onToast('يرجى السماح بصلاحية الميكروفون من المتصفح ثم المحاولة مجدداً');
      } else if (errName === 'NotFoundError') {
        onToast('لم يتم العثور على جهاز ميكروفون متصل');
      } else {
        onToast('تعذر بدء تسجيل الصوت — تأكد من عدم استخدام الميكروفون في تطبيق آخر');
      }
    }
  };

  const handleSaveNote = (source: 'voice' | 'text' = 'text') => {
    const clean = noteInput.trim();
    if (!clean) {
      onToast('اكتب نص الملاحظة الإدارية أولاً');
      return;
    }
    const item: AdminNoteItem = {
      id: makeSafeId('note'),
      text: clean,
      department: noteDept,
      createdAt: new Date().toISOString(),
      source,
    };
    setNotes((prev) => [item, ...prev]);
    setNoteInput('');
    onToast('تم حفظ الملاحظة الإدارية في السجل');
  };

  const handleConvertNoteToDraft = async (note: AdminNoteItem) => {
    await onCreateDraft({
      id: makeSafeId('draft'),
      title: `ملاحظة إدارية — ${note.department}`,
      content: note.text,
      scope: 'factory',
      projectId: selectedProjectId,
      pinned: true,
    });
    onToast('تم إرسال الملاحظة إلى مسودات السكرتارية بنجاح');
  };

  const handleConvertNoteToOrder = async (note: AdminNoteItem) => {
    await onCreateOrder({
      id: makeSafeId('ord'),
      refCode: `NOTE-${Math.floor(100 + Math.random() * 900)}`,
      title: note.text.slice(0, 70),
      details: note.text,
      domain: 'company',
      projectId: selectedProjectId,
      issuer: 'د. أيمن عبد الحميد',
      assigneeOrUnit: note.department,
      subDepartment: note.department,
      technicians: [],
      isAssigned: true,
      priority: 'high',
      status: 'new',
      dueDate: new Date().toISOString().slice(0, 10),
      linkedFileIds: [],
    });
    onToast('تم تحويل الملاحظة إلى تكليف عمل في السكرتارية');
  };

  const handleSaveBookingNote = () => {
    const clean = bookDetails.trim();
    if (!clean) {
      onToast('اكتب الملاحظة أو سجلها بالصوت أولاً لحفظها');
      return;
    }
    const noteText = bookTitle.trim()
      ? `${bookTitle.trim()} — ${clean}`
      : clean;
    const item: AdminNoteItem = {
      id: makeSafeId('note'),
      text: noteText,
      department: bookDept,
      createdAt: new Date().toISOString(),
      source: bookDetailsSource,
    };
    setNotes((prev) => [item, ...prev]);
    setBookDetails('');
    setBookDetailsSource('text');
    onToast('تم حفظ الملاحظة في سجل الملاحظات الإدارية بنجاح');
  };

  const handleBookWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle.trim()) {
      onToast('أدخل عنوان المهمة للتكليف بعمل');
      return;
    }
    setBookingBusy(true);
    try {
      await onCreateOrder({
        id: makeSafeId('ord'),
        refCode: `ENV-${Math.floor(100 + Math.random() * 900)}`,
        title: bookTitle.trim(),
        details: bookDetails.trim() || `تكليف بعمل مجدول لوحدة: ${bookDept}`,
        domain: 'company',
        projectId: selectedProjectId,
        issuer: 'د. أيمن عبد الحميد',
        assigneeOrUnit: bookDept,
        subDepartment: bookDept,
        technicians: [],
        isAssigned: true,
        priority: bookPriority,
        status: 'new',
        dueDate: bookDueDate || new Date().toISOString().slice(0, 10),
        linkedFileIds: [],
      });
      setBookTitle('');
      setBookDetails('');
      setBookDetailsSource('text');
      onToast('تم حفظ التكليف وعرضه في قائمة مهام العمل اليومية بنجاح');
    } finally {
      setBookingBusy(false);
    }
  };

  const handleAddIdea = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = ideaInput.trim();
    if (!clean) {
      onToast('أدخل نص الفكرة أو المسودة، أو استخدم الإدخال الصوتي لسماع الأفكار');
      return;
    }
    const item: QuickIdeaItem = {
      id: makeSafeId('idea'),
      text: clean,
      importance: ideaImportance,
      createdAt: new Date().toISOString(),
      source: ideaSourceMode,
      savedToDrafts: false,
    };
    setIdeas((prev) => [item, ...prev]);
    setIdeaInput('');
    setIdeaSourceMode('text');
    onToast(
      ideaImportance === 'high'
        ? 'تم تسجيل الفكرة بمستوى اهتمام (عالي) بنجاح'
        : 'تم تسجيل الفكرة بمستوى اهتمام (واطي) بنجاح'
    );
  };

  const handleSaveIdeaToDrafts = async (idea: QuickIdeaItem) => {
    const draftTitle =
      idea.text.length > 50
        ? `${idea.text.slice(0, 48).trim()}...`
        : idea.text;
    await onCreateDraft({
      id: makeSafeId('draft'),
      title: `فكرة ومسودة: ${draftTitle}`,
      content: idea.text,
      scope: 'factory',
      projectId: selectedProjectId,
      pinned: idea.importance === 'high',
    });
    setIdeas((prev) =>
      prev.map((item) =>
        item.id === idea.id ? { ...item, savedToDrafts: true } : item
      )
    );
    onToast('تم حفظ الفكرة في مسودات السكرتارية بنجاح');
  };

  const handleToggleIdeaImportance = (ideaId: string) => {
    setIdeas((prev) =>
      prev.map((item) => {
        if (item.id === ideaId) {
          const nextImp = item.importance === 'high' ? 'low' : 'high';
          onToast(
            nextImp === 'high'
              ? 'تم تغيير نوع الاهتمام إلى: عالي'
              : 'تم تغيير نوع الاهتمام إلى: واطي'
          );
          return { ...item, importance: nextImp };
        }
        return item;
      })
    );
  };

  const handleDeleteIdea = (ideaId: string) => {
    setIdeas((prev) => prev.filter((item) => item.id !== ideaId));
    onToast('تم حذف الفكرة');
  };

  const cycleOrderStatus = async (order: WorkOrder) => {
    const nextStatus: WorkOrderStatus =
      order.status === 'new'
        ? 'in_progress'
        : order.status === 'in_progress'
          ? 'done'
          : 'new';
    await onUpdateOrder(order.id, { status: nextStatus });
    const label =
      nextStatus === 'done'
        ? 'مكتمل'
        : nextStatus === 'in_progress'
          ? 'جاري التنفيذ'
          : 'جديد';
    onToast(`تم تحديث حالة المهمة إلى: ${label}`);
  };

  const openOrdersCount = workspace.orders.filter((o) => o.status !== 'done').length;
  const completedOrdersCount = workspace.orders.filter((o) => o.status === 'done').length;
  const todayDateStr = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dailySummaryText = `التقرير اليومي للإدارة العامة للبيئة والسلامة المهنية بتاريخ ${todayDateStr}. إجمالي التكليفات المفتوحة: ${openOrdersCount} مهمة، والمكتملة: ${completedOrdersCount} مهمة. عدد المذكرات المسجلة: ${workspace.memos.length} مذكرة، والمراسلات الخارجية: ${workspace.correspondences.length} مراسلة، والملاحظات الإدارية المسجلة: ${notes.length} ملاحظة.`;

  const unansweredOutgoingMemos = useMemo(() => {
    const repliedMemoIds = new Set(
      workspace.memos.map((m) => m.replyToId).filter((id): id is string => Boolean(id))
    );
    return workspace.memos.filter(
      (m) => (m.direction || 'outgoing') === 'outgoing' && !repliedMemoIds.has(m.id)
    );
  }, [workspace.memos]);

  const unansweredOutgoingCorrespondences = useMemo(() => {
    const repliedCorrIds = new Set(
      workspace.correspondences
        .map((c) => c.replyToId)
        .filter((id): id is string => Boolean(id))
    );
    return workspace.correspondences.filter(
      (c) => c.direction === 'outgoing' && !repliedCorrIds.has(c.id)
    );
  }, [workspace.correspondences]);

  const activeDailyTasks = useMemo(
    () =>
      workspace.orders.filter(
        (o) => o.status !== 'done' && !ignoredTaskIds.includes(o.id)
      ),
    [workspace.orders, ignoredTaskIds]
  );

  const ignoredDailyTasks = useMemo(
    () => workspace.orders.filter((o) => ignoredTaskIds.includes(o.id)),
    [workspace.orders, ignoredTaskIds]
  );

  const handleSaveDailyReportSnapshot = () => {
    const dateKey = new Date().toISOString().slice(0, 10);
    const snap: DailyReportSnapshot = {
      id: makeSafeId('rep'),
      dateKey,
      title: `التقرير اليومي للإدارة العامة للبيئة — ${todayDateStr}`,
      summary: dailySummaryText,
      createdAt: new Date().toISOString(),
      openOrdersCount,
      completedOrdersCount,
      memosCount: workspace.memos.length + workspace.correspondences.length,
      notesCount: notes.length,
    };
    setDailyReports((prev) => [snap, ...prev]);
    onToast('تم حفظ التقرير اليومي في سجل التقارير اليومية');
  };

  const handleIgnoreDailyTask = (taskId: string, title: string) => {
    setIgnoredTaskIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
    onToast(`تم تجاهل «${title}» من قائمة المهام اليومية دون حذفه من السكرتارية`);
  };

  const handleRestoreIgnoredTask = (taskId: string) => {
    setIgnoredTaskIds((prev) => prev.filter((id) => id !== taskId));
    onToast('تمت استعادة المهمة إلى قائمة المهام اليومية');
  };

  const toggleSpeakText = (textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onToast('القراءة الصوتية غير مدعومة في هذا المتصفح');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'ar-EG';
    utterance.rate = 0.95;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      onToast('تعذر تشغيل القراءة الصوتية على هذا الجهاز');
    };
    window.speechSynthesis.speak(utterance);
  };

  const toggleSpeakSummary = () => toggleSpeakText(dailySummaryText);

  const commandTabs: Array<{
    id: QuickCommandTab;
    label: string;
    subtitle: string;
    icon: typeof Users;
    badge?: number;
  }> = [
    {
      id: 'team',
      label: 'اتصال بفريق العمل',
      subtitle: 'اتصال مباشر وواتساب',
      icon: Users,
      badge: contacts.length,
    },
    {
      id: 'ai',
      label: 'الاتصال بالذكاء الاصطناعي',
      subtitle: 'تحليل وصياغة فورية',
      icon: Bot,
    },
    {
      id: 'notes',
      label: 'الملاحظات الإدارية',
      subtitle: 'تسجيل صوتي وكتابي',
      icon: Mic,
      badge: notes.length,
    },
    {
      id: 'booking',
      label: 'التكليف بعمل',
      subtitle: 'جدولة المهام الميدانية',
      icon: CalendarCheck,
      badge: openOrdersCount,
    },
    {
      id: 'reports',
      label: 'التقارير اليومية',
      subtitle: 'الملخص والأجندة اليومية',
      icon: FileBarChart2,
    },
    {
      id: 'ideas',
      label: 'المسودات والأفكار',
      subtitle: 'استماع وتسجيل الأفكار',
      icon: Lightbulb,
      badge: ideas.length,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Unified Header matching Secretariat TopBar */}
      <header className="no-print sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onReturnToPortal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>الرئيسية</span>
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  الأوامر السريعة — إدارة البيئة والسلامة المهنية
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  شركة الدقهلية لصناعة وتكرير السكر · د. أيمن عبد الحميد
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSyncModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              title="حالة المزامنة وجوجل درايف"
            >
              {user && !localMode && isOnline ? (
                <Cloud className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              ) : (
                <HardDrive className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className="hidden sm:inline">
                {user && !localMode ? 'الحالة متصل' : 'غير متصل'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleDark}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              aria-label="تبديل المظهر"
              title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onOpenSecretariat}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>فتح السكرتارية</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 lg:p-6 space-y-5">
        {/* Quick Commands Selector Bar — Unified with Secretariat Palette */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                لوحة الأوامر التنفيذية الفورية
              </p>
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                أقسام الأوامر السريعة
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
              اضغط مطولاً على أي جهة اتصال للحذف أو التبديل
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {commandTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`p-3.5 rounded-xl border text-right transition-all flex items-start justify-between gap-2 ${
                    isActive
                      ? 'bg-blue-700 border-blue-700 text-white shadow-sm'
                      : 'bg-slate-50/80 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-snug">{tab.label}</p>
                      <p
                        className={`text-[10px] mt-0.5 truncate ${
                          isActive ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {tab.subtitle}
                      </p>
                    </div>
                  </div>
                  {typeof tab.badge === 'number' && (
                    <span
                      className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Command Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
          {/* 1. Quick Team Contacts */}
          {activeTab === 'team' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    اتصال سريع بفريق العمل
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    اضغط مطولاً على أي جهة اتصال (أو استخدم زر الخيارات) للحذف أو التبديل بجهة أخرى من نفس القائمة
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="بحث في الفريق..."
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs w-44 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setAddContactOpen((v) => !v)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة جهة</span>
                  </button>
                  {contacts.length < DEFAULT_TEAM_CONTACTS.length && (
                    <button
                      type="button"
                      onClick={() => {
                        setContacts(DEFAULT_TEAM_CONTACTS);
                        onToast('تمت استعادة قائمة فريق العمل الافتراضية');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>استعادة</span>
                    </button>
                  )}
                </div>
              </div>

              {addContactOpen && (
                <form
                  onSubmit={handleAddContact}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end"
                >
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      الاسم
                    </label>
                    <input
                      type="text"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      placeholder="مثال: م. محمد حسن"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      الصفة / القسم
                    </label>
                    <input
                      type="text"
                      value={newContactRole}
                      onChange={(e) => setNewContactRole(e.target.value)}
                      placeholder="السلامة المهنية"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      placeholder="+201000000000"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                    >
                      حفظ
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddContactOpen(false)}
                      className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredContacts.map((contact, idx) => (
                  <div
                    key={contact.id}
                    onPointerDown={() => handlePointerDownContact(contact.id)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openContactMenu(contact.id);
                    }}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-blue-300 dark:hover:border-blue-800 flex items-center justify-between gap-2 select-none transition-colors active:scale-[0.99]"
                    title="اضغط مطولاً أو انقر زر الخيارات للحذف أو التبديل"
                  >
                    <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 tabular-nums shrink-0">
                        #{idx + 1}
                      </span>
                      <h4 className="font-display text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                        {contact.name}
                      </h4>
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 truncate">
                        ({contact.role})
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <a
                        href={`tel:${contact.phone}`}
                        onClick={() => {
                          onToast(`جاري الاتصال بـ: ${contact.name} (${contact.phone})`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>اتصال</span>
                      </a>

                      <a
                        href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `مرحباً ${contact.name}، رسالة من الإدارة العامة للبيئة والسلامة المهنية`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          onToast(`فتح محادثة واتساب مع: ${contact.name}`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors"
                        title="إرسال رسالة واتساب"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">واتساب</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => openContactMenu(contact.id)}
                        className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-400 flex items-center justify-center transition-colors"
                        title="خيارات جهة الاتصال (حذف / تبديل)"
                        aria-label={`خيارات ${contact.name}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredContacts.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                  لا توجد جهات اتصال مطابقة لبحثك.
                </div>
              )}
            </div>
          )}

          {/* 2. AI Chat */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    اتصال بذكاء اصطناعي
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    صياغة المذكرات الرسمية وتحليل تقارير البيئة والسلامة المهنية فوراً
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setChatMessages([
                      {
                        role: 'assistant',
                        text: 'تم بدء محادثة جديدة. كيف يمكنني مساعدتك اليوم؟',
                      },
                    ])
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  محادثة جديدة
                </button>
              </div>

              {/* Quick Prompts */}
              <div className="flex flex-wrap gap-2">
                {[
                  'صياغة مذكرة متابعة تحليل محطة الصرف الصناعي',
                  'مراجعة اشتراطات السلامة المهنية للمراجل البخارية',
                  'إعداد جدول تفتيش بيئي أسبوعي للأقسام',
                ].map((qPrompt) => (
                  <button
                    key={qPrompt}
                    type="button"
                    disabled={chatLoading}
                    onClick={() => void handleSendChat(qPrompt)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-950/70 disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{qPrompt}</span>
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div className="min-h-[280px] max-h-[420px] overflow-y-auto p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-xl border max-w-2xl text-xs sm:text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-700 border-blue-700 text-white mr-auto'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 ml-auto'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <strong
                        className={`text-[11px] ${
                          msg.role === 'user'
                            ? 'text-blue-100'
                            : 'text-blue-700 dark:text-blue-400'
                        }`}
                      >
                        {msg.role === 'user'
                          ? 'د. أيمن عبد الحميد'
                          : 'المساعد الذكي للبيئة'}
                      </strong>
                      {msg.role === 'assistant' && i > 0 && !msg.isError && (
                        <button
                          type="button"
                          onClick={async () => {
                            await onCreateDraft({
                              id: makeSafeId('draft'),
                              title: `رد الذكاء الاصطناعي - ${new Date().toLocaleDateString('ar-EG')}`,
                              content: msg.text,
                              scope: 'factory',
                              projectId: selectedProjectId,
                              pinned: false,
                            });
                            onToast('تم حفظ الرد في مسودات السكرتارية');
                          }}
                          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                        >
                          حفظ في المسودات
                        </button>
                      )}
                      {msg.isError && msg.retryPrompt && (
                        <button
                          type="button"
                          disabled={chatLoading}
                          onClick={() => void handleSendChat(msg.retryPrompt)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>إعادة المحاولة</span>
                        </button>
                      )}
                    </div>
                    <p
                      className={`whitespace-pre-wrap leading-relaxed ${
                        msg.isError ? 'text-red-700 dark:text-red-300 font-medium' : ''
                      }`}
                    >
                      {msg.text}
                    </p>
                  </div>
                ))}
                {chatLoading && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-xs text-xs text-blue-700 dark:text-blue-400 font-semibold animate-pulse">
                    جاري التحليل وصياغة الرد...
                  </div>
                )}
              </div>

              {/* Input (Text + Voice Recording + Audio File Upload/Drop) */}
              <div className="space-y-2">
                <div className="flex gap-2.5">
                  <textarea
                    rows={2}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const f = e.dataTransfer.files?.[0];
                      if (f) {
                        e.preventDefault();
                        void chatVoice.transcribeFile(f);
                      }
                    }}
                    placeholder="اكتب استفسارك أو اسحب ملفاً صوتياً هنا لتفريغه تلقائياً... (Enter للإرسال)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:border-blue-600 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendChat();
                      }
                    }}
                  />
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={chatVoice.state === 'transcribing'}
                        onClick={() => void chatVoice.toggle()}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 border disabled:opacity-60 ${
                          chatVoice.state === 'recording'
                            ? 'bg-red-600 border-red-600 text-white'
                            : chatVoice.state === 'transcribing'
                              ? 'bg-amber-600 border-amber-600 text-white cursor-wait'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        title="تسجيل صوتي عبر الميكروفون"
                      >
                        {chatVoice.state === 'recording' ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span className="font-mono tabular-nums">
                              {formatVoiceSeconds(chatVoice.seconds)}
                            </span>
                          </>
                        ) : chatVoice.state === 'transcribing' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>تفريغ...</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            <span>صوتي</span>
                          </>
                        )}
                      </button>

                      <label
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                          chatVoice.state !== 'idle' ? 'opacity-50 pointer-events-none' : ''
                        }`}
                        title="رفع ملف صوتي وتحويله إلى نص"
                      >
                        <FileAudio className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                        <span className="hidden sm:inline">ملف صوتي</span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) void chatVoice.transcribeFile(f);
                          }}
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={chatLoading || !chatInput.trim()}
                      onClick={() => void handleSendChat()}
                      className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{chatLoading ? 'جاري...' : 'إرسال'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  يمكنك الكتابة، التسجيل الصوتي، أو اختيار/إفلات ملف صوتي (MP3, WAV, M4A, OGG) لتحويله إلى نص وإرساله.
                </p>
              </div>
            </div>
          )}

          {/* 3. Administrative Notes */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  ملاحظات إدارية
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  سجل الملاحظات الصوتية أو الكتابية ووجّهها مباشرة إلى مسودات أو تكليفات السكرتارية
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      الإدارة المعنية:
                    </label>
                    <select
                      value={noteDept}
                      onChange={(e) => setNoteDept(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                    >
                      {SUB_DEPARTMENTS.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={noteRecordState === 'transcribing'}
                      onClick={() => void toggleVoiceForNotes()}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-70 ${
                        noteRecordState === 'recording'
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : noteRecordState === 'transcribing'
                            ? 'bg-amber-600 text-white cursor-wait'
                            : 'bg-blue-700 hover:bg-blue-800 text-white'
                      }`}
                    >
                      {noteRecordState === 'recording' ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>إيقاف التسجيل</span>
                          <span className="font-mono tabular-nums bg-black/20 px-1.5 py-0.5 rounded">
                            {formatRecordTimer(noteRecordSeconds)}
                          </span>
                        </>
                      ) : noteRecordState === 'transcribing' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري تفريغ التسجيل...</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          <span>تسجيل صوتي</span>
                        </>
                      )}
                    </button>

                    <label
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer ${
                        noteRecordState !== 'idle' ? 'opacity-50 pointer-events-none' : ''
                      }`}
                      title="رفع ملف صوتي وتحويله إلى نص في الملاحظة"
                    >
                      <FileAudio className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                      <span>إدخال ملف صوتي</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) void handleNoteAudioFileUpload(f);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={noteInput}
                  onChange={(e) => {
                    setNoteInput(e.target.value);
                    setNoteSourceMode('text');
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const f = e.dataTransfer.files?.[0];
                    if (f) {
                      e.preventDefault();
                      void handleNoteAudioFileUpload(f);
                    }
                  }}
                  placeholder="اكتب الملاحظة الإدارية هنا، اضغط «تسجيل صوتي»، أو أدرج/أسقط ملفاً صوتياً ليتم تفريغه وكتابته تلقائياً..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm focus:border-blue-600 focus:outline-none"
                />

                {noteAudioUrl && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <audio controls src={noteAudioUrl} className="h-8 flex-1 min-w-[200px]" />
                    <button
                      type="button"
                      onClick={() => setNoteAudioUrl(null)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-red-600 px-2 py-1"
                    >
                      مسح التسجيل
                    </button>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveNote(noteSourceMode);
                      setNoteAudioUrl(null);
                      setNoteSourceMode('text');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>حفظ الملاحظة الإدارية</span>
                  </button>
                </div>
              </div>

              {/* Saved Notes List */}
              <div className="space-y-2.5">
                {notes.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-500 dark:text-slate-400">
                    لا توجد ملاحظات إدارية مسجلة بعد.
                  </p>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-wrap items-start justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold">
                            {n.department}
                          </span>
                          <span>
                            {new Date(n.createdAt).toLocaleString('ar-EG')}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                          {n.text}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleConvertNoteToDraft(n)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <FileEdit className="w-3 h-3 text-blue-700 dark:text-blue-400" />
                          <span>حفظ كمسودة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleConvertNoteToOrder(n)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <CalendarCheck className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                          <span>تحويل لتكليف</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotes((prev) => prev.filter((x) => x.id !== n.id));
                            onToast('تم حذف الملاحظة');
                          }}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="حذف الملاحظة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. Work Assignment */}
          {activeTab === 'booking' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    تكليف بعمل
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    جدولة المهام والمواعيد الميدانية وربطها مباشرة بمذكرة الأعمال في السكرتارية
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenSecretariat}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  عرض جميع التكليفات في السكرتارية
                </button>
              </div>

              <form
                onSubmit={(e) => void handleBookWork(e)}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        عنوان المهمة / الموقع الميداني
                      </label>
                      <button
                        type="button"
                        disabled={bookTitleVoice.state === 'transcribing'}
                        onClick={() => void bookTitleVoice.toggle()}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-70 ${
                          bookTitleVoice.state === 'recording'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : bookTitleVoice.state === 'transcribing'
                              ? 'bg-amber-600 text-white cursor-wait'
                              : 'bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}
                        title="إملاء عنوان المهمة بالصوت"
                      >
                        {bookTitleVoice.state === 'recording' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            <Square className="w-2.5 h-2.5 fill-current" />
                            <span>إيقاف ({formatVoiceSeconds(bookTitleVoice.seconds)})</span>
                          </>
                        ) : bookTitleVoice.state === 'transcribing' ? (
                          <>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            <span>تفريغ...</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-2.5 h-2.5" />
                            <span>إدخال صوتي للعنوان</span>
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      placeholder="مثال: معاينة محطة المعالجة البيولوجية (اكتب أو اضغط إدخال صوتي)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      الإدارة الفرعية
                    </label>
                    <select
                      value={bookDept}
                      onChange={(e) => setBookDept(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    >
                      {SUB_DEPARTMENTS.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      تاريخ التنفيذ
                    </label>
                    <input
                      type="date"
                      value={bookDueDate}
                      onChange={(e) => setBookDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                    <input
                      type="text"
                      value={bookDetails}
                      onChange={(e) => {
                        setBookDetails(e.target.value);
                        if (!e.target.value.trim()) setBookDetailsSource('text');
                      }}
                      onDragOver={(e) => {
                        if (e.dataTransfer?.types?.includes('Files')) {
                          e.preventDefault();
                        }
                      }}
                      onDrop={(e) => {
                        const file = e.dataTransfer?.files?.[0];
                        if (file) {
                          e.preventDefault();
                          void bookDetailsVoice.transcribeFile(file);
                        }
                      }}
                      placeholder="ملاحظات أو تعليمات إضافية للمهمة (اكتب أو استخدم الإدخال الصوتي / اسحب ملف صوت)"
                      className="flex-1 min-w-[190px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />

                    <button
                      type="button"
                      disabled={bookDetailsVoice.state === 'transcribing'}
                      onClick={() => void bookDetailsVoice.toggle()}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold border transition-colors shrink-0 disabled:opacity-70 ${
                        bookDetailsVoice.state === 'recording'
                          ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                          : bookDetailsVoice.state === 'transcribing'
                            ? 'bg-amber-600 text-white border-amber-600 cursor-wait'
                            : 'bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                      }`}
                      title="إملاء الملاحظة بالصوت"
                    >
                      {bookDetailsVoice.state === 'recording' ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          <Square className="w-3 h-3 fill-current" />
                          <span>إيقاف ({formatVoiceSeconds(bookDetailsVoice.seconds)})</span>
                        </>
                      ) : bookDetailsVoice.state === 'transcribing' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>تفريغ...</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          <span>إدخال صوتي</span>
                        </>
                      )}
                    </button>

                    <label
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
                      title="إدخال ملف صوتي وتفريغه في الملاحظة"
                    >
                      <FileAudio className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span className="hidden sm:inline">ملف صوت</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) void bookDetailsVoice.transcribeFile(f);
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleSaveBookingNote}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0"
                      title="حفظ الملاحظة في سجل الملاحظات الإدارية"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ الملاحظة</span>
                    </button>

                    <select
                      value={bookPriority}
                      onChange={(e) =>
                        setBookPriority(e.target.value as PriorityLevel)
                      }
                      className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                    >
                      <option value="urgent">عاجل</option>
                      <option value="high">مرتفع</option>
                      <option value="normal">عادي</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={bookingBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold disabled:opacity-60 transition-colors shadow-xs"
                    title="حفظ التكليف في سجل مهام العمل اليومية"
                  >
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>
                      {bookingBusy
                        ? 'جاري الحفظ...'
                        : 'حفظ التكليف في مهام العمل اليومية'}
                    </span>
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {workspace.orders.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-500 dark:text-slate-400">
                    لا توجد مهام محجوزة حالياً. أضف مهمة من النموذج أعلاه.
                  </p>
                ) : (
                  workspace.orders.map((o) => {
                    const statusLabel =
                      o.status === 'done'
                        ? 'مكتمل'
                        : o.status === 'in_progress'
                          ? 'جاري التنفيذ'
                          : o.status === 'review'
                            ? 'قيد المراجعة'
                            : 'جديد';
                    const statusClass =
                      o.status === 'done'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : o.status === 'in_progress'
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                    return (
                      <div
                        key={o.id}
                        onClick={() => setSelectedTaskModal(o)}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xs transition-all cursor-pointer flex flex-wrap items-center justify-between gap-3 text-xs group"
                        title="اضغط كليكة واحدة لعرض المهمة في نافذة صغيرة"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                              {o.refCode}
                            </span>
                            <strong className="text-slate-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                              {o.title}
                            </strong>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>الوحدة: {o.subDepartment || o.assigneeOrUnit}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {o.dueDate}
                            </span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                              عرض المهمة ↗
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void cycleOrderStatus(o);
                          }}
                          className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-colors ${statusClass}`}
                          title="اضغط لتغيير حالة المهمة"
                        >
                          {statusLabel}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 5. Daily Reports */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    تقارير يومية
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ملخص حي لأعمال الإدارة اليومية مع إمكانية القراءة الصوتية والطباعة على A4
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {new Date().toISOString().slice(0, 10)}
                </span>
              </div>

              {/* Live Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    مهام مفتوحة
                  </p>
                  <p className="font-mono text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1 tabular-nums">
                    {openOrdersCount}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    مهام مكتملة
                  </p>
                  <p className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                    {completedOrdersCount}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    مذكرات ومراسلات
                  </p>
                  <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                    {workspace.memos.length + workspace.correspondences.length}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ملاحظات إدارية
                  </p>
                  <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                    {notes.length}
                  </p>
                </div>
              </div>

              {/* Voice + Print Summary Card */}
              <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                    الملخص التنفيذي الصباحي
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {todayDateStr}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {dailySummaryText}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={toggleSpeakSummary}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white transition-colors ${
                      isSpeaking
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-blue-700 hover:bg-blue-800'
                    }`}
                  >
                    {isSpeaking ? (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        <span>إيقاف القراءة الصوتية</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>استماع للملخص الصوتي</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onPrintMemo({
                        title: `التقرير اليومي للإدارة العامة للبيئة — ${new Date().toISOString().slice(0, 10)}`,
                        content: `${dailySummaryText}\n\nأبرز المهام المفتوحة:\n${
                          workspace.orders
                            .filter((o) => o.status !== 'done')
                            .slice(0, 8)
                            .map((o) => `- [${o.refCode}] ${o.title} (${o.dueDate})`)
                            .join('\n') || 'لا توجد مهام مفتوحة'
                        }`,
                        domain: 'company',
                        direction: 'outgoing',
                        departmentName: 'الإدارة العامة للبيئة والسلامة المهنية',
                        updatedAt: new Date().toISOString(),
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة التقرير (A4)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveDailyReportSnapshot}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 text-xs font-bold"
                  >
                    <FileBarChart2 className="w-3.5 h-3.5" />
                    <span>حفظ في سجل التقارير</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await onCreateDraft({
                        id: makeSafeId('draft'),
                        title: `التقرير اليومي — ${new Date().toISOString().slice(0, 10)}`,
                        content: dailySummaryText,
                        scope: 'factory',
                        projectId: selectedProjectId,
                        pinned: false,
                      });
                      onToast('تم حفظ التقرير اليومي في المسودات');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>حفظ في المسودات</span>
                  </button>
                </div>
              </div>

              {/* Daily Tasks with Ignore-Without-Delete + Ignored Toggle */}
              <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                      <span>قائمة المهام اليومية المفتوحة ({activeDailyTasks.length})</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      زر «تجاهل» يستبعد المهمة من قائمة اليوم فقط مع إبقائها محفوظة دون حذف في السكرتارية
                    </p>
                  </div>
                  {ignoredDailyTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowIgnoredTasks((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>
                        {showIgnoredTasks
                          ? 'إخفاء المتجاهلة'
                          : `المهام المتجاهلة (${ignoredDailyTasks.length})`}
                      </span>
                    </button>
                  )}
                </div>

                {activeDailyTasks.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                    لا توجد مهام نشطة في قائمة اليوم حالياً.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeDailyTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskModal(task)}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xs transition-all cursor-pointer flex flex-wrap items-center justify-between gap-2 text-xs group"
                        title="اضغط كليكة واحدة لعرض المهمة في نافذة صغيرة"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                              {task.refCode}
                            </span>
                            <strong className="text-slate-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                              {task.title}
                            </strong>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {task.subDepartment || task.assigneeOrUnit} · الموعد:{' '}
                            <span className="font-mono">{task.dueDate}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => void cycleOrderStatus(task)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-bold hover:bg-blue-100"
                          >
                            {task.status === 'in_progress' ? 'جاري التنفيذ' : 'جديد'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleIgnoreDailyTask(task.id, task.title)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-950/70"
                            title="تجاهل من قائمة المهام اليومية دون حذف"
                          >
                            <EyeOff className="w-3 h-3" />
                            <span>تجاهل من القائمة</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {showIgnoredTasks && ignoredDailyTasks.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      مهام تم تجاهلها من قائمة اليوم (ما زالت محفوظة في السكرتارية):
                    </p>
                    {ignoredDailyTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="truncate">
                          <span className="font-mono font-bold text-slate-500">
                            {task.refCode}
                          </span>{' '}
                          — {task.title}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreIgnoredTask(task.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-700 text-white text-[11px] font-bold hover:bg-emerald-800 shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>استعادة للقائمة</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unanswered Outgoing Memos & External Correspondences */}
              <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-amber-600" />
                      <span>
                        المذكرات المرسلة والتي لم يتم الرد عليها (
                        {unansweredOutgoingMemos.length +
                          unansweredOutgoingCorrespondences.length}
                        )
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      جميع مذكرات المصنع والمراسلات الخارجية الصادرة بانتظار الرد
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenSecretariat}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    فتح السكرتارية للرد
                  </button>
                </div>

                {unansweredOutgoingMemos.length === 0 &&
                unansweredOutgoingCorrespondences.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                    تم الرد على جميع المذكرات المرسلة، أو لا توجد مذكرات صادرة بعد.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {unansweredOutgoingMemos.map((m) => (
                      <div
                        key={m.id}
                        onClick={() =>
                          setSelectedReportItemModal({
                            id: m.id,
                            type: 'memo',
                            title: m.title,
                            subtitle: 'مذكرة مصنع صادرة — بانتظار الرد',
                            badge: 'مذكرة صادرة دون رد',
                            badgeColor: 'amber',
                            date: m.updatedAt.slice(0, 10),
                            content: m.content,
                            department: m.departmentName || 'إدارة المصنع',
                            refNumber: m.id,
                            rawItem: m,
                          })
                        }
                        className="p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-1 text-xs cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-xs transition-all group"
                        title="اضغط كليكة واحدة لعرض تفاصيل المذكرة في نافذة صغيرة"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-bold">
                            مذكرة مصنع صادرة · دون رد
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {m.updatedAt.slice(0, 10)}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                          {m.title}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                          {m.content}
                        </p>
                        <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                          عرض المذكرة في نافذة صغيرة ↗
                        </div>
                      </div>
                    ))}
                    {unansweredOutgoingCorrespondences.map((c) => (
                      <div
                        key={c.id}
                        onClick={() =>
                          setSelectedReportItemModal({
                            id: c.id,
                            type: 'correspondence',
                            title: c.subject,
                            subtitle: `مراسلة خارجية صادرة · ${c.entityName}`,
                            badge: 'مراسلة صادرة دون رد',
                            badgeColor: 'blue',
                            date: c.date,
                            content: c.body,
                            department: c.entityName,
                            refNumber: c.refNumber,
                            rawItem: c,
                          })
                        }
                        className="p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-1 text-xs cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xs transition-all group"
                        title="اضغط كليكة واحدة لعرض تفاصيل المراسلة في نافذة صغيرة"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 text-[10px] font-bold">
                            مراسلة خارجية · {c.entityName}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {c.date}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                          {c.refNumber ? `[${c.refNumber}] ` : ''}
                          {c.subject}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                          {c.body}
                        </p>
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                          عرض المراسلة في نافذة صغيرة ↗
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drafts + Admin Notes Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Drafts */}
                <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileEdit className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>المسودات ({workspace.drafts.length})</span>
                  </h4>
                  {workspace.drafts.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                      لا توجد مسودات مسجلة حالياً.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pl-1">
                      {workspace.drafts.map((d) => (
                        <div
                          key={d.id}
                          onClick={() =>
                            setSelectedReportItemModal({
                              id: d.id,
                              type: 'draft',
                              title: d.title,
                              subtitle: `مسودة أعمال · نطاق: ${d.scope === 'private' ? 'خاص' : 'المصنع'}`,
                              badge: 'مسودة أعمال',
                              badgeColor: 'emerald',
                              date: d.updatedAt.slice(0, 10),
                              content: d.content,
                              department: d.scope === 'private' ? 'خاص' : 'عام المصنع',
                              rawItem: d,
                            })
                          }
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-1 text-xs cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-xs transition-all group"
                          title="اضغط كليكة واحدة لعرض تفاصيل المسودة في نافذة صغيرة"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-slate-900 dark:text-white truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                              {d.title}
                            </strong>
                            <div
                              className="flex items-center gap-1.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                {d.scope === 'private' ? 'خاص' : 'المصنع'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onPrintMemo({
                                    headerMode: 'draft',
                                    title: d.title,
                                    content: d.content,
                                    domain: 'company',
                                    updatedAt: d.updatedAt,
                                  })
                                }
                                className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="طباعة المسودة A4"
                              >
                                <Printer className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 whitespace-pre-wrap">
                            {d.content}
                          </p>
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                            عرض المسودة في نافذة صغيرة ↗
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Admin Notes */}
                <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>الملاحظات الإدارية ({notes.length})</span>
                  </h4>
                  {notes.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                      لا توجد ملاحظات إدارية مسجلة حالياً.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pl-1">
                      {notes.map((n) => (
                        <div
                          key={n.id}
                          onClick={() =>
                            setSelectedReportItemModal({
                              id: n.id,
                              type: 'note',
                              title: `ملاحظة إدارية — ${n.department}`,
                              subtitle: n.department,
                              badge: 'ملاحظة إدارية',
                              badgeColor: 'purple',
                              date: new Date(n.createdAt).toLocaleString('ar-EG'),
                              content: n.text,
                              department: n.department,
                              rawItem: n,
                            })
                          }
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-1 text-xs cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xs transition-all group"
                          title="اضغط كليكة واحدة لعرض تفاصيل الملاحظة في نافذة صغيرة"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                              {n.department}
                            </span>
                            <span>{new Date(n.createdAt).toLocaleString('ar-EG')}</span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap line-clamp-3">
                            {n.text}
                          </p>
                          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                            عرض الملاحظة في نافذة صغيرة ↗
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* All Daily Reports */}
              <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileBarChart2 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>جميع التقارير اليومية ({dailyReports.length + 1})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleSaveDailyReportSnapshot}
                    className="px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold"
                  >
                    + أرشفة تقرير اليوم
                  </button>
                </div>

                <div className="space-y-2">
                  {/* Live Today Report */}
                  <div
                    onClick={() =>
                      setSelectedReportItemModal({
                        id: 'live-today',
                        type: 'report',
                        title: `التقرير اليومي المباشر — ${todayDateStr}`,
                        subtitle: 'الملخص التنفيذي المباشر لأعمال اليوم',
                        badge: 'تقرير مباشر',
                        badgeColor: 'blue',
                        date: new Date().toISOString().slice(0, 10),
                        content: dailySummaryText,
                      })
                    }
                    className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 flex flex-wrap items-center justify-between gap-3 text-xs cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xs transition-all group"
                    title="اضغط كليكة واحدة لعرض التقرير اليومي في نافذة صغيرة"
                  >
                    <div className="space-y-0.5 flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-700 text-white text-[10px] font-bold">
                          تقرير اليوم (مباشر)
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {new Date().toISOString().slice(0, 10)}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                        {dailySummaryText}
                      </p>
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                        عرض التقرير في نافذة صغيرة ↗
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSpeakText(dailySummaryText)}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 hover:bg-slate-50"
                        title="استماع للتقرير"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onPrintMemo({
                            title: `التقرير اليومي للإدارة العامة للبيئة — ${new Date().toISOString().slice(0, 10)}`,
                            content: dailySummaryText,
                            domain: 'company',
                            direction: 'outgoing',
                            departmentName: 'الإدارة العامة للبيئة والسلامة المهنية',
                            updatedAt: new Date().toISOString(),
                          })
                        }
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                        title="طباعة A4"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Archived Reports */}
                  {dailyReports.map((rep) => (
                    <div
                      key={rep.id}
                      onClick={() =>
                        setSelectedReportItemModal({
                          id: rep.id,
                          type: 'report',
                          title: rep.title,
                          subtitle: 'تقرير يومي مؤرشف للإدارة العامة للبيئة',
                          badge: 'تقرير يومي مؤرشف',
                          badgeColor: 'blue',
                          date: rep.dateKey,
                          content: rep.summary,
                          rawItem: rep,
                        })
                      }
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-xs cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xs transition-all group"
                      title="اضغط كليكة واحدة لعرض التقرير المؤرشف في نافذة صغيرة"
                    >
                      <div className="space-y-0.5 flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                            {rep.title}
                          </strong>
                          <span className="font-mono text-[10px] text-slate-500">
                            {new Date(rep.createdAt).toLocaleTimeString('ar-EG')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          {rep.summary}
                        </p>
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                          عرض التقرير في نافذة صغيرة ↗
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSpeakText(rep.summary)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 hover:bg-slate-100"
                          title="استماع"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onPrintMemo({
                              title: rep.title,
                              content: rep.summary,
                              domain: 'company',
                              direction: 'outgoing',
                              departmentName:
                                'الإدارة العامة للبيئة والسلامة المهنية',
                              updatedAt: rep.createdAt,
                            })
                          }
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                          title="طباعة A4"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 6. Drafts & Ideas Chat */}
          {activeTab === 'ideas' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      المسودات والأفكار
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      صندوق شات استماع ذكي: اسمع وتحدث بالأفكار والمسودات ليتم كتابتها تلقائياً، مع تحديد مستوى الاهتمام (عالي أو واطي) وحفظها بضغطة زر في المسودات
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold font-mono">
                    إجمالي الأفكار: {ideas.length}
                  </span>
                  <button
                    type="button"
                    onClick={onOpenSecretariat}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    عرض المسودات في السكرتارية ({workspace.drafts.length})
                  </button>
                </div>
              </div>

              {/* Ideas Chat Stream */}
              <div className="space-y-3 min-h-[220px] max-h-[500px] overflow-y-auto p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                {ideas.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <Lightbulb className="w-8 h-8 mx-auto text-amber-500/60" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      لا توجد أفكار أو مسودات مسجلة بعد
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      اضغط على زر «استماع صوتي للأفكار» في الأسفل وتحدث بحرية، أو ارفع ملفاً صوتياً، أو اكتب فكرتك مباشرة، ثم اختر نوع الاهتمام واحفظها في المسودات.
                    </p>
                  </div>
                ) : (
                  ideas.map((idea) => {
                    const isHigh = idea.importance === 'high';
                    return (
                      <div
                        key={idea.id}
                        onClick={() =>
                          setSelectedReportItemModal({
                            id: idea.id,
                            type: 'idea',
                            title: `فكرة ومسودة: ${idea.text.slice(0, 45)}...`,
                            subtitle: `مستوى الاهتمام: ${isHigh ? 'عالي' : 'واطي'} · المصدر: ${idea.source === 'voice' ? 'صوتي' : idea.source === 'audio_file' ? 'ملف صوت' : 'كتابي'}`,
                            badge: isHigh ? 'اهتمام عالي' : 'اهتمام واطي',
                            badgeColor: isHigh ? 'rose' : 'blue',
                            date: new Date(idea.createdAt).toLocaleString('ar-EG'),
                            content: idea.text,
                            importance: idea.importance,
                            rawItem: idea,
                          })
                        }
                        className={`p-4 rounded-xl border transition-all cursor-pointer group select-none shadow-2xs ${
                          isHigh
                            ? 'border-amber-300 dark:border-amber-900/80 bg-white dark:bg-slate-900 hover:border-amber-400'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400'
                        }`}
                        title="اضغط كليكة واحدة لعرض تفاصيل الفكرة في نافذة صغيرة"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Importance Badge */}
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleIdeaImportance(idea.id);
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold cursor-pointer transition-transform hover:scale-105 ${
                                isHigh
                                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                              title="اضغط لتبديل نوع الاهتمام بين (عالي) و(واطي)"
                            >
                              {isHigh ? (
                                <>
                                  <Flame className="w-3 h-3 text-rose-600 fill-current" />
                                  <span>اهتمام عالي</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                                  <span>اهتمام واطي</span>
                                </>
                              )}
                            </span>

                            {/* Source indicator */}
                            <span className="text-[10px] text-slate-500 font-medium">
                              {idea.source === 'voice'
                                ? '🎙️ صوتي'
                                : idea.source === 'audio_file'
                                  ? '📁 ملف صوت'
                                  : '✍️ كتابي'}
                            </span>

                            <span className="font-mono text-[10px] text-slate-400">
                              {new Date(idea.createdAt).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {idea.savedToDrafts ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                                <Check className="w-3 h-3" />
                                <span>محفوظة في المسودات</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleSaveIdeaToDrafts(idea)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition-colors shadow-2xs"
                                title="حفظ هذه الفكرة في مسودات السكرتارية الرسمية"
                              >
                                <Save className="w-3 h-3" />
                                <span>حفظ في المسودات</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                onPrintMemo({
                                  headerMode: 'draft',
                                  title: `فكرة ومسودة — اهتمام: ${isHigh ? 'عالي' : 'واطي'}`,
                                  content: idea.text,
                                  domain: 'company',
                                  updatedAt: idea.createdAt,
                                })
                              }
                              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="طباعة A4"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteIdea(idea.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              title="حذف الفكرة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {idea.text}
                        </p>

                        <div className="mt-2 text-[10px] text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          اضغط كليكة واحدة لعرض وتعديل الفكرة ↗
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input Box: Chat Listen & Write with Importance Selection */}
              <form
                onSubmit={handleAddIdea}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span>مربع إدخال وسماع الأفكار والمسودات:</span>
                  </label>

                  {/* Importance Selector (High or Low) */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      نوع الاهتمام:
                    </span>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                      <button
                        type="button"
                        onClick={() => setIdeaImportance('high')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors flex items-center gap-1 ${
                          ideaImportance === 'high'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
                        }`}
                      >
                        <Flame className="w-3 h-3" />
                        <span>عالي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIdeaImportance('low')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors flex items-center gap-1 ${
                          ideaImportance === 'low'
                            ? 'bg-blue-700 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-blue-600'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-current" />
                        <span>واطي</span>
                      </button>
                    </div>
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={ideaInput}
                  onChange={(e) => setIdeaInput(e.target.value)}
                  onDragOver={(e) => {
                    if (e.dataTransfer?.types?.includes('Files')) {
                      e.preventDefault();
                    }
                  }}
                  onDrop={(e) => {
                    const file = e.dataTransfer?.files?.[0];
                    if (file) {
                      e.preventDefault();
                      void ideaVoice.transcribeFile(file);
                      setIdeaSourceMode('audio_file');
                    }
                  }}
                  placeholder="تحدث أو اكتب الفكرة/المسودة هنا، أو اضغط «استماع صوتي للأفكار»، أو اسحب ملفاً صوتياً ليتم تفريغه وكتابته فوراً..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm focus:border-blue-600 focus:outline-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Voice Listening Dictation Button */}
                    <button
                      type="button"
                      disabled={ideaVoice.state === 'transcribing'}
                      onClick={() => void ideaVoice.toggle()}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors disabled:opacity-70 ${
                        ideaVoice.state === 'recording'
                          ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm'
                          : ideaVoice.state === 'transcribing'
                            ? 'bg-amber-600 text-white border-amber-600 cursor-wait'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-700 dark:text-blue-400 border-slate-200 dark:border-slate-700'
                      }`}
                      title="استماع صوتي وتسجيل الفكرة عبر الميكروفون"
                    >
                      {ideaVoice.state === 'recording' ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <Square className="w-3 h-3 fill-current" />
                          <span>إيقاف الاستماع ({formatVoiceSeconds(ideaVoice.seconds)})</span>
                        </>
                      ) : ideaVoice.state === 'transcribing' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري التفريغ الصوتي...</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          <span>استماع صوتي للأفكار</span>
                        </>
                      )}
                    </button>

                    {/* Audio File Upload Button */}
                    <label
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      title="تحميل ملف صوتي مسجل وتفريغه مباشرة في الفكرة"
                    >
                      <FileAudio className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span>ملف صوتي</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) {
                            void ideaVoice.transcribeFile(f);
                            setIdeaSourceMode('audio_file');
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick Save Directly to Drafts */}
                    <button
                      type="button"
                      disabled={!ideaInput.trim()}
                      onClick={async () => {
                        const clean = ideaInput.trim();
                        if (!clean) return;
                        const item: QuickIdeaItem = {
                          id: makeSafeId('idea'),
                          text: clean,
                          importance: ideaImportance,
                          createdAt: new Date().toISOString(),
                          source: ideaSourceMode,
                          savedToDrafts: true,
                        };
                        setIdeas((prev) => [item, ...prev]);
                        setIdeaInput('');
                        setIdeaSourceMode('text');
                        await handleSaveIdeaToDrafts(item);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50 transition-colors"
                      title="تسجيل الفكرة وحفظها مباشرة في المسودات"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ في المسودات</span>
                    </button>

                    {/* Standard Send into Ideas Chat */}
                    <button
                      type="submit"
                      disabled={!ideaInput.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold disabled:opacity-50 transition-colors shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>تسجيل الفكرة</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Saved Drafts Section Directly Under Ideas & Drafts */}
              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FileEdit className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        المسودات ({workspace.drafts.length})
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        قائمة المسودات المحفوظة وإضافة مسودة جديدة مباشرة داخل نفس المربع
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQuickDraftScopeFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        quickDraftScopeFilter === 'all'
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      الكل ({workspace.drafts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDraftScopeFilter('factory')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        quickDraftScopeFilter === 'factory'
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      المصنع (
                      {
                        workspace.drafts.filter(
                          (d) => (d.scope || 'factory') === 'factory'
                        ).length
                      }
                      )
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDraftScopeFilter('private')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        quickDraftScopeFilter === 'private'
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      خاص (
                      {
                        workspace.drafts.filter((d) => d.scope === 'private')
                          .length
                      }
                      )
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewDraftScope(
                          quickDraftScopeFilter === 'private'
                            ? 'private'
                            : 'factory'
                        );
                        setShowNewDraftComposer((v) => !v);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors shadow-2xs"
                    >
                      {showNewDraftComposer ? (
                        <X className="w-3.5 h-3.5" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {showNewDraftComposer ? 'إغلاق نموذج المسودة' : 'إضافة مسودة'}
                      </span>
                    </button>
                  </div>
                </div>

                {showNewDraftComposer && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900/60 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        value={newDraftTitle}
                        onChange={(e) => setNewDraftTitle(e.target.value)}
                        placeholder="عنوان المسودة..."
                        className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm focus:border-emerald-600 focus:outline-none"
                      />
                      <select
                        value={newDraftScope}
                        onChange={(e) =>
                          setNewDraftScope(e.target.value as DraftScope)
                        }
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold focus:border-emerald-600 focus:outline-none"
                      >
                        <option value="factory">مسودة المصنع</option>
                        <option value="private">مسودة خاصة</option>
                      </select>
                    </div>

                    <textarea
                      rows={3}
                      value={newDraftContent}
                      onChange={(e) => setNewDraftContent(e.target.value)}
                      placeholder="اكتب محتوى المسودة هنا أو استخدم الإملاء الصوتي..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm focus:border-emerald-600 focus:outline-none"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={newDraftVoice.state === 'transcribing'}
                        onClick={() => void newDraftVoice.toggle()}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          newDraftVoice.state === 'recording'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>
                          {newDraftVoice.state === 'recording'
                            ? `إيقاف (${formatVoiceSeconds(newDraftVoice.seconds)})`
                            : newDraftVoice.state === 'transcribing'
                              ? 'جاري التفريغ...'
                              : 'إملاء صوتي للمسودة'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={
                          savingDraft ||
                          (!newDraftTitle.trim() && !newDraftContent.trim())
                        }
                        onClick={async () => {
                          const content = newDraftContent.trim();
                          const title =
                            newDraftTitle.trim() ||
                            (content.length > 48
                              ? `${content.slice(0, 46).trim()}...`
                              : content);
                          if (!title && !content) return;
                          setSavingDraft(true);
                          try {
                            await onCreateDraft({
                              id: makeSafeId('draft'),
                              title,
                              content: content || title,
                              scope: newDraftScope,
                              projectId: selectedProjectId,
                              pinned: false,
                            });
                            setNewDraftTitle('');
                            setNewDraftContent('');
                            setShowNewDraftComposer(false);
                            onToast('تم إضافة المسودة بنجاح');
                          } finally {
                            setSavingDraft(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
                      >
                        {savingDraft ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>حفظ المسودة</span>
                      </button>
                    </div>
                  </div>
                )}

                {filteredQuickDrafts.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-center space-y-1.5">
                    <FileEdit className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      لا توجد مسودات في هذا التصنيف حالياً
                    </p>
                    <p className="text-[11px] text-slate-500">
                      اضغط «إضافة مسودة» أو استخدم زر «حفظ في المسودات» لحفظ أي فكرة هنا.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredQuickDrafts.map((d) => (
                      <div
                        key={d.id}
                        onClick={() =>
                          setSelectedReportItemModal({
                            id: d.id,
                            type: 'draft',
                            title: d.title,
                            subtitle:
                              d.scope === 'private'
                                ? 'مسودة خاصة — إدارة البيئة'
                                : 'مسودة المصنع — إدارة البيئة',
                            badge: d.scope === 'private' ? 'خاص' : 'المصنع',
                            badgeColor:
                              d.scope === 'private' ? 'purple' : 'emerald',
                            date: formatDateAr(d.updatedAt),
                            content: d.content,
                            department: 'الإدارة العامة للبيئة والسلامة المهنية',
                            rawItem: d,
                          })
                        }
                        className={`p-3.5 rounded-xl border bg-white dark:bg-slate-900 hover:border-blue-400 transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                          d.pinned
                            ? 'border-amber-300 dark:border-amber-800/80'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded font-bold border ${
                                  d.scope === 'private'
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                }`}
                              >
                                {d.scope === 'private' ? 'خاص' : 'المصنع'}
                              </span>
                              {onUpdateDraft && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void onUpdateDraft(d.id, {
                                      pinned: !d.pinned,
                                    });
                                  }}
                                  title={
                                    d.pinned ? 'إلغاء تثبيت المسودة' : 'تثبيت المسودة'
                                  }
                                  className={`p-1 rounded transition-colors ${
                                    d.pinned
                                      ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/50'
                                      : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <Pin className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <span className="text-slate-400 font-mono text-[10px]">
                              {formatDateAr(d.updatedAt)}
                            </span>
                          </div>

                          <h5 className="font-display text-xs sm:text-sm font-extrabold text-slate-950 dark:text-white line-clamp-1">
                            {d.title}
                          </h5>
                          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-3">
                            {d.content}
                          </p>
                        </div>

                        <div
                          className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PrintAsMenu
                            compact
                            onPrintPaperOrPdf={() =>
                              onPrintMemo({
                                headerMode: 'draft',
                                title: d.title,
                                content: d.content,
                                domain: 'company',
                                updatedAt: d.updatedAt,
                              })
                            }
                            onPreviewPrint={() =>
                              onPrintMemo(
                                {
                                  headerMode: 'draft',
                                  title: d.title,
                                  content: d.content,
                                  domain: 'company',
                                  updatedAt: d.updatedAt,
                                },
                                { previewOnly: true }
                              )
                            }
                            onExportPdf={() =>
                              downloadMemoPdf({
                                headerMode: 'draft',
                                title: d.title,
                                content: d.content,
                                domain: 'company',
                                updatedAt: d.updatedAt,
                              })
                            }
                            onExportWord={async () => {
                              const blob = await generateWordDocxBlob({
                                headerMode: 'draft',
                                title: d.title,
                                subTitle: 'إدارة البيئة — مسودة عمل',
                                updatedAt: d.updatedAt,
                                bodyText: d.content,
                              });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${d.title.slice(0, 40)}.docx`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                          />
                          {onDeleteDraft && (
                            <ConfirmDeleteInline
                              compact
                              onConfirm={() => onDeleteDraft(d.id)}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-5 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800 mt-8 space-y-1">
        <p className="font-display text-xs font-bold text-slate-900 dark:text-white">إنتاج وتطوير أحمد جلال</p>
        <p className="text-[11px] text-slate-500"><span className="font-mono">2026</span> · الإصدار الرابع</p>
      </footer>

      {/* Contact Long-Press / Options Modal: Delete OR Swap with another contact from same list */}
      {activeActionContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/45"
            onClick={closeContactMenu}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {swapMode
                    ? `تبديل «${activeActionContact.name}» بجهة أخرى`
                    : `خيارات جهة الاتصال`}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeActionContact.name} · {activeActionContact.role}
                </p>
              </div>
              <button
                type="button"
                onClick={closeContactMenu}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!swapMode ? (
              <div className="p-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setSwapMode(true)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-950/70 text-right transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
                      <ArrowLeftRight className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        تبديل بجهة اتصال أخرى من نفس القائمة
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        اختر جهة اتصال لتبديل موضعها مع {activeActionContact.name}
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteContact(activeActionContact.id)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100/80 dark:hover:bg-red-950/60 text-right transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-red-800 dark:text-red-300">
                        حذف جهة الاتصال من القائمة
                      </p>
                      <p className="text-[11px] text-red-700/80 dark:text-red-400">
                        إزالة {activeActionContact.name} نهائياً من قائمة الاتصال السريع
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 px-1">
                  اختر جهة الاتصال المراد التبديل معها:
                </p>
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
                  {contacts
                    .filter((c) => c.id !== activeActionContact.id)
                    .map((other) => (
                      <button
                        key={other.id}
                        type="button"
                        onClick={() =>
                          handleSwapContacts(activeActionContact.id, other.id)
                        }
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-between gap-2 text-right transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {other.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {other.role} · <span className="font-mono">{other.phone}</span>
                          </p>
                        </div>
                        <ArrowLeftRight className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                      </button>
                    ))}
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSwapMode(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    رجوع
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Detail Modal (نافذة صغيرة لعرض المهمة بمجرد الضغط عليها كليكة واحدة) */}
      {selectedTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setSelectedTaskModal(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  {selectedTaskModal.refCode}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  تفاصيل تكليف العمل
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskModal(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto text-right" dir="rtl">
              <div>
                <h3 className="font-display text-base font-extrabold text-slate-950 dark:text-white leading-snug">
                  {selectedTaskModal.title}
                </h3>
              </div>

              {/* Status and Priority badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                    selectedTaskModal.status === 'done'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : selectedTaskModal.status === 'in_progress'
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  الحالة:{' '}
                  {selectedTaskModal.status === 'done'
                    ? 'مكتمل'
                    : selectedTaskModal.status === 'in_progress'
                      ? 'جاري التنفيذ'
                      : selectedTaskModal.status === 'review'
                        ? 'قيد المراجعة'
                        : 'جديد'}
                </span>

                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                    selectedTaskModal.priority === 'urgent'
                      ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
                      : selectedTaskModal.priority === 'high'
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  الأولوية:{' '}
                  {selectedTaskModal.priority === 'urgent'
                    ? 'عاجل جداً'
                    : selectedTaskModal.priority === 'high'
                      ? 'مرتفع'
                      : 'عادي'}
                </span>

                {selectedTaskModal.isAssigned && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    مكلف رسمياً
                  </span>
                )}
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">الإدارة / الوحدة:</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedTaskModal.subDepartment || selectedTaskModal.assigneeOrUnit}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">تاريخ التنفيذ المستهدف:</span>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedTaskModal.dueDate || 'غير محدد'}
                  </p>
                </div>
                {selectedTaskModal.issuer && (
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">جهة الإصدار:</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedTaskModal.issuer}
                    </p>
                  </div>
                )}
                {selectedTaskModal.technicians && selectedTaskModal.technicians.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">المكلفون / الفنيون:</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedTaskModal.technicians.join('، ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Task Details / Notes */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  تفاصيل وتعليمات المهمة:
                </span>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap min-h-[70px]">
                  {selectedTaskModal.details || 'لا توجد تعليمات إضافية مسجلة لهذه المهمة.'}
                </div>
              </div>
            </div>

            {/* Footer with actions */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const task = selectedTaskModal;
                    void cycleOrderStatus(task);
                    const nextStatus: WorkOrderStatus =
                      task.status === 'new'
                        ? 'in_progress'
                        : task.status === 'in_progress'
                          ? 'done'
                          : 'new';
                    setSelectedTaskModal({ ...task, status: nextStatus });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors"
                >
                  تبديل الحالة ({selectedTaskModal.status === 'done' ? 'إعادة فتح' : selectedTaskModal.status === 'in_progress' ? 'تعيين كمكتمل' : 'بدء التنفيذ'})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onPrintMemo({
                      headerMode: 'memo',
                      title: `تكليف بعمل: ${selectedTaskModal.title}`,
                      content: `رقم التكليف: ${selectedTaskModal.refCode}\nالإدارة / الوحدة: ${selectedTaskModal.subDepartment || selectedTaskModal.assigneeOrUnit}\nتاريخ التنفيذ: ${selectedTaskModal.dueDate}\nالأولوية: ${selectedTaskModal.priority === 'urgent' ? 'عاجل' : selectedTaskModal.priority === 'high' ? 'مرتفع' : 'عادي'}\nالحالة: ${selectedTaskModal.status === 'done' ? 'مكتمل' : selectedTaskModal.status === 'in_progress' ? 'جاري التنفيذ' : 'جديد'}\n\nتفاصيل وتعليمات المهمة:\n${selectedTaskModal.details || 'لا توجد تفاصيل إضافية'}`,
                      domain: 'company',
                      direction: 'outgoing',
                      departmentName: selectedTaskModal.subDepartment || selectedTaskModal.assigneeOrUnit,
                      refNumber: selectedTaskModal.refCode,
                      updatedAt: selectedTaskModal.dueDate,
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                  <span>طباعة A4 / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await downloadMemoPdf({
                        headerMode: 'memo',
                        title: `تكليف بعمل: ${selectedTaskModal.title}`,
                        content: `رقم التكليف: ${selectedTaskModal.refCode}\nالإدارة / الوحدة: ${selectedTaskModal.subDepartment || selectedTaskModal.assigneeOrUnit}\nتاريخ التنفيذ: ${selectedTaskModal.dueDate}\nالأولوية: ${selectedTaskModal.priority === 'urgent' ? 'عاجل' : selectedTaskModal.priority === 'high' ? 'مرتفع' : 'عادي'}\nالحالة: ${selectedTaskModal.status === 'done' ? 'مكتمل' : selectedTaskModal.status === 'in_progress' ? 'جاري التنفيذ' : 'جديد'}\n\nتفاصيل وتعليمات المهمة:\n${selectedTaskModal.details || 'لا توجد تفاصيل إضافية'}`,
                        domain: 'company',
                        direction: 'outgoing',
                        departmentName: selectedTaskModal.subDepartment || selectedTaskModal.assigneeOrUnit,
                        refNumber: selectedTaskModal.refCode,
                        updatedAt: selectedTaskModal.dueDate,
                      });
                      onToast('تم تحميل ملف PDF بنجاح واستقرار');
                    } catch {
                      onToast('تعذر تنزيل ملف PDF');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                >
                  <CloudDownload className="w-3.5 h-3.5" />
                  <span>تحميل ملف PDF (.pdf)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTaskModal(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report / Memo / Draft / Note / Idea Detail Modal (نافذة صغيرة تفتح كليكة واحدة) */}
      {selectedReportItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setSelectedReportItemModal(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedReportItemModal.badgeColor === 'amber'
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                      : selectedReportItemModal.badgeColor === 'emerald'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                        : selectedReportItemModal.badgeColor === 'rose'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                          : selectedReportItemModal.badgeColor === 'purple'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-800'
                  }`}
                >
                  {selectedReportItemModal.badge}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {selectedReportItemModal.type === 'memo'
                    ? 'تفاصيل المذكرة الرسمية'
                    : selectedReportItemModal.type === 'correspondence'
                      ? 'تفاصيل المراسلة الخارجية'
                      : selectedReportItemModal.type === 'draft'
                        ? 'تفاصيل المسودة'
                        : selectedReportItemModal.type === 'note'
                          ? 'تفاصيل الملاحظة الإدارية'
                          : selectedReportItemModal.type === 'idea'
                            ? 'تفاصيل الفكرة والمسودة'
                            : 'تفاصيل التقرير اليومي'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportItemModal(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto text-right" dir="rtl">
              <div>
                <h3 className="font-display text-base font-extrabold text-slate-950 dark:text-white leading-snug">
                  {selectedReportItemModal.title}
                </h3>
                {selectedReportItemModal.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {selectedReportItemModal.subtitle}
                  </p>
                )}
              </div>

              {/* Metadata chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
                {selectedReportItemModal.department && (
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      الجهة / الإدارة:
                    </span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedReportItemModal.department}
                    </p>
                  </div>
                )}
                {selectedReportItemModal.date && (
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      التاريخ:
                    </span>
                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedReportItemModal.date}
                    </p>
                  </div>
                )}
                {selectedReportItemModal.refNumber && (
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      رقم الإشارة / الصادر:
                    </span>
                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedReportItemModal.refNumber}
                    </p>
                  </div>
                )}
                {selectedReportItemModal.importance && (
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      درجة الاهتمام:
                    </span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedReportItemModal.importance === 'high'
                        ? 'عالي (أولوية قصوى)'
                        : 'واطي (عادي)'}
                    </p>
                  </div>
                )}
              </div>

              {/* Text content */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  النص الكامل:
                </span>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap min-h-[90px] max-h-60 overflow-y-auto">
                  {selectedReportItemModal.content}
                </div>
              </div>
            </div>

            {/* Footer with actions */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Print button */}
                <button
                  type="button"
                  onClick={() => {
                    onPrintMemo({
                      headerMode:
                        selectedReportItemModal.type === 'draft' ||
                        selectedReportItemModal.type === 'idea'
                          ? 'draft'
                          : 'memo',
                      title: selectedReportItemModal.title,
                      content: selectedReportItemModal.content,
                      domain: 'company',
                      direction: 'outgoing',
                      departmentName:
                        selectedReportItemModal.department ||
                        'الإدارة العامة للبيئة والسلامة المهنية',
                      refNumber: selectedReportItemModal.refNumber,
                      updatedAt:
                        selectedReportItemModal.date ||
                        new Date().toISOString(),
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                  <span>طباعة A4 / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await downloadMemoPdf({
                        headerMode:
                          selectedReportItemModal.type === 'draft' ||
                          selectedReportItemModal.type === 'idea'
                            ? 'draft'
                            : 'memo',
                        title: selectedReportItemModal.title,
                        content: selectedReportItemModal.content,
                        domain: 'company',
                        direction: 'outgoing',
                        departmentName:
                          selectedReportItemModal.department ||
                          'الإدارة العامة للبيئة والسلامة المهنية',
                        refNumber: selectedReportItemModal.refNumber,
                        updatedAt:
                          selectedReportItemModal.date ||
                          new Date().toISOString(),
                      });
                      onToast('تم تحميل ملف PDF بنجاح واستقرار');
                    } catch {
                      onToast('تعذر تنزيل ملف PDF');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                >
                  <CloudDownload className="w-3.5 h-3.5" />
                  <span>تحميل ملف PDF (.pdf)</span>
                </button>

                {/* If idea, save to drafts button */}
                {selectedReportItemModal.type === 'idea' &&
                  Boolean(selectedReportItemModal.rawItem) && (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleSaveIdeaToDrafts(
                          selectedReportItemModal.rawItem as QuickIdeaItem
                        );
                        setSelectedReportItemModal(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ في المسودات</span>
                    </button>
                  )}

                {/* If note, convert to draft or order */}
                {selectedReportItemModal.type === 'note' &&
                  Boolean(selectedReportItemModal.rawItem) && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleConvertNoteToDraft(
                            selectedReportItemModal.rawItem as AdminNoteItem
                          );
                          setSelectedReportItemModal(null);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                      >
                        <FileEdit className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                        <span>تحويل لمسودة</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleConvertNoteToOrder(
                            selectedReportItemModal.rawItem as AdminNoteItem
                          );
                          setSelectedReportItemModal(null);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                      >
                        <CalendarCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span>تحويل لتكليف</span>
                      </button>
                    </>
                  )}

                {/* Open Secretariat */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReportItemModal(null);
                    onOpenSecretariat();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>فتح بالسكرتارية</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReportItemModal(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
