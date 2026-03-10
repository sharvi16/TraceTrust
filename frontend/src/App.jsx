import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PublicPage from './pages/PublicPage';
import Login from './pages/Login';
import Register from './pages/Register';
import DonorDashboard from './pages/DonorDashboard';
import NGODashboard from './pages/NGODashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-500 mb-4">403</h1>
        <p className="text-xl text-gray-700 mb-6">Access Denied</p>
        <p className="text-gray-500 mb-8">You don't have permission to view this page.</p>
        <a href="/login" className="px-6 py-3 bg-[#1a3a5c] text-white rounded-lg hover:bg-[#0f2540] transition">
          Back to Login
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route
        path="/donor"
        element={
          <ProtectedRoute allowedRoles={['donor']}>
            <DonorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ngo"
        element={
          <ProtectedRoute allowedRoles={['ngo_admin']}>
            <NGODashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
