import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Layers, 
  AlertTriangle, 
  Sliders, 
  Users, 
  Bell, 
  RefreshCw, 
  Search, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Check, 
  X, 
  Trash2,
  Camera,
  RotateCcw
} from 'lucide-react';
import PriorityBadge from '../../components/PriorityBadge';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('review'); // 'tests' | 'review' | 'rules' | 'staff' | 'notifications'
  const [stats, setStats] = useState({
    total_tests: 0,
    waiting_tests: 0,
    completed_tests: 0,
    awaiting_review: 0,
    in_progress: 0
  });

  // Data states
  const [tests, setTests] = useState([]);
  const [reviewTests, setReviewTests] = useState([]);
  const [rules, setRules] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [biometricPatients, setBiometricPatients] = useState([]);
  const [biometricLogs, setBiometricLogs] = useState([]);
  const [resettingPatientId, setResettingPatientId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filter states for All Tests
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Priority Review modal/action state
  const [reviewReason, setReviewReason] = useState({});

  // New Rule form modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    rule_name: '',
    test_category: 'Biochemistry',
    configured_priority: 'MEDIUM',
    processing_deadline: 60,
    keywords: ''
  });

  // New Staff form modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    email: '',
    phone: '+91 98765 00000'
  });

  const fetchStatsAndActiveTab = async () => {
    try {
      setLoading(true);
      const statsRes = await api.getAdminStats();
      if (statsRes.stats) setStats(statsRes.stats);

      if (activeTab === 'tests') {
        const testsRes = await api.getAllTests({
          priority: filterPriority,
          status: filterStatus,
          search: searchQuery
        });
        if (testsRes.tests) setTests(testsRes.tests);
      } else if (activeTab === 'review') {
        const reviewRes = await api.getPendingReviews();
        if (reviewRes.tests) setReviewTests(reviewRes.tests);
      } else if (activeTab === 'rules') {
        const rulesRes = await api.getRules();
        if (rulesRes.rules) setRules(rulesRes.rules);
      } else if (activeTab === 'staff') {
        const staffRes = await api.getStaffList();
        if (staffRes.staff) setStaffList(staffRes.staff);
      } else if (activeTab === 'notifications') {
        const notifRes = await api.getNotifications();
        if (notifRes.notifications) setNotifications(notifRes.notifications);
      } else if (activeTab === 'biometrics') {
        const [patientsRes, logsRes] = await Promise.all([
          api.getAdminBiometricPatients(),
          api.getAdminBiometricLogs()
        ]);
        if (patientsRes?.patients) setBiometricPatients(patientsRes.patients);
        if (logsRes?.logs) setBiometricLogs(logsRes.logs);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndActiveTab();
  }, [activeTab, filterPriority, filterStatus, searchQuery]);

  // Handle Manual Priority Review Assignment (STEP 5 & 6)
  const handleAssignPriority = async (testId, chosenPriority) => {
    const reason = reviewReason[testId] || 'Assigned after clinical pathologist review';
    try {
      await api.submitReview(testId, {
        priority: chosenPriority,
        reason: reason,
        admin_id: user?.id
      });
      alert(`Priority ${chosenPriority} assigned. Test moved to waiting queue!`);
      setReviewReason({ ...reviewReason, [testId]: '' });
      fetchStatsAndActiveTab();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Handle Create Rule
  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      await api.createRule({
        ...newRule,
        keywords: newRule.keywords.split(',').map(s => s.trim()).filter(Boolean)
      });
      setShowRuleModal(false);
      setNewRule({ rule_name: '', test_category: 'Biochemistry', configured_priority: 'MEDIUM', processing_deadline: 60, keywords: '' });
      fetchStatsAndActiveTab();
    } catch (err) {
      alert('Error creating rule: ' + err.message);
    }
  };

  // Handle Delete Rule
  const handleDeleteRule = async (id) => {
    if (confirm('Delete this priority rule?')) {
      await api.deleteRule(id);
      fetchStatsAndActiveTab();
    }
  };

  // Handle Add Staff
  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await api.addStaff(newStaff);
      setShowStaffModal(false);
      setNewStaff({ full_name: '', email: '', phone: '+91 98765 00000' });
      fetchStatsAndActiveTab();
    } catch (err) {
      alert('Error adding staff: ' + err.message);
    }
  };

  // Handle Toggle Staff Active Status
  const handleToggleStaff = async (id) => {
    await api.toggleStaffStatus(id);
    fetchStatsAndActiveTab();
  };

  // Handle Admin Reset of Patient Biometrics
  const handleResetBiometric = async (patientId) => {
    if (!confirm("Are you sure you want to reset/disable this patient's face registration? The patient will need to re-register or use Tracking ID + Password.")) {
      return;
    }
    try {
      setResettingPatientId(patientId);
      await api.resetPatientBiometric(patientId, { admin_id: user?.id || 'a0000000-0000-0000-0000-000000000001' });
      alert("Biometric registration has been reset successfully.");
      fetchStatsAndActiveTab();
    } catch (err) {
      alert("Error resetting biometric: " + err.message);
    } finally {
      setResettingPatientId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Admin Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white uppercase tracking-wider">
              Hospital Lab Administration
            </span>
            <span className="text-xs text-slate-400">• Role-Based Control</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Clinical Operations &amp; Triage Administration
          </h1>
          <p className="text-xs text-slate-500">
            System Overseer: {user?.full_name || 'Chief Pathologist'}
          </p>
        </div>

        <button
          onClick={fetchStatsAndActiveTab}
          disabled={loading}
          className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* 4 Statistics Cards per Section 8 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tests</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total_tests}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">All specimens registered</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-sky-700 uppercase tracking-wider">Waiting in Queue</span>
          <div className="text-2xl font-extrabold text-sky-700 mt-1">{stats.waiting_tests}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">In dynamic priority queue</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Completed Tests</span>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{stats.completed_tests}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Verified reports released</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Awaiting Review</span>
          <div className="text-2xl font-extrabold text-purple-700 mt-1">{stats.awaiting_review}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Priority engine fallbacks</p>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'review', label: 'Priority Review', badge: stats.awaiting_review, badgeColor: 'bg-purple-600 text-white' },
          { id: 'tests', label: 'All Registered Tests', badge: stats.total_tests },
          { id: 'rules', label: 'Priority Rules Management' },
          { id: 'staff', label: 'Staff Management' },
          { id: 'biometrics', label: 'Face Auth & Biometrics' },
          { id: 'notifications', label: 'Notifications & Audit Log' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${tab.badgeColor || 'bg-slate-200 text-slate-700'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: PRIORITY REVIEW (THE CRITICAL FALLBACK MODULE) */}
      {activeTab === 'review' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-purple-600" />
                <span>Priority Review Required</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tests where the automatic priority engine could not determine priority due to unmapped categories or rule conflicts.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
              {reviewTests.length} Pending Triage
            </span>
          </div>

          {reviewTests.length > 0 ? (
            <div className="space-y-4">
              {reviewTests.map((t) => (
                <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-sky-700">#{t.tracking_number}</span>
                        <span className="font-semibold text-slate-900 text-xs">{t.test_name}</span>
                        <span className="text-slate-400 text-xs">•</span>
                        <span className="text-slate-600 text-xs font-medium">{t.test_category}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Patient: <strong>{t.patient?.full_name}</strong> ({t.patient?.age}y, {t.patient?.phone})
                      </p>
                    </div>
                    <StatusBadge status={t.status} size="sm" />
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <strong>Reason for Review:</strong> {t.priority_reason}
                  </div>

                  {/* Manual Priority Assignment Controls */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter clinical reason for priority assignment..."
                      value={reviewReason[t.id] || ''}
                      onChange={(e) => setReviewReason({ ...reviewReason, [t.id]: e.target.value })}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleAssignPriority(t.id, 'HIGH')}
                        className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs cursor-pointer"
                      >
                        HIGH
                      </button>
                      <button
                        onClick={() => handleAssignPriority(t.id, 'MEDIUM')}
                        className="px-3 py-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-xs cursor-pointer"
                      >
                        MEDIUM
                      </button>
                      <button
                        onClick={() => handleAssignPriority(t.id, 'LOW')}
                        className="px-3 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-xs cursor-pointer"
                      >
                        LOW
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No Tests Awaiting Review</p>
              <p className="text-[11px] text-slate-400">All tests have been evaluated and triaged.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL REGISTERED TESTS */}
      {activeTab === 'tests' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900">All Registered Laboratory Tests</h2>
            
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search ID or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              >
                <option value="ALL">All Priorities</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="WAITING_IN_QUEUE">Waiting in Queue</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="AWAITING_ADMIN_REVIEW">Awaiting Review</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3">Tracking ID</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Test Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Assigned Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tests.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono font-bold text-sky-700">#{t.tracking_number}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{t.patient?.full_name || 'Patient'}</td>
                    <td className="py-2.5 px-3 text-slate-700">{t.test_name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{t.test_category}</td>
                    <td className="py-2.5 px-3"><PriorityBadge priority={t.priority} size="sm" /></td>
                    <td className="py-2.5 px-3"><StatusBadge status={t.status} size="sm" /></td>
                    <td className="py-2.5 px-3 text-slate-500">{t.assigned_staff_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRIORITY RULES MANAGEMENT */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Priority Engine Rules</h2>
              <p className="text-xs text-slate-500">Configure deterministic medical triage priorities and processing SLA deadlines.</p>
            </div>

            <button
              onClick={() => setShowRuleModal(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Priority Rule</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((r) => (
              <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 relative">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">{r.rule_name}</h3>
                    <span className="text-[11px] text-slate-500">{r.test_category}</span>
                  </div>
                  <PriorityBadge priority={r.configured_priority} size="sm" />
                </div>

                <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                  <span>Processing SLA: <strong>{r.processing_deadline} mins</strong></span>
                  <button
                    onClick={() => handleDeleteRule(r.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded"
                    title="Delete rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: STAFF MANAGEMENT */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Laboratory Staff Roster &amp; Workload</h2>
              <p className="text-xs text-slate-500">Manage laboratory personnel accounts and monitor testing volume.</p>
            </div>

            <button
              onClick={() => setShowStaffModal(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff Account</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3">Staff Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Active Workload</th>
                  <th className="py-2.5 px-3">Total Completed</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{s.full_name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{s.email}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{s.active_workload || 0}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{s.total_completed || 0}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {s.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleToggleStaff(s.id)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: NOTIFICATIONS & AUDIT LOG */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">SMS &amp; Email Notification Ledger</h2>
              <p className="text-xs text-slate-500">Historical delivery status, recipients, and provider responses.</p>
            </div>
            <span className="text-xs text-slate-400">Total: {notifications.length}</span>
          </div>

          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                      {n.channel}
                    </span>
                    <span className="font-semibold text-slate-900">{n.recipient}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    n.delivery_status === 'SENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {n.delivery_status}
                  </span>
                </div>
                <p className="text-slate-600 font-mono text-[11px] pt-1">{n.message}</p>
                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/50">
                  <span>Type: {n.notification_type}</span>
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: BIOMETRIC AUTHENTICATION & MANAGEMENT */}
      {activeTab === 'biometrics' && (
        <div className="space-y-6">
          {/* Biometrics Summary & Security Notice */}
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Patient Biometric Privacy &amp; Security Ledger</p>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Biometric face embeddings are encrypted via server-side AES-256 tokens and protected by strict Row-Level Security. Raw biometric templates cannot be exported or downloaded. As an administrator, you may monitor verification telemetry and reset patient enrollments upon verified request.
              </p>
            </div>
          </div>

          {/* Enrolled Patients Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-sky-600" />
                  <span>Patient Face Registration Directory</span>
                </h2>
                <p className="text-xs text-slate-500">Track which patients have enrolled biometric face authentication.</p>
              </div>
              <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                {biometricPatients.filter(p => p.registered).length} of {biometricPatients.length} Enrolled
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Patient Name</th>
                    <th className="py-2.5 px-3">Patient UUID</th>
                    <th className="py-2.5 px-3">Biometric Status</th>
                    <th className="py-2.5 px-3">Consent Timestamp</th>
                    <th className="py-2.5 px-3">Enrolled At</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {biometricPatients.length > 0 ? (
                    biometricPatients.map((p) => (
                      <tr key={p.patient_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900">{p.full_name}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{p.patient_id.substring(0, 8)}...</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.registered ? 'bg-emerald-100 text-emerald-800' : p.biometric_status === 'RESET' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {p.biometric_status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {p.consent_timestamp ? new Date(p.consent_timestamp).toLocaleString() : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {p.registered_at ? new Date(p.registered_at).toLocaleString() : 'Not enrolled'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {p.registered ? (
                            <button
                              onClick={() => handleResetBiometric(p.patient_id)}
                              disabled={resettingPatientId === p.patient_id}
                              className="px-2.5 py-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{resettingPatientId === p.patient_id ? 'Resetting...' : 'Reset Face ID'}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No Active Registration</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400">No patient records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Biometric Verification Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Biometric Verification Audit Logs</span>
                </h2>
                <p className="text-xs text-slate-500">Live attempt ledger including match confidence and anti-spoofing liveness checks.</p>
              </div>
              <span className="text-xs text-slate-400">Total Attempts: {biometricLogs.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Patient Reference</th>
                    <th className="py-2.5 px-3">Verification Result</th>
                    <th className="py-2.5 px-3">Confidence Score</th>
                    <th className="py-2.5 px-3">Liveness Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {biometricLogs.length > 0 ? (
                    biometricLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {log.patient_id ? log.patient_id.substring(0, 8) + '...' : <span className="text-slate-400 italic">Unidentified Scan</span>}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.verification_status === 'MATCHED' ? 'bg-emerald-100 text-emerald-800' :
                            log.verification_status === 'NO_MATCH' ? 'bg-red-100 text-red-800' :
                            log.verification_status === 'LIVENESS_FAILED' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {log.verification_status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-800 font-semibold">
                          {(log.confidence_score * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.liveness_status === 'PASS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {log.liveness_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400">No verification attempts recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PRIORITY RULE */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Create Automatic Priority Rule</h3>

            <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical Cardiac Biomarkers"
                  value={newRule.rule_name}
                  onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Test Category</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cardiac & Emergency"
                  value={newRule.test_category}
                  onChange={(e) => setNewRule({ ...newRule, test_category: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newRule.configured_priority}
                    onChange={(e) => setNewRule({ ...newRule, configured_priority: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SLA Deadline (Mins)</label>
                  <input
                    type="number"
                    min="5"
                    max="480"
                    value={newRule.processing_deadline}
                    onChange={(e) => setNewRule({ ...newRule, processing_deadline: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Condition Keywords (Comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Troponin, CK-MB, Emergency"
                  value={newRule.keywords}
                  onChange={(e) => setNewRule({ ...newRule, keywords: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Save Priority Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD STAFF ACCOUNT */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Add Laboratory Personnel</h3>

            <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan (MLS)"
                  value={newStaff.full_name}
                  onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alex.morgan@labflow.health"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 00000"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-xs"
                >
                  Add Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
