import React, { useState, useEffect } from 'react';
import { Search, ArrowLeft, CheckCircle2, Clock, AlertCircle, FileText, Download, ShieldCheck, Camera, ScanFace } from 'lucide-react';
import PriorityBadge from '../../components/PriorityBadge';
import StatusBadge from '../../components/StatusBadge';
import FaceCapture from '../../components/FaceCapture';
import api from '../../api/client';

// Helper to render a single test result card (shared by both tracking and face scan flows)
function TestResultCard({ testData }) {
  if (!testData || !testData.test) return null;
  const t = testData.test;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in duration-300">
      <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tracking ID</span>
          <div className="text-xl font-mono font-bold text-sky-700">#{t.tracking_number}</div>
        </div>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={t.priority} />
          <StatusBadge status={t.status} />
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Test Name</span>
            <span className="font-semibold text-slate-800">{t.test_name}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Discipline</span>
            <span className="font-semibold text-slate-800">{t.test_category}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Sample Type</span>
            <span className="font-semibold text-slate-800">{t.sample_type}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Registered Date</span>
            <span className="font-semibold text-slate-800">
              {new Date(t.registered_at).toLocaleDateString([], {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
        </div>

        {t.status === 'COMPLETED' ? (
          <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
            <div className="flex items-center gap-2.5 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-sm">Diagnostic Test Completed</span>
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              {t.remarks || 'Your laboratory diagnostic evaluation has been completed and verified by laboratory staff.'}
            </p>
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => alert(`Viewing verified diagnostic report for Tracking ID #${t.tracking_number}. All parameters verified.`)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>View Report</span>
              </button>
              <button
                onClick={() => alert(`Downloading official PDF diagnostic report for Tracking ID #${t.tracking_number}.`)}
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
  );
}

export function TrackTest({ initialTrackingId = '', onBack }) {
  // ── Mode management ──────────────────────────────────────────────
  // 'choice' | 'face' | 'tracking'
  const [trackMode, setTrackMode] = useState(initialTrackingId ? 'tracking' : 'choice');
  const [bioAvailable, setBioAvailable] = useState(false);

  // ── Tracking ID flow state ───────────────────────────────────────
  const [trackingId, setTrackingId] = useState(initialTrackingId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testData, setTestData] = useState(null);
  const [verified, setVerified] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);

  // ── Face scan flow state ─────────────────────────────────────────
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceError, setFaceError] = useState(null);
  const [faceResults, setFaceResults] = useState([]); // array of test objects

  // ── On mount: check biometric availability ───────────────────────
  useEffect(() => {
    api.getBiometricStatus()
      .then(r => setBioAvailable(r.face_recognition_available === true))
      .catch(() => setBioAvailable(false));
  }, []);

  // Auto-search if initialTrackingId is provided
  useEffect(() => {
    if (initialTrackingId) {
      handleSearch(initialTrackingId);
    }
  }, [initialTrackingId]);

  // ── Tracking ID handlers ─────────────────────────────────────────
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
      if (!verified) setShowOtpModal(true);
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

  // ── Face scan handlers ───────────────────────────────────────────
  const handleFaceScan = async (imageDataUri) => {
    setShowFaceCapture(false);
    setFaceLoading(true);
    setFaceError(null);
    setFaceResults([]);
    try {
      // Strip data URI prefix — backend expects raw base64
      const base64 = imageDataUri.replace(/^data:image\/[a-z]+;base64,/, '');
      const res = await api.identifyByFace({ image_b64: base64 });
      if (res.identified && res.tests && res.tests.length > 0) {
        setFaceResults(res.tests);
      } else {
        setFaceError('No matching patient found. Your face did not match any enrolled record with sufficient confidence.');
      }
    } catch (err) {
      setFaceError(err.message || 'Face identification failed. Please try again or use Tracking ID.');
    } finally {
      setFaceLoading(false);
    }
  };

  // ── MODE: CHOICE ─────────────────────────────────────────────────
  if (trackMode === 'choice') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Patient Options</span>
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-2 text-center">
          <h1 className="text-lg font-bold text-slate-900">Track My Specimen & Report</h1>
          <p className="text-xs text-slate-500">Choose how you'd like to verify your identity and access your test records.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Face scan option — only shown when biometric service is available */}
          {bioAvailable && (
            <button
              onClick={() => { setTrackMode('face'); setFaceError(null); setFaceResults([]); }}
              className="bg-white rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-md p-6 text-left transition-all group cursor-pointer space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center group-hover:bg-sky-200 transition-colors">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Scan Face to Access Reports</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Open camera, scan your face, and instantly access your test records — no codes needed.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700">
                Use face scan <span aria-hidden>→</span>
              </span>
            </button>
          )}

          {/* Tracking ID option — always shown */}
          <button
            onClick={() => { setTrackMode('tracking'); setError(null); setTestData(null); }}
            className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md p-6 text-left transition-all group cursor-pointer space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Use Tracking ID</h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Enter your 5-digit Tracking ID and verification code to view your test status and reports.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              Enter Tracking ID <span aria-hidden>→</span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── MODE: FACE SCAN ──────────────────────────────────────────────
  if (trackMode === 'face') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <button onClick={() => setTrackMode('choice')} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Face Scan Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Face Recognition Verification</h1>
              <p className="text-xs text-slate-500">Liveness check will be performed. Keep your face clearly visible.</p>
            </div>
          </div>

          {/* Privacy note */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span>Your face image is processed locally on the server and immediately deleted after identification. No raw photos are stored.</span>
          </div>

          {faceLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
              <span className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span>Identifying patient from face scan…</span>
            </div>
          )}

          {faceError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div className="space-y-1">
                <span>{faceError}</span>
                <div className="pt-1">
                  <button
                    onClick={() => setTrackMode('tracking')}
                    className="underline text-sky-700 hover:text-sky-900"
                  >
                    Unable to recognize your face? Use Tracking ID and Password.
                  </button>
                </div>
              </div>
            </div>
          )}

          {!faceLoading && faceResults.length === 0 && (
            <button
              onClick={() => setShowFaceCapture(true)}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Open Camera & Scan Face</span>
            </button>
          )}

          {!faceLoading && faceResults.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Face verified. Showing your test records below.</span>
            </div>
          )}

          {/* Switch to tracking ID link */}
          <p className="text-xs text-center text-slate-400">
            Prefer not to use face scan?{' '}
            <button onClick={() => setTrackMode('tracking')} className="text-sky-600 hover:underline font-medium cursor-pointer">
              Use Tracking ID instead
            </button>
          </p>
        </div>

        {/* Face scan results */}
        {faceResults.map((test, i) => (
          <TestResultCard key={test.id || i} testData={{ test }} />
        ))}

        {/* Face capture modal */}
        {showFaceCapture && (
          <FaceCapture
            onCapture={handleFaceScan}
            onCancel={() => setShowFaceCapture(false)}
          />
        )}
      </div>
    );
  }

  // ── MODE: TRACKING ID (default fallback) ─────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <button onClick={() => (initialTrackingId ? onBack() : setTrackMode('choice'))} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer">
        <ArrowLeft className="w-4 h-4" />
        <span>{initialTrackingId ? 'Back to Patient Options' : 'Back'}</span>
      </button>

      {/* Tracking Input Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h1 className="text-lg font-bold text-slate-900 mb-1">Track My Specimen & Diagnostic Report</h1>
        <p className="text-xs text-slate-500 mb-4">
          Enter your 5-digit Tracking Number provided upon registration.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
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
            {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <span>Search Test</span>
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Switch to face scan link (only if biometrics available) */}
        {bioAvailable && (
          <p className="mt-3 text-xs text-slate-400">
            <button onClick={() => setTrackMode('face')} className="text-sky-600 hover:underline font-medium cursor-pointer">
              Prefer face scan? Click here.
            </button>
          </p>
        )}
      </div>

      {/* Test Result */}
      {testData && <TestResultCard testData={testData} />}

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
