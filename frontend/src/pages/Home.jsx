import React from 'react';
import { User, Microscope, ShieldCheck, ArrowRight, Activity, Clock, CheckCircle2 } from 'lucide-react';

export function Home({ onNavigate }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
      {/* Main Section Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold">
          <Activity className="w-3.5 h-3.5 text-sky-600" />
          <span>Dynamic Priority Queue &amp; Automatic Triage Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Laboratory Test Management Made Simple
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Register, prioritize, process and track laboratory tests in one place.
        </p>
      </div>

      {/* 3 Simple Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Patient Portal */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Patient Portal</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Register a new medical laboratory test or track your specimen status in real time.
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Register a Test</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Track My Test (5-digit ID)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('patient')}
            className="w-full mt-6 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <span>Patient Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Laboratory Staff */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Microscope className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Laboratory Staff</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Atomic priority queue claiming, real-time diagnostic testing, and report generation.
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Dynamic Priority Queue</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Take Next Test (Atomic Lock)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('staff')}
            className="w-full mt-6 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <span>Staff Login</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 3. Admin Dashboard */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Admin Dashboard</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Triage review, priority rule management, staff workload, notifications and audit logs.
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Priority Review &amp; Fallbacks</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Configurable Triage Rules</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('admin')}
            className="w-full mt-6 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <span>Admin Login</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
