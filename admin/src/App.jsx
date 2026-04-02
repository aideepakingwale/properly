/**
 * @file        App.jsx
 * @description Admin console React router — login guard and page routes for all admin sections
 * @module      Admin App
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Shop from './pages/Shop';
import Stories from './pages/Stories';
import Analytics from './pages/Analytics';
import Config from './pages/Config';
import BooksAdmin from './pages/Books';
import Reports from './pages/Reports';

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontFamily:'var(--font-mono)' }}>
      initialising…
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="shop" element={<Shop />} />
            <Route path="stories" element={<Stories />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="config" element={<Config />} />
            <Route path="books"    element={<BooksAdmin />} />
            <Route path="reports"  element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
