import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import NGOCard from '../components/NGOCard';

const CATEGORIES = ['All', 'Education', 'Health', 'Food', 'Disaster'];

export default function PublicPage() {
  const [ngos, setNgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    api.get('/impact/all')
      .then((res) => setNgos(res.data))
      .catch(() => setNgos([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = ngos.filter((n) => {
    const matchesSearch =
      n.ngo_name?.toLowerCase().includes(search.toLowerCase()) ||
      n.category?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === 'All' ||
      n.category?.toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-[#1a3a5c] text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#10b981] flex items-center justify-center">
            <span className="font-bold text-sm">T</span>
          </div>
          <span className="text-xl font-bold">TraceTrust</span>
        </div>
        <Link
          to="/login"
          className="px-4 py-2 bg-[#10b981] text-white rounded-lg text-sm font-medium hover:bg-[#0d9668] transition"
        >
          Login
        </Link>
      </nav>

      {/* Hero */}
      <section className="bg-[#1a3a5c] text-white py-16 px-6 text-center">
        <h1 className="text-4xl font-extrabold mb-4">
          Track Every Rupee.{' '}
          <span className="text-[#10b981]">Trust Every NGO.</span>
        </h1>
        <p className="text-blue-200 text-lg max-w-xl mx-auto">
          Real-time transparency into how NGOs spend your donations.
          Powered by data. Built on trust.
        </p>
      </section>

      {/* Search + Filters */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search NGOs by name or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#10b981] bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                activeCategory === cat
                  ? 'bg-[#1a3a5c] text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:border-[#1a3a5c]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No NGOs found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((ngo) => (
              <NGOCard key={ngo.ngo_id} ngo={ngo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
