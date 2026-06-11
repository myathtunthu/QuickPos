import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../firebase/config';
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
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  DollarSign,
  Edit3,
  History,
  Plus,
  Receipt,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';

import ConfirmDialog from '../components/UI/ConfirmDialog';
import { showToast } from '../components/UI/Toast';

const CUSTOMER_FETCH_LIMIT = 500;
const RECORD_FETCH_LIMIT = 1000;
const CUSTOMER_RENDER_PAGE_SIZE = 50;
const MAX_CUSTOMER_DEBT = 999_999_999;
const MAX_PAYMENT_AMOUNT = 999_999_999;

const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin']);

const emptyCustomerForm = {
  name: '',
  phone: '',
  address: '',
  creditLimit: '',
  note: '',
};

const emptyPaymentForm = {
  amount: '',
  note: '',
};

const normalizeText = (value) => String(value ?? '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const toMoney = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.round(numberValue * 100) / 100);
};
const formatMoney = (value) => `${toMoney(value).toLocaleString()} Ks`;
const todayIsoDate = () => new Date().toISOString().split('T')[0];

const customerDuplicateKey = (customer) => [
  normalizeLower(customer?.name),
  normalizeText(customer?.phone),
].join('__');

const sanitizeCsvCell = (value) => {
  const raw = String(value ?? '').replace(/\r?\n|\r/g, ' ').trim();
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

const parseCsvLine = (line) => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const getRecordTimestamp = (record) => {
  if (record?.createdAt?.toMillis) return record.createdAt.toMillis();
  const fallback = new Date(`${record?.date || ''} ${record?.time || ''}`).getTime();
  return Number.isFinite(fallback) ? fallback : 0;
};

const getPaymentPersonKey = (record) => record.customerId || normalizeLower(record.personName);

export default function CustomersPage() {
  const { profile, hasPermission } = useAuth();
  const { t } = useLanguage();
  const tenantId = profile?.tenantId;
  const isAdmin = ADMIN_ROLES.has(profile?.role);

  const [activeTab, setActiveTab] = useState('book');
  const [customers, setCustomers] = useState([]);
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [creditSaleRecords, setCreditSaleRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(CUSTOMER_RENDER_PAGE_SIZE);
  const [historyVisibleLimit, setHistoryVisibleLimit] = useState(CUSTOMER_RENDER_PAGE_SIZE);

  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isLedgerModalOpen, setLedgerModalOpen] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const [expandedCust, setExpandedCust] = useState({});
  const [expandedHist, setExpandedHist] = useState({});
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const fileRef = useRef(null);

  const toggleCust = (id) => setExpandedCust((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleHist = (key) => setExpandedHist((prev) => ({ ...prev, [key]: !prev[key] }));

  const canManageCustomers = hasPermission('manage_customers');
  const canAcceptPayment = hasPermission('accept_payment');

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);

    try {
      // Keep Firestore queries index-free: tenantId equality only.
      // Payment/sale type filtering and date/name sorting are done client-side.
      const customerQuery = query(
        collection(db, 'pos_customers'),
        where('tenantId', '==', tenantId),
        limit(CUSTOMER_FETCH_LIMIT),
      );

      const recordQuery = query(
        collection(db, 'pos_records'),
        where('tenantId', '==', tenantId),
        limit(RECORD_FETCH_LIMIT),
      );

      const [customerSnap, recordSnap] = await Promise.all([
        getDocs(customerQuery),
        getDocs(recordQuery),
      ]);

      const customerData = customerSnap.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name)));

      const tenantRecords = recordSnap.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a));

      setCustomers(customerData);
      setPaymentRecords(tenantRecords.filter((record) => record.type === 'Customer Payment'));
      setCreditSaleRecords(
        tenantRecords.filter((record) => record.type === 'Sale' && toMoney(record.remainingDebt) > 0),
      );
    } catch (error) {
      console.error('Error fetching customer data:', error);
      showToast('Customer data ဖတ်ရာတွင် အမှားဖြစ်နေပါသည်။', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  useEffect(() => {
    setVisibleLimit(CUSTOMER_RENDER_PAGE_SIZE);
    setHistoryVisibleLimit(CUSTOMER_RENDER_PAGE_SIZE);
  }, [searchTerm, activeTab]);

  const duplicateCustomerWarnings = useMemo(() => {
    const groups = new Map();
    customers.forEach((customer) => {
      const key = customerDuplicateKey(customer);
      if (!normalizeText(customer.name)) return;
      groups.set(key, [...(groups.get(key) || []), customer]);
    });
    return Array.from(groups.values()).filter((group) => group.length > 1);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const search = normalizeLower(searchTerm);
    if (!search) return customers;
    return customers.filter((customer) => [
      customer.name,
      customer.phone,
      customer.address,
      customer.note,
    ].some((field) => normalizeLower(field).includes(search)));
  }, [customers, searchTerm]);

  const visibleCustomers = useMemo(
    () => filteredCustomers.slice(0, visibleLimit),
    [filteredCustomers, visibleLimit],
  );

  const mergedHistory = useMemo(() => {
    const merged = new Map();

    paymentRecords.forEach((payment) => {
      const key = getPaymentPersonKey(payment);
      if (!key) return;
      const existing = merged.get(key) || {
        key,
        customerId: payment.customerId,
        personName: payment.personName || 'Unknown Customer',
        totalPaid: 0,
        paymentCount: 0,
        lastPaymentDate: payment.date,
        details: [],
      };
      existing.totalPaid += toMoney(payment.amount);
      existing.paymentCount += 1;
      existing.details.push(payment);
      if (getRecordTimestamp(payment) > getRecordTimestamp({ date: existing.lastPaymentDate })) {
        existing.lastPaymentDate = payment.date;
      }
      merged.set(key, existing);
    });

    let history = Array.from(merged.values()).sort((a, b) => {
      const aLast = Math.max(...a.details.map(getRecordTimestamp));
      const bLast = Math.max(...b.details.map(getRecordTimestamp));
      return bLast - aLast;
    });

    const search = normalizeLower(searchTerm);
    if (search) history = history.filter((item) => normalizeLower(item.personName).includes(search));
    return history;
  }, [paymentRecords, searchTerm]);

  const visibleHistory = useMemo(
    () => mergedHistory.slice(0, historyVisibleLimit),
    [mergedHistory, historyVisibleLimit],
  );

  const currentLedger = useMemo(() => {
    if (!selectedCustomer) return [];
    const customerName = normalizeLower(selectedCustomer.name);
    const relevantSales = creditSaleRecords.filter((record) => (
      record.customerId === selectedCustomer.id || normalizeLower(record.personName) === customerName
    ));
    const relevantPayments = paymentRecords.filter((record) => (
      record.customerId === selectedCustomer.id || normalizeLower(record.personName) === customerName
    ));

    const records = [...relevantSales, ...relevantPayments]
      .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b));

    let runningBalance = 0;
    return records.map((record) => {
      if (record.type === 'Sale') runningBalance += toMoney(record.remainingDebt);
      if (record.type === 'Customer Payment') runningBalance -= toMoney(record.amount);
      return { ...record, runningBalance: Math.max(0, runningBalance) };
    }).reverse();
  }, [creditSaleRecords, paymentRecords, selectedCustomer]);

  const resetCustomerModal = () => {
    setEditingCustomer(null);
    setCustomerForm(emptyCustomerForm);
    setCustomerModalOpen(true);
  };

  const openEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      creditLimit: customer.creditLimit ?? '',
      note: customer.note || '',
    });
    setCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (event) => {
    event.preventDefault();
    if (!canManageCustomers) return showToast('လုပ်ပိုင်ခွင့် မရှိပါ။', 'error');
    if (!tenantId) return showToast('Tenant မတွေ့ပါ။ ပြန်ဝင်ပါ။', 'error');

    const name = normalizeText(customerForm.name);
    const phone = normalizeText(customerForm.phone);
    const address = normalizeText(customerForm.address);
    const note = normalizeText(customerForm.note);
    const creditLimit = customerForm.creditLimit === '' ? 0 : toMoney(customerForm.creditLimit);

    if (!name) return showToast('Customer အမည် ထည့်ပါ။', 'error');
    if (name.length > 120) return showToast('Customer အမည်သည် အလွန်ရှည်နေပါသည်။', 'error');
    if (phone.length > 40) return showToast('ဖုန်းနံပါတ် အလွန်ရှည်နေပါသည်။', 'error');
    if (creditLimit > MAX_CUSTOMER_DEBT) return showToast('Credit limit အလွန်များနေပါသည်။', 'error');

    setLoading(true);
    try {
      const duplicate = customers.find((customer) => (
        customer.id !== editingCustomer?.id && customerDuplicateKey(customer) === customerDuplicateKey({ name, phone })
      ));

      if (duplicate) {
        setLoading(false);
        return showToast('အမည်နှင့်ဖုန်း တူသော Customer ရှိပြီးသား ဖြစ်ပါသည်။', 'warning');
      }

      const payload = {
        tenantId,
        name,
        phone,
        address,
        note,
        creditLimit,
        updatedAt: serverTimestamp(),
      };

      if (editingCustomer?.id) {
        await setDoc(doc(db, 'pos_customers', editingCustomer.id), payload, { merge: true });
      } else {
        await addDoc(collection(db, 'pos_customers'), {
          ...payload,
          totalDebt: 0,
          createdAt: serverTimestamp(),
        });
      }

      setCustomerModalOpen(false);
      showToast('Customer စာရင်း သိမ်းပြီးပါပြီ။', 'success');
      await fetchData();
    } catch (error) {
      console.error('Error saving customer:', error);
      showToast('Customer သိမ်းရာတွင် အမှားဖြစ်နေပါသည်။', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = (customer) => {
    if (!canManageCustomers) return showToast('လုပ်ပိုင်ခွင့် မရှိပါ။', 'error');
    if (toMoney(customer.totalDebt) > 0) {
      return showToast(`${customer.name} တွင် ပေးရန်ကျန်ငွေရှိနေသဖြင့် ဖျက်၍မရပါ။`, 'error');
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Customer ဖျက်သိမ်းခြင်း',
      message: `"${customer.name}" ကို ဖျက်ရန် သေချာပါသလား?`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await deleteDoc(doc(db, 'pos_customers', customer.id));
          showToast('ဖျက်သိမ်းပြီးပါပြီ။', 'success');
          await fetchData();
        } catch (error) {
          console.error('Error deleting customer:', error);
          showToast('Customer ဖျက်ရာတွင် အမှားဖြစ်နေပါသည်။', 'error');
        }
      },
    });
  };

  const handlePayment = async (event) => {
    event.preventDefault();
    if (paymentSaving) return;
    if (!canAcceptPayment) return showToast('ငွေချေခွင့် မရှိပါ။', 'error');
    if (!tenantId) return showToast('Tenant မတွေ့ပါ။ ပြန်ဝင်ပါ။', 'error');
    if (!selectedCustomer?.id) return showToast('Customer မရွေးရသေးပါ။', 'error');

    const payAmount = toMoney(paymentForm.amount);
    const note = normalizeText(paymentForm.note) || 'အကြွေးလာဆပ်သည်';

    if (payAmount <= 0) return showToast('ငွေပမာဏ မှန်ကန်စွာထည့်ပါ။', 'error');
    if (payAmount > MAX_PAYMENT_AMOUNT) return showToast('ငွေပမာဏ အလွန်များနေပါသည်။', 'error');

    setPaymentSaving(true);
    setLoading(true);

    try {
      const customerRef = doc(db, 'pos_customers', selectedCustomer.id);
      const recordRef = doc(collection(db, 'pos_records'));
      const now = new Date();

      const paymentRecord = await runTransaction(db, async (transaction) => {
        const customerSnap = await transaction.get(customerRef);
        if (!customerSnap.exists()) throw new Error('CUSTOMER_NOT_FOUND');
        const liveCustomer = customerSnap.data();
        if (liveCustomer.tenantId !== tenantId) throw new Error('CUSTOMER_TENANT_MISMATCH');

        const liveDebt = toMoney(liveCustomer.totalDebt);
        if (liveDebt <= 0) throw new Error('NO_DEBT');
        if (payAmount > liveDebt) throw new Error('PAYMENT_EXCEEDS_DEBT');

        const nextDebt = toMoney(liveDebt - payAmount);
        const payload = {
          type: 'Customer Payment',
          tenantId,
          customerId: selectedCustomer.id,
          personName: liveCustomer.name || selectedCustomer.name || '',
          amount: payAmount,
          beforeDebt: liveDebt,
          afterDebt: nextDebt,
          note,
          date: todayIsoDate(),
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          cashier: profile?.username || profile?.name || profile?.email || 'Admin',
          createdAt: serverTimestamp(),
        };

        transaction.update(customerRef, { totalDebt: nextDebt, updatedAt: serverTimestamp() });
        transaction.set(recordRef, payload);
        return { id: recordRef.id, ...payload };
      });

      setCustomers((prev) => prev.map((customer) => (
        customer.id === selectedCustomer.id ? { ...customer, totalDebt: paymentRecord.afterDebt } : customer
      )));
      setPaymentRecords((prev) => [paymentRecord, ...prev]);
      setSelectedCustomer((prev) => (prev ? { ...prev, totalDebt: paymentRecord.afterDebt } : prev));
      setPaymentModalOpen(false);
      setPaymentForm(emptyPaymentForm);
      showToast('ငွေသွင်းမှတ်တမ်း သိမ်းပြီးပါပြီ။', 'success');
      await fetchData();
    } catch (error) {
      console.error('Error saving payment:', error);
      const messageMap = {
        CUSTOMER_NOT_FOUND: 'Customer မတွေ့ပါ။',
        CUSTOMER_TENANT_MISMATCH: 'Customer tenant မကိုက်ညီပါ။',
        PAYMENT_EXCEEDS_DEBT: 'ဆပ်သည့်ငွေသည် လက်ရှိအကြွေးထက် များနေပါသည်။',
        NO_DEBT: 'လက်ရှိအကြွေး မရှိတော့ပါ။',
      };
      showToast(messageMap[error?.message] || 'ငွေသွင်းမှတ်တမ်း သိမ်းရာတွင် အမှားဖြစ်နေပါသည်။', 'error');
    } finally {
      setPaymentSaving(false);
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!isAdmin) return showToast('Admin/Owner လုပ်ပိုင်ခွင့်လိုအပ်ပါသည်။', 'error');
    if (customers.length === 0) return showToast('Export ထုတ်ရန် Customer မရှိပါ။', 'warning');

    const header = ['Name', 'Phone', 'Address', 'Credit Limit', 'Total Debt', 'Note'];
    const rows = customers.map((customer) => [
      customer.name || '',
      customer.phone || '',
      customer.address || '',
      customer.creditLimit || 0,
      customer.totalDebt || 0,
      customer.note || '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(sanitizeCsvCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Customers_${todayIsoDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV ဖိုင် ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ။', 'success');
  };

  const handleImportCSV = (event) => {
    if (!isAdmin) return showToast('Admin/Owner လုပ်ပိုင်ခွင့်လိုအပ်ပါသည်။', 'error');
    if (!tenantId) return showToast('Tenant မတွေ့ပါ။ ပြန်ဝင်ပါ။', 'error');

    const file = event.target.files?.[0];
    if (!file) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Customer CSV သွင်းခြင်း',
      message: 'Customer စာရင်းအသစ်များကို Database သို့ ထည့်သွင်းမှာ သေချာပါသလား?',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setLoading(true);

        try {
          const text = await file.text();
          const rows = text.split(/\r?\n/).filter((row) => row.trim());
          if (rows.length <= 1) {
            showToast('ဖိုင်ထဲတွင် ဒေတာမရှိပါ။', 'warning');
            return;
          }

          const existingKeys = new Set(customers.map(customerDuplicateKey));
          let batch = writeBatch(db);
          let imported = 0;
          let skipped = 0;

          for (let index = 1; index < rows.length; index += 1) {
            const [nameRaw, phoneRaw, addressRaw, creditLimitRaw, totalDebtRaw, noteRaw] = parseCsvLine(rows[index]);
            const name = normalizeText(nameRaw);
            const phone = normalizeText(phoneRaw);
            if (!name) {
              skipped += 1;
              continue;
            }

            const key = customerDuplicateKey({ name, phone });
            if (existingKeys.has(key)) {
              skipped += 1;
              continue;
            }
            existingKeys.add(key);

            const totalDebt = Math.min(toMoney(totalDebtRaw), MAX_CUSTOMER_DEBT);
            const creditLimit = Math.min(toMoney(creditLimitRaw), MAX_CUSTOMER_DEBT);
            const newRef = doc(collection(db, 'pos_customers'));
            batch.set(newRef, {
              tenantId,
              name,
              phone,
              address: normalizeText(addressRaw),
              note: normalizeText(noteRaw),
              creditLimit,
              totalDebt,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            imported += 1;

            if (imported % 400 === 0) {
              await batch.commit();
              batch = writeBatch(db);
            }
          }

          if (imported % 400 !== 0) await batch.commit();
          showToast(`${imported} ဦး ထည့်ပြီး၊ ${skipped} ဦး ကျော်ထားပါသည်။`, 'success');
          await fetchData();
        } catch (error) {
          console.error('Customer import error:', error);
          showToast('Import လုပ်ရာတွင် အမှားဖြစ်နေပါသည်။', 'error');
        } finally {
          setLoading(false);
          if (fileRef.current) fileRef.current.value = '';
        }
      },
    });
  };

  if (!hasPermission('view_customers')) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-slate-500">
        <Users size={64} className="mb-4 opacity-20" />
        <h2 className="text-xl font-bold">{t('accessDenied') || 'Access Denied'}</h2>
        <p className="mt-2 text-sm">သင့်တွင် Customer စာရင်း ကြည့်ရှုခွင့် မရှိပါ။</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-20 text-white sm:p-6">
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))} />

      <div className="flex flex-col items-center justify-between gap-5 rounded-3xl border border-cyan-500/15 bg-[#0d1120] p-4 shadow-xl sm:p-6 md:flex-row">
        <div className="flex w-full items-center gap-4 rounded-2xl border border-white/5 bg-black/40 p-1.5 md:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('book')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all md:flex-none ${activeTab === 'book' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
          >
            <Users size={18} /> {t('customerBook')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all md:flex-none ${activeTab === 'history' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
          >
            <History size={18} /> {t('paymentHistory')}
          </button>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto sm:flex-row">
          <div className="relative flex-1 sm:min-w-[220px]">
            <Search size={18} className="absolute left-4 top-3.5 text-slate-500" />
            <input
              type="text"
              placeholder={t('searchCustomer') || 'Customer ရှာရန်...'}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-cyan-500/20 bg-black/50 py-3 pl-11 pr-4 text-sm outline-none focus:border-cyan-400"
            />
          </div>

          {activeTab === 'book' && (
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <button type="button" onClick={handleExportCSV} className="rounded-xl bg-emerald-600/20 p-3 text-emerald-400 transition-colors hover:bg-emerald-600/40" title="Export CSV"><Download size={20} /></button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl bg-amber-600/20 p-3 text-amber-400 transition-colors hover:bg-amber-600/40" title="Import CSV"><Upload size={20} /></button>
                  <input type="file" accept=".csv,text/csv" ref={fileRef} onChange={handleImportCSV} className="hidden" />
                </>
              )}
              {canManageCustomers && (
                <button type="button" onClick={resetCustomerModal} className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 font-bold text-white shadow-lg transition-colors hover:bg-cyan-500 active:scale-95"><Plus size={20} /> {t('add')}</button>
              )}
            </div>
          )}
        </div>
      </div>

      {duplicateCustomerWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
          Customer duplicate ဖြစ်နိုင်သော စာရင်း {duplicateCustomerWarnings.length} ခုရှိသည်။ Auto-merge မလုပ်တော့ပါ။ Admin မှ စစ်ပြီး manual ပြင်ပါ။
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#0d1120] shadow-xl">
        {activeTab === 'book' ? (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/5 bg-black/40 text-slate-400">
                  <tr>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider">{t('customerInfo')}</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider">{t('contact')}</th>
                    <th className="p-4 text-right text-xs font-bold uppercase tracking-wider">{t('creditLimit') || 'Credit Limit'}</th>
                    <th className="p-4 text-right text-xs font-bold uppercase tracking-wider">{t('creditBalance')}</th>
                    <th className="w-44 p-4 text-center text-xs font-bold uppercase tracking-wider">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCustomers.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-500">Customer မရှိသေးပါ။</td></tr>
                  ) : visibleCustomers.map((customer) => {
                    const debt = toMoney(customer.totalDebt);
                    const limitAmount = toMoney(customer.creditLimit);
                    const isOverLimit = limitAmount > 0 && debt > limitAmount;
                    return (
                      <tr key={customer.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="p-4">
                          <p className="text-base font-bold text-white">{customer.name}</p>
                          {customer.note && <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">{customer.note}</p>}
                        </td>
                        <td className="p-4 text-slate-400"><p>{customer.phone || '-'}</p><p className="max-w-[220px] truncate text-xs text-slate-500">{customer.address || '-'}</p></td>
                        <td className="p-4 text-right text-slate-300">{limitAmount > 0 ? formatMoney(limitAmount) : '-'}</td>
                        <td className="p-4 text-right">{debt > 0 ? <span className={`text-base font-black ${isOverLimit ? 'text-rose-400' : 'text-amber-400'}`}>{formatMoney(debt)}</span> : <span className="text-sm font-bold text-green-500">ရှင်းပြီး</span>}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button type="button" onClick={() => { setSelectedCustomer(customer); setLedgerModalOpen(true); }} className="rounded-lg bg-blue-600/20 p-2 text-blue-400 transition-colors hover:bg-blue-600/40" title="မှတ်တမ်းကြည့်မည်"><ClipboardList size={16} /></button>
                            {canAcceptPayment && (
                              <button type="button" onClick={() => { setSelectedCustomer(customer); setPaymentForm(emptyPaymentForm); setPaymentModalOpen(true); }} disabled={debt <= 0} className={`rounded-lg p-2 transition-colors ${debt > 0 ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40' : 'cursor-not-allowed bg-gray-800 text-gray-600'}`} title="အကြွေးဆပ်မည်"><DollarSign size={16} /></button>
                            )}
                            {canManageCustomers && (
                              <>
                                <button type="button" onClick={() => openEditCustomer(customer)} className="rounded-lg bg-indigo-600/20 p-2 text-indigo-400 transition-colors hover:bg-indigo-600/40" title="ပြင်မည်"><Edit3 size={16} /></button>
                                <button type="button" onClick={() => handleDeleteCustomer(customer)} className="rounded-lg bg-rose-600/20 p-2 text-rose-400 transition-colors hover:bg-rose-600/40" title="ဖျက်မည်"><Trash2 size={16} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="block divide-y divide-white/5 sm:hidden">
              {filteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">Customer မရှိသေးပါ။</div>
              ) : visibleCustomers.map((customer) => {
                const debt = toMoney(customer.totalDebt);
                const isExpanded = Boolean(expandedCust[customer.id]);
                return (
                  <div key={customer.id} className="p-4">
                    <button type="button" onClick={() => toggleCust(customer.id)} className="flex w-full items-start justify-between gap-3 text-left">
                      <div>
                        <p className="font-black text-white">{customer.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{customer.phone || '-'}</p>
                        <p className={`mt-2 text-sm font-black ${debt > 0 ? 'text-amber-400' : 'text-green-500'}`}>{debt > 0 ? formatMoney(debt) : 'ရှင်းပြီး'}</p>
                      </div>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {isExpanded && (
                      <div className="mt-4 space-y-3 rounded-2xl bg-black/30 p-3 text-sm">
                        <p className="text-slate-400">လိပ်စာ: {customer.address || '-'}</p>
                        <p className="text-slate-400">Credit Limit: {toMoney(customer.creditLimit) > 0 ? formatMoney(customer.creditLimit) : '-'}</p>
                        {customer.note && <p className="text-slate-400">မှတ်ချက်: {customer.note}</p>}
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button type="button" onClick={() => { setSelectedCustomer(customer); setLedgerModalOpen(true); }} className="rounded-lg bg-blue-600/20 px-3 py-2 text-xs font-bold text-blue-300">{t('ledger')}</button>
                          {canAcceptPayment && debt > 0 && <button type="button" onClick={() => { setSelectedCustomer(customer); setPaymentForm(emptyPaymentForm); setPaymentModalOpen(true); }} className="rounded-lg bg-amber-600/20 px-3 py-2 text-xs font-bold text-amber-300">{t('payment')}</button>}
                          {canManageCustomers && <button type="button" onClick={() => openEditCustomer(customer)} className="rounded-lg bg-indigo-600/20 px-3 py-2 text-xs font-bold text-indigo-300">{t('edit')}</button>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/5 bg-black/40 text-slate-400">
                <tr>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">{t('customer')}</th>
                  <th className="p-4 text-center text-xs font-bold uppercase tracking-wider">{t('times') || 'Times'}</th>
                  <th className="p-4 text-right text-xs font-bold uppercase tracking-wider">{t('totalPaidMerged')}</th>
                  <th className="p-4 text-right text-xs font-bold uppercase tracking-wider">{t('lastPayment')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {mergedHistory.length === 0 ? (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-500">ငွေသွင်းမှတ်တမ်း မရှိသေးပါ။</td></tr>
                ) : visibleHistory.map((history) => (
                  <React.Fragment key={history.key}>
                    <tr className="cursor-pointer transition-colors hover:bg-white/[0.02]" onClick={() => toggleHist(history.key)}>
                      <td className="p-4 text-base font-bold text-white">{history.personName}</td>
                      <td className="p-4 text-center font-bold text-cyan-400">{history.paymentCount} ကြိမ်</td>
                      <td className="p-4 text-right text-base font-black text-green-400">+{formatMoney(history.totalPaid)}</td>
                      <td className="p-4 text-right text-slate-400">{history.lastPaymentDate || '-'}</td>
                    </tr>
                    {expandedHist[history.key] && (
                      <tr>
                        <td colSpan="4" className="bg-black/20 p-4">
                          <div className="space-y-2">
                            {history.details.map((detail) => <div key={detail.id} className="flex justify-between rounded-xl bg-white/5 px-3 py-2 text-xs"><span>{detail.date} {detail.time}</span><span className="font-bold text-green-300">{formatMoney(detail.amount)}</span></div>)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeTab === 'book' && filteredCustomers.length > visibleCustomers.length && (
        <div className="flex justify-center"><button type="button" onClick={() => setVisibleLimit((prev) => prev + CUSTOMER_RENDER_PAGE_SIZE)} className="rounded-xl border border-cyan-500/20 bg-cyan-600/20 px-5 py-3 font-bold text-cyan-300 hover:bg-cyan-600/30">{t('loadMore') || 'Load More'} ({visibleCustomers.length}/{filteredCustomers.length})</button></div>
      )}

      {activeTab === 'history' && mergedHistory.length > visibleHistory.length && (
        <div className="flex justify-center"><button type="button" onClick={() => setHistoryVisibleLimit((prev) => prev + CUSTOMER_RENDER_PAGE_SIZE)} className="rounded-xl border border-purple-500/20 bg-purple-600/20 px-5 py-3 font-bold text-purple-300 hover:bg-purple-600/30">{t('loadMore') || 'Load More'} ({visibleHistory.length}/{mergedHistory.length})</button></div>
      )}

      {(customers.length >= CUSTOMER_FETCH_LIMIT || paymentRecords.length >= RECORD_FETCH_LIMIT || creditSaleRecords.length >= RECORD_FETCH_LIMIT) && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
          Data များလွန်းလို့ latest records ကို အကန့်အသတ်နဲ့သာ ဖော်ပြထားပါသည်။ နောက်အဆင့်တွင် server-side pagination/date filter ထည့်သင့်ပါသည်။
        </div>
      )}

      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveCustomer} className="w-full max-w-md rounded-3xl border border-cyan-500/30 bg-[#0d1120] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-black tracking-wide text-cyan-400">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
              <button type="button" onClick={() => setCustomerModalOpen(false)} className="rounded-full bg-white/5 p-1 text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="mb-1 ml-1 block text-xs font-bold text-slate-400">အမည် *</label><input required value={customerForm.name} onChange={(event) => setCustomerForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-xl border border-cyan-500/20 bg-black/50 p-3.5 text-sm text-white outline-none focus:border-cyan-400" /></div>
              <div><label className="mb-1 ml-1 block text-xs font-bold text-slate-400">ဖုန်းနံပါတ်</label><input type="tel" value={customerForm.phone} onChange={(event) => setCustomerForm((prev) => ({ ...prev, phone: event.target.value }))} className="w-full rounded-xl border border-cyan-500/20 bg-black/50 p-3.5 text-sm text-white outline-none focus:border-cyan-400" /></div>
              <div><label className="mb-1 ml-1 block text-xs font-bold text-slate-400">{t('creditLimit') || 'Credit Limit'}</label><input type="number" min="0" inputMode="decimal" value={customerForm.creditLimit} onChange={(event) => setCustomerForm((prev) => ({ ...prev, creditLimit: event.target.value }))} className="w-full rounded-xl border border-cyan-500/20 bg-black/50 p-3.5 text-sm text-white outline-none focus:border-cyan-400" placeholder="0 = limit မသတ်မှတ်" /></div>
              <div><label className="mb-1 ml-1 block text-xs font-bold text-slate-400">လိပ်စာ</label><textarea value={customerForm.address} onChange={(event) => setCustomerForm((prev) => ({ ...prev, address: event.target.value }))} className="custom-scrollbar w-full rounded-xl border border-cyan-500/20 bg-black/50 p-3.5 text-sm text-white outline-none focus:border-cyan-400" rows="2" /></div>
              <div><label className="mb-1 ml-1 block text-xs font-bold text-slate-400">မှတ်ချက်</label><textarea value={customerForm.note} onChange={(event) => setCustomerForm((prev) => ({ ...prev, note: event.target.value }))} className="custom-scrollbar w-full rounded-xl border border-cyan-500/20 bg-black/50 p-3.5 text-sm text-white outline-none focus:border-cyan-400" rows="2" /></div>
            </div>
            <button type="submit" disabled={loading} className="mt-8 w-full rounded-xl bg-cyan-600 py-3.5 font-black text-white transition-transform active:scale-95 disabled:opacity-50">သိမ်းမည်</button>
          </form>
        </div>
      )}

      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={handlePayment} className="w-full max-w-sm rounded-3xl border border-amber-500/30 bg-[#0d1120] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-black tracking-wide text-amber-400">ငွေသွင်းမှတ်တမ်း</h3>
              <button type="button" onClick={() => setPaymentModalOpen(false)} className="rounded-full bg-white/5 p-1 text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="mb-6 rounded-2xl border border-white/5 bg-black/40 p-5 text-center shadow-inner">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('creditBalance')}</p>
              <p className="mt-2 text-3xl font-black text-amber-400">{formatMoney(selectedCustomer.totalDebt)}</p>
            </div>
            <div className="space-y-4">
              <div><label className="mb-1 ml-1 block text-xs font-bold text-slate-400">ပေးသွင်းမည့် ငွေပမာဏ *</label><input type="number" required min="1" max={toMoney(selectedCustomer.totalDebt)} value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} inputMode="decimal" className="w-full rounded-xl border border-amber-500/30 bg-black/50 p-4 text-center text-[16px] font-black tracking-wider text-amber-400 outline-none focus:border-amber-400 sm:text-xl" /></div>
              <div><label className="mb-1 ml-1 block text-xs font-bold text-slate-400">မှတ်ချက်</label><input value={paymentForm.note} onChange={(event) => setPaymentForm((prev) => ({ ...prev, note: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/50 p-3.5 text-sm text-white outline-none focus:border-amber-400" /></div>
            </div>
            <button type="submit" disabled={loading || paymentSaving} className="mt-8 w-full rounded-xl bg-amber-600 py-4 font-black text-white transition-transform active:scale-95 disabled:opacity-50">ငွေသွင်းမည်</button>
          </form>
        </div>
      )}

      {isLedgerModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-blue-500/30 bg-[#0d1120] shadow-2xl">
            <div className="flex items-center justify-between rounded-t-3xl border-b border-white/5 bg-black/20 p-6 pb-4">
              <div><h3 className="flex items-center gap-2 text-xl font-black text-blue-400"><ClipboardList size={20} /> {selectedCustomer.name}</h3><p className="mt-1 text-xs font-bold tracking-wider text-slate-400">Current Debt: <span className="text-sm text-amber-400">{formatMoney(selectedCustomer.totalDebt)}</span></p></div>
              <button type="button" onClick={() => setLedgerModalOpen(false)} className="rounded-full bg-white/5 p-2 text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto bg-black/10 p-4 sm:p-6">
              {currentLedger.length === 0 ? (
                <div className="py-10 text-center opacity-50"><p className="font-bold text-slate-400">မှတ်တမ်း မရှိသေးပါ။</p></div>
              ) : (
                <div className="space-y-3">
                  {currentLedger.map((record) => {
                    const isSale = record.type === 'Sale';
                    return (
                      <div key={record.id} onClick={() => isSale && setReceiptModal({ show: true, record })} className={`flex flex-col justify-between gap-3 rounded-2xl border border-white/5 bg-[#12182b] p-4 transition-colors sm:flex-row sm:items-center ${isSale ? 'cursor-pointer hover:border-cyan-500/50 hover:bg-[#1a2235]' : 'hover:border-blue-500/30'}`}>
                        <div>
                          <div className="mb-2 flex items-center gap-2"><span className={`rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${!isSale ? 'border-green-500/20 bg-green-500/20 text-green-400' : 'border-amber-500/20 bg-amber-500/20 text-amber-400'}`}>{!isSale ? 'Payment In' : 'Credit Sale'}</span><span className="text-[11px] font-bold text-slate-500">{record.date} {record.time}</span></div>
                          {isSale ? <p className="flex items-center gap-1.5 text-sm font-bold text-cyan-300"><Receipt size={14} /> Invoice: {record.voucherNo || '-'}</p> : <p className="text-sm font-bold text-slate-200">{record.note || 'အကြွေးဆပ်ခြင်း'}</p>}
                          {isSale && <p className="mt-1 text-[11px] font-bold text-slate-500">Total Bill: {formatMoney(record.amount)} • Paid: {formatMoney(record.paidAmount)}</p>}
                        </div>
                        <div className="mt-2 border-t border-white/5 pt-2 text-left sm:mt-0 sm:border-0 sm:pt-0 sm:text-right">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{!isSale ? 'Amount Received' : 'Debt Added'}</p>
                          <p className={`mt-0.5 text-lg font-black ${!isSale ? 'text-green-400' : 'text-amber-400'}`}>{!isSale ? '-' : '+'}{formatMoney(!isSale ? record.amount : record.remainingDebt)}</p>
                          <p className="mt-1 text-[10px] text-slate-500">Bal: {formatMoney(record.runningBalance)}</p>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm print:hidden">
          <div className="custom-scrollbar relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-6 font-sans text-black shadow-2xl">
            <button type="button" onClick={() => setReceiptModal({ show: false, record: null })} className="absolute right-4 top-4 rounded-full bg-gray-200 p-1 text-gray-600 hover:bg-gray-300"><X size={20} /></button>
            <div className="mb-4 mt-2 text-center"><h2 className="text-2xl font-black uppercase tracking-wider text-gray-800">{t('receipt')}</h2></div>
            <div className="mb-4 space-y-1.5 border-y border-dashed border-gray-300 py-3 text-[11px] font-semibold text-gray-600">
              <div className="flex justify-between"><span>{t('voucherNo')}</span> <span className="text-gray-900">{receiptModal.record.voucherNo || '-'}</span></div>
              <div className="flex justify-between"><span>{t('date')}</span> <span className="text-gray-900">{receiptModal.record.date || '-'}</span></div>
              <div className="flex justify-between"><span>{t('customer')}</span> <span className="text-gray-900">{receiptModal.record.personName || '-'}</span></div>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-300 text-gray-500"><th className="py-2 text-left">{t('itemLabel')}</th><th className="py-2 text-right">{t('amountLabel')}</th></tr></thead>
              <tbody>
                {(receiptModal.record.itemsDetail || []).map((item, index) => {
                  const quantity = toMoney(item.quantity);
                  const unitPrice = toMoney(item.unitPrice || item.price);
                  const itemDiscount = toMoney(item.itemDiscountAmt);
                  return (
                    <tr key={`${item.name}-${index}`} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5"><div className="font-bold text-gray-800">{item.name || '-'}</div><div className="mt-0.5 text-[10px] text-gray-500">{quantity} x {formatMoney(unitPrice)}</div></td>
                      <td className="py-2.5 text-right align-top font-bold text-gray-800">{formatMoney((unitPrice * quantity) - itemDiscount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 border-t border-gray-300 pt-3 text-xs">
              <div className="flex justify-between text-gray-600"><span>{t('totalBill')}</span><span>{formatMoney(receiptModal.record.amount)}</span></div>
              <div className="flex justify-between text-gray-600"><span>{t('paidLabel')}</span><span>{formatMoney(receiptModal.record.paidAmount)}</span></div>
              <div className="mt-1.5 flex justify-between border-t border-gray-200 pt-1.5 font-bold text-red-600"><span>{t('creditStatus')}</span><span>{formatMoney(receiptModal.record.remainingDebt)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
