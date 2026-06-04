import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, 
  query, where, orderBy, limit, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { 
  Users, Building2, Settings, Shield, AlertTriangle, 
  Plus, Edit, Trash2, RefreshCw, LogOut, Home, 
  ShoppingCart, DollarSign, TrendingUp, CheckCircle, XCircle
} from 'lucide-react';

// ============================================
// SuperAdminPage Component
// ============================================
export default function SuperAdminPage() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [stats, setStats] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    shopName: '',
    email: '',
    phone: '',
    address: '',
    isActive: true,
    subscription: 'monthly'
  });
  const [autoLoginEmail, setAutoLoginEmail] = useState('');
  const [autoLoginPassword, setAutoLoginPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');

  // ============================================
  // Auto-Login using predefined Super Admin account
  // ============================================
  const SUPER_ADMIN_EMAIL = 'superadmin@quickpos.com';
  const SUPER_ADMIN_PASSWORD = 'Admin@123456';

  useEffect(() => {
    // Auto-login when component mounts
    const autoLogin = async () => {
      try {
        // Check if already logged in
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.email === SUPER_ADMIN_EMAIL) {
          console.log('Already logged in as Super Admin');
          fetchTenants();
          setLoading(false);
          return;
        }
        
        // Auto sign in
        await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
        setLoginMessage('Auto-login successful!');
        setTimeout(() => setLoginMessage(''), 3000);
        fetchTenants();
      } catch (error) {
        console.error('Auto-login error:', error);
        setLoginMessage('Auto-login failed. Please check Firebase Auth.');
        setLoading(false);
      }
    };
    
    autoLogin();
  }, []);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === SUPER_ADMIN_EMAIL) {
        fetchTenants();
      } else if (user) {
        // If logged in as non-super admin, sign out
        signOut(auth);
        setLoginMessage('Please use Super Admin account');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ============================================
  // Fetch all tenants
  // ============================================
  const fetchTenants = useCallback(async () => {
    try {
      const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const tenantsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTenants(tenantsData);
      
      // Fetch stats for each tenant
      const statsData = {};
      for (const tenant of tenantsData) {
        const salesQuery = query(
          collection(db, 'pos_records'),
          where('tenantId', '==', tenant.id),
          where('type', '==', 'Sale'),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        const salesSnap = await getDocs(salesQuery);
        const totalSales = salesSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
        statsData[tenant.id] = { totalSales, recordCount: salesSnap.size };
      }
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  }, []);

  // ============================================
  // Create new tenant
  // ============================================
  const createTenant = async () => {
    if (!formData.shopName || !formData.email) {
      alert('Please fill required fields');
      return;
    }
    
    setLoading(true);
    try {
      const tenantId = `tenant_${Date.now()}`;
      const tenantRef = doc(db, 'tenants', tenantId);
      
      await setDoc(tenantRef, {
        tenantId,
        shopName: formData.shopName,
        email: formData.email,
        phone: formData.phone || '',
        address: formData.address || '',
        isActive: formData.isActive,
        subscription: formData.subscription,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Create default settings for tenant
      const settingsRef = doc(db, 'pos_settings', tenantId);
      await setDoc(settingsRef, {
        shopName: formData.shopName,
        phone: formData.phone,
        address: formData.address,
        currency: 'MMK',
        createdAt: serverTimestamp()
      });
      
      setShowCreateModal(false);
      setFormData({ id: '', shopName: '', email: '', phone: '', address: '', isActive: true, subscription: 'monthly' });
      fetchTenants();
      alert('Tenant created successfully!');
    } catch (error) {
      console.error('Error creating tenant:', error);
      alert('Failed to create tenant');
    }
    setLoading(false);
  };

  // ============================================
  // Update tenant
  // ============================================
  const updateTenant = async () => {
    if (!selectedTenant) return;
    
    setLoading(true);
    try {
      const tenantRef = doc(db, 'tenants', selectedTenant.id);
      await setDoc(tenantRef, {
        shopName: formData.shopName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        isActive: formData.isActive,
        subscription: formData.subscription,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setShowEditModal(false);
      fetchTenants();
      alert('Tenant updated successfully!');
    } catch (error) {
      console.error('Error updating tenant:', error);
      alert('Failed to update tenant');
    }
    setLoading(false);
  };

  // ============================================
  // Delete tenant
  // ============================================
  const deleteTenant = async (tenantId) => {
    if (!window.confirm('Are you sure? This will delete ALL data for this tenant!')) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'tenants', tenantId));
      // Optional: Delete all subcollections (pos_records, pos_products, etc.)
      fetchTenants();
      alert('Tenant deleted successfully');
    } catch (error) {
      console.error('Error deleting tenant:', error);
      alert('Failed to delete tenant');
    }
    setLoading(false);
  };

  // ============================================
  // Manual logout (just in case)
  // ============================================
  const handleLogout = async () => {
    await signOut(auth);
    alert('Logged out. Page will reload.');
    window.location.reload();
  };

  // ============================================
  // Render
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060816] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Auto-login in progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060816] to-[#0a0f1a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-black text-cyan-400 flex items-center gap-2">
              <Shield size={28} /> Super Admin Dashboard
            </h1>
            {loginMessage && (
              <p className="text-green-400 text-sm mt-1">{loginMessage}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Auto-logged in as: <span className="text-cyan-400">{SUPER_ADMIN_EMAIL}</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/40 rounded-xl text-rose-400 font-bold flex items-center gap-2 transition-colors"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0f172a] rounded-xl p-4 border border-cyan-500/20">
            <div className="flex items-center gap-3">
              <Building2 size={24} className="text-cyan-400" />
              <div>
                <p className="text-slate-400 text-xs">Total Tenants</p>
                <p className="text-2xl font-bold text-white">{tenants.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0f172a] rounded-xl p-4 border border-cyan-500/20">
            <div className="flex items-center gap-3">
              <Users size={24} className="text-cyan-400" />
              <div>
                <p className="text-slate-400 text-xs">Active Tenants</p>
                <p className="text-2xl font-bold text-white">
                  {tenants.filter(t => t.isActive !== false).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-[#0f172a] rounded-xl p-4 border border-cyan-500/20">
            <div className="flex items-center gap-3">
              <TrendingUp size={24} className="text-cyan-400" />
              <div>
                <p className="text-slate-400 text-xs">Total Sales (all tenants)</p>
                <p className="text-2xl font-bold text-white">
                  {Object.values(stats).reduce((sum, s) => sum + (s.totalSales || 0), 0).toLocaleString()} Ks
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">All Tenants</h2>
          <button
            onClick={() => {
              setFormData({ id: '', shopName: '', email: '', phone: '', address: '', isActive: true, subscription: 'monthly' });
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold flex items-center gap-2 transition-colors"
          >
            <Plus size={18} /> New Tenant
          </button>
        </div>

        {/* Tenants Table */}
        <div className="bg-[#0f172a] rounded-2xl border border-cyan-500/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-cyan-600/10 border-b border-cyan-500/20">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-cyan-400">Shop Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-cyan-400">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-cyan-400">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-cyan-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-cyan-400">Sales</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-cyan-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{tenant.shopName}</div>
                      <div className="text-xs text-slate-500">{tenant.id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{tenant.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{tenant.phone || '-'}</td>
                    <td className="px-4 py-3">
                      {tenant.isActive !== false ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-rose-500/20 text-rose-400 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                          <XCircle size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-cyan-400">
                        {stats[tenant.id]?.totalSales?.toLocaleString() || 0} Ks
                      </div>
                      <div className="text-xs text-slate-500">
                        {stats[tenant.id]?.recordCount || 0} transactions
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setFormData({
                              id: tenant.id,
                              shopName: tenant.shopName,
                              email: tenant.email,
                              phone: tenant.phone || '',
                              address: tenant.address || '',
                              isActive: tenant.isActive !== false,
                              subscription: tenant.subscription || 'monthly'
                            });
                            setShowEditModal(true);
                          }}
                          className="p-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 rounded-lg transition-colors"
                        >
                          <Edit size={16} className="text-cyan-400" />
                        </button>
                        <button
                          onClick={() => deleteTenant(tenant.id)}
                          className="p-1.5 bg-rose-600/20 hover:bg-rose-600/40 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} className="text-rose-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tenants.length === 0 && (
            <div className="text-center py-12">
              <Building2 size={48} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No tenants found. Create your first tenant.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] rounded-2xl max-w-md w-full p-6 border border-cyan-500/20">
            <h2 className="text-xl font-bold text-white mb-4">Create New Tenant</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Shop Name *"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white"
              />
              <input
                type="email"
                placeholder="Admin Email *"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white"
              />
              <input
                type="text"
                placeholder="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white"
              />
              <input
                type="text"
                placeholder="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white"
              />
              <div className="flex gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-300">Active</span>
                </label>
                <select
                  value={formData.subscription}
                  onChange={(e) => setFormData({ ...formData, subscription: e.target.value })}
                  className="bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="trial">Trial</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={createTenant} className="flex-1 py-3 bg-cyan-600 rounded-xl font-bold">Create</button>
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-slate-700 rounded-xl font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tenant Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] rounded-2xl max-w-md w-full p-6 border border-cyan-500/20">
            <h2 className="text-xl font-bold text-white mb-4">Edit Tenant</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Shop Name"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white"
              />
              <input
                type="email"
                placeholder="Admin Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white"
              />
              <input
                type="text"
                placeholder="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white"
              />
              <input
                type="text"
                placeholder="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-3 text-white"
              />
              <div className="flex gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span className="text-sm text-slate-300">Active</span>
                </label>
                <select
                  value={formData.subscription}
                  onChange={(e) => setFormData({ ...formData, subscription: e.target.value })}
                  className="bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="trial">Trial</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={updateTenant} className="flex-1 py-3 bg-cyan-600 rounded-xl font-bold">Update</button>
              <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-slate-700 rounded-xl font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
