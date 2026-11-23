import React, { useState, useEffect } from 'react';
import { Play, Clock, CheckCircle2, AlertCircle, RefreshCw, Layers, ArrowRight } from 'lucide-react';
import PriorityBadge from '../../components/PriorityBadge';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Privacy: mask patient names for lab staff (biometric privacy feature)
const maskName = (name) => name ? name.split(' ').map(w => 'X'.repeat(w.length)).join(' ') : 'PATIENT';

export function StaffDashboard({ onOpenCurrentTest }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    waiting_tests: 0,
    high_priority: 0,
    in_progress: 0,
    completed_today: 0
  });
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [activeTest, setActiveTest] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, queueRes, currentTestRes] = await Promise.all([
        api.getStaffStats(),
        api.getQueue(),
        api.getCurrentTest(user?.id)
      ]);
      if (statsRes.stats) setStats(statsRes.stats);
      if (queueRes.queue) setQueue(queueRes.queue);
      if (currentTestRes.test) setActiveTest(currentTestRes.test);
    } catch (err) {
      console.error('Error fetching staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleTakeNextTest = async () => {
    try {
      setClaiming(true);
      const res = await api.takeNextTest(user?.id);
      if (res.success && res.test) {
        onOpenCurrentTest(res.test);
      } else {
        alert(res.message || 'No tests available in queue.');
      }
    } catch (err) {
      alert(err.message || 'Error claiming next test.');
    } finally {
      setClaiming(false);
      fetchData();
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner: Staff Identity & Take Next Test Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Laboratory Staff Operational Console
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Welcome back, {user?.full_name || 'Laboratory Staff'}
          </h1>
          <p className="text-xs text-slate-500">
            Manage real-time triage queue and execute automated diagnostic workflows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTest && (
            <button
              onClick={() => onOpenCurrentTest(activeTest)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Resume Active Test (#{activeTest.tracking_number})</span>
            </button>
          )}

          {/* THE PROMINENT "TAKE NEXT TEST" BUTTON */}
          <button
            onClick={handleTakeNextTest}
            disabled={claiming || queue.length === 0}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${claiming ? 'animate-spin' : ''}`} />
            <span>{claiming ? 'Claiming Next...' : 'TAKE NEXT TEST'}</span>
          </button>
        </div>
      </div>

      {/* 4 Statistics Cards per Section 7 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Waiting Tests</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{stats.waiting_tests}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">In dynamic priority queue</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wider">High Priority</div>
          <div className="text-2xl font-extrabold text-red-600 mt-1">{stats.high_priority}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Emergency / STAT triage</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">In Progress</div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">{stats.in_progress}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Being processed by staff</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Completed Today</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{stats.completed_today}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Reports verified &amp; dispatched</p>
        </div>
      </div>

      {/* Dynamic Priority Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-900">Dynamic Priority Queue</h2>
            <span className="text-xs text-slate-400">({queue.length} waiting)</span>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">Pos</th>
                <th className="py-3 px-4">Tracking ID</th>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Test Name</th>
                <th className="py-3 px-4">Sample Type</th>
                <th className="py-3 px-4">Priority Level</th>
                <th className="py-3 px-4">Waiting Time</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queue.length > 0 ? (
                queue.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold font-mono text-slate-400">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-sky-700">
                      {item.tracking_number}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {item.patient?.full_name || 'Patient'}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {item.test_name}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {item.sample_type}
                    </td>
                    <td className="py-3 px-4">
                      <PriorityBadge priority={item.priority} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {item.waiting_time}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.status} size="sm" />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400 space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">Queue is Clear</p>
                    <p className="text-[11px] text-slate-400">All tests have been claimed or completed.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default StaffDashboard;
