import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from './firebase/config';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/UI/Toast';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EntryPage from './pages/EntryPage';
import InventoryPage from './pages/InventoryPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import LedgerPage from './pages/LedgerPage';
import RecordsPage from './pages/RecordsPage';
import ReportsPage from './pages/ReportsPage';
import SuperAdminPage from './pages/SuperAdminPage';
import CustomersPage from './pages/CustomersPage';
import SuppliersPage from './pages/SuppliersPage';
import DraftsPage from './pages/DraftsPage';

const NotFoundPage = () => (
  <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6 text-white">
    <div className="max-w-md rounded-3xl border border-white/10 bg-slate-950/90 p-8 text-center shadow-2xl">
      <h1 className="text-3xl font-black text-cyan-200">404</h1>
      <p className="mt-3 text-sm font-bold text-slate-300">Page not found</p>
    </div>
  </div>
);

import Layout from './components/UI/Layout';

const LoadingScreen = () => (
  <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user || !profile) return <Navigate to="/login" replace />;

  return children;
};

const AdminOnlyRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user || !profile) return <Navigate to="/login" replace />;

  const role = String(profile?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'owner' || role === 'superadmin' || role === 'super_admin';

  if (!isAdmin) return <Navigate to="/entry" replace />;

  return children;
};

const PermissionRoute = ({ permission, children, fallback = '/entry' }) => {
  const { user, profile, loading, hasPermission } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (!hasPermission(permission)) return <Navigate to={fallback} replace />;

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
      (snap) => setAllRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubProducts = onSnapshot(
      query(collection(db, 'pos_products'), where('tenantId', '==', profile.tenantId)),
      (snap) => setAllProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubRecords();
      unsubProducts();
    };
  }, [profile?.tenantId]);

  const mappedProducts = useMemo(() => {
    return allProducts.map((prod) => {
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

        {/* Super Admin setup page - public */}
        <Route path="/mttadminacc" element={<SuperAdminPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route
            path="dashboard"
            element={
              <PermissionRoute permission="view_reports" fallback="/entry">
                <DashboardPage records={allRecords} />
              </PermissionRoute>
            }
          />

          <Route
            path="entry"
            element={
              <PermissionRoute permission="create_sale" fallback="/inventory">
                <EntryPage products={mappedProducts} />
              </PermissionRoute>
            }
          />

          <Route
            path="inventory"
            element={
              <PermissionRoute permission="view_inventory" fallback="/entry">
                <InventoryPage products={mappedProducts} />
              </PermissionRoute>
            }
          />

          <Route
            path="customers"
            element={
              <PermissionRoute permission="view_customers" fallback="/entry">
                <CustomersPage />
              </PermissionRoute>
            }
          />

          <Route
            path="suppliers"
            element={
              <PermissionRoute permission="view_suppliers" fallback="/entry">
                <SuppliersPage />
              </PermissionRoute>
            }
          />

          <Route path="drafts" element={<DraftsPage />} />

          <Route
            path="ledger"
            element={
              <PermissionRoute permission="view_reports" fallback="/entry">
                <LedgerPage records={allRecords} />
              </PermissionRoute>
            }
          />

          <Route
            path="admin"
            element={
              <AdminOnlyRoute>
                <AdminPage />
              </AdminOnlyRoute>
            }
          />

          <Route
            path="settings"
            element={
              <AdminOnlyRoute>
                <SettingsPage />
              </AdminOnlyRoute>
            }
          />

          <Route
            path="records"
            element={
              <PermissionRoute permission="view_sales" fallback="/entry">
                <RecordsPage />
              </PermissionRoute>
            }
          />

          <Route
            path="reports"
            element={
              <PermissionRoute permission="view_reports" fallback="/entry">
                <ReportsPage records={allRecords} />
              </PermissionRoute>
            }
          />

        </Route>

        <Route path="*" element={<NotFoundPage />} />
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
