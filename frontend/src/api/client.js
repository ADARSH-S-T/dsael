/**
 * LabFlow Centralized REST API Client
 */

const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = localStorage.getItem('labflow_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => request('/auth/me'),

  // Patient Portal
  registerTest: (payload) => request('/patients/register', { method: 'POST', body: JSON.stringify(payload) }),
  verifyOtp: (payload) => request('/patients/verify-otp', { method: 'POST', body: JSON.stringify(payload) }),
  trackTest: (trackingNumber) => request(`/patients/track/${trackingNumber}`),

  // Priority Queue
  getQueue: () => request('/queue'),
  takeNextTest: (staffId) => request('/queue/take-next', { method: 'POST', body: JSON.stringify({ staff_id: staffId }) }),

  // Staff Portal
  getStaffStats: () => request('/staff/dashboard'),
  getCurrentTest: (staffId) => request(`/staff/current-test?staff_id=${staffId || ''}`),
  startTest: (testId, staffId) => request('/staff/start-test', { method: 'POST', body: JSON.stringify({ test_id: testId, staff_id: staffId }) }),
  completeTest: (payload) => request('/staff/complete-test', { method: 'POST', body: JSON.stringify(payload) }),
  getCompletedTests: () => request('/staff/completed-tests'),

  // Admin Dashboard
  getAdminStats: () => request('/admin/stats'),
  getAllTests: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    const qs = params.toString();
    return request(`/admin/tests${qs ? `?${qs}` : ''}`);
  },
  getPendingReviews: () => request('/admin/priority-review'),
  submitReview: (id, payload) => request(`/admin/priority-review/${id}`, { method: 'POST', body: JSON.stringify(payload) }),
  overridePriority: (id, payload) => request(`/admin/priority-override/${id}`, { method: 'POST', body: JSON.stringify(payload) }),

  // Rules Management
  getRules: () => request('/admin/rules'),
  createRule: (rule) => request('/admin/rules', { method: 'POST', body: JSON.stringify(rule) }),
  updateRule: (id, rule) => request(`/admin/rules/${id}`, { method: 'PUT', body: JSON.stringify(rule) }),
  deleteRule: (id) => request(`/admin/rules/${id}`, { method: 'DELETE' }),

  // Staff Management
  getStaffList: () => request('/admin/staff'),
  addStaff: (payload) => request('/admin/staff', { method: 'POST', body: JSON.stringify(payload) }),
  toggleStaffStatus: (id) => request(`/admin/staff/${id}/toggle`, { method: 'PATCH' }),

  // Logs
  getNotifications: () => request('/admin/notifications'),
  getActivityLogs: () => request('/admin/activity-logs')
};

export default api;
