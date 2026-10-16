import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import AdminRaces from '@/pages/AdminRaces';
import MyRaces from '@/pages/MyRaces';
import Account from '@/pages/Account';
import { useIsAdmin } from '@/lib/useIsAdmin';

function AdminOnly({ children }) {
  const isAdmin = useIsAdmin();
  if (isAdmin === null) {
    return <div className="p-10 text-center text-sm text-gray-400">Comprobando permisos…</div>;
  }
  if (!isAdmin) {
    return <div className="p-10 text-center text-sm text-gray-300">Esta sección es solo para administradores.</div>;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route
          path="/admin"
          element={
            <Layout>
              <AdminOnly>
                <AdminRaces />
              </AdminOnly>
            </Layout>
          }
        />
        <Route path="/my-races" element={<Layout><MyRaces /></Layout>} />
        <Route path="/login" element={<Account />} />
        <Route path="/forgot-password" element={<Account />} />
        <Route path="/reset-password" element={<Account />} />
      </Routes>
    </BrowserRouter>
  );
}
