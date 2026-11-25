import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Copy, Plus } from 'lucide-react';
import type {
  InspectedItem,
  WorkOrder,
  WorkOrderStatus,
} from '../../types';
import { ConfirmDeleteInline } from '../ConfirmDeleteInline';
import { priorityLabel, statusLabel } from '../DomainLabels';

interface OrdersViewProps {
  orders: WorkOrder[];
  onAddOrder: () => void;
  onUpdateOrder: (id: string, updates: Partial<WorkOrder>) => Promise<void>;
  onDeleteOrder: (id: string) => Promise<void>;
  onFollowUpOrder: (order: WorkOrder) => Promise<void>;
  onInspect: (item: InspectedItem) => void;
}

export function OrdersView({
  orders,
  onAddOrder,
  onUpdateOrder,
  onDeleteOrder,
  onFollowUpOrder,
  onInspect,
}: OrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | WorkOrderStatus>('all');

  const filtered = orders.filter((o) =>
    statusFilter === 'all' ? true : o.status === statusFilter
  );

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'new', 'in_progress', 'review', 'done'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                statusFilter === st
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {st === 'all' ? 'الكل' : statusLabel(st).text}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onAddOrder}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة مذكرة أعمال</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            لا توجد مهام في مذكرة الأعمال ضمن هذا التصنيف
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const st = statusLabel(o.status);
            const pr = priorityLabel(o.priority);
            return (
              <div
                key={o.id}
                onClick={() => onInspect({ kind: 'order', id: o.id })}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-colors cursor-pointer space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        {o.refCode}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold border ${st.classes}`}>
                        {st.text}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold border ${pr.classes}`}>
                        {pr.text}
                      </span>
                      {(o.subDepartment || o.assigneeOrUnit) && (
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          {o.subDepartment || o.assigneeOrUnit}
                        </span>
                      )}
                      {o.dueDate && <span className="text-slate-400">الموعد: {o.dueDate}</span>}
                    </div>

                    <h3 className="font-display text-sm font-extrabold text-slate-950 dark:text-white">
                      {o.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {o.details}
                    </p>
                    {o.technicians && o.technicians.length > 0 && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        الفنيون المكلفون: {o.technicians.join('، ')}
                      </p>
                    )}
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {o.status !== 'done' ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdateOrder(o.id, { isAssigned: !o.isAssigned })
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-bold ${
                            o.isAssigned
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{o.isAssigned ? 'تم التكليف' : 'تكليف'}</span>
                        </button>
                        <select
                          value={o.status}
                          onChange={(e) =>
                            void onUpdateOrder(o.id, {
                              status: e.target.value as WorkOrderStatus,
                            })
                          }
                          className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
                        >
                          <option value="new">جديد</option>
                          <option value="in_progress">قيد التنفيذ</option>
                          <option value="review">بانتظار المراجعة</option>
                          <option value="done">مكتمل</option>
                        </select>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onFollowUpOrder(o)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-700 text-white text-xs font-bold"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>متابعة</span>
                      </button>
                    )}
                    <ConfirmDeleteInline compact onConfirm={() => onDeleteOrder(o.id)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
