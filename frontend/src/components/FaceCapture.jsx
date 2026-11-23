/**
 * FaceCapture — Reusable camera capture component for LabFlow
 * Props:
 *   onCapture(base64String)  — called with JPEG data URI when patient clicks Capture
 *   onCancel()               — called when patient dismisses camera
 *   instructionText          — optional override for guidance text
 */
import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle2, X, AlertCircle } from 'lucide-react';

export function FaceCapture({ onCapture, onCancel, instructionText }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase] = useState('preview');   // 'preview' | 'captured'
  const [capturedImg, setCapturedImg] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraError(null);
    } catch (err) {
      setCameraError('Camera access denied or not available. Please allow camera access and try again.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    // Mirror the image (selfie view)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImg(dataUrl);
    setPhase('captured');
  };

  const handleRetake = () => {
    setCapturedImg(null);
    setPhase('preview');
    startCamera();
  };

  const handleConfirm = () => {
    stopCamera();
    onCapture(capturedImg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-bold">Face Capture</span>
          </div>
          <button onClick={() => { stopCamera(); onCancel(); }}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {cameraError ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 text-center">
                {instructionText || 'Look directly at the camera. Ensure your face is well-lit and fully visible.'}
              </p>

              {/* Camera / Preview */}
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video">
                {phase === 'preview' && (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                )}
                {phase === 'captured' && capturedImg && (
                  <img src={capturedImg} alt="Captured face" className="w-full h-full object-cover" />
                )}

                {/* Face guide oval */}
                {phase === 'preview' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-sky-400 border-dashed rounded-full w-40 h-52 opacity-60" />
                  </div>
                )}
              </div>

              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Actions */}
              <div className="flex items-center gap-3">
                {phase === 'preview' ? (
                  <button
                    onClick={handleCapture}
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    Capture Photo
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRetake}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retake
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Use This Photo
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FaceCapture;
