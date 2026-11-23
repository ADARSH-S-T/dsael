import React, { useState } from 'react';
import { Microscope, ArrowRight, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function StaffLogin({ onLoginSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('staff1@labflow.health');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (selectedEmail) => {
    try {
      setLoading(true);
      await login(selectedEmail || email, 'staff');
      if (onLoginSuccess) onLoginSuccess();
    } catch (e) {
      alert('Login failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <Microscope className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Laboratory Staff Portal</h1>
          <p className="text-xs text-slate-500">Sign in to process priority tests and update laboratory records.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>Sign In to Staff Queue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Quick Logins */}
        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Quick Demo Staff Sign-In:
          </span>
          <button
            onClick={() => handleLogin('staff1@labflow.health')}
            className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-slate-700 transition-colors flex items-center justify-between"
          >
            <span>Marcus Vance (Senior Lab Analyst)</span>
            <span className="font-mono text-[10px] text-slate-400">staff1</span>
          </button>
          <button
            onClick={() => handleLogin('staff2@labflow.health')}
            className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-slate-700 transition-colors flex items-center justify-between"
          >
            <span>Sarah Jenkins (Biochemist)</span>
            <span className="font-mono text-[10px] text-slate-400">staff2</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default StaffLogin;
