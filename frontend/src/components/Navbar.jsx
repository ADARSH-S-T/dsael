import React from 'react';
import { Activity, User, Microscope, ShieldCheck, LogOut, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar({ currentSection, setCurrentSection }) {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & System Name */}
          <div 
            onClick={() => setCurrentSection('home')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                Lab<span className="text-sky-600">Flow</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-500 border-l border-slate-300 pl-2">
                Smart Laboratory Test Management
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentSection('home')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                currentSection === 'home'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => setCurrentSection('patient')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                currentSection.startsWith('patient')
                  ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Patient Portal</span>
            </button>

            <button
              onClick={() => setCurrentSection('staff')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                currentSection.startsWith('staff')
                  ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Microscope className="w-3.5 h-3.5" />
              <span>Staff Portal</span>
            </button>

            <button
              onClick={() => setCurrentSection('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                currentSection.startsWith('admin')
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Dashboard</span>
            </button>

            {user && (
              <div className="ml-3 pl-3 border-l border-slate-200 flex items-center gap-2">
                <span className="text-xs text-slate-600 font-medium hidden md:inline">
                  {user.full_name || user.email}
                </span>
                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
