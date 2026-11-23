import React, { useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function AdminLogin({ onLoginSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@labflow.health');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (selectedEmail) => {
    try {
      setLoading(true);
      await login(selectedEmail || email, 'admin');
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
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Administrator Console</h1>
          <p className="text-xs text-slate-500">Authorized access for laboratory heads and clinical directors.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Administrator Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>Sign In as Lab Administrator</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Default Administrator Account:
          </span>
          <button
            onClick={() => handleLogin('admin@labflow.health')}
            className="w-full text-left p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-colors flex items-center justify-between"
          >
            <span className="font-semibold">Dr. Evelyn Reed (Chief Pathologist)</span>
            <span className="font-mono text-[10px] text-slate-400">admin</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
