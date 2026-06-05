import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../hooks/useCart';
import useDebounce from '../hooks/useDebounce';
import {
  AlertTriangle,
  Calendar,
  Minus,
  RotateCcw,
  ScanLine,
  Search,
  Trash2,
  User,
  Zap,
} from 'lucide-react';

import ConfirmDialog from '../components/UI/ConfirmDialog';
import { showToast } from '../components/UI/Toast';
import logger from '../utils/logger';

import ProductSearch from '../components/entry/ProductSearch';
import ProductGrid from '../components/entry/ProductGrid';
import ProductDropdown from '../components/entry/ProductDropdown';
import ScannerModal from '../components/entry/ScannerModal';
import PromptModal from '../components/entry/PromptModal';
import ReceiptModal from '../components/entry/ReceiptModal';
import SidePanel from '../components/entry/EntrySidePanel';
import ReceiptContent from '../components/entry/ReceiptContent';
import {
  buildVoucherNo,
  canDo,
  cleanDisplayName,
  formatMoney,
  getDefaultUnit,
  getItemCostPrice,
  getProductName,
  getProductStock,
  getTimeNow,
  getTodayISO,
  isWalkInName,
  normalizePerson,
  safeTrim,
  toNumber,
  translate,
} from '../utils/entryHelpers';

