import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase text-gray-400 tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-[#1a3a5c]">{value}</span>
    </div>
  );
}

export default function DonorDashboard() {
  const { user, logout } = useAuth();
  const [donations, setDonations] = useState([]);
  const [impacts, setImpacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/donations/my'),
      api.get('/impact/donor/my'),
    ])
      .then(([donRes, impRes]) => {
        setDonations(donRes.data);
        setImpacts(impRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  // Summary calculations
  const totalDonated = donations.reduce((s, g) => s + g.total_donated, 0);
  const ngoCount = donations.length;
  const avgImpact = impacts.length
    ? Math.round(impacts.reduce((s, i) => s + i.impact_score, 0) / impacts.length)
    : 0;

  // Build a flat donation history rows
  const allDonations = donations.flatMap((g) =>
    g.donations.map((d) => ({ ...d, ngo_name: g.ngo_name }))
  ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  function progressColor(pct) {
    if (pct >= 80) return 'bg-[#10b981]';
    if (pct >= 60) return 'bg-[#f59e0b]';
    return 'bg-[#ef4444]';
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
          <button
            onClick={logout}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? <Spinner /> : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <StatCard label="Total Donated" value={`₹${totalDonated.toLocaleString('en-IN')}`} />
              <StatCard label="NGOs Supported" value={ngoCount} />
              <StatCard label="Avg Impact Score" value={`${avgImpact}%`} />
            </div>

            {/* Impact Section */}
            <section className="mb-10">
              <h2 className="text-lg font-bold text-[#1a3a5c] mb-4">Your Impact</h2>
              <div className="space-y-4">
                {impacts.map((item) => {
                  const pct = item.you_donated > 0
                    ? Math.round((item.reached_cause / item.you_donated) * 100)
                    : 0;
                  return (
                    <div key={item.ngo_id} className="bg-white rounded-xl shadow p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-[#1a3a5c]">{item.ngo_name}</span>
                        <span
                          className="px-2 py-0.5 text-xs font-bold rounded-full"
                          style={{
                            backgroundColor: item.grade === 'A' ? '#d1fae5' : item.grade === 'B' ? '#fef3c7' : '#fee2e2',
                            color: item.grade === 'A' ? '#065f46' : item.grade === 'B' ? '#92400e' : '#991b1b',
                          }}
                        >
                          Grade {item.grade}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        ₹{item.reached_cause.toLocaleString('en-IN')} of ₹{item.you_donated.toLocaleString('en-IN')} reached the cause
                      </p>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all ${progressColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {impacts.length === 0 && (
                  <p className="text-gray-400 text-sm">No impact data yet. Make a donation to see your impact.</p>
                )}
              </div>
            </section>

            {/* Donation History */}
            <section>
              <h2 className="text-lg font-bold text-[#1a3a5c] mb-4">Donation History</h2>
              {allDonations.length === 0 ? (
                <p className="text-gray-400 text-sm">No donations yet.</p>
              ) : (
                <div className="bg-white rounded-xl shadow overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Date', 'NGO Name', 'Amount', 'Transaction Ref'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allDonations.map((d) => (
                        <tr key={d.donation_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{new Date(d.timestamp).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-3 font-medium text-[#1a3a5c]">{d.ngo_name}</td>
                          <td className="px-4 py-3 font-semibold">₹{d.amount.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{d.transaction_ref}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
