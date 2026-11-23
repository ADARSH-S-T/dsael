import React from 'react';
import { PlusCircle, Search, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

export function PatientHome({ onSelectOption }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10 space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Patient Diagnostic Portal</h1>
        <p className="text-xs text-slate-500">
          Select an option below to register an incoming specimen or track existing test results.
        </p>
      </div>

      {/* Exactly TWO Main Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option 1: Register a Test */}
        <div 
          onClick={() => onSelectOption('register')}
          className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs hover:border-sky-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <PlusCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">1. Register a Test</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Register a new laboratory test request with sample details. Automatic priority evaluation will triage your request immediately.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs font-bold text-sky-600 group-hover:text-sky-700">
            <span>Begin Registration</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Option 2: Track My Test */}
        <div 
          onClick={() => onSelectOption('track')}
          className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Search className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">2. Track My Test</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Check real-time processing status using your 5-digit Tracking ID and securely download verified diagnostic reports once completed.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs font-bold text-emerald-600 group-hover:text-emerald-700">
            <span>Track Specimen</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatientHome;
