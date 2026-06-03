import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from './firebase/config';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/UI/Toast';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EntryPage from './pages/EntryPage';
import InventoryPage from './pages/InventoryPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import LedgerPage from './pages/LedgerPage';
import RecordsPage from './pages/RecordsPage';
import SuperAdminPage from './pages/SuperAdminPage';

import CustomersPage from './pages/CustomersPage';
import SuppliersPage from './pages/SuppliersPage';
import DraftsPage from './pages/DraftsPage';

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
  if (!user || !profile) return <Navigate to="/login" replace />;
  return children;
};

function AppContent() {
  const { profile } = useAuth();
  const [allRecords, setAllRecords] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const unsubRecords = onSnapshot(
      query(collection(db, 'pos_records'), where('tenantId', '==', profile.tenantId)),
      snap => setAllRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubProducts = onSnapshot(
      query(collection(db, 'pos_products'), where('tenantId', '==', profile.tenantId)),
      snap => setAllProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubRecords();
      unsubProducts();
    };
  }, [profile?.tenantId]);

  const mappedProducts = useMemo(() => {
    return allProducts.map(prod => {
      if (prod.packageUnits?.length > 0) return prod;
      return {
        ...prod,
        stockBase: prod.stockBase ?? prod.stock ?? 0,
        packageUnits: [
          {
            name: prod.baseUnit || 'unit',
            multiplier: 1,
            prices: {
              retail: prod.price || 0,
              wholesaleA: prod.wholesalePriceA || 0,
              wholesaleB: prod.wholesalePriceB || 0,
              wholesaleC: prod.wholesalePriceC || 0,
            },
            costPrice: prod.costPrice || 0,
            barcodes: { retail: prod.barcode || '' },
          },
        ],
      };
    });
  }, [allProducts]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mttadminacc" element={<SuperAdminPage />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage records={allRecords} />} />
          <Route path="entry" element={<EntryPage products={mappedProducts} />} />
          <Route path="inventory" element={<InventoryPage products={mappedProducts} />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="drafts" element={<DraftsPage />} />
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
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <Toast />
          <AppContent />
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
