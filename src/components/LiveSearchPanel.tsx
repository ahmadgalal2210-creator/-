import { Search } from 'lucide-react';
import type { SearchHit } from '../lib/searchEngine';
import type { InspectedItem, ProjectFolder } from '../types';

interface LiveSearchPanelProps {
  query: string;
  hits: SearchHit[];
  projects: ProjectFolder[];
  onInspect: (item: InspectedItem) => void;
}

export function LiveSearchPanel({
  query,
  hits,
  onInspect,
}: LiveSearchPanelProps) {
  return (
    <section className="mb-5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
          <Search className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          <span>
            نتائج البحث الفوري عن «{query}» ({hits.length})
          </span>
        </div>
      </div>

      {hits.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          لم يتم العثور على تطابقات في المراسلات أو الملفات أو جداول الإكسيل أو المذكرات.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
          {hits.map((hit) => (
            <button
              key={hit.key}
              type="button"
              onClick={() =>
                onInspect({
                  kind: hit.kind,
                  id: hit.id,
                  focusSearch: hit.focusSearch,
                })
              }
              className="text-right p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 hover:border-blue-400 transition-colors space-y-1"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>{hit.subtitle}</span>
                <span className="font-mono text-blue-700 dark:text-blue-400 font-bold tabular-nums">
                  {hit.matchCount} تطابق
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {hit.title}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                {hit.snippet}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
