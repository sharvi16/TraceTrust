import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const CATEGORIES = ['education', 'health', 'food', 'disaster'];

export default function Register() {
  const [role, setRole] = useState('donor');
  const [form, setForm] = useState({
    email: '',
    password: '',
    ngo_name: '',
    registration_number: '',
    category: 'education',
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = { email: form.email, password: form.password, role };
      if (role === 'ngo_admin') {
        payload.ngo_name = form.ngo_name;
        payload.registration_number = form.registration_number;
        payload.category = form.category;
      }
      await api.post('/auth/register', payload);
      setSuccess(
        role === 'ngo_admin'
          ? 'Registration successful! Your NGO is pending approval by the admin before you can log in.'
          : 'Registration successful! You can now log in.'
      );
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Brand */}
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-[#1a3a5c]">TraceTrust</span>
          <p className="text-gray-500 text-sm mt-1">Create your account</p>
        </div>

        {/* Role toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-6">
          <button
            type="button"
            onClick={() => setRole('donor')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              role === 'donor'
                ? 'bg-[#1a3a5c] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            I am a Donor
          </button>
          <button
            type="button"
            onClick={() => setRole('ngo_admin')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              role === 'ngo_admin'
                ? 'bg-[#1a3a5c] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            I represent an NGO
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" name="email" required
              value={form.email} onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password" name="password" required
              value={form.password} onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981]"
              placeholder="Min. 8 characters"
            />
          </div>

          {role === 'ngo_admin' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NGO Name</label>
                <input
                  type="text" name="ngo_name" required
                  value={form.ngo_name} onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                  placeholder="Name of your NGO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input
                  type="text" name="registration_number" required
                  value={form.registration_number} onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                  placeholder="e.g. NGO/MH/2024/001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  name="category" value={form.category} onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10b981] bg-white capitalize"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-[#1a3a5c] text-white font-semibold rounded-lg hover:bg-[#0f2540] transition disabled:opacity-60"
          >
            {loading ? 'Registering…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#10b981] font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
