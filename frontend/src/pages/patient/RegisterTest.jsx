import React, { useState, useEffect } from 'react';
import { ArrowLeft, FlaskConical, AlertCircle, CheckCircle2, Camera, ShieldCheck, Info } from 'lucide-react';
import api from '../../api/client';
import FaceCapture from '../../components/FaceCapture';

export function RegisterTest({ onBack, onSuccess }) {
  const [formData, setFormData] = useState({
    patient_name: '',
    phone: '',
    email: '',
    age: '',
    gender: 'Female',
    test_name: '',
    test_category: 'Cardiac & Emergency',
    sample_type: 'Whole Blood',
    sample_details: '',
    additional_information: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Face registration state (shown after test registration succeeds)
  const [registeredPatientId, setRegisteredPatientId] = useState(null);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [faceStep, setFaceStep] = useState('idle'); // 'idle' | 'consent' | 'camera' | 'processing' | 'done' | 'skipped'
  const [faceConsent, setFaceConsent] = useState(false);
  const [faceError, setFaceError] = useState(null);
  const [faceSuccess, setFaceSuccess] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(null);

  const categories = [
    'Cardiac & Emergency',
    'Microbiology & CSF',
    'Biochemistry',
    'Hematology',
    'Coagulation',
    'Urinalysis',
    'Immunology / Specialized'
  ];

  const sampleTypes = [
    'Whole Blood',
    'Serum',
    'Plasma',
    'CSF Fluid',
    'Urine Specimen',
    'Throat / Nasal Swab',
    'Tissue Biopsy'
  ];

  // Check if face recognition is available once
  useEffect(() => {
    api.getBiometricStatus()
      .then(res => setBioAvailable(res.face_recognition_available))
      .catch(() => setBioAvailable(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.patient_name || !formData.phone || !formData.email || !formData.age || !formData.test_name || !formData.sample_details) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.registerTest(formData);
      if (res.success) {
        setRegisteredPatientId(res.patient?.id);
        setRegistrationResult(res);
        // If biometrics available, offer face registration; else go straight to success
        if (bioAvailable && res.patient?.id) {
          setFaceStep('consent');
        } else {
          onSuccess(res);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to register test. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFaceCapture = async (imageDataUrl) => {
    setFaceStep('processing');
    setFaceError(null);
    try {
      const res = await api.registerFace({
        patient_id: registeredPatientId,
        image_b64: imageDataUrl,
        consent: faceConsent
      });
      if (res.success) {
        setFaceSuccess(true);
        setFaceStep('done');
      } else {
        setFaceError(res.error || 'Face registration failed. Please try again.');
        setFaceStep('consent');
      }
    } catch (err) {
      setFaceError(err.message || 'Face registration failed.');
      setFaceStep('consent');
    }
  };

  const handleSkipFace = () => {
    setFaceStep('skipped');
    onSuccess(registrationResult);
  };

  const handleFaceDone = () => {
    onSuccess(registrationResult);
  };

  // ── Face Registration Flow (shown after test form submitted) ──────────────
  if (faceStep !== 'idle' && registrationResult) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-400/30">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Register Your Face</h1>
                <p className="text-xs text-slate-300">
                  Optional biometric setup for fast, secure report access
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {faceStep === 'done' && faceSuccess ? (
              // Success state
              <div className="text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Face Registered Successfully</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    You can now access your reports by scanning your face in the Track My Test section.
                  </p>
                </div>
                <button
                  onClick={handleFaceDone}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Continue to My Test Status
                </button>
              </div>
            ) : (
              // Consent + actions
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 flex gap-3">
                  <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-sky-800 space-y-1">
                    <p className="font-semibold">What happens to your face data?</p>
                    <ul className="list-disc ml-4 space-y-0.5 text-sky-700">
                      <li>A mathematical face template (not a photo) is securely encrypted and stored.</li>
                      <li>Raw images are deleted immediately after processing.</li>
                      <li>Your template is never shared with third parties.</li>
                      <li>Face login is optional — Tracking ID always works.</li>
                    </ul>
                  </div>
                </div>

                {faceError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{faceError}</span>
                  </div>
                )}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={faceConsent}
                    onChange={e => setFaceConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-sky-600"
                  />
                  <span className="text-xs text-slate-700">
                    I consent to the collection and secure storage of my biometric face template for identity verification purposes within LabFlow.
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    onClick={() => { if (faceConsent) setFaceStep('camera'); }}
                    disabled={!faceConsent || faceStep === 'processing'}
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors"
                  >
                    {faceStep === 'processing' ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    {faceStep === 'processing' ? 'Processing...' : 'Open Camera & Register Face'}
                  </button>

                  <button
                    onClick={handleSkipFace}
                    className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Skip for now
                  </button>
                </div>

                <p className="text-[11px] text-center text-slate-400">
                  You can always register your face later from the Track My Test page.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Camera modal */}
        {faceStep === 'camera' && (
          <FaceCapture
            onCapture={handleFaceCapture}
            onCancel={() => setFaceStep('consent')}
            instructionText="Position your face inside the oval guide. Ensure your full face is visible and well-lit."
          />
        )}
      </div>
    );
  }

  // ── Normal Registration Form ──────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Patient Options</span>
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-400/30">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Register a Laboratory Test</h1>
              <p className="text-xs text-slate-300">
                Submit specimen information for automatic priority allocation and queue intake.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Patient Information */}
          <div className="space-y-3 pb-4 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Patient Demographics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eleanor Vance"
                  value={formData.patient_name}
                  onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. eleanor@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="140"
                    required
                    placeholder="45"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-2 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Test & Sample Information */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Test &amp; Sample Specifications
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Test Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STAT High-Sensitivity Troponin"
                  value={formData.test_name}
                  onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Test Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.test_category}
                  onChange={(e) => setFormData({ ...formData, test_category: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sample Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sample_type}
                  onChange={(e) => setFormData({ ...formData, sample_type: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                >
                  {sampleTypes.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sample Details <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3mL EDTA tube, collected fasting"
                  value={formData.sample_details}
                  onChange={(e) => setFormData({ ...formData, sample_details: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Additional Clinical Information (Optional)
              </label>
              <textarea
                rows="2"
                placeholder="Diagnostic indication, physician instructions, or urgency details..."
                value={formData.additional_information}
                onChange={(e) => setFormData({ ...formData, additional_information: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white resize-none"
              ></textarea>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
              <span>Submit &amp; Evaluate Priority</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegisterTest;