export default function EntryPage({ products = [] }) {
  const { profile, hasPermission } = useAuth();
  const { t } = useLanguage();
  const tenantId = profile?.tenantId || null;
  const cashierName = cleanDisplayName(profile);

  const txt = useMemo(() => ({
    posNewSale: translate(t, 'posNewSale', 'POS / New Sale'),
    cashier: translate(t, 'cashier', 'Cashier'),
    sale: translate(t, 'sale', 'Sale'),
    purchase: translate(t, 'purchase', 'Purchase'),
    expense: translate(t, 'expense', 'Expense'),
    products: translate(t, 'products', 'Products'),
    lowStock: translate(t, 'lowStock', 'Low Stock'),
    cartItems: translate(t, 'cartItems', 'Cart Items'),
    total: translate(t, 'total', 'Total'),
    customer: translate(t, 'customer', 'Customer'),
    supplier: translate(t, 'supplier', 'Supplier'),
    quickFilters: translate(t, 'quickFilters', 'Quick Filters'),
    clear: translate(t, 'clear', 'Clear'),
    scan: translate(t, 'scan', 'Scan'),
    cartSummary: translate(t, 'cartSummary', 'Cart Summary'),
    subtotal: translate(t, 'subtotal', 'Subtotal'),
    invoiceDiscount: translate(t, 'invoiceDiscount', 'Invoice Discount'),
    appliedDiscount: translate(t, 'appliedDiscount', 'Applied Discount'),
    payment: translate(t, 'payment', 'Payment'),
    paid: translate(t, 'paid', 'Paid'),
    balance: translate(t, 'balance', 'Balance'),
    change: translate(t, 'change', 'Change'),
    receiptPreview: translate(t, 'receiptPreview', 'Receipt Preview'),
    print: translate(t, 'print', 'Print'),
    newTransaction: translate(t, 'newTransaction', 'New Transaction'),
    hold: translate(t, 'hold', 'Hold'),
    savedHoldBills: translate(t, 'savedHoldBills', 'Saved Hold Bills'),
    hide: translate(t, 'hide', 'Hide'),
    show: translate(t, 'show', 'Show'),
    restore: translate(t, 'restore', 'Restore'),
    saveExpense: translate(t, 'saveExpense', 'Save Expense'),
    saving: translate(t, 'saving', 'Saving...'),
    recordExpense: translate(t, 'recordExpense', 'Record Expense'),
    noProductFound: translate(t, 'noProductFound', 'Product not found'),
    searchOrCategory: translate(t, 'searchOrCategory', 'Check search or category again'),
    noCartItem: translate(t, 'noCartItem', 'No items in cart yet'),
    selectProductStart: translate(t, 'selectProductStart', 'Select products to start sale'),
  }), [t]);

  const canCreateSale = canDo(profile, hasPermission, 'create_sale');
  const canCreatePurchase = canDo(profile, hasPermission, 'create_purchase');
  const canCreateExpense = canDo(profile, hasPermission, 'create_expense');

  const [entryDate, setEntryDate] = useState(getTodayISO());
  const [entryTab, setEntryTab] = useState(canCreateSale ? 'Sale' : canCreatePurchase ? 'Purchase' : canCreateExpense ? 'Expense' : 'Sale');
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newPersonAddress, setNewPersonAddress] = useState('');
  const [shopSettings, setShopSettings] = useState({ shopName: profile?.shopName || profile?.businessName || 'Shop', phone: profile?.phone || '', address: profile?.address || '', logoUrl: profile?.logoUrl || '', footerText: 'Thank you for your business!', currencySymbol: 'Ks' });
  const [selCategory, setSelCategory] = useState('All');
  const [prodSearch, setProdSearch] = useState('');
  const debouncedSearch = useDebounce(prodSearch, 200);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmt, setExpenseAmt] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const [latestReceipt, setLatestReceipt] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [promptModal, setPromptModal] = useState({ isOpen: false, name: '' });

  const submitLock = useRef(false);
  const lastScrollPositionRef = useRef(0);
  const safeProducts = Array.isArray(products) ? products : [];

  const {
    cart,
    setCart,
    addToCart,
    removeCartItem,
    updateCartItemQty,
    updateCartItemUnit,
    updateCartItemPriceType,
    updateCartItemDiscount,
    updateCartItemPrice,
    clearCart,
    cartTotals,
    globalDiscountAmt,
    setGlobalDiscountAmt,
    globalDiscountType,
    setGlobalDiscountType,
  } = useCart(safeProducts, entryTab);

  const keepCurrentScrollPosition = useCallback(() => {
    const y = lastScrollPositionRef.current;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo({ top: y, left: 0, behavior: 'auto' })));
  }, []);

  const fetchDrafts = useCallback(async () => {
    if (!tenantId) return;
    try {
      const q = query(collection(db, 'pos_drafts'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'), limit(20));
      const snap = await getDocs(q);
      setDrafts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      logger.error('Error fetching drafts:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    setEntryTab(canCreateSale ? 'Sale' : canCreatePurchase ? 'Purchase' : canCreateExpense ? 'Expense' : 'Sale');
  }, [canCreateSale, canCreatePurchase, canCreateExpense]);

  useEffect(() => {
    if (!tenantId) return;

    const fetchAllData = async () => {
      try {
        const [settingsSnap, customerSnap, supplierSnap] = await Promise.all([
          getDoc(doc(db, 'pos_settings', tenantId)),
          getDocs(query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId))),
          getDocs(query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId))),
        ]);

        if (settingsSnap.exists()) {
          const settings = settingsSnap.data();
          setShopSettings({
            shopName: settings.shopName || settings.businessName || profile?.shopName || 'Shop',
            phone: settings.phone || settings.shopPhone || profile?.phone || '',
            address: settings.address || settings.shopAddress || profile?.address || '',
            logoUrl: settings.logoUrl || settings.logo || settings.shopLogo || profile?.logoUrl || '',
            footerText: settings.footerText || settings.receiptFooter || settings.invoiceFooterText || 'Thank you for your business!',
            currencySymbol: settings.currencySymbol || settings.currency || 'Ks',
          });
        }

        setCustomers(customerSnap.docs.map((d) => normalizePerson({ id: d.id, ...d.data() })));
        setSuppliers(supplierSnap.docs.map((d) => normalizePerson({ id: d.id, ...d.data() })));
      } catch (error) {
        logger.error('Entry initial data error:', error);
        showToast(`ဒေတာများရယူရာတွင် အမှားရှိနေပါသည်: ${error.message}`, 'error');
      }
    };

    fetchAllData();
    fetchDrafts();
  }, [tenantId, profile?.shopName, fetchDrafts]);

  useEffect(() => {
    setPersonSearch('');
    setSelectedPerson(null);
    setNewPersonPhone('');
    setNewPersonAddress('');
    setPaymentMethod('Cash');
    setPaidAmount('');
  }, [entryTab]);

  const personList = entryTab === 'Sale' ? customers : suppliers;
  const filteredPersons = useMemo(() => {
    const q = personSearch.toLowerCase().trim();
    if (!q) return personList.slice(0, 10);
    return personList.filter((person) => String(person.name || '').toLowerCase().includes(q) || String(person.phone || '').includes(q)).slice(0, 20);
  }, [personList, personSearch]);

  const categories = useMemo(() => ['All', ...new Set(safeProducts.map((p) => p.category).filter(Boolean))], [safeProducts]);
  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return safeProducts.filter((product) => {
      if (selCategory !== 'All' && product.category !== selCategory) return false;
      if (!q) return true;
      const nameMatch = getProductName(product).toLowerCase().includes(q);
      const skuMatch = String(product.sku || product.code || product.barcode || '').toLowerCase().includes(q);
      const unitMatch = product.packageUnits?.some((unit) => String(unit.barcode || '').toLowerCase().includes(q) || String(unit.barcodes?.retail || '').toLowerCase().includes(q) || String(unit.barcodes?.wholesale || '').toLowerCase().includes(q));
      return nameMatch || skuMatch || unitMatch;
    });
  }, [safeProducts, debouncedSearch, selCategory]);

  const barcodeMap = useMemo(() => {
    const map = new Map();
    safeProducts.forEach((product) => {
      const defaultUnit = getDefaultUnit(product);
      if (product.barcode) map.set(String(product.barcode).trim().toLowerCase(), { product, unit: defaultUnit });
      product.packageUnits?.forEach((unit) => {
        [unit.barcode, unit.barcodes?.retail, unit.barcodes?.wholesale].filter(Boolean).forEach((barcode) => map.set(String(barcode).trim().toLowerCase(), { product, unit }));
      });
    });
    return map;
  }, [safeProducts]);

  const summary = useMemo(() => {
    const total = toNumber(cartTotals.total);
    const paid = paidAmount === '' ? total : toNumber(paidAmount);
    return {
      total,
      itemCount: cart.reduce((sum, item) => sum + toNumber(item.quantity), 0),
      lowStockCount: safeProducts.filter((product) => getProductStock(product) <= toNumber(product.minStock ?? product.minStockAlert ?? 5)).length,
      productCount: safeProducts.length,
      balance: Math.max(0, total - paid),
    };
  }, [cart, cartTotals.total, paidAmount, safeProducts]);

  const handleSelectProduct = useCallback((product) => {
    lastScrollPositionRef.current = window.scrollY || window.pageYOffset || 0;
    const response = addToCart(product, getDefaultUnit(product), 'retail', 1);
    if (response?.success) {
      setProdSearch('');
      keepCurrentScrollPosition();
    } else {
      showToast(response?.message || 'ပစ္စည်းထည့်၍ မရပါ', 'error');
    }
  }, [addToCart, keepCurrentScrollPosition]);

  const handleBarcodeScanned = useCallback((text) => {
    const match = barcodeMap.get(String(text || '').trim().toLowerCase());
    if (!match) return showToast(`Barcode (${text}) ဖြင့် ပစ္စည်းရှာမတွေ့ပါ`, 'error');
    lastScrollPositionRef.current = window.scrollY || window.pageYOffset || 0;
    const response = addToCart(match.product, match.unit, 'retail', 1);
    if (response?.success) {
      keepCurrentScrollPosition();
    } else {
      showToast(response?.message || 'ပစ္စည်းထည့်၍ မရပါ', 'error');
    }
  }, [addToCart, barcodeMap, keepCurrentScrollPosition]);

  const handleTabChange = (tab) => {
    if (entryTab === tab) return;
    if (cart.length > 0) {
      setConfirmDialog({ isOpen: true, title: 'Tab ပြောင်းမည်', message: 'လက်ရှိ cart ကို ဖျက်ပြီး tab ပြောင်းမှာ သေချာပါသလား?', onConfirm: () => { clearCart(); setEntryTab(tab); setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null }); } });
      return;
    }
    clearCart();
    setEntryTab(tab);
  };

  const handleHoldInvoiceClick = () => {
    if (cart.length === 0) return;
    const invalidItem = cart.find((item) => item.quantity === '' || toNumber(item.quantity) <= 0);
    if (invalidItem) return showToast(`"${invalidItem.name}" ၏ Qty မှားနေပါသည်`, 'error');
    setPromptModal({ isOpen: true, name: personSearch || '' });
  };

  const executeHoldInvoice = async () => {
    const name = promptModal.name.trim();
    if (!name) return showToast('Hold Bill အမည်ထည့်ပါ', 'error');
    if (!tenantId) return showToast('Tenant မတွေ့ပါ', 'error');
    setLoading(true);
    try {
      const draftRef = doc(collection(db, 'pos_drafts'));
      await setDoc(draftRef, { tenantId, draftName: name, type: entryTab, cart, personSearch, selectedPerson, newPersonPhone, newPersonAddress, globalDiscountAmt, globalDiscountType, paymentMethod, paidAmount, cartTotals, createdAt: serverTimestamp(), createdAtLocal: Date.now() });
      clearCart();
      setPersonSearch('');
      setSelectedPerson(null);
      setPromptModal({ isOpen: false, name: '' });
      await fetchDrafts();
      showToast('ဘေလ်ကို Hold ထားပြီးပါပြီ', 'success');
    } catch (error) {
      logger.error('Error saving draft:', error);
      showToast(`Draft သိမ်းမရပါ: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const executeRestoreDraft = async (draft) => {
    try {
      clearCart();
      setEntryTab(draft.type || 'Sale');
      setPersonSearch(draft.personSearch || '');
      setSelectedPerson(draft.selectedPerson || null);
      setNewPersonPhone(draft.newPersonPhone || '');
      setNewPersonAddress(draft.newPersonAddress || '');
      setGlobalDiscountAmt(draft.globalDiscountAmt || '');
      setGlobalDiscountType(draft.globalDiscountType || '%');
      setPaymentMethod(draft.paymentMethod || 'Cash');
      setPaidAmount(draft.paidAmount || '');
      if (Array.isArray(draft.cart)) setCart(draft.cart.map((item) => ({ ...item, id: item.id || `${Date.now()}-${Math.random()}` })));
      await deleteDoc(doc(db, 'pos_drafts', draft.id));
      await fetchDrafts();
      setShowDrafts(false);
      showToast('Hold Bill ပြန်ယူပြီးပါပြီ', 'success');
    } catch (error) {
      logger.error('Restore draft error:', error);
      showToast(`Draft ပြန်ယူမရပါ: ${error.message}`, 'error');
    } finally {
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
    }
  };

  const restoreDraft = (draft) => {
    if (cart.length > 0) {
      setConfirmDialog({ isOpen: true, title: 'Draft ပြန်ယူမည်', message: 'လက်ရှိ cart ကို ဖျက်ပြီး Hold Bill ပြန်ယူမှာ သေချာပါသလား?', onConfirm: () => executeRestoreDraft(draft) });
      return;
    }
    executeRestoreDraft(draft);
  };

  const deleteDraft = (draftId) => setConfirmDialog({ isOpen: true, title: 'Draft ဖျက်မည်', message: 'ဒီ Hold Bill ကို ဖျက်မှာ သေချာပါသလား?', onConfirm: async () => { try { await deleteDoc(doc(db, 'pos_drafts', draftId)); await fetchDrafts(); showToast('Draft ဖျက်ပြီးပါပြီ', 'success'); } catch (error) { logger.error('Delete draft error:', error); showToast(`Draft ဖျက်မရပါ: ${error.message}`, 'error'); } finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null }); } } });

  const refreshPersons = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [customerSnap, supplierSnap] = await Promise.all([getDocs(query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId))), getDocs(query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId)))]);
      setCustomers(customerSnap.docs.map((d) => normalizePerson({ id: d.id, ...d.data() })));
      setSuppliers(supplierSnap.docs.map((d) => normalizePerson({ id: d.id, ...d.data() })));
    } catch (error) { logger.error('Refresh person error:', error); }
  }, [tenantId]);

  const submitExpense = async () => {
    if (submitLock.current || loading) return;
    const title = expenseTitle.trim();
    const amount = toNumber(expenseAmt);
    if (!tenantId) return showToast('Tenant မတွေ့ပါ', 'error');
    if (!title) return showToast('Expense title ထည့်ပါ', 'error');
    if (amount <= 0) return showToast('Expense amount မှန်မှန်ထည့်ပါ', 'error');
    submitLock.current = true; setLoading(true);
    try {
      const counterRef = doc(db, 'pos_counters', tenantId);
      const counterSnap = await getDoc(counterRef);
      const nextCount = (counterSnap.exists() ? toNumber(counterSnap.data().expenseCount) : 0) + 1;
      const voucherNo = buildVoucherNo('Expense', nextCount, entryDate);
      const batch = writeBatch(db);
      const recordRef = doc(collection(db, 'pos_records'));
      batch.set(recordRef, { id: recordRef.id, type: 'Expense', tenantId, item: title, amount, paidAmount: amount, paymentMethod: 'Cash', cashier: cashierName, cashierEmail: profile?.email || '', voucherNo, date: entryDate, time: getTimeNow(), createdAt: serverTimestamp(), createdAtLocal: Date.now() });
      batch.set(counterRef, { tenantId, expenseCount: increment(1), updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      setExpenseTitle(''); setExpenseAmt(''); showToast('Expense သိမ်းပြီးပါပြီ', 'success');
    } catch (error) { logger.error('Expense save error:', error); showToast(`Expense သိမ်းမရပါ: ${error.message}`, 'error'); }
    finally { submitLock.current = false; setLoading(false); }
  };

  const submitTransaction = async () => {
    if (submitLock.current || loading) return;
    if (!tenantId) return showToast('Tenant မတွေ့ပါ', 'error');
    if (cart.length === 0) return showToast('Cart ထဲမှာ ပစ္စည်းမရှိပါ', 'error');
    const invalidItem = cart.find((item) => item.quantity === '' || toNumber(item.quantity) <= 0);
    if (invalidItem) return showToast(`"${invalidItem.name}" ၏ Qty မှားနေပါသည်`, 'error');
    const total = toNumber(cartTotals.total);
    if (total <= 0) return showToast('Total amount မှားနေပါသည်', 'error');
    const paid = paymentMethod === 'Credit' ? 0 : paidAmount === '' ? total : toNumber(paidAmount);
    if (paid < 0) return showToast('Paid amount negative မဖြစ်ရပါ', 'error');
    const remainingDebt = Math.max(0, total - paid);
    const changeAmount = Math.max(0, paid - total);
    let personIdForRecord = selectedPerson?.id || null;
    let personNameForRecord = selectedPerson?.name || safeTrim(personSearch) || (entryTab === 'Sale' ? 'Walk-in' : 'Unknown Supplier');
    if (remainingDebt > 0 && isWalkInName(personNameForRecord, entryTab)) return showToast(`${entryTab === 'Sale' ? 'Customer' : 'Supplier'} အမည် ထည့်မှ Credit သုံးလို့ရပါမယ်`, 'error');

    submitLock.current = true; setLoading(true);
    try {
      let savedRecord = null;
      await runTransaction(db, async (transaction) => {
        const stockUpdates = [];
        for (const item of cart) {
          if (!item.productId) continue;
          const productRef = doc(db, 'pos_products', item.productId);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists()) throw new Error(`ပစ္စည်းရှာမတွေ့ပါ: ${item.name}`);
          const currentStock = getProductStock(productSnap.data());
          const qtyBase = toNumber(item.baseQuantity, toNumber(item.quantity, 1));
          if (entryTab === 'Sale' && qtyBase > currentStock) throw new Error(`"${item.name}" Stock မလုံလောက်ပါ။ လက်ကျန်: ${formatMoney(currentStock)}`);
          stockUpdates.push({ ref: productRef, nextStock: entryTab === 'Sale' ? currentStock - Math.abs(qtyBase) : currentStock + Math.abs(qtyBase) });
        }

        let personRef = null;
        let personSnap = null;
        if (personIdForRecord && remainingDebt > 0) {
          const collectionName = entryTab === 'Sale' ? 'pos_customers' : 'pos_suppliers';
          personRef = doc(db, collectionName, personIdForRecord);
          personSnap = await transaction.get(personRef);
        }

        const counterRef = doc(db, 'pos_counters', tenantId);
        const counterSnap = await transaction.get(counterRef);
        const countField = `${entryTab.toLowerCase()}Count`;
        const nextCount = (counterSnap.exists() ? toNumber(counterSnap.data()[countField]) : 0) + 1;

        if (!personIdForRecord && !isWalkInName(personNameForRecord, entryTab)) {
          const collectionName = entryTab === 'Sale' ? 'pos_customers' : 'pos_suppliers';
          const newPersonRef = doc(collection(db, collectionName));
          personIdForRecord = newPersonRef.id;
          transaction.set(newPersonRef, { tenantId, name: personNameForRecord, phone: safeTrim(newPersonPhone), address: safeTrim(newPersonAddress), totalDebt: remainingDebt, totalSales: entryTab === 'Sale' ? total : 0, totalPurchase: entryTab === 'Purchase' ? total : 0, totalPaid: paid, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        } else if (personRef && personSnap?.exists() && remainingDebt > 0) {
          transaction.update(personRef, { totalDebt: toNumber(personSnap.data().totalDebt) + remainingDebt, totalPaid: toNumber(personSnap.data().totalPaid) + paid, ...(entryTab === 'Sale' ? { totalSales: toNumber(personSnap.data().totalSales) + total } : { totalPurchase: toNumber(personSnap.data().totalPurchase) + total }), updatedAt: serverTimestamp() });
        }

        transaction.set(counterRef, { tenantId, [countField]: increment(1), updatedAt: serverTimestamp() }, { merge: true });

        const voucherNo = buildVoucherNo(entryTab, nextCount, entryDate);
        const recordRef = doc(collection(db, 'pos_records'));
        const itemsDetail = cart.map((item) => {
          const quantity = toNumber(item.quantity, 1);
          const unitPrice = toNumber(item.unitPrice);
          const itemDiscountAmt = toNumber(item.itemDiscountAmt);
          const costPrice = getItemCostPrice(item, safeProducts);
          const itemTotal = unitPrice * quantity - itemDiscountAmt;
          return { productId: item.productId || '', name: item.name || 'Unknown Item', quantity, unitName: item.unitName || 'ခု', multiplier: toNumber(item.multiplier, 1), baseQuantity: toNumber(item.baseQuantity, quantity), priceType: item.priceType || 'retail', unitPrice, costPrice, itemDiscountAmt, itemTotal, itemProfit: itemTotal - costPrice * quantity };
        });
        const totalCost = itemsDetail.reduce((sum, item) => sum + toNumber(item.costPrice) * toNumber(item.quantity), 0);
        const grossProfit = entryTab === 'Sale' ? total - totalCost : 0;
        const recordData = { id: recordRef.id, type: entryTab, tenantId, personName: personNameForRecord, customerId: entryTab === 'Sale' ? personIdForRecord : null, supplierId: entryTab === 'Purchase' ? personIdForRecord : null, cashier: cashierName, cashierEmail: profile?.email || '', voucherNo, invoiceNo: voucherNo, date: entryDate, time: getTimeNow(), itemsDetail, item: itemsDetail.length > 1 ? 'Multiple' : itemsDetail[0]?.name || 'Multiple', amount: total, subtotal: toNumber(cartTotals.subtotal), itemDiscount: toNumber(cartTotals.itemDiscounts), globalDiscount: toNumber(cartTotals.globalDisc), paymentMethod, paymentType: paymentMethod, paidAmount: paid, remainingDebt, changeAmount, totalCost, grossProfit, profit: grossProfit, status: remainingDebt > 0 ? 'Pending' : 'Completed', createdAt: serverTimestamp(), createdAtLocal: Date.now() };
        transaction.set(recordRef, recordData);
        stockUpdates.forEach((update) => transaction.update(update.ref, { stockBase: update.nextStock, stock: update.nextStock, updatedAt: serverTimestamp() }));
        const ledgerRef = doc(collection(db, 'pos_ledgers'));
        transaction.set(ledgerRef, { tenantId, recordId: recordRef.id, voucherNo, type: entryTab, personId: personIdForRecord || null, personName: personNameForRecord, total, paid, due: remainingDebt, paymentMethod, date: entryDate, time: recordData.time, createdAt: serverTimestamp(), createdAtLocal: Date.now() });
        if (paid > 0) {
          const paymentRef = doc(collection(db, 'pos_payments'));
          transaction.set(paymentRef, { tenantId, recordId: recordRef.id, voucherNo, type: entryTab === 'Sale' ? 'Customer Payment' : 'Supplier Payment', personId: personIdForRecord || null, personName: personNameForRecord, amount: paid, paymentMethod, cashier: cashierName, date: entryDate, time: recordData.time, createdAt: serverTimestamp(), createdAtLocal: Date.now() });
        }
        savedRecord = recordData;
      });
      setReceiptModal({ show: true, record: savedRecord });
      setLatestReceipt(savedRecord);
      clearCart(); setPersonSearch(''); setSelectedPerson(null); setNewPersonPhone(''); setNewPersonAddress(''); setPaidAmount(''); setPaymentMethod('Cash');
      await refreshPersons();
      showToast(`${entryTab} သိမ်းပြီးပါပြီ`, 'success');
    } catch (error) { logger.error('Transaction save error:', error); showToast(error.message || 'Transaction သိမ်းမရပါ', 'error'); }
    finally { submitLock.current = false; setLoading(false); }
  };

  const handlePrint = () => window.setTimeout(() => window.print(), 120);
  const personLabel = entryTab === 'Sale' ? txt.customer : txt.supplier;

  return (
    <>
      <ConfirmDialog isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })} />
      {promptModal.isOpen && <PromptModal value={promptModal.name} onChange={(name) => setPromptModal({ ...promptModal, name })} onCancel={() => setPromptModal({ isOpen: false, name: '' })} onSubmit={executeHoldInvoice} />}
      {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onScan={handleBarcodeScanned} />}
      {receiptModal.show && receiptModal.record && <ReceiptModal record={receiptModal.record} shopSettings={shopSettings} onClose={() => setReceiptModal({ show: false, record: null })} onPrint={handlePrint} txt={txt} />}

      <div className="min-h-screen bg-[#060816] text-white print:hidden">
        <div className="mx-auto max-w-[1600px] space-y-4 p-3 pb-32 sm:p-4 lg:p-6">
          <header className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-4 shadow-2xl shadow-cyan-950/20">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3"><div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-400"><Zap size={24} /></div><div><h1 className="text-xl font-black sm:text-2xl"><span className="text-white">{txt.posNewSale}</span></h1><p className="text-xs font-bold text-slate-500">{shopSettings.shopName || 'Shop'} • {txt.cashier}: {cashierName}</p></div></div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-black/30 px-3 py-2"><Calendar size={16} className="text-cyan-400" /><input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className="w-[130px] bg-transparent text-sm font-bold text-cyan-200 outline-none" style={{ colorScheme: 'dark' }} aria-label="Entry date" /></div>
                <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
                  {canCreateSale && <button type="button" onClick={() => handleTabChange('Sale')} className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${entryTab === 'Sale' ? 'bg-cyan-500 text-[#06111f]' : 'text-slate-400 hover:text-white'}`}>{txt.sale}</button>}
                  {canCreatePurchase && <button type="button" onClick={() => handleTabChange('Purchase')} className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${entryTab === 'Purchase' ? 'bg-cyan-500 text-[#06111f]' : 'text-slate-400 hover:text-white'}`}>{txt.purchase}</button>}
                  {canCreateExpense && <button type="button" onClick={() => handleTabChange('Expense')} className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${entryTab === 'Expense' ? 'bg-cyan-500 text-[#06111f]' : 'text-slate-400 hover:text-white'}`}>{txt.expense}</button>}
                </div>
              </div>
            </div>
          </header>

          {entryTab === 'Expense' ? (
            <section className="mx-auto max-w-2xl rounded-3xl border border-amber-500/20 bg-[#0d1120]/95 p-5 shadow-2xl shadow-amber-950/10">
              <div className="mb-5 flex items-center gap-3"><div className="rounded-2xl bg-amber-500/10 p-3 text-amber-400"><Minus size={22} /></div><div><h2 className="text-xl font-black text-white">{txt.recordExpense}</h2><p className="text-xs font-bold text-slate-500">နေ့စဉ် အသုံးစရိတ်များ မှတ်တမ်းတင်ရန်</p></div></div>
              <div className="space-y-3"><input value={expenseTitle} onChange={(event) => setExpenseTitle(event.target.value)} placeholder="Expense title (ဥပမာ - မီတာခ)" className="w-full rounded-2xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-400" /><input type="number" min="0" value={expenseAmt} onChange={(event) => { const value = event.target.value; if (value === '' || toNumber(value) >= 0) setExpenseAmt(value); }} placeholder="Amount (Ks)" className="w-full rounded-2xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-400" /><button type="button" onClick={submitExpense} disabled={loading} className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 font-black text-[#1b1203] shadow-lg shadow-amber-950/30 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95">{loading ? txt.saving : txt.saveExpense}</button></div>
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <main className="min-w-0 space-y-4">
                <section className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-3 shadow-2xl shadow-cyan-950/10 sm:p-4">
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3"><p className="text-[10px] font-black uppercase text-cyan-300">{txt.products}</p><p className="text-xl font-black text-white">{summary.productCount}</p></div><div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3"><p className="text-[10px] font-black uppercase text-rose-300">{txt.lowStock}</p><p className="text-xl font-black text-white">{summary.lowStockCount}</p></div><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3"><p className="text-[10px] font-black uppercase text-emerald-300">{txt.cartItems}</p><p className="text-xl font-black text-white">{summary.itemCount}</p></div><div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3"><p className="text-[10px] font-black uppercase text-violet-300">{txt.total}</p><p className="text-xl font-black text-white">{formatMoney(summary.total)}</p></div></div>
                  <div className="relative z-30"><div className="relative"><User className={`absolute left-3 top-1/2 -translate-y-1/2 ${selectedPerson ? 'text-emerald-400' : 'text-cyan-500'}`} size={16} /><input value={personSearch} onChange={(event) => { setPersonSearch(event.target.value); setSelectedPerson(null); setShowPersonDropdown(true); }} onFocus={() => setShowPersonDropdown(true)} onBlur={() => window.setTimeout(() => setShowPersonDropdown(false), 200)} placeholder={`${personLabel} အမည် ရှာရန် / အသစ်ထည့်ရန်`} className={`w-full rounded-2xl border bg-black/40 py-3 pl-10 pr-3 text-sm text-white outline-none ${selectedPerson ? 'border-emerald-500/40' : 'border-cyan-500/20 focus:border-cyan-400'}`} />{showPersonDropdown && personSearch.trim().length > 0 && filteredPersons.length > 0 && <div className="absolute left-0 top-full z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-cyan-500/30 bg-[#0b1220] shadow-2xl">{filteredPersons.map((person) => <button key={person.id} type="button" onMouseDown={() => { setSelectedPerson(person); setPersonSearch(person.name); setNewPersonPhone(''); setNewPersonAddress(''); setShowPersonDropdown(false); }} className="block w-full border-b border-white/5 px-4 py-3 text-left last:border-b-0 hover:bg-cyan-500/10"><p className="font-black text-white">{person.name}</p><p className="text-xs text-slate-400">{person.phone || 'No phone'} • Debt: {formatMoney(person.totalDebt)} Ks</p></button>)}</div>}</div>{!selectedPerson && personSearch.trim().length > 0 && !isWalkInName(personSearch, entryTab) && <div className="mt-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3"><p className="mb-2 text-xs font-bold text-emerald-300"><span className="text-white">"{personSearch}"</span> ကို {personLabel} အသစ်အဖြစ် သိမ်းမည်</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><input value={newPersonPhone} onChange={(event) => setNewPersonPhone(event.target.value)} placeholder="Phone" className="rounded-xl border border-emerald-500/20 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400" /><input value={newPersonAddress} onChange={(event) => setNewPersonAddress(event.target.value)} placeholder="Address" className="rounded-xl border border-emerald-500/20 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400" /></div></div>}</div>
                </section>

                <section className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-3 shadow-2xl shadow-cyan-950/10 sm:p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="flex items-center gap-2 font-black text-white"><Search size={18} className="text-cyan-400" />{txt.quickFilters}</h2><div className="flex gap-2"><button type="button" onClick={() => { setSelCategory('All'); setProdSearch(''); }} className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-black text-white active:scale-95">{txt.clear}</button><button type="button" onClick={() => setShowScanner(true)} aria-label="Open barcode scanner" className="flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-[#06111f] active:scale-95"><ScanLine size={16} /> {txt.scan}</button></div></div>
                  <ProductSearch categories={categories} selCategory={selCategory} setSelCategory={setSelCategory} prodSearch={prodSearch} setProdSearch={setProdSearch} setShowScanner={setShowScanner} />
                  <div className="relative z-10 mt-4">{debouncedSearch.length > 0 ? <ProductDropdown products={filteredProducts} onSelect={handleSelectProduct} isOpen /> : <ProductGrid products={filteredProducts} onSelect={handleSelectProduct} />}{filteredProducts.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center"><AlertTriangle className="mx-auto mb-2 text-slate-600" size={30} /><p className="font-bold text-slate-500">{txt.noProductFound}</p><p className="mt-1 text-xs text-slate-600">{txt.searchOrCategory}</p></div>}</div>
                </section>

                <div className="xl:hidden"><SidePanel txt={txt} cart={cart} products={safeProducts} entryTab={entryTab} cartTotals={cartTotals} globalDiscountAmt={globalDiscountAmt} setGlobalDiscountAmt={setGlobalDiscountAmt} globalDiscountType={globalDiscountType} setGlobalDiscountType={setGlobalDiscountType} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} paidAmount={paidAmount} setPaidAmount={setPaidAmount} submitTransaction={submitTransaction} loading={loading} handleHoldInvoiceClick={handleHoldInvoiceClick} receiptRecord={latestReceipt} shopSettings={shopSettings} onUpdateQty={updateCartItemQty} onUpdateUnit={updateCartItemUnit} onUpdatePriceType={updateCartItemPriceType} onUpdateDiscount={updateCartItemDiscount} onUpdatePrice={updateCartItemPrice} onRemove={removeCartItem} /></div>

                {canCreateSale && entryTab === 'Sale' && <section className="rounded-3xl border border-indigo-500/20 bg-[#0d1120]/95 p-3"><div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-black text-indigo-300"><RotateCcw size={16} /> {txt.savedHoldBills}</h2><button type="button" onClick={async () => { await fetchDrafts(); setShowDrafts((prev) => !prev); }} className="rounded-xl bg-indigo-500/10 px-3 py-2 text-xs font-black text-indigo-300">{showDrafts ? txt.hide : `${txt.show} (${drafts.length})`}</button></div>{showDrafts && <div className="max-h-64 space-y-2 overflow-y-auto">{drafts.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">Hold Bill မရှိပါ</p> : drafts.map((draft) => <div key={draft.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/30 p-3"><div className="min-w-0"><p className="truncate font-black text-white">{draft.draftName}</p><p className="text-xs text-slate-500">{draft.cart?.length || 0} items • {formatMoney(draft.cartTotals?.total)} Ks</p></div><div className="flex gap-2"><button type="button" onClick={() => restoreDraft(draft)} className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-[#06111f]">{txt.restore}</button><button type="button" onClick={() => deleteDraft(draft.id)} className="rounded-xl bg-rose-500/20 p-2 text-rose-300" aria-label="Delete draft"><Trash2 size={15} /></button></div></div>)}</div>}</section>}
              </main>

              <aside className="hidden xl:block"><SidePanel txt={txt} cart={cart} products={safeProducts} entryTab={entryTab} cartTotals={cartTotals} globalDiscountAmt={globalDiscountAmt} setGlobalDiscountAmt={setGlobalDiscountAmt} globalDiscountType={globalDiscountType} setGlobalDiscountType={setGlobalDiscountType} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} paidAmount={paidAmount} setPaidAmount={setPaidAmount} submitTransaction={submitTransaction} loading={loading} handleHoldInvoiceClick={handleHoldInvoiceClick} receiptRecord={latestReceipt} shopSettings={shopSettings} onUpdateQty={updateCartItemQty} onUpdateUnit={updateCartItemUnit} onUpdatePriceType={updateCartItemPriceType} onUpdateDiscount={updateCartItemDiscount} onUpdatePrice={updateCartItemPrice} onRemove={removeCartItem} /></aside>
            </div>
          )}
        </div>
      </div>

      {latestReceipt && <div id="receipt-print-area" className="hidden bg-white text-black print:block"><ReceiptContent record={latestReceipt} shopSettings={shopSettings} /></div>}

      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { width: 80mm !important; min-width: 80mm !important; margin: 0 auto !important; padding: 0 !important; background: #ffffff !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          #receipt-print-area, #receipt-print-area * { visibility: visible !important; }
          #receipt-print-area { display: block !important; position: absolute !important; left: 0 !important; right: 0 !important; top: 0 !important; width: 80mm !important; max-width: 80mm !important; margin: 0 auto !important; padding: 4mm !important; background: #ffffff !important; box-shadow: none !important; }
          #receipt-print-area table { width: 100% !important; }
        }
        @media screen { #receipt-print-area { display: none; } }
      `}</style>
    </>
  );
}
