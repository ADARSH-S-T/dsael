import React from 'react';
import { AlertCircle, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';

export function PriorityBadge({ priority, size = 'md' }) {
  const p = (priority || '').toUpperCase();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  if (p === 'HIGH') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-red-50 text-red-700 border border-red-200 ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
        <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
        HIGH PRIORITY
      </span>
    );
  }

  if (p === 'MEDIUM') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-orange-50 text-orange-700 border border-orange-200 ${sizeClasses}`}>
        <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
        MEDIUM PRIORITY
      </span>
    );
  }

  if (p === 'LOW') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-green-50 text-green-700 border border-green-200 ${sizeClasses}`}>
        <Clock className="w-3.5 h-3.5 text-green-600" />
        LOW PRIORITY
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses}`}>
      PENDING REVIEW
    </span>
  );
}

export default PriorityBadge;
