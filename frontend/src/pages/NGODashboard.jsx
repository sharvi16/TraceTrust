import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ImpactRing from '../components/ImpactRing';
import AnomalyBanner from '../components/AnomalyBanner';

const TABS = ['Overview', 'Log Donation', 'Log Expense', 'Anomaly Alerts'];
const EXPENSE_CATEGORIES = ['food', 'medicine', 'education', 'salary', 'admin', 'other'];

function Toast({ message, type, onClose }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-3 ${
        type === 'success' ? 'bg-[#10b981]' : 'bg-[#ef4444]'
      }`}
    >
      {message}
      <button onClick={onClose} className="ml-2 opacity-75 hover:opacity-100">&times;</button>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-10 h-10 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#1a3a5c]">{value}</p>
    </div>
  );
}

// --- Tab 1: Overview ---
function OverviewTab({ ngoId }) {
  const [impact, setImpact] = useState(null);
  const [recentDonations, setRecentDonations] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);

  useEffect(() => {
    if (!ngoId) return;
    Promise.all([
      api.get(`/impact/${ngoId}`),
      api.get(`/donations/ngo/${ngoId}`),
      api.get(`/expenses/${ngoId}`),
    ]).then(([imp, don, exp]) => {
      setImpact(imp.data);
      setRecentDonations(don.data.donation_list?.slice(0, 10) ?? []);
      setRecentExpenses(exp.data.expenses?.slice(0, 10) ?? []);
    });
  }, [ngoId]);

  if (!ngoId) return <p className="text-gray-400 text-sm">No NGO associated with this account.</p>;
  if (!impact) return <Spinner />;

  const activity = [
    ...recentDonations.map((d) => ({ ...d, _type: 'donation' })),
    ...recentExpenses.map((e) => ({ ...e, _type: 'expense' })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

  return (
    <div>
      {(impact.grade === 'C' || impact.grade === 'D') && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl px-5 py-3 mb-6 text-sm font-medium">
          &#9888;&#xFE0F; Your impact score is low. Review your admin expenses.
        </div>
      )}

      <div className="flex justify-center mb-8">
        <ImpactRing score={impact.impact_score} grade={impact.grade} size="lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Received" value={`₹${(impact.total_donated ?? 0).toLocaleString('en-IN')}`} />
        <StatCard label="Total Expenses" value={`₹${((impact.program_expenses ?? 0) + (impact.overhead_expenses ?? 0)).toLocaleString('en-IN')}`} />
        <StatCard label="Overhead Ratio" value={`${impact.overhead_ratio ?? 0}%`} />
      </div>

      <h3 className="font-semibold text-[#1a3a5c] mb-3">Recent Activity</h3>
      <div className="bg-white rounded-xl shadow divide-y divide-gray-100">
        {activity.length === 0 && (
          <p className="text-gray-400 text-sm p-5">No activity yet.</p>
        )}
        {activity.map((item, i) => (
          <div key={i} className="px-5 py-3 flex items-center justify-between">
            <div>
              <span
                className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mr-2 ${
                  item._type === 'donation'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {item._type === 'donation' ? 'Donation' : item.category}
              </span>
              <span className="text-sm text-gray-600">
                {item._type === 'donation' ? item.transaction_ref : item.description}
              </span>
            </div>
            <div className="text-right">
              <span className={`font-semibold text-sm ${ item._type === 'donation' ? 'text-green-600' : 'text-red-500' }`}>
                {item._type === 'donation' ? '+' : '-'}₹{item.amount?.toLocaleString('en-IN')}
              </span>
              <p className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleDateString('en-IN')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Tab 2: Log Donation ---
function LogDonationTab({ onToast }) {
  const [form, setForm] = useState({ donor_email: '', amount: '', transaction_ref: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/donations/log', { ...form, amount: parseFloat(form.amount) });
      onToast('Donation logged successfully!', 'success');
      setForm({ donor_email: '', amount: '', transaction_ref: '' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to log donation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h3 className="text-lg font-bold text-[#1a3a5c] mb-6">Log a Donation</h3>
      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl shadow p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Donor Email</label>
          <input type="email" required value={form.donor_email}
            onChange={(e) => setForm({ ...form, donor_email: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981]"
            placeholder="donor@example.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
          <input type="number" required min="1" step="0.01" value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981]"
            placeholder="5000" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Reference</label>
          <input type="text" required value={form.transaction_ref}
            onChange={(e) => setForm({ ...form, transaction_ref: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981]"
            placeholder="TXN-2026-001" />
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-[#1a3a5c] text-white font-semibold rounded-lg hover:bg-[#0f2540] transition disabled:opacity-60">
          {loading ? 'Logging…' : 'Log Donation'}
        </button>
      </form>
    </div>
  );
}

// --- Tab 3: Log Expense ---
function LogExpenseTab({ onToast }) {
  const [form, setForm] = useState({ amount: '', category: 'food', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [anomalies, setAnomalies] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setAnomalies([]);
    setLoading(true);
    try {
      const res = await api.post('/expenses/log', { ...form, amount: parseFloat(form.amount) });
      if (res.data.anomalies_detected?.length > 0) {
        setAnomalies(res.data.anomalies_detected);
      } else {
        onToast('Expense logged successfully!', 'success');
      }
      setForm({ amount: '', category: 'food', description: '' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to log expense.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h3 className="text-lg font-bold text-[#1a3a5c] mb-6">Log an Expense</h3>
      {anomalies.length > 0 && <div className="mb-4"><AnomalyBanner reasons={anomalies} /></div>}
      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl shadow p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
          <input type="number" required min="1" step="0.01" value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981]"
            placeholder="12000" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981] bg-white capitalize">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea required rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981] resize-none"
            placeholder="Describe what this expense is for…" />
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-[#1a3a5c] text-white font-semibold rounded-lg hover:bg-[#0f2540] transition disabled:opacity-60">
          {loading ? 'Logging…' : 'Log Expense'}
        </button>
      </form>
    </div>
  );
}

// --- Tab 4: Anomaly Alerts ---
function AnomalyAlertsTab({ ngoId }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ngoId) { setLoading(false); return; }
    api.get(`/anomaly/alerts/${ngoId}`)
      .then((res) => setAlerts(res.data))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [ngoId]);

  if (loading) return <Spinner />;

  return (
    <div>
      <h3 className="text-lg font-bold text-[#1a3a5c] mb-4">Anomaly Alerts</h3>
      {alerts.length === 0 ? (
        <p className="text-gray-400 text-sm">No anomaly alerts. Your finances look clean!</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Amount', 'Category', 'Reason', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {alerts.map((a) => (
                <tr key={a.alert_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{new Date(a.flagged_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 font-semibold">{a.expense ? `₹${a.expense.amount.toLocaleString('en-IN')}` : '—'}</td>
                  <td className="px-4 py-3 capitalize">{a.expense?.category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs">{a.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      a.resolved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {a.resolved ? 'Resolved' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Main Dashboard ---
export default function NGODashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [toast, setToast] = useState(null);

  const ngoId = user?.ngo_id;

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-[#1a3a5c] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#10b981] flex items-center justify-center">
            <span className="font-bold text-sm">T</span>
          </div>
          <span className="text-xl font-bold">TraceTrust</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-200">{user?.email}</span>
          <button onClick={logout} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-200 flex-shrink-0">
          <nav className="py-6">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`w-full text-left px-6 py-3 text-sm font-medium transition ${
                  activeTab === i
                    ? 'bg-[#1a3a5c] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {activeTab === 0 && <OverviewTab ngoId={ngoId} />}
          {activeTab === 1 && <LogDonationTab onToast={showToast} />}
          {activeTab === 2 && <LogExpenseTab onToast={showToast} />}
          {activeTab === 3 && <AnomalyAlertsTab ngoId={ngoId} />}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
