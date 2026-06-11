import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  DollarSign,
  Download,
  Edit3,
  History,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';

import ConfirmDialog from '../components/UI/ConfirmDialog';
import { showToast } from '../components/UI/Toast';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';

const SUPPLIER_FETCH_LIMIT = 500;
const SUPPLIER_RENDER_PAGE_SIZE = 50;
const SUPPLIER_HISTORY_LIMIT = 900;
const MAX_IMPORT_ROWS = 1000;
const MAX_SUPPLIER_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 40;
const MAX_ADDRESS_LENGTH = 240;
const MAX_NOTE_LENGTH = 200;
const MAX_MONEY_VALUE = 999_999_999_999;

const normalizeText = (value = '') => String(value ?? '').trim();
const normalizeLower = (value = '') => normalizeText(value).toLowerCase();
const normalizePhone = (value = '') => normalizeText(value).replace(/\s+/g, '');
const toSafeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const clampMoney = (value) => Math.min(MAX_MONEY_VALUE, Math.max(0, toSafeNumber(value, 0)));
const todayString = () => new Date().toISOString().slice(0, 10);
const fmt = (value) => toSafeNumber(value, 0).toLocaleString();

const csvEscape = (value = '') => {
  const raw = String(value ?? '');
  const protectedValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replace(/"/g, '""')}"`;
};

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values.map((v) => v.replace(/^'+/, ''));
};

const createDuplicateKey = (supplier) => `${normalizeLower(supplier.name)}_${normalizePhone(supplier.phone)}`;

const getDateMillis = (record) => {
  if (record?.createdAt?.toMillis) return record.createdAt.toMillis();
  const candidate = record?.createdAt?.seconds ? record.createdAt.seconds * 1000 : Date.parse(record?.date || '');
  return Number.isFinite(candidate) ? candidate : 0;
};

const getCashierName = (profile) => profile?.username || profile?.name || profile?.email || 'Admin';

const initialSupplierForm = {
  name: '',
  phone: '',
  address: '',
  creditLimit: '',
  note: '',
};

export default function SuppliersPage() {
  const { profile, hasPermission } = useAuth();
  const tenantId = profile?.tenantId;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'superadmin';

  const [activeTab, setActiveTab] = useState('book');
  const [suppliers, setSuppliers] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(SUPPLIER_RENDER_PAGE_SIZE);
  const [historyVisibleLimit, setHistoryVisibleLimit] = useState(SUPPLIER_RENDER_PAGE_SIZE);

  const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isLedgerModalOpen, setLedgerModalOpen] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const [expandedSupp, setExpandedSupp] = useState({});
  const [expandedHist, setExpandedHist] = useState({});
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' });
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const fileRef = useRef(null);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const suppQ = query(
        collection(db, 'pos_suppliers'),
        where('tenantId', '==', tenantId),
        limit(SUPPLIER_FETCH_LIMIT),
      );
      const suppSnap = await getDocs(suppQ);
      const suppData = suppSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      suppData.sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name)));
      setSuppliers(suppData);

      const paymentQ = query(
        collection(db, 'pos_records'),
        where('tenantId', '==', tenantId),
        limit(SUPPLIER_HISTORY_LIMIT),
      );
      const paymentSnap = await getDocs(paymentQ);
      const paymentRecords = paymentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const purchaseQ = query(
        collection(db, 'pos_records'),
        where('tenantId', '==', tenantId),
        limit(SUPPLIER_HISTORY_LIMIT),
      );
      const purchaseSnap = await getDocs(purchaseQ);
      const purchaseRecords = purchaseSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllRecords([...paymentRecords, ...purchaseRecords]);
    } catch (error) {
      console.error('Error fetching supplier data:', error);
      showToast('Supplier data ဖတ်ရာတွင် အမှားဖြစ်နေပါသည်။', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    setVisibleLimit(SUPPLIER_RENDER_PAGE_SIZE);
    setHistoryVisibleLimit(SUPPLIER_RENDER_PAGE_SIZE);
  }, [searchTerm, activeTab]);

  const duplicateWarnings = useMemo(() => {
    const grouped = new Map();
    suppliers.forEach((supplier) => {
      const key = createDuplicateKey(supplier);
      if (!normalizeText(supplier.name) || key.endsWith('_')) return;
      grouped.set(key, [...(grouped.get(key) || []), supplier]);
    });
    return Array.from(grouped.values()).filter((group) => group.length > 1);
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const term = normalizeLower(searchTerm);
    if (!term) return suppliers;
    return suppliers.filter((supplier) => {
      const target = `${supplier.name || ''} ${supplier.phone || ''} ${supplier.address || ''} ${supplier.note || ''}`.toLowerCase();
      return target.includes(term);
    });
  }, [suppliers, searchTerm]);

  const visibleSuppliers = useMemo(() => filteredSuppliers.slice(0, visibleLimit), [filteredSuppliers, visibleLimit]);

  const supplierStats = useMemo(() => {
    const totalDebt = suppliers.reduce((sum, supplier) => sum + clampMoney(supplier.totalDebt), 0);
    const overLimit = suppliers.filter((supplier) => {
      const creditLimit = clampMoney(supplier.creditLimit);
      return creditLimit > 0 && clampMoney(supplier.totalDebt) > creditLimit;
    }).length;
    return { totalDebt, overLimit, count: suppliers.length };
  }, [suppliers]);

  const mergedHistory = useMemo(() => {
    const payments = allRecords.filter((record) => record.type === 'Supplier Payment');
    const merged = {};
    payments.forEach((payment) => {
      const key = payment.supplierId || payment.personName || 'unknown';
      if (!merged[key]) {
        merged[key] = {
          supplierId: payment.supplierId,
          personName: payment.personName || 'Unknown Supplier',
          totalPaid: 0,
          paymentCount: 0,
          lastPaymentDate: payment.date,
          details: [],
        };
      }
      merged[key].totalPaid += clampMoney(payment.amount);
      merged[key].paymentCount += 1;
      merged[key].details.push(payment);
      if (new Date(payment.date) > new Date(merged[key].lastPaymentDate)) merged[key].lastPaymentDate = payment.date;
    });

    let historyArr = Object.values(merged).sort((a, b) => new Date(b.lastPaymentDate) - new Date(a.lastPaymentDate));
    const term = normalizeLower(searchTerm);
    if (term) historyArr = historyArr.filter((row) => normalizeLower(row.personName).includes(term));
    return historyArr;
  }, [allRecords, searchTerm]);

  const visibleHistory = useMemo(() => mergedHistory.slice(0, historyVisibleLimit), [mergedHistory, historyVisibleLimit]);

  const openSupplierModal = (supplier = null) => {
    setEditingSupplier(supplier);
    setSupplierForm(
      supplier
        ? {
            name: supplier.name || '',
            phone: supplier.phone || '',
            address: supplier.address || '',
            creditLimit: supplier.creditLimit ?? '',
            note: supplier.note || '',
          }
        : initialSupplierForm,
    );
    setSupplierModalOpen(true);
  };

  const validateSupplierForm = () => {
    const name = normalizeText(supplierForm.name);
    const phone = normalizePhone(supplierForm.phone);
    const address = normalizeText(supplierForm.address);
    const note = normalizeText(supplierForm.note);
    const creditLimit = supplierForm.creditLimit === '' ? 0 : clampMoney(supplierForm.creditLimit);

    if (!name) return { error: 'Supplier အမည် ထည့်ပါ။' };
    if (name.length > MAX_SUPPLIER_NAME_LENGTH) return { error: `Supplier အမည်သည် ${MAX_SUPPLIER_NAME_LENGTH} လုံးထက် မကျော်ရပါ။` };
    if (phone.length > MAX_PHONE_LENGTH) return { error: `ဖုန်းနံပါတ်သည် ${MAX_PHONE_LENGTH} လုံးထက် မကျော်ရပါ။` };
    if (address.length > MAX_ADDRESS_LENGTH) return { error: `လိပ်စာသည် ${MAX_ADDRESS_LENGTH} လုံးထက် မကျော်ရပါ။` };
    if (note.length > MAX_NOTE_LENGTH) return { error: `မှတ်ချက်သည် ${MAX_NOTE_LENGTH} လုံးထက် မကျော်ရပါ။` };
    if (supplierForm.creditLimit !== '' && (!Number.isFinite(Number(supplierForm.creditLimit)) || Number(supplierForm.creditLimit) < 0)) {
      return { error: 'Credit Limit ကို 0 နှင့်အထက် ငွေပမာဏအဖြစ် ထည့်ပါ။' };
    }

    return { payload: { name, phone, address, note, creditLimit } };
  };

  const handleSaveSupplier = async (event) => {
    event.preventDefault();
    if (!hasPermission('manage_suppliers')) return showToast('လုပ်ပိုင်ခွင့် မရှိပါ။', 'error');
    if (!tenantId) return showToast('Tenant မတွေ့ပါ။ ပြန်ဝင်ပါ။', 'error');

    const validated = validateSupplierForm();
    if (validated.error) return showToast(validated.error, 'error');

    setLoading(true);
    try {
      const duplicate = suppliers.find((supplier) => {
        if (editingSupplier && supplier.id === editingSupplier.id) return false;
        return createDuplicateKey(supplier) === `${normalizeLower(validated.payload.name)}_${normalizePhone(validated.payload.phone)}`;
      });
      if (duplicate) {
        setLoading(false);
        return showToast('အမည်/ဖုန်း တူသော Supplier ရှိပြီးသားဖြစ်သည်။ Duplicate warning ကိုစစ်ပါ။', 'warning');
      }

      const payload = {
        ...validated.payload,
        tenantId,
        updatedAt: serverTimestamp(),
      };

      if (editingSupplier) {
        await setDoc(doc(db, 'pos_suppliers', editingSupplier.id), payload, { merge: true });
      } else {
        await addDoc(collection(db, 'pos_suppliers'), {
          ...payload,
          totalDebt: 0,
          createdAt: serverTimestamp(),
        });
      }

      setSupplierModalOpen(false);
      showToast('Supplier သိမ်းဆည်းပြီးပါပြီ။', 'success');
      fetchData();
    } catch (error) {
      console.error('Supplier save error:', error);
      showToast('Supplier သိမ်းရာတွင် အမှားဖြစ်နေပါသည်။', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = (supplier) => {
    if (!hasPermission('manage_suppliers')) return showToast('လုပ်ပိုင်ခွင့် မရှိပါ။', 'error');
    if (clampMoney(supplier.totalDebt) > 0) return showToast(`${supplier.name} သို့ ပေးရန်ကျန်ငွေရှိနေသဖြင့် ဖျက်၍မရပါ။`, 'error');

    setConfirmDialog({
      isOpen: true,
      title: 'Supplier ဖျက်သိမ်းခြင်း',
      message: `"${supplier.name}" ကို ဖျက်ရန် သေချာပါသလား?`,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
          await deleteDoc(doc(db, 'pos_suppliers', supplier.id));
          showToast('Supplier ဖျက်သိမ်းပြီးပါပြီ။', 'success');
          fetchData();
        } catch (error) {
          console.error('Supplier delete error:', error);
          showToast('Supplier ဖျက်ရာတွင် အမှားဖြစ်နေပါသည်။', 'error');
        }
      },
    });
  };

  const handlePayment = async (event) => {
    event.preventDefault();
    if (paymentSaving) return;
    if (!hasPermission('create_purchase')) return showToast('ငွေချေခွင့် မရှိပါ။', 'error');
    if (!selectedSupplier?.id) return showToast('Supplier မရွေးရသေးပါ။', 'error');
    if (!tenantId) return showToast('Tenant မတွေ့ပါ။ ပြန်ဝင်ပါ။', 'error');

    const payAmount = clampMoney(paymentForm.amount);
    const note = normalizeText(paymentForm.note).slice(0, MAX_NOTE_LENGTH);
    if (payAmount <= 0) return showToast('ငွေပမာဏ မှန်ကန်စွာထည့်ပါ။', 'error');

    setPaymentSaving(true);
    setLoading(true);
    try {
      const supplierRef = doc(db, 'pos_suppliers', selectedSupplier.id);
      const recordRef = doc(collection(db, 'pos_records'));
      const now = new Date();
      const paymentRecord = await runTransaction(db, async (transaction) => {
        const supplierSnap = await transaction.get(supplierRef);
        if (!supplierSnap.exists()) throw new Error('SUPPLIER_NOT_FOUND');
        const liveSupplier = supplierSnap.data();
        if (liveSupplier.tenantId !== tenantId) throw new Error('SUPPLIER_TENANT_MISMATCH');

        const liveDebt = clampMoney(liveSupplier.totalDebt);
        if (liveDebt <= 0) throw new Error('NO_DEBT');
        if (payAmount > liveDebt) throw new Error('PAYMENT_EXCEEDS_DEBT');

        const nextDebt = Math.max(0, liveDebt - payAmount);
        const payload = {
          type: 'Supplier Payment',
          tenantId,
          supplierId: selectedSupplier.id,
          personName: liveSupplier.name || selectedSupplier.name || '',
          amount: payAmount,
          beforeDebt: liveDebt,
          afterDebt: nextDebt,
          note: note || 'Supplier သို့ ငွေချေသည်',
          date: now.toISOString().slice(0, 10),
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          cashier: getCashierName(profile),
          createdAt: serverTimestamp(),
        };

        transaction.update(supplierRef, { totalDebt: nextDebt, updatedAt: serverTimestamp() });
        transaction.set(recordRef, payload);
        return payload;
      });

      setSuppliers((prev) => prev.map((supplier) => (supplier.id === selectedSupplier.id ? { ...supplier, totalDebt: paymentRecord.afterDebt } : supplier)));
      setSelectedSupplier((prev) => (prev ? { ...prev, totalDebt: paymentRecord.afterDebt } : prev));
      setPaymentModalOpen(false);
      setPaymentForm({ amount: '', note: '' });
      showToast('ငွေချေမှတ်တမ်း သိမ်းပြီးပါပြီ။', 'success');
      fetchData();
    } catch (error) {
      console.error('Supplier payment error:', error);
      const messages = {
        PAYMENT_EXCEEDS_DEBT: 'ဆပ်သည့်ငွေသည် လက်ရှိအကြွေးထက် များနေပါသည်။',
        NO_DEBT: 'လက်ရှိပေးရန်ကျန်ငွေ မရှိတော့ပါ။',
        SUPPLIER_NOT_FOUND: 'Supplier မတွေ့ပါ။ စာရင်းကို refresh လုပ်ပါ။',
        SUPPLIER_TENANT_MISMATCH: 'Security error: Supplier tenant မကိုက်ပါ။',
      };
      showToast(messages[error?.message] || 'ငွေချေမှတ်တမ်း သိမ်းရာတွင် အမှားဖြစ်နေပါသည်။', 'error');
    } finally {
      setPaymentSaving(false);
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!isAdmin) return showToast('Admin လုပ်ပိုင်ခွင့်လိုအပ်ပါသည်။', 'error');
    if (suppliers.length === 0) return showToast('Export ထုတ်ရန် Supplier မရှိပါ။', 'warning');

    const header = ['Name', 'Phone', 'Address', 'Credit Limit', 'Total Debt', 'Note'];
    const rows = suppliers.map((supplier) => [
      supplier.name || '',
      supplier.phone || '',
      supplier.address || '',
      clampMoney(supplier.creditLimit),
      clampMoney(supplier.totalDebt),
      supplier.note || '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Suppliers_${todayString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV ဖိုင် ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ။', 'success');
  };

  const handleImportCSV = (event) => {
    if (!isAdmin) return showToast('Admin လုပ်ပိုင်ခွင့်လိုအပ်ပါသည်။', 'error');
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      if (fileRef.current) fileRef.current.value = '';
      return showToast('CSV file သာ သွင်းနိုင်ပါသည်။', 'error');
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Supplier CSV သွင်းခြင်း',
      message: `Supplier စာရင်းအသစ်များကို Database သို့ ထည့်သွင်းမည်။ အများဆုံး ${MAX_IMPORT_ROWS} rows သာ လက်ခံပါမည်။`,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        setLoading(true);
        try {
          const text = await file.text();
          const rows = text.split(/\r?\n/).filter((row) => row.trim() !== '');
          if (rows.length <= 1) return showToast('ဖိုင်ထဲတွင် ဒေတာမရှိပါ။', 'warning');
          if (rows.length - 1 > MAX_IMPORT_ROWS) return showToast(`Import rows ${MAX_IMPORT_ROWS} ထက်မကျော်ရပါ။`, 'error');

          const existingKeys = new Set(suppliers.map(createDuplicateKey));
          const seenKeys = new Set();
          let batch = writeBatch(db);
          let count = 0;
          let skipped = 0;

          for (let i = 1; i < rows.length; i += 1) {
            const cols = parseCsvLine(rows[i]);
            const name = normalizeText(cols[0]).slice(0, MAX_SUPPLIER_NAME_LENGTH);
            const phone = normalizePhone(cols[1]).slice(0, MAX_PHONE_LENGTH);
            const address = normalizeText(cols[2]).slice(0, MAX_ADDRESS_LENGTH);
            const creditLimit = clampMoney(cols[3]);
            const totalDebt = clampMoney(cols[4]);
            const note = normalizeText(cols[5]).slice(0, MAX_NOTE_LENGTH);
            if (!name) {
              skipped += 1;
              continue;
            }
            const key = `${normalizeLower(name)}_${phone}`;
            if (existingKeys.has(key) || seenKeys.has(key)) {
              skipped += 1;
              continue;
            }
            seenKeys.add(key);
            batch.set(doc(collection(db, 'pos_suppliers')), {
              tenantId,
              name,
              phone,
              address,
              creditLimit,
              totalDebt,
              note,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            count += 1;
            if (count % 400 === 0) {
              await batch.commit();
              batch = writeBatch(db);
            }
          }
          if (count % 400 !== 0) await batch.commit();
          showToast(`${count} ခု ထည့်သွင်းပြီး၊ ${skipped} ခု ကျော်ထားပါသည်။`, 'success');
          fetchData();
        } catch (error) {
          console.error('Supplier import error:', error);
          showToast('Import လုပ်ရာတွင် အမှားဖြစ်နေပါသည်။', 'error');
        } finally {
          setLoading(false);
          if (fileRef.current) fileRef.current.value = '';
        }
      },
    });
  };

  const currentLedger = useMemo(() => {
    if (!selectedSupplier) return [];
    const relevant = allRecords.filter((record) => {
      const isSameSupplier = record.supplierId === selectedSupplier.id || record.personName === selectedSupplier.name;
      if (!isSameSupplier) return false;
      if (record.type === 'Supplier Payment') return true;
      if (record.type === 'Purchase') return clampMoney(record.remainingDebt) > 0 || clampMoney(record.amount) > 0;
      return false;
    });
    relevant.sort((a, b) => getDateMillis(a) - getDateMillis(b));
    let runningBalance = 0;
    return relevant
      .map((record) => {
        if (record.type === 'Purchase') runningBalance += clampMoney(record.remainingDebt || record.amount);
        if (record.type === 'Supplier Payment') runningBalance -= clampMoney(record.amount);
        return { ...record, runningBalance: Math.max(0, runningBalance) };
      })
      .reverse();
  }, [allRecords, selectedSupplier]);

  if (!hasPermission('view_suppliers')) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500">
        <Truck size={64} className="mb-4 opacity-20" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-sm mt-2">သင့်တွင် Supplier စာရင်း ကြည့်ရှုခွင့် မရှိပါ။</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-20">
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#0d1120] border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-slate-500 font-bold uppercase">Suppliers</p>
          <p className="text-2xl font-black text-white mt-1">{fmt(supplierStats.count)}</p>
        </div>
        <div className="bg-[#0d1120] border border-rose-500/15 rounded-2xl p-4">
          <p className="text-xs text-slate-500 font-bold uppercase">Total Payable</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{fmt(supplierStats.totalDebt)} Ks</p>
        </div>
        <div className="bg-[#0d1120] border border-amber-500/15 rounded-2xl p-4">
          <p className="text-xs text-slate-500 font-bold uppercase">Over Credit Limit</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{fmt(supplierStats.overLimit)}</p>
        </div>
      </div>

      {duplicateWarnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-200 flex items-start gap-3">
          <ShieldAlert size={22} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-black">Duplicate Supplier Warning</p>
            <p className="text-sm text-amber-100/80 mt-1">
              အမည်/ဖုန်းတူသော Supplier အုပ်စု {duplicateWarnings.length} ခု တွေ့ထားသည်။ Auto merge မလုပ်ပါ။ Admin မှ စစ်ပြီး manually ပြင်ပါ။
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-4 sm:p-6 rounded-3xl border border-rose-500/15 shadow-xl gap-5">
        <div className="flex items-center gap-4 bg-black/40 p-1.5 rounded-2xl border border-white/5 w-full md:w-auto">
          <button type="button" onClick={() => setActiveTab('book')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${activeTab === 'book' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
            <Truck size={18} /> Supplier Book
          </button>
          <button type="button" onClick={() => setActiveTab('history')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${activeTab === 'history' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
            <History size={18} /> Payment History
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:min-w-[220px]">
            <Search size={18} className="absolute left-4 top-3.5 text-slate-500" />
            <input type="text" placeholder="Search supplier..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-black/50 border border-rose-500/20 rounded-xl outline-none focus:border-rose-400 text-sm" />
          </div>
          {activeTab === 'book' && (
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <button type="button" onClick={handleExportCSV} className="bg-emerald-600/20 text-emerald-400 p-3 rounded-xl hover:bg-emerald-600/40 transition-colors" title="Export CSV"><Download size={20} /></button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="bg-amber-600/20 text-amber-400 p-3 rounded-xl hover:bg-amber-600/40 transition-colors" title="Import CSV"><Upload size={20} /></button>
                  <input type="file" accept=".csv,text/csv" ref={fileRef} onChange={handleImportCSV} className="hidden" />
                </>
              )}
              {hasPermission('manage_suppliers') && (
                <button type="button" onClick={() => openSupplierModal()} className="bg-rose-600 text-white px-5 py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-rose-500 transition-colors shadow-lg active:scale-95">
                  <Plus size={20} /> Add
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#0d1120] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
        {activeTab === 'book' ? (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/40 text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Supplier Info</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Contact</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Payable</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Limit</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-center w-44">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {visibleSuppliers.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-500">No Suppliers</td></tr>
                  ) : visibleSuppliers.map((supplier) => {
                    const debt = clampMoney(supplier.totalDebt);
                    const creditLimit = clampMoney(supplier.creditLimit);
                    const overLimit = creditLimit > 0 && debt > creditLimit;
                    return (
                      <tr key={supplier.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-white text-base flex items-center gap-2">
                            {supplier.name}
                            {overLimit && <AlertTriangle size={16} className="text-amber-400" />}
                          </p>
                          {supplier.note && <p className="text-xs text-slate-500 mt-1 truncate max-w-[260px]">{supplier.note}</p>}
                        </td>
                        <td className="p-4 text-slate-400"><p>{supplier.phone || '-'}</p><p className="text-xs text-slate-500 truncate max-w-[220px]">{supplier.address || '-'}</p></td>
                        <td className="p-4 text-right">{debt > 0 ? <span className="font-black text-rose-400 text-base">{fmt(debt)} Ks</span> : <span className="font-bold text-green-500 text-sm">ရှင်းပြီး</span>}</td>
                        <td className={`p-4 text-right font-bold ${overLimit ? 'text-amber-400' : 'text-slate-400'}`}>{creditLimit > 0 ? `${fmt(creditLimit)} Ks` : '-'}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button type="button" onClick={() => { setSelectedSupplier(supplier); setLedgerModalOpen(true); }} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-colors active:scale-95" title="Ledger"><ClipboardList size={16} /></button>
                            {hasPermission('create_purchase') && <button type="button" onClick={() => { setSelectedSupplier(supplier); setPaymentForm({ amount: '', note: '' }); setPaymentModalOpen(true); }} disabled={debt <= 0} className={`p-2 rounded-lg transition-colors ${debt > 0 ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 active:scale-95' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`} title="Pay supplier"><DollarSign size={16} /></button>}
                            {hasPermission('manage_suppliers') && <button type="button" onClick={() => openSupplierModal(supplier)} className="p-2 bg-slate-700/60 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors active:scale-95" title="Edit"><Edit3 size={16} /></button>}
                            {hasPermission('manage_suppliers') && <button type="button" onClick={() => handleDeleteSupplier(supplier)} className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 transition-colors active:scale-95" title="Delete"><Trash2 size={16} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden divide-y divide-white/5">
              {visibleSuppliers.length === 0 ? <div className="p-8 text-center text-slate-500">No Suppliers</div> : visibleSuppliers.map((supplier) => {
                const debt = clampMoney(supplier.totalDebt);
                const creditLimit = clampMoney(supplier.creditLimit);
                const overLimit = creditLimit > 0 && debt > creditLimit;
                const expanded = expandedSupp[supplier.id];
                return (
                  <div key={supplier.id} className="p-4">
                    <button type="button" onClick={() => setExpandedSupp((prev) => ({ ...prev, [supplier.id]: !prev[supplier.id] }))} className="w-full flex items-start justify-between gap-3 text-left">
                      <div>
                        <p className="font-black text-white flex items-center gap-2">{supplier.name}{overLimit && <AlertTriangle size={15} className="text-amber-400" />}</p>
                        <p className="text-xs text-slate-500 mt-1">{supplier.phone || 'No phone'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-rose-400 font-black">{fmt(debt)} Ks</p>
                        {expanded ? <ChevronUp size={16} className="ml-auto mt-1 text-slate-500" /> : <ChevronDown size={16} className="ml-auto mt-1 text-slate-500" />}
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-3 text-sm">
                        <p className="text-slate-400">Address: {supplier.address || '-'}</p>
                        <p className="text-slate-400">Credit Limit: {creditLimit > 0 ? `${fmt(creditLimit)} Ks` : '-'}</p>
                        {supplier.note && <p className="text-slate-400">Note: {supplier.note}</p>}
                        <div className="flex gap-2 pt-2">
                          <button type="button" onClick={() => { setSelectedSupplier(supplier); setLedgerModalOpen(true); }} className="flex-1 py-2 rounded-lg bg-blue-600/20 text-blue-400 font-bold">Ledger</button>
                          {hasPermission('create_purchase') && <button type="button" onClick={() => { setSelectedSupplier(supplier); setPaymentForm({ amount: '', note: '' }); setPaymentModalOpen(true); }} disabled={debt <= 0} className="flex-1 py-2 rounded-lg bg-amber-600/20 text-amber-400 font-bold disabled:opacity-40">Pay</button>}
                          {hasPermission('manage_suppliers') && <button type="button" onClick={() => openSupplierModal(supplier)} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200"><Edit3 size={16} /></button>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredSuppliers.length > visibleLimit && (
              <div className="p-4 border-t border-white/5 text-center">
                <button type="button" onClick={() => setVisibleLimit((prev) => prev + SUPPLIER_RENDER_PAGE_SIZE)} className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-300">Load More</button>
              </div>
            )}
          </>
        ) : (
          <div className="divide-y divide-white/5">
            {visibleHistory.length === 0 ? <div className="p-8 text-center text-slate-500">Payment history မရှိသေးပါ။</div> : visibleHistory.map((row) => {
              const expanded = expandedHist[row.supplierId || row.personName];
              return (
                <div key={row.supplierId || row.personName} className="p-4">
                  <button type="button" onClick={() => setExpandedHist((prev) => ({ ...prev, [row.supplierId || row.personName]: !expanded }))} className="w-full flex justify-between items-center gap-3 text-left">
                    <div><p className="font-black text-white">{row.personName}</p><p className="text-xs text-slate-500">{row.paymentCount} payments • Last: {row.lastPaymentDate}</p></div>
                    <div className="text-right"><p className="font-black text-green-400">{fmt(row.totalPaid)} Ks</p>{expanded ? <ChevronUp size={16} className="ml-auto text-slate-500" /> : <ChevronDown size={16} className="ml-auto text-slate-500" />}</div>
                  </button>
                  {expanded && (
                    <div className="mt-4 space-y-2">
                      {row.details.sort((a, b) => getDateMillis(b) - getDateMillis(a)).map((detail) => (
                        <div key={detail.id} className="bg-black/30 rounded-xl p-3 flex justify-between gap-3 text-sm">
                          <div><p className="text-slate-200 font-bold">{detail.note || 'Supplier Payment'}</p><p className="text-xs text-slate-500">{detail.date} {detail.time}</p></div>
                          <p className="text-green-400 font-black">{fmt(detail.amount)} Ks</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {mergedHistory.length > historyVisibleLimit && (
              <div className="p-4 text-center">
                <button type="button" onClick={() => setHistoryVisibleLimit((prev) => prev + SUPPLIER_RENDER_PAGE_SIZE)} className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-300">Load More</button>
              </div>
            )}
          </div>
        )}
      </div>

      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleSaveSupplier} className="bg-[#0d1120] border border-rose-500/30 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-rose-400">{editingSupplier ? 'Supplier ပြင်မည်' : 'Supplier အသစ်ထည့်မည်'}</h3>
              <button type="button" onClick={() => setSupplierModalOpen(false)} className="text-slate-400 hover:text-white p-1 bg-white/5 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">အမည် *</label><input required maxLength={MAX_SUPPLIER_NAME_LENGTH} value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className="w-full bg-black/50 border border-rose-500/20 rounded-xl p-3.5 text-white outline-none focus:border-rose-400 text-sm" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">ဖုန်းနံပါတ်</label><input type="tel" maxLength={MAX_PHONE_LENGTH} value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="w-full bg-black/50 border border-rose-500/20 rounded-xl p-3.5 text-white outline-none focus:border-rose-400 text-sm" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">Credit Limit</label><input type="number" min="0" inputMode="decimal" value={supplierForm.creditLimit} onChange={(e) => setSupplierForm({ ...supplierForm, creditLimit: e.target.value })} className="w-full bg-black/50 border border-rose-500/20 rounded-xl p-3.5 text-white outline-none focus:border-rose-400 text-sm" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">လိပ်စာ</label><textarea maxLength={MAX_ADDRESS_LENGTH} value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} className="w-full bg-black/50 border border-rose-500/20 rounded-xl p-3.5 text-white outline-none focus:border-rose-400 text-sm custom-scrollbar" rows="2" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">မှတ်ချက်</label><textarea maxLength={MAX_NOTE_LENGTH} value={supplierForm.note} onChange={(e) => setSupplierForm({ ...supplierForm, note: e.target.value })} className="w-full bg-black/50 border border-rose-500/20 rounded-xl p-3.5 text-white outline-none focus:border-rose-400 text-sm custom-scrollbar" rows="2" /></div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-8 bg-rose-600 text-white font-black py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-60">သိမ်းမည်</button>
          </form>
        </div>
      )}

      {isPaymentModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handlePayment} className="bg-[#0d1120] border border-amber-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-amber-400 tracking-wide">Supplier ငွေပေးချေမှု</h3><button type="button" onClick={() => setPaymentModalOpen(false)} className="text-slate-400 hover:text-white p-1 bg-white/5 rounded-full"><X size={20} /></button></div>
            <div className="bg-black/40 p-5 rounded-2xl mb-6 text-center border border-white/5 shadow-inner"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payable Balance</p><p className="text-3xl font-black text-rose-400 mt-2">{fmt(selectedSupplier.totalDebt)} <span className="text-sm">Ks</span></p></div>
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">ပေးချေမည့် ငွေပမာဏ *</label><input type="number" required min="1" max={clampMoney(selectedSupplier.totalDebt)} value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} inputMode="decimal" className="w-full bg-black/50 border border-amber-500/30 rounded-xl p-4 text-amber-400 text-[16px] sm:text-xl font-black outline-none focus:border-amber-400 text-center tracking-wider" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">မှတ်ချက်</label><input maxLength={MAX_NOTE_LENGTH} value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-amber-400 text-sm" /></div>
            </div>
            <button type="submit" disabled={loading || paymentSaving} className="w-full mt-8 bg-amber-600 text-white font-black py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-60">ငွေချေမည်</button>
          </form>
        </div>
      )}

      {isLedgerModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d1120] border border-blue-500/30 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 pb-4 border-b border-white/5 flex justify-between items-center bg-black/20 rounded-t-3xl">
              <div><h3 className="text-xl font-black text-blue-400 flex items-center gap-2"><ClipboardList size={20} /> {selectedSupplier.name}</h3><p className="text-xs text-slate-400 mt-1 font-bold tracking-wider">Current Debt: <span className="text-rose-400 text-sm">{fmt(selectedSupplier.totalDebt)} Ks</span></p></div>
              <button type="button" onClick={() => setLedgerModalOpen(false)} className="text-slate-400 hover:text-white bg-white/5 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-1 p-4 sm:p-6 bg-black/10">
              {currentLedger.length === 0 ? <div className="text-center py-10 opacity-50"><p className="text-slate-400 font-bold">မှတ်တမ်း မရှိသေးပါ။</p></div> : (
                <div className="space-y-3">
                  {currentLedger.map((record) => {
                    const isPurchase = record.type === 'Purchase';
                    const amount = isPurchase ? clampMoney(record.remainingDebt || record.amount) : clampMoney(record.amount);
                    return (
                      <div key={record.id} onClick={() => isPurchase && setReceiptModal({ show: true, record })} className={`bg-[#12182b] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors ${isPurchase ? 'cursor-pointer hover:border-cyan-500/50 hover:bg-[#1a2235]' : 'hover:border-blue-500/30'}`}>
                        <div>
                          <div className="flex items-center gap-2 mb-2"><span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${!isPurchase ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-rose-500/20 text-rose-400 border border-rose-500/20'}`}>{!isPurchase ? 'Payment Out' : 'Credit Purchase'}</span><span className="text-[11px] font-bold text-slate-500">{record.date} {record.time}</span></div>
                          {isPurchase ? <p className="text-sm font-bold text-cyan-300 flex items-center gap-1.5"><Receipt size={14} /> Invoice: {record.voucherNo || '-'}</p> : <p className="text-sm font-bold text-slate-200">{record.note || 'Supplier သို့ ငွေချေခြင်း'}</p>}
                          {isPurchase && <p className="text-[11px] font-bold text-slate-500 mt-1">Total Bill: {fmt(record.amount)} • Paid: {fmt(record.paidAmount)}</p>}
                        </div>
                        <div className="text-left sm:text-right pt-2 sm:pt-0 border-t border-white/5 sm:border-0 mt-2 sm:mt-0">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{!isPurchase ? 'Amount Paid' : 'Debt Added'}</p>
                          <p className={`text-lg font-black mt-0.5 ${!isPurchase ? 'text-green-400' : 'text-rose-400'}`}>{!isPurchase ? '-' : '+'}{fmt(amount)} <span className="text-xs">Ks</span></p>
                          <p className="text-[10px] text-slate-500 mt-1">Bal: {fmt(record.runningBalance)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {receiptModal.show && receiptModal.record && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-sm bg-white text-black rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar font-sans relative">
            <button type="button" onClick={() => setReceiptModal({ show: false, record: null })} className="absolute top-4 right-4 p-1 bg-gray-200 rounded-full text-gray-600 hover:bg-gray-300"><X size={20} /></button>
            <div className="text-center mb-4 mt-2"><h2 className="text-2xl font-black text-gray-800 uppercase tracking-wider">PURCHASE RECEIPT</h2></div>
            <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 text-[11px] font-semibold text-gray-600 space-y-1.5">
              <div className="flex justify-between"><span>Voucher No:</span> <span className="text-gray-900">{receiptModal.record.voucherNo || '-'}</span></div>
              <div className="flex justify-between"><span>Date:</span> <span className="text-gray-900">{receiptModal.record.date || '-'}</span></div>
              <div className="flex justify-between"><span>Supplier:</span> <span className="text-gray-900">{receiptModal.record.personName || '-'}</span></div>
            </div>
            <div className="mb-4">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-300 text-gray-500"><th className="text-left py-2">Item</th><th className="text-right py-2">Amount</th></tr></thead>
                <tbody>
                  {(receiptModal.record.itemsDetail || []).map((item, index) => (
                    <tr key={`${item.name || 'item'}-${index}`} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5"><div className="font-bold text-gray-800">{item.name || '-'}</div><div className="text-gray-500 text-[10px] mt-0.5">{fmt(item.quantity)} x {fmt(item.unitPrice)}</div></td>
                      <td className="py-2.5 text-right font-bold text-gray-800 align-top">{fmt((toSafeNumber(item.unitPrice) * toSafeNumber(item.quantity)) - toSafeNumber(item.itemDiscountAmt))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-300 pt-3 mt-3 space-y-1 text-xs">
              <div className="flex justify-between text-gray-600"><span>Total Bill:</span><span>{fmt(receiptModal.record.amount)} Ks</span></div>
              <div className="flex justify-between text-gray-600"><span>Paid:</span><span>{fmt(receiptModal.record.paidAmount)} Ks</span></div>
              <div className="flex justify-between text-rose-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5"><span>Credit Balance:</span><span>{fmt(receiptModal.record.remainingDebt)} Ks</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
