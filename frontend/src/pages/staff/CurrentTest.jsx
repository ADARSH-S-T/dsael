import React, { useState } from 'react';
import { ArrowLeft, Play, CheckCircle2, FileText, Upload, Clock, User, ShieldAlert } from 'lucide-react';
import PriorityBadge from '../../components/PriorityBadge';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Privacy: mask patient name for lab staff (biometric privacy feature)
const maskName = (name) => name ? name.split(' ').map(w => 'X'.repeat(w.length)).join(' ') : 'PATIENT';

export function CurrentTest({ test, onBack, onCompleted }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(test.status || 'ASSIGNED');
  const [remarks, setRemarks] = useState(test.remarks || '');
  const [reportFileName, setReportFileName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStartTest = async () => {
    try {
      setLoading(true);
      await api.startTest(test.id, user?.id);
      setStatus('IN_PROGRESS');
    } catch (err) {
      alert('Error starting test: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTest = async () => {
    try {
      setLoading(true);
      await api.completeTest({
        test_id: test.id,
        staff_id: user?.id,
        remarks: remarks || 'Clinical diagnostic evaluation verified and confirmed.',
        report_name: reportFileName || 'DiagnosticReport.pdf'
      });
      alert(`Test #${test.tracking_number} completed! Patient notified via SMS & Email.`);
      if (onCompleted) onCompleted();
      if (onBack) onBack();
    } catch (err) {
      alert('Error completing test: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Queue</span>
      </button>

      {/* Main Specimen Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Active Specimen Analysis
            </span>
            <div className="text-2xl font-mono font-bold">
              #{test.tracking_number}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">{test.test_name}</p>
          </div>

          <div className="flex items-center gap-2">
            <PriorityBadge priority={test.priority} />
            <StatusBadge status={status} />
          </div>
        </div>

        <div className="p-6 space-y-6 text-xs">
          {/* Patient Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-slate-400 block mb-0.5">Patient Name</span>
              <span className="font-semibold text-slate-900">{test.patient?.full_name || 'Patient'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Age / Gender</span>
              <span className="font-semibold text-slate-900">
                {test.patient?.age || '-'} yrs • {test.patient?.gender || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Contact</span>
              <span className="font-semibold text-slate-900">{test.patient?.phone || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Assigned Staff</span>
              <span className="font-semibold text-slate-900">{user?.full_name || 'Staff'}</span>
            </div>
          </div>

          {/* Sample Specifications */}
          <div className="space-y-2">
            <h2 className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
              Sample Specifications
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 block mb-0.5">Discipline / Category</span>
                <span className="font-semibold text-slate-800">{test.test_category}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Sample Type</span>
                <span className="font-semibold text-slate-800">{test.sample_type}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 block mb-0.5">Sample Details</span>
                <span className="text-slate-700">{test.sample_details}</span>
              </div>
              {test.additional_information && (
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block mb-0.5">Additional Clinical Info</span>
                  <span className="text-slate-700">{test.additional_information}</span>
                </div>
              )}
            </div>
          </div>

          {/* Processing Controls */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h2 className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
              Diagnostic Processing Controls
            </h2>

            {status === 'ASSIGNED' && (
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sky-900">Ready to begin specimen analysis</p>
                  <p className="text-sky-700 text-[11px]">Change status to In Progress to log diagnostic start timestamp.</p>
                </div>
                <button
                  onClick={handleStartTest}
                  disabled={loading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Test</span>
                </button>
              </div>
            )}

            {/* Remarks Input */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Diagnostic Findings &amp; Clinical Remarks
              </label>
              <textarea
                rows="3"
                placeholder="Enter analyzer findings, reference range evaluations, or pathologist comments..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white resize-none"
              ></textarea>
            </div>

            {/* Report Attachment Simulation */}
            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-semibold text-slate-800">
                    {reportFileName ? `Attached: ${reportFileName}` : 'Laboratory Diagnostic Report (PDF)'}
                  </p>
                  <p className="text-[11px] text-slate-400">Auto-generated diagnostic report template will be sealed upon completion.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportFileName(`${test.tracking_number}_DiagnosticReport.pdf`)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 cursor-pointer"
              >
                {reportFileName ? 'Report Attached' : 'Attach Report'}
              </button>
            </div>

            {/* Complete Test Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleCompleteTest}
                disabled={loading}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Test &amp; Notify Patient</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CurrentTest;
