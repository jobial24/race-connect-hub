import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import AdminRaces from '@/pages/AdminRaces';
import MyRaces from '@/pages/MyRaces';
import Account from '@/pages/Account';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/admin" element={<Layout><AdminRaces /></Layout>} />
        <Route path="/my-races" element={<Layout><MyRaces /></Layout>} />
        <Route path="/login" element={<Account />} />
        <Route path="/forgot-password" element={<Account />} />
        <Route path="/reset-password" element={<Account />} />
      </Routes>
    </BrowserRouter>
  );
}
