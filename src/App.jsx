import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from './firebase/config';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EntryPage from './pages/EntryPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import LedgerPage from './pages/LedgerPage';
import RecordsPage from './pages/RecordsPage';
import SuperAdminPage from './pages/SuperAdminPage';

// Layout
import Layout from './components/UI/Layout';

const ProtectedRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function AppContent() {
  const { profile } = useAuth();
  const [allRecords, setAllRecords] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const recordsQuery = query(
      collection(db, 'pos_records'),
      where('tenantId', '==', profile.tenantId)
    );
    const unsubRecords = onSnapshot(recordsQuery, (snap) => {
      setAllRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const productsQuery = query(
      collection(db, 'pos_products'),
      where('tenantId', '==', profile.tenantId)
    );
    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      setAllProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubRecords(); unsubProducts(); };
  }, [profile?.tenantId]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mttadminacc" element={<SuperAdminPage />} />

        {/* ✅ Nested Routes with Layout + Outlet */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage records={allRecords} />} />
          <Route path="entry" element={<EntryPage products={allProducts} />} />
          <Route path="inventory" element={<InventoryPage products={allProducts} />} />
          <Route path="reports" element={<ReportsPage records={allRecords} />} />
          <Route path="ledger" element={<LedgerPage records={allRecords} />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="records" element={<RecordsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
