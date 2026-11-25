import { File, FileSpreadsheet, FileText } from 'lucide-react';
import type {
  FileCategory,
  ItemDomain,
  PriorityLevel,
  ResearchKind,
  WorkOrderStatus,
} from '../types';

export function CategoryIcon({
  category,
  className = 'w-4 h-4',
}: {
  category: FileCategory;
  className?: string;
}) {
  if (category === 'excel') {
    return <FileSpreadsheet className={`${className} text-emerald-700 dark:text-emerald-400`} />;
  }
  if (category === 'word') {
    return <FileText className={`${className} text-blue-700 dark:text-blue-400`} />;
  }
  if (category === 'pdf') {
    return <FileText className={`${className} text-rose-700 dark:text-rose-400`} />;
  }
  return <File className={`${className} text-slate-500 dark:text-slate-400`} />;
}

export function domainLabel(domain: ItemDomain): string {
  return domain === 'university' ? 'أبحاث' : 'شركة الدقهلية للسكر';
}

export function researchKindLabel(kind?: ResearchKind): string {
  switch (kind) {
    case 'masters':
      return 'رسالة ماجستير';
    case 'phd':
      return 'رسالة دكتوراه';
    case 'paper':
      return 'ورقة بحثية';
    case 'book':
      return 'كتاب علمي';
    default:
      return 'ملف عمل';
  }
}

export function priorityLabel(priority: PriorityLevel): {
  text: string;
  classes: string;
} {
  if (priority === 'urgent') {
    return {
      text: 'عاجل',
      classes: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900',
    };
  }
  if (priority === 'high') {
    return {
      text: 'أولوية عالية',
      classes: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    };
  }
  return {
    text: 'عادي',
    classes: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };
}

export function statusLabel(status: WorkOrderStatus): {
  text: string;
  classes: string;
} {
  switch (status) {
    case 'new':
      return {
        text: 'جديد',
        classes: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      };
    case 'in_progress':
      return {
        text: 'قيد التنفيذ',
        classes: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900',
      };
    case 'review':
      return {
        text: 'بانتظار المراجعة',
        classes: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
      };
    case 'done':
      return {
        text: 'مكتمل',
        classes: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
      };
  }
}
