import React from 'react';
import { Clock, Activity, CheckCircle2, AlertTriangle, UserCheck, XCircle } from 'lucide-react';

export function StatusBadge({ status, size = 'md' }) {
  const s = (status || '').toUpperCase();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  switch (s) {
    case 'WAITING_IN_QUEUE':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-sky-50 text-sky-700 border border-sky-200 ${sizeClasses}`}>
          <Clock className="w-3 h-3 text-sky-600" />
          Waiting in Queue
        </span>
      );
    case 'ASSIGNED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 ${sizeClasses}`}>
          <UserCheck className="w-3 h-3 text-indigo-600" />
          Assigned
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
          </span>
          In Progress
        </span>
      );
    case 'COMPLETED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Completed
        </span>
      );
    case 'AWAITING_ADMIN_REVIEW':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-purple-50 text-purple-700 border border-purple-200 ${sizeClasses}`}>
          <AlertTriangle className="w-3 h-3 text-purple-600" />
          Awaiting Admin Review
        </span>
      );
    case 'CANCELLED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses}`}>
          <XCircle className="w-3 h-3 text-slate-500" />
          Cancelled
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
}

export default StatusBadge;
