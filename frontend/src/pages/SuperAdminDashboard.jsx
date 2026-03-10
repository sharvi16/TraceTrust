import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-10 h-10 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Toast({ message, type, onClose }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-3 ${
      type === 'success' ? 'bg-[#10b981]' : 'bg-[#ef4444]'
    }`}>
      {message}
      <button onClick={onClose} className="ml-2 opacity-75 hover:opacity-100">&times;</button>
    </div>
  );
}

const CATEGORY_COLORS = {
  education: 'bg-blue-100 text-blue-700',
  health: 'bg-green-100 text-green-700',
  food: 'bg-orange-100 text-orange-700',
  disaster: 'bg-red-100 text-red-700',
};

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const [pendingNGOs, setPendingNGOs] = useState([]);
  const [allNGOs, setAllNGOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function fetchNGOs() {
    try {
      const res = await api.get('/impact/all');
      const approved = res.data;
      setAllNGOs(approved);

      // Fetch all NGOs to find unapproved ones — use /auth/me trick:
      // We don't have a list-all-ngos endpoint, so query pending via a dedicated call
      const pendingRes = await api.get('/auth/pending-ngos');
      setPendingNGOs(pendingRes.data);
    } catch {
      // /auth/pending-ngos may not exist yet — fall back gracefully
      setPendingNGOs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNGOs();
  }, []);

  async function handleApprove(ngoId) {
    setApproving(ngoId);
    try {
      await api.post('/auth/approve-ngo', { ngo_id: ngoId });
      showToast('NGO approved successfully!', 'success');
      setPendingNGOs((prev) => prev.filter((n) => n.ngo_id !== ngoId));
      // Refresh approved list
      const res = await api.get('/impact/all');
      setAllNGOs(res.data);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to approve NGO.', 'error');
    } finally {
      setApproving(null);
    }
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
          <span className="ml-3 text-xs bg-white/20 px-2 py-0.5 rounded-full">Super Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-200">{user?.email}</span>
          <button onClick={logout} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition">
            Logout
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full p-8">
        <h2 className="text-2xl font-bold text-[#1a3a5c] mb-6">NGO Management</h2>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-200 p-1 rounded-xl w-fit mb-8">
          {[['pending', `Pending Approval (${pendingNGOs.length})`], ['approved', `Approved NGOs (${allNGOs.length})`]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === key ? 'bg-white text-[#1a3a5c] shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <Spinner /> : (
          <>
            {/* Pending Approval */}
            {activeTab === 'pending' && (
              <div>
                {pendingNGOs.length === 0 ? (
                  <div className="bg-white rounded-xl shadow p-10 text-center">
                    <p className="text-3xl mb-3">✅</p>
                    <p className="text-gray-500 font-medium">No pending NGO registrations.</p>
                    <p className="text-gray-400 text-sm mt-1">All submitted NGOs have been reviewed.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingNGOs.map((ngo) => (
                      <div key={ngo.ngo_id} className="bg-white rounded-xl shadow p-6 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-[#1a3a5c] text-lg truncate">{ngo.name}</h3>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[ngo.category] ?? 'bg-gray-100 text-gray-600'}`}>
                              {ngo.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">Reg. No: <span className="font-mono font-medium text-gray-700">{ngo.registration_number}</span></p>
                          <p className="text-xs text-gray-400 mt-0.5">ID: {ngo.ngo_id}</p>
                        </div>
                        <button
                          onClick={() => handleApprove(ngo.ngo_id)}
                          disabled={approving === ngo.ngo_id}
                          className="flex-shrink-0 px-5 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-lg transition disabled:opacity-60 text-sm"
                        >
                          {approving === ngo.ngo_id ? 'Approving…' : 'Approve'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Approved NGOs */}
            {activeTab === 'approved' && (
              <div>
                {allNGOs.length === 0 ? (
                  <div className="bg-white rounded-xl shadow p-10 text-center">
                    <p className="text-gray-400 text-sm">No approved NGOs yet.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['NGO Name', 'Category', 'Impact Score', 'Grade', 'Total Donated', 'Donors'].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {allNGOs.map((ngo) => (
                          <tr key={ngo.ngo_id} className="hover:bg-gray-50">
                            <td className="px-5 py-4 font-semibold text-[#1a3a5c]">{ngo.ngo_name}</td>
                            <td className="px-5 py-4 capitalize">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[ngo.category] ?? 'bg-gray-100 text-gray-600'}`}>
                                {ngo.category}
                              </span>
                            </td>
                            <td className="px-5 py-4 font-bold text-[#10b981]">{ngo.impact_score}</td>
                            <td className="px-5 py-4">
                              <span className={`font-bold text-sm px-2 py-0.5 rounded ${
                                ngo.grade === 'A' ? 'text-emerald-600 bg-emerald-50' :
                                ngo.grade === 'B' ? 'text-amber-600 bg-amber-50' :
                                ngo.grade === 'C' ? 'text-orange-600 bg-orange-50' :
                                'text-red-600 bg-red-50'
                              }`}>{ngo.grade}</span>
                            </td>
                            <td className="px-5 py-4">₹{(ngo.total_donated ?? 0).toLocaleString('en-IN')}</td>
                            <td className="px-5 py-4">{ngo.donor_count ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
