export type DomainScope = 'all' | 'university' | 'company';
export type ItemDomain = 'university' | 'company';

export type NavSection =
  | 'overview'
  | 'external'
  | 'sub_departments'
  | 'memos'
  | 'drafts'
  | 'folders'
  | 'orders'
  | 'research'
  | 'files'
  | 'images'
  | 'messages';

export type DraftScope = 'factory' | 'private';

export type SubDepartmentId =
  | 'industrial_drainage'
  | 'sanitary_drainage'
  | 'occupational_safety'
  | 'industrial_security';

export interface SubDepartmentDefinition {
  id: SubDepartmentId;
  name: string;
  code: string;
  description: string;
}

export const SUB_DEPARTMENTS: SubDepartmentDefinition[] = [
  {
    id: 'industrial_drainage',
    name: 'إدارة الصرف الصناعي',
    code: 'IND-DRN',
    description: 'محطات المعالجة الصناعية، قياسات COD/BOD، ومخارج الصرف الصناعي.',
  },
  {
    id: 'sanitary_drainage',
    name: 'إدارة الصرف الصحي',
    code: 'SAN-DRN',
    description: 'شبكات الصرف الصحي بالمصنع، الصيانة الدورية، والربط بالشبكة العمومية.',
  },
  {
    id: 'occupational_safety',
    name: 'إدارة السلامة المهنية',
    code: 'OSH-SAF',
    description: 'اشتراطات السلامة والصحة المهنية، مهمات الوقاية، وتأمين مواقع العمل.',
  },
  {
    id: 'industrial_security',
    name: 'إدارة الأمن الصناعي',
    code: 'IND-SEC',
    description: 'تأمين المنشآت، منظومات الإطفاء والإنذار، وخطط الطوارئ بالمصنع.',
  },
];

export type FileCategory = 'word' | 'excel' | 'pdf' | 'other';

export type ResearchKind = 'none' | 'masters' | 'phd' | 'paper' | 'book';

export type MemoDirection = 'incoming' | 'outgoing';

export type WorkOrderStatus = 'new' | 'in_progress' | 'review' | 'done';

export type PriorityLevel = 'urgent' | 'high' | 'normal';

export type MessageChannel =
  | 'university_email'
  | 'company_email'
  | 'whatsapp'
  | 'teams';

export interface ProjectFolder {
  id: string;
  name: string;
  domain: ItemDomain;
  code: string;
  description: string;
  createdAt: string;
}

export interface SheetPreviewData {
  sheetName: string;
  headers: string[];
  rows: string[][];
}

export interface IndexedFile {
  id: string;
  title: string;
  fileName: string;
  category: FileCategory;
  domain: ItemDomain;
  projectId: string;
  sizeBytes: number;
  updatedAt: string;
  notes: string;
  hasBlob: boolean;
  mimeType: string;
  extractedText?: string;
  sheetPreview?: SheetPreviewData[];
  starred?: boolean;
  researchKind?: ResearchKind;
  headings?: string[];
}

export interface IndexedImage {
  id: string;
  title: string;
  fileName: string;
  domain: ItemDomain;
  projectId: string;
  sizeBytes: number;
  capturedAt: string;
  caption: string;
  hasBlob: boolean;
  thumbnailDataUrl?: string;
  dataUrl?: string;
  width?: number;
  height?: number;
  starred?: boolean;
}

export interface WorkMemo {
  id: string;
  title: string;
  content: string;
  domain: ItemDomain;
  projectId: string;
  updatedAt: string;
  pinned: boolean;
  linkedFileIds: string[];
  direction?: MemoDirection;
  departmentName?: string;
  replyToId?: string;
  threadId?: string;
}

export interface WorkOrder {
  id: string;
  refCode: string;
  title: string;
  details: string;
  domain: ItemDomain;
  projectId: string;
  issuer: string;
  assigneeOrUnit: string;
  subDepartment?: string;
  technicians?: string[];
  isAssigned?: boolean;
  priority: PriorityLevel;
  status: WorkOrderStatus;
  dueDate: string;
  createdAt: string;
  linkedFileIds: string[];
  sourceMessageId?: string;
}

export interface IncomingMessage {
  id: string;
  senderName: string;
  senderRole: string;
  subject: string;
  body: string;
  channel: MessageChannel;
  domain: ItemDomain;
  projectId: string;
  receivedAt: string;
  isRead: boolean;
  starred: boolean;
  convertedOrderId?: string;
  convertedMemoId?: string;
}

export interface CorrespondenceEntity {
  id: string;
  name: string;
  category: string;
  contactInfo: string;
  notes: string;
  createdAt: string;
}

export interface ExternalCorrespondence {
  id: string;
  entityId: string;
  entityName: string;
  direction: MemoDirection;
  refNumber: string;
  subject: string;
  body: string;
  date: string;
  subDepartment?: string;
  linkedFileIds: string[];
  pinned: boolean;
  updatedAt: string;
  replyToId?: string;
  threadId?: string;
}

export interface WorkDraft {
  id: string;
  title: string;
  content: string;
  scope?: DraftScope;
  projectId: string;
  linkedWordFileId?: string;
  pinned: boolean;
  updatedAt: string;
}

export interface WorkspaceState {
  projects: ProjectFolder[];
  files: IndexedFile[];
  images: IndexedImage[];
  memos: WorkMemo[];
  drafts: WorkDraft[];
  orders: WorkOrder[];
  messages: IncomingMessage[];
  correspondenceEntities: CorrespondenceEntity[];
  correspondences: ExternalCorrespondence[];
}

export interface SearchFocusTarget {
  query: string;
  matchOrdinal?: number;
  sheetIndex?: number;
  rowIndex?: number;
  headingText?: string;
  sourceField?: 'extractedText' | 'notes' | 'content' | 'details' | 'body' | 'caption';
}

export type InspectedItem =
  | { kind: 'file'; id: string; focusSearch?: SearchFocusTarget }
  | { kind: 'image'; id: string; focusSearch?: SearchFocusTarget }
  | { kind: 'memo'; id: string; focusSearch?: SearchFocusTarget }
  | { kind: 'draft'; id: string; focusSearch?: SearchFocusTarget }
  | { kind: 'order'; id: string; focusSearch?: SearchFocusTarget }
  | { kind: 'message'; id: string; focusSearch?: SearchFocusTarget }
  | { kind: 'correspondence'; id: string; focusSearch?: SearchFocusTarget }
  | { kind: 'project'; id: string; focusSearch?: SearchFocusTarget };
