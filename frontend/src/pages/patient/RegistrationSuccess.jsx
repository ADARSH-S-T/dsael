import React from 'react';
import { CheckCircle2, Copy, Search, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import PriorityBadge from '../../components/PriorityBadge';
import StatusBadge from '../../components/StatusBadge';

export function RegistrationSuccess({ registrationData, onTrackThisTest, onRegisterAnother }) {
  const { tracking_number, test, patient, priority_status } = registrationData;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tracking_number);
    alert(`Tracking ID ${tracking_number} copied to clipboard!`);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900">Test Registered Successfully</h1>
          <p className="text-xs text-slate-500 mt-1">
            Your laboratory specimen has been registered in the LabFlow system.
          </p>
        </div>

        {/* Highlighted 5-Digit Tracking Code Box */}
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Your Unique Tracking ID
          </span>
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-extrabold tracking-widest text-sky-700 font-mono">
              {tracking_number}
            </span>
            <button
              onClick={copyToClipboard}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Copy Tracking ID"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Keep this 5-digit number safe to verify and download your diagnostic report.
          </p>
        </div>

        {/* Priority Allocation Summary */}
        <div className="text-left bg-slate-50/50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="font-semibold text-slate-700">Triage Status:</span>
            <StatusBadge status={test?.status} size="sm" />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Priority Level:</span>
            <PriorityBadge priority={test?.priority} size="sm" />
          </div>

          <div className="pt-2 text-[11px] text-slate-600 leading-relaxed">
            <strong>Triage Explanation:</strong> {test?.priority_reason || priority_status?.reason}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onTrackThisTest(tracking_number)}
            className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Track My Test Now</span>
          </button>
          <button
            onClick={onRegisterAnother}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Register Another Specimen
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegistrationSuccess;
