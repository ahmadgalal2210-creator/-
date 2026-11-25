import { Building2, CheckCircle2, ClipboardCheck, Plus, Send } from 'lucide-react';
import { SUB_DEPARTMENTS } from '../../types';
import type {
  ExternalCorrespondence,
  InspectedItem,
  SubDepartmentId,
  WorkOrder,
} from '../../types';
import { ConfirmDeleteInline } from '../ConfirmDeleteInline';
import { priorityLabel, statusLabel } from '../DomainLabels';

interface SubDepartmentsViewProps {
  selectedSubDept: SubDepartmentId;
  onSelectSubDept: (id: SubDepartmentId) => void;
  orders: WorkOrder[];
  correspondences: ExternalCorrespondence[];
  onAddOrderForDept: (deptName: string) => void;
  onAddCorrForDept: (deptName: string) => void;
  onInspect: (item: InspectedItem) => void;
  onDeleteOrder: (id: string) => Promise<void>;
}

export function SubDepartmentsView({
  selectedSubDept,
  onSelectSubDept,
  orders,
  correspondences,
  onAddOrderForDept,
  onAddCorrForDept,
  onInspect,
  onDeleteOrder,
}: SubDepartmentsViewProps) {
  const activeDept =
    SUB_DEPARTMENTS.find((d) => d.id === selectedSubDept) || SUB_DEPARTMENTS[0];

  const deptOrders = orders.filter(
    (o) =>
      o.subDepartment === activeDept.name || o.assigneeOrUnit === activeDept.name
  );
  const deptCorrs = correspondences.filter(
    (c) => c.subDepartment === activeDept.name
  );

  return (
    <div className="space-y-5">
      {/* 4 Sub-departments Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {SUB_DEPARTMENTS.map((dept) => {
          const active = dept.id === activeDept.id;
          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => onSelectSubDept(dept.id)}
              className={`text-right p-3.5 rounded-xl border transition-colors ${
                active
                  ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-xs font-extrabold">{dept.name}</span>
                <Building2 className={`w-4 h-4 ${active ? 'text-blue-200' : 'text-blue-700'}`} />
              </div>
              <p
                className={`text-[11px] mt-1 line-clamp-2 ${
                  active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {dept.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Sub-department Header */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-extrabold text-slate-950 dark:text-white">
            {activeDept.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {activeDept.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAddCorrForDept(activeDept.name)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Send className="w-3.5 h-3.5 text-blue-700" />
            <span>مراسلة للإدارة</span>
          </button>
          <button
            type="button"
            onClick={() => onAddOrderForDept(activeDept.name)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold hover:bg-blue-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>تكليف عمل جديد</span>
          </button>
        </div>
      </div>

      {/* Department Orders & Correspondences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-blue-700" />
            تكليفات ومهام الإدارة ({deptOrders.length})
          </h4>
          {deptOrders.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              لا توجد تكليفات مسجلة لهذه الإدارة الفرعية بعد.
            </p>
          ) : (
            <div className="space-y-2.5">
              {deptOrders.map((o) => {
                const st = statusLabel(o.status);
                const pr = priorityLabel(o.priority);
                return (
                  <div
                    key={o.id}
                    onClick={() => onInspect({ kind: 'order', id: o.id })}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 hover:border-blue-400 cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold text-slate-500">
                          {o.refCode}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${st.classes}`}>
                          {st.text}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${pr.classes}`}>
                          {pr.text}
                        </span>
                      </div>
                      <ConfirmDeleteInline compact onConfirm={() => onDeleteOrder(o.id)} />
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{o.title}</p>
                    {o.technicians && o.technicians.length > 0 && (
                      <p className="text-[11px] text-slate-500">
                        الفنيون: {o.technicians.join('، ')}
                      </p>
                    )}
                    {o.isAssigned && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        تم التكليف
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Send className="w-4 h-4 text-emerald-700" />
            مراسلات مرتبطة بالإدارة ({deptCorrs.length})
          </h4>
          {deptCorrs.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              لا توجد مراسلات مرتبطة بهذه الإدارة بعد.
            </p>
          ) : (
            <div className="space-y-2.5">
              {deptCorrs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onInspect({ kind: 'correspondence', id: c.id })}
                  className="w-full text-right p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 hover:border-blue-400 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-blue-700 dark:text-blue-400">{c.entityName}</span>
                    <span className="text-slate-400">{c.date}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{c.subject}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
