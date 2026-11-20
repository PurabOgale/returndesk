import { ReturnStatus } from '@/lib/domain';

const STATUS_STYLES: Record<ReturnStatus, string> = {
  Open: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  'In Review': 'bg-blue-50 text-blue-800 ring-blue-600/20',
  Approved: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  Rejected: 'bg-rose-50 text-rose-800 ring-rose-600/20',
  Completed: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

const STATUS_DOTS: Record<ReturnStatus, string> = {
  Open: 'bg-amber-500',
  'In Review': 'bg-blue-500',
  Approved: 'bg-emerald-500',
  Rejected: 'bg-rose-500',
  Completed: 'bg-slate-500',
};

export function StatusBadge({ status }: { status: ReturnStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[status]}`} />
      {status}
    </span>
  );
}
