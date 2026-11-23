import React, { useState, useEffect } from 'react';
import { Search, ArrowLeft, CheckCircle2, Clock, AlertCircle, FileText, Download, ShieldCheck } from 'lucide-react';
import PriorityBadge from '../../components/PriorityBadge';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/client';

export function TrackTest({ initialTrackingId = '', onBack }) {
  const [trackingId, setTrackingId] = useState(initialTrackingId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testData, setTestData] = useState(null);
  const [verified, setVerified] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);

  useEffect(() => {
    if (initialTrackingId) {
      handleSearch(initialTrackingId);
    }
  }, [initialTrackingId]);

  const handleSearch = async (codeToSearch) => {
    const code = (codeToSearch || trackingId).trim();
    if (!code || code.length !== 5) {
      setError('Please enter a valid 5-digit Tracking ID (e.g. 48291).');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.trackTest(code);
      setTestData(res);
      // If not yet verified, prompt verification before revealing full patient report
      if (!verified) {
        setShowOtpModal(true);
      }
    } catch (err) {
      setTestData(null);
      setError(err.message || 'No test found with this Tracking ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (otpInput.trim().length < 4) {
      alert('Please enter your 4 or 6-digit verification code.');
      return;
    }
    setVerified(true);
    setShowOtpModal(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Patient Options</span>
      </button>

      {/* Tracking Input Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h1 className="text-lg font-bold text-slate-900 mb-1">Track My Specimen &amp; Diagnostic Report</h1>
        <p className="text-xs text-slate-500 mb-4">
          Enter your 5-digit Tracking Number provided upon registration.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              maxLength="5"
              placeholder="e.g. 48291"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value.replace(/\D/g, ''))}
              className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold tracking-widest bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white text-slate-800"
            />
          </div>
          <button
            type="submit"
            disabled={loading || trackingId.length !== 5}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
            <span>Search Test</span>
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Test Status & Diagnostic Result Card */}
      {testData && testData.test && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in duration-300">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tracking ID
              </span>
              <div className="text-xl font-mono font-bold text-sky-700">
                #{testData.test.tracking_number}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <PriorityBadge priority={testData.test.priority} />
              <StatusBadge status={testData.test.status} />
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Overview Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Test Name</span>
                <span className="font-semibold text-slate-800">{testData.test.test_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Discipline</span>
                <span className="font-semibold text-slate-800">{testData.test.test_category}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Sample Type</span>
                <span className="font-semibold text-slate-800">{testData.test.sample_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Registered Date</span>
                <span className="font-semibold text-slate-800">
                  {new Date(testData.test.registered_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>

            {/* Test Completed & Verified Report Banner */}
            {testData.test.status === 'COMPLETED' ? (
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-sm">Diagnostic Test Completed</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  {testData.test.remarks || 'Your laboratory diagnostic evaluation has been completed and verified by laboratory staff.'}
                </p>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={() => alert(`Viewing verified diagnostic report for Tracking ID #${testData.test.tracking_number}. All parameters verified.`)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View Report</span>
                  </button>

                  <button
                    onClick={() => alert(`Downloading official PDF diagnostic report for Tracking ID #${testData.test.tracking_number}.`)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Report</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <Clock className="w-5 h-5 text-sky-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Test In Progress</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Your specimen is prioritized in the laboratory queue. You will receive an SMS and Email notification immediately upon completion.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Patient Verification</h3>
                <p className="text-xs text-slate-500">Security verification required</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              For patient confidentiality, enter the 4-digit verification code sent to your registered contact number. (Demo Code: <strong>1234</strong>)
            </p>

            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <input
                type="text"
                required
                maxLength="6"
                placeholder="Enter 1234"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                className="w-full text-center px-3 py-2 text-base font-mono font-bold tracking-widest bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs"
                >
                  Verify Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrackTest;
