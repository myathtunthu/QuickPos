import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  increment,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../hooks/useCart';
import useDebounce from '../hooks/useDebounce';
import {
  Calendar,
  User,
  ShoppingCart,
  PauseCircle,
  RotateCcw,
  X,
  Search,
  ScanLine,
  ReceiptText,
  Package,
  CreditCard,
  DollarSign,
  Wallet,
  Sparkles,
  Trash2,
  Boxes,
  Plus,
} from 'lucide-react';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { showToast } from '../components/UI/Toast';
import logger from '../utils/logger';

import ProductSearch from '../components/entry/ProductSearch';
import ProductGrid from '../components/entry/ProductGrid';
import ProductDropdown from '../components/entry/ProductDropdown';
import CartSection from '../components/entry/CartSection';
import PaymentSection from '../components/entry/PaymentSection';

import ScannerModal from '../components/entry/ScannerModal';
import PromptModal from '../components/entry/PromptModal';
import ReceiptPreview from '../components/entry/ReceiptPreview';
import ReceiptModal from '../components/entry/ReceiptModal';
import { cleanDisplayName, buildVoucherNo, getItemCostPrice, getProductStock, formatMoney } from '../utils/entryHelpers';

export default function EntryPage({ products = [] }) {
  const { profile, hasPermission } = useAuth();
  const { t } = useLanguage();
  const tenantId = profile?.tenantId;
  const cashierName = cleanDisplayName(profile);
  const tt = useCallback((key, fallback) => {
    const value = typeof t === 'function' ? t(key, fallback) : fallback;
    return value && value !== key ? value : fallback;
  }, [t]);

  const [shopSettings, setShopSettings] = useState({
    shopName: profile?.shopName || profile?.businessName || profile?.storeName || 'POS',
    phone: profile?.phone || '',
    address: profile?.address || '',
    logoUrl: '',
    receiptFooter: tt('receiptFooterDefault', 'Thank you for your business!'),
    currency: 'Ks',
    receiptWidth: '80mm',
  });

  const todayISO = new Date().toISOString().split('T')[0];

  const initialTab = hasPermission('create_sale')
    ? 'Sale'
    : hasPermission('create_purchase')
    ? 'Purchase'
    : hasPermission('create_expense')
    ? 'Expense'
    : 'Sale';

  const [entryDate, setEntryDate] = useState(todayISO);
  const [entryTab, setEntryTab] = useState(initialTab);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newPersonAddress, setNewPersonAddress] = useState('');
  const [selCategory, setSelCategory] = useState('All');
  const [prodSearch, setProdSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const debouncedSearch = useDebounce(prodSearch, 300);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmt, setExpenseAmt] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });
  const [promptModal, setPromptModal] = useState({ isOpen: false, name: '' });
  const submitLock = useRef(false);

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
  } = useCart(products, entryTab);

  const fetchDrafts = useCallback(async () => {
    if (!tenantId) return;

    try {
      const q = query(
        collection(db, 'pos_drafts'),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      setDrafts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      logger.error('Error fetching drafts:', err);
    }
  }, [tenantId]);

  const barcodeMap = useMemo(() => {
    const map = new Map();

    if (!Array.isArray(products)) return map;

    products.forEach((p) => {
      if (p.barcode) map.set(String(p.barcode).trim().toLowerCase(), { product: p, unit: p.packageUnits?.[0] });

      p.packageUnits?.forEach((u) => {
        if (u.barcode) map.set(String(u.barcode).trim().toLowerCase(), { product: p, unit: u });
        if (u.barcodes?.retail) {
          map.set(String(u.barcodes.retail).trim().toLowerCase(), { product: p, unit: u });
        }
        if (u.barcodes?.wholesale) {
          map.set(String(u.barcodes.wholesale).trim().toLowerCase(), { product: p, unit: u });
        }
      });
    });

    return map;
  }, [products]);

  useEffect(() => {
    if (!tenantId) return;

    const fetchAllData = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'pos_settings', tenantId));

        if (settingsSnap.exists()) {
          const sData = settingsSnap.data();
          setShopSettings({
            shopName:
              sData.shopName ||
              sData.businessName ||
              sData.storeName ||
              sData.name ||
              profile?.shopName ||
              profile?.businessName ||
              profile?.storeName ||
              'POS',
            phone: sData.phone || sData.shopPhone || sData.contactPhone || profile?.phone || '',
            address: sData.address || sData.shopAddress || sData.location || profile?.address || '',
            logoUrl: sData.logoUrl || sData.logo || sData.shopLogo || sData.logoURL || '',
            receiptFooter:
              sData.receiptFooter ||
              sData.invoiceFooterText ||
              sData.footerText ||
              sData.thankYouMessage ||
              tt('receiptFooterDefault', 'Thank you for your business!'),
            currency: sData.currencySymbol || sData.currency || 'Ks',
            receiptWidth: sData.receiptWidth || sData.printerWidth || '80mm',
          });
        }

        const custSnap = await getDocs(
          query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId))
        );
        setCustomers(custSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const suppSnap = await getDocs(
          query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId))
        );
        setSuppliers(suppSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        logger.error('Error fetching initial data:', err);
        showToast(tt('dataLoadError', 'Failed to load data.'), 'error');
      }
    };

    fetchAllData();
    fetchDrafts();
  }, [tenantId, profile, fetchDrafts]);

  useEffect(() => {
    setPersonSearch('');
    setSelectedPerson(null);
    setNewPersonPhone('');
    setNewPersonAddress('');
  }, [entryTab]);

  const personList = entryTab === 'Sale' ? customers : suppliers;

  const filteredPersons = useMemo(() => {
    const search = personSearch.toLowerCase();

    return personList.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const phone = String(p.phone || '');
      return name.includes(search) || phone.includes(personSearch);
    });
  }, [personList, personSearch]);

  const categories = useMemo(
    () => ['All', ...new Set(products.map((p) => p.category).filter(Boolean))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    let result = products;

    if (selCategory !== 'All') result = result.filter((p) => p.category === selCategory);

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((p) => {
        const hasBarcode = p.packageUnits?.some(
          (u) =>
            u.barcodes?.retail?.toLowerCase().includes(q) ||
            u.barcodes?.wholesale?.toLowerCase().includes(q) ||
            u.barcode?.toLowerCase().includes(q)
        );

        return String(p.name || '').toLowerCase().includes(q) || hasBarcode;
      });
    }

    return result;
  }, [products, debouncedSearch, selCategory]);

  const summary = useMemo(() => {
    const productCount = products.length;
    const lowStockCount = products.filter((p) => getProductStock(p) <= Number(p.minStock || 5)).length;
    const cartCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const total = Number(cartTotals.total || 0);
    const paid = paidAmount === '' ? total : Number(paidAmount) || 0;
    const balance = Math.max(0, total - paid);

    return { productCount, lowStockCount, cartCount, total, paid, balance };
  }, [products, cart, cartTotals.total, paidAmount]);


  const walkInName = tt('walkInCustomer', 'Walk-in Customer');
  const unknownSupplierName = tt('unknownSupplier', 'Unknown Supplier');

  const liveReceiptRecord = useMemo(() => {
    const total = Number(cartTotals.total) || 0;
    const paid = paidAmount === '' ? total : Number(paidAmount) || 0;
    const remainingDebt = Math.max(0, total - paid);
    const changeAmount = Math.max(0, paid - total);
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const itemsDetail = cart.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const itemDiscountAmt = Number(item.itemDiscountAmt) || 0;
      const itemTotal = unitPrice * quantity - itemDiscountAmt;

      return {
        name: item.name || tt('itemLabel', 'Item'),
        quantity,
        unitName: item.unitName || tt('defaultUnit', 'pcs'),
        unitPrice,
        itemDiscountAmt,
        itemTotal,
      };
    });

    return {
      type: entryTab,
      voucherNo: tt('previewVoucher', 'PREVIEW'),
      date: entryDate,
      time: currentTime,
      cashier: cashierName,
      personName: selectedPerson?.name || personSearch.trim() || (entryTab === 'Sale' ? walkInName : unknownSupplierName),
      itemsDetail,
      subtotal: Number(cartTotals.subtotal) || 0,
      itemDiscount: Number(cartTotals.itemDiscounts) || 0,
      globalDiscount: Number(cartTotals.globalDisc) || 0,
      amount: total,
      paymentMethod: paymentMethod || 'Cash',
      paidAmount: paid,
      remainingDebt,
      changeAmount,
    };
  }, [cart, cartTotals, paidAmount, paymentMethod, entryTab, entryDate, cashierName, selectedPerson, personSearch, tt, walkInName, unknownSupplierName]);

  const handleSelectProduct = useCallback(
    (product) => {
      const defaultUnit =
        product.packageUnits?.find((u) => Number(u.multiplier) === 1) ||
        product.packageUnits?.[0] || {
          name: tt('defaultUnit', 'pcs'),
          multiplier: 1,
          prices: { retail: 0 },
        };

      const response = addToCart(product, defaultUnit, 'retail', 1);

      if (response.success) {
        setProdSearch('');
      } else {
        showToast(response.message, 'error');
      }
    },
    [addToCart]
  );

  const handleTabChange = (tab) => {
    if (cart.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: tt('tabChange', 'Change Tab'),
        message: tt('cartNotEmptyMsg', 'Cart has items. Clear cart and change tab?'),
        onConfirm: () => {
          setEntryTab(tab);
          clearCart();
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        },
      });
      return;
    }

    setEntryTab(tab);
    clearCart();
  };

  const handleHoldInvoiceClick = () => {
    if (cart.length === 0) return;

    if (cart.some((x) => x.quantity === '' || Number(x.quantity) <= 0)) {
      showToast(
        tt('qtyErrorMsg', 'Please check item quantities.'),
        'error'
      );
      return;
    }

    setPromptModal({ isOpen: true, name: personSearch || '' });
  };

  const executeHoldInvoice = async (name) => {
    if (!name.trim()) return;

    setLoading(true);

    try {
      const draftRef = doc(collection(db, 'pos_drafts'));
      const sanitizedCart = cart.map((item) => ({
        id: item.id,
        productId: item.productId || null,
        productSnapshot: products.find((p) => p.id === item.productId) || null,
        unitName: item.unitName || '',
        multiplier: Number(item.multiplier) || 1,
        priceType: item.priceType || 'retail',
        unitPrice: Number(item.unitPrice) || 0,
        quantity: Number(item.quantity) || 1,
        baseQuantity: Number(item.baseQuantity) || Number(item.quantity) || 1,
        itemDiscountAmt: Number(item.itemDiscountAmt) || 0,
        notes: item.notes || '',
      }));

      await setDoc(draftRef, {
        tenantId: tenantId || '',
        draftName: name || 'No Name',
        type: entryTab || 'Sale',
        cart: sanitizedCart,
        cartTotals: {
          subtotal: Number(cartTotals.subtotal) || 0,
          itemDiscounts: Number(cartTotals.itemDiscounts) || 0,
          globalDisc: Number(cartTotals.globalDisc) || 0,
          total: Number(cartTotals.total) || 0,
        },
        personSearch: personSearch || '',
        selectedPerson: selectedPerson || null,
        newPersonPhone: newPersonPhone || '',
        newPersonAddress: newPersonAddress || '',
        globalDiscountAmt: globalDiscountAmt || '',
        globalDiscountType: globalDiscountType || '%',
        paymentMethod: paymentMethod || 'Cash',
        paidAmount: paidAmount || '',
        createdAt: serverTimestamp(),
      });

      showToast(tt('draftSavedSuccess', 'Draft saved successfully.'), 'success');
      clearCart();
      setPersonSearch('');
      setSelectedPerson(null);
      setNewPersonPhone('');
      setNewPersonAddress('');
      fetchDrafts();
    } catch (err) {
      logger.error('Error saving draft:', err);
      showToast(`${tt('draftSaveError', 'Error saving draft')}: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setPromptModal({ isOpen: false, name: '' });
    }
  };

  const executeRestoreDraft = async (draft) => {
    setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
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

    if (Array.isArray(draft.cart)) {
      setCart(draft.cart.map((item) => ({ ...item, id: item.id || Date.now() + Math.random() })));
    }

    try {
      await deleteDoc(doc(db, 'pos_drafts', draft.id));
      fetchDrafts();
      setShowDrafts(false);
      showToast(tt('draftRestoredSuccess', 'Draft restored successfully.'), 'success');
    } catch (err) {
      logger.error('Error restoring draft:', err);
    }
  };

  const restoreDraft = (draft) => {
    if (cart.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: tt('restoreDraftTitle', 'Restore Draft'),
        message: tt('restoreDraftMsg', 'Clear current cart and restore this draft?'),
        onConfirm: () => executeRestoreDraft(draft),
      });
      return;
    }

    executeRestoreDraft(draft);
  };

  const deleteDraft = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: tt('deleteDraftTitle', 'Delete Draft'),
      message: tt('deleteDraftMsg', 'Delete this draft?'),
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });

        try {
          await deleteDoc(doc(db, 'pos_drafts', id));
          fetchDrafts();
          showToast(tt('draftDeletedSuccess', 'Draft deleted successfully.'), 'success');
        } catch (err) {
          logger.error('Error deleting draft:', err);
        }
      },
    });
  };

  const submitExpense = async () => {
    if (submitLock.current) return;
    if (!expenseTitle || !expenseAmt || !tenantId) return;

    submitLock.current = true;
    setLoading(true);

    try {
      const counterRef = doc(db, 'pos_counters', tenantId || 'default');
      const counterSnap = await getDoc(counterRef);
      const nextCount = (counterSnap.exists() ? counterSnap.data().expenseCount || 0 : 0) + 1;
      const voucherNo = buildVoucherNo('Expense', nextCount, entryDate || todayISO);
      const batch = writeBatch(db);
      const ref = doc(collection(db, 'pos_records'));

      batch.set(ref, {
        type: 'Expense',
        tenantId,
        item: expenseTitle,
        amount: Number(expenseAmt) || 0,
        date: entryDate,
        time: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        cashier: cashierName,
        voucherNo,
        createdAt: serverTimestamp(),
      });

      if (counterSnap.exists()) {
        batch.set(counterRef, { expenseCount: increment(1), tenantId }, { merge: true });
      } else {
        batch.set(counterRef, { expenseCount: 1, tenantId });
      }

      await batch.commit();
      setExpenseTitle('');
      setExpenseAmt('');
      showToast(tt('expenseSavedSuccess', 'Expense saved successfully.'), 'success');
    } catch (err) {
      logger.error('Error saving expense:', err);
      showToast(tt('expenseSaveError', 'Error saving expense'), 'error');
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  const submitTransaction = async () => {
    if (submitLock.current) return;
    if (cart.length === 0 || !tenantId) return;

    const invalidItem = cart.find((item) => item.quantity === '' || Number(item.quantity) <= 0);

    if (invalidItem) {
      showToast(`${tt('invalidQuantityFor', 'Invalid quantity for')} "${invalidItem.name}"`, 'error');
      return;
    }

    const total = Number(cartTotals.total) || 0;
    const paid = paidAmount === '' ? total : Number(paidAmount) || 0;
    const remainingDebt = Math.max(0, total - paid);
    const changeAmount = Math.max(0, paid - total);

    let personIdForRecord = selectedPerson?.id || null;
    let personNameForRecord =
      selectedPerson?.name ||
      personSearch.trim() ||
      (entryTab === 'Sale' ? walkInName : unknownSupplierName);

    if (remainingDebt > 0 && personNameForRecord === (entryTab === 'Sale' ? walkInName : unknownSupplierName)) {
      showToast(
        tt('creditRequiresName', 'Credit transaction requires a customer/supplier name.'),
        'error'
      );
      return;
    }

    submitLock.current = true;
    setLoading(true);

    try {
      let receiptRecord = null;

      await runTransaction(db, async (transaction) => {
        const stockChecks = [];

        for (const item of cart) {
          if (!item.productId) continue;

          const prodRef = doc(db, 'pos_products', item.productId);
          const prodSnap = await transaction.get(prodRef);

          if (!prodSnap.exists()) throw new Error(`${tt('productNotFound', 'Product not found')}: ${item.name}`);

          const productData = prodSnap.data();
          const currentStockBase = Number(productData.stockBase ?? productData.stock ?? 0);
          const requiredQty = Number(item.baseQuantity) || Number(item.quantity) || 0;

          if (entryTab === 'Sale' && requiredQty > currentStockBase) {
            throw new Error(`${tt('stockNotEnough', 'Insufficient stock')}: ${item.name} (${tt('stockLabel', 'Stock')}: ${currentStockBase})`);
          }

          stockChecks.push({
            ref: prodRef,
            currentStockBase,
            change: entryTab === 'Sale' ? -Math.abs(requiredQty) : Math.abs(requiredQty),
          });
        }

        let personSnap = null;
        let personRef = null;

        if (personIdForRecord && remainingDebt > 0) {
          const collectionName = entryTab === 'Sale' ? 'pos_customers' : 'pos_suppliers';
          personRef = doc(db, collectionName, personIdForRecord);
          personSnap = await transaction.get(personRef);
        }

        const counterRef = doc(db, 'pos_counters', tenantId || 'default');
        const counterSnap = await transaction.get(counterRef);
        const countField = `${entryTab.toLowerCase()}Count`;
        const nextCount = counterSnap.exists() ? (Number(counterSnap.data()[countField]) || 0) + 1 : 1;

        if (personNameForRecord !== walkInName && personNameForRecord !== unknownSupplierName && !personIdForRecord) {
          const collectionName = entryTab === 'Sale' ? 'pos_customers' : 'pos_suppliers';
          const newPersonRef = doc(collection(db, collectionName));
          personIdForRecord = newPersonRef.id;

          transaction.set(newPersonRef, {
            tenantId,
            name: personNameForRecord,
            phone: newPersonPhone.trim(),
            address: newPersonAddress.trim(),
            totalDebt: remainingDebt,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (personRef && personSnap?.exists() && remainingDebt > 0) {
          const currentDebt = Number(personSnap.data().totalDebt) || 0;
          transaction.update(personRef, {
            totalDebt: currentDebt + remainingDebt,
            updatedAt: serverTimestamp(),
          });
        }

        if (counterSnap.exists()) {
          transaction.update(counterRef, {
            [countField]: nextCount,
            updatedAt: serverTimestamp(),
          });
        } else {
          transaction.set(counterRef, {
            tenantId,
            [countField]: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const voucherNo = buildVoucherNo(entryTab, nextCount, entryDate || todayISO);
        const recordRef = doc(collection(db, 'pos_records'));
        const currentTime = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        const itemsDetail = cart.map((i) => {
          const costPrice = getItemCostPrice(i, products);
          const quantity = Number(i.quantity) || 1;
          const unitPrice = Number(i.unitPrice) || 0;
          const itemDiscountAmt = Number(i.itemDiscountAmt) || 0;
          const itemTotal = unitPrice * quantity - itemDiscountAmt;
          const itemProfit = itemTotal - costPrice * quantity;

          return {
            productId: i.productId || '',
            name: i.name || tt('unknownItem', 'Unknown Item'),
            quantity,
            unitPrice,
            costPrice,
            itemDiscountAmt,
            unitName: i.unitName || tt('defaultUnit', 'pcs'),
            multiplier: Number(i.multiplier) || 1,
            priceType: i.priceType || 'retail',
            baseQuantity: Number(i.baseQuantity) || quantity,
            itemTotal,
            itemProfit,
          };
        });

        const totalCost = itemsDetail.reduce(
          (sum, item) => sum + (Number(item.costPrice) || 0) * (Number(item.quantity) || 0),
          0
        );
        const grossProfit = entryTab === 'Sale' ? total - totalCost : 0;

        const recordData = {
          id: recordRef.id,
          type: entryTab || 'Sale',
          tenantId,
          personName: personNameForRecord,
          customerId: entryTab === 'Sale' ? personIdForRecord : null,
          supplierId: entryTab === 'Purchase' ? personIdForRecord : null,
          cashier: cashierName,
          cashierEmail: profile?.email || '',
          time: currentTime,
          voucherNo,
          itemsDetail,
          item: itemsDetail.length > 1 ? tt('multipleItems', 'Multiple') : itemsDetail[0]?.name || tt('multipleItems', 'Multiple'),
          amount: total,
          subtotal: Number(cartTotals.subtotal) || 0,
          itemDiscount: Number(cartTotals.itemDiscounts) || 0,
          globalDiscount: Number(cartTotals.globalDisc) || 0,
          paymentMethod: paymentMethod || 'Cash',
          paidAmount: paid,
          remainingDebt,
          changeAmount,
          totalCost,
          grossProfit,
          profit: grossProfit,
          date: entryDate || todayISO,
          createdAt: serverTimestamp(),
          createdAtLocal: Date.now(),
        };

        transaction.set(recordRef, recordData);

        for (const update of stockChecks) {
          const nextStock = update.currentStockBase + update.change;
          transaction.update(update.ref, {
            stockBase: nextStock,
            stock: nextStock,
            updatedAt: serverTimestamp(),
          });
        }

        receiptRecord = recordData;
      });

      setReceiptModal({ show: true, record: receiptRecord });
      clearCart();
      setPersonSearch('');
      setSelectedPerson(null);
      setNewPersonPhone('');
      setNewPersonAddress('');
      setPaidAmount('');
      setPaymentMethod('Cash');

      const custSnap = await getDocs(query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId)));
      setCustomers(custSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const suppSnap = await getDocs(query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId)));
      setSuppliers(suppSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      showToast(`${tt(entryTab.toLowerCase(), entryTab)} ${tt('transactionSavedSuccess', 'saved successfully.')}`, 'success');
    } catch (err) {
      logger.error('Transaction Error: ', err);
      showToast(err.message || tt('transactionSaveError', 'Error saving transaction. Please check your connection and try again.'), 'error');
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  const printPageHeightMm = useMemo(() => {
    const itemCount = receiptModal.record?.itemsDetail?.length || 1;
    const hasDiscount = (receiptModal.record?.itemDiscount || 0) > 0 || (receiptModal.record?.globalDiscount || 0) > 0;
    const hasLogo = Boolean(shopSettings.logoUrl);
    const baseHeight = hasLogo ? 88 : 76;
    const itemHeight = itemCount * 11;
    const discountHeight = hasDiscount ? 8 : 0;
    return Math.min(260, Math.max(115, baseHeight + itemHeight + discountHeight));
  }, [receiptModal.record, shopSettings.logoUrl]);

  const doPrint = () => {
    requestAnimationFrame(() => {
      window.print();
    });
  };

  const handleBarcodeScanned = (text) => {
    const cleanText = text.trim().toLowerCase();
    const match = barcodeMap.get(cleanText);

    if (!match) {
      showToast(`${tt('barcodeNotFound', 'No product found for barcode')}: ${text}`, 'error');
      return;
    }

    const { product, unit } = match;
    const res = addToCart(product, unit, 'retail', 1);

    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      logger.warn('Audio beep failed', e);
    }
  };

  return (
    <>
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })}
      />

      <PromptModal promptModal={promptModal} setPromptModal={setPromptModal} executeHoldInvoice={executeHoldInvoice} />

      {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onScan={handleBarcodeScanned} />}

      <div className="relative min-h-screen bg-[#060816] text-white overflow-x-hidden print:hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-blue-500/10 blur-[120px]" />
          <div className="absolute -bottom-32 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-500/10 blur-[140px]" />
        </div>

        <div className="relative z-10 p-3 sm:p-5 pb-28 max-w-[1600px] mx-auto space-y-4">
          <div className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-4 sm:p-5 shadow-2xl shadow-black/30">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <ShoppingCart size={26} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black">
                    <span className="text-white">{shopSettings.shopName || 'POS'}</span>{' '}
                    <span className="text-cyan-400">{tt('posEntry', 'POS Entry')}</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-bold mt-1">
                    {tt('receiptUsesSettings', 'Shop receipt uses Settings logo/name/phone/address')} • {tt('cashierLabel', 'Cashier')}: <span className="text-cyan-300">{cashierName}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex gap-2">
                {hasPermission('create_sale') && (
                  <button
                    type="button"
                    onClick={() => handleTabChange('Sale')}
                    className={`px-4 py-2 rounded-2xl font-black text-xs transition-all ${
                      entryTab === 'Sale'
                        ? 'bg-cyan-500 text-[#060816] shadow-lg shadow-cyan-500/20'
                        : 'bg-black/30 border border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tt('sale', 'Sale')}
                  </button>
                )}
                {hasPermission('create_purchase') && (
                  <button
                    type="button"
                    onClick={() => handleTabChange('Purchase')}
                    className={`px-4 py-2 rounded-2xl font-black text-xs transition-all ${
                      entryTab === 'Purchase'
                        ? 'bg-cyan-500 text-[#060816] shadow-lg shadow-cyan-500/20'
                        : 'bg-black/30 border border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tt('purchase', 'Purchase')}
                  </button>
                )}
                {hasPermission('create_expense') && (
                  <button
                    type="button"
                    onClick={() => handleTabChange('Expense')}
                    className={`px-4 py-2 rounded-2xl font-black text-xs transition-all ${
                      entryTab === 'Expense'
                        ? 'bg-amber-500 text-[#060816] shadow-lg shadow-amber-500/20'
                        : 'bg-black/30 border border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tt('expense', 'Expense')}
                  </button>
                )}
                <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 bg-black/40 border border-cyan-500/20 rounded-2xl px-3 py-2">
                  <Calendar size={14} className="text-cyan-400" />
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-cyan-300 outline-none w-full sm:w-[120px]"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {entryTab === 'Expense' ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 bg-[#0d1120]/95 border border-amber-500/20 rounded-3xl p-5 space-y-4 shadow-xl">
                <h2 className="text-amber-400 font-black text-xl flex items-center gap-2">
                  <Wallet size={22} />
                  {tt('recordExpense', 'Record Expense')}
                </h2>
                <input
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder={tt('expenseTitlePlaceholder', 'Expense Title (e.g. electricity bill)')}
                  className="w-full bg-black/40 border border-amber-500/30 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-amber-400"
                />
                <input
                  type="number"
                  value={expenseAmt}
                  onChange={(e) => setExpenseAmt(e.target.value)}
                  placeholder={tt('expenseAmountPlaceholder', 'Amount (Ks)')}
                  className="w-full bg-black/40 border border-amber-500/30 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={submitExpense}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 font-black text-sm active:scale-95 transition-transform disabled:opacity-50"
                >
                  {loading ? tt('pleaseWait', 'Saving...') : tt('saveExpense', 'Save Expense')}
                </button>
              </div>
              <div className="bg-[#0d1120]/95 border border-white/5 rounded-3xl p-5">
                <h3 className="font-black text-slate-300 mb-3">{tt('dailySummary', 'Today Info')}</h3>
                <div className="space-y-3">
                  <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-slate-500 font-bold">{tt('voucher', 'Voucher')} Prefix</p>
                    <p className="text-amber-400 font-black">EXP</p>
                  </div>
                  <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-slate-500 font-bold">{tt('cashierLabel', 'Cashier')}</p>
                    <p className="text-white font-black">{cashierName}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-4 shadow-xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{tt('productsLabel', 'Products')}</p>
                  <p className="text-2xl font-black text-cyan-400 mt-1">{summary.productCount}</p>
                </div>
                <div className="rounded-3xl border border-violet-500/20 bg-[#0d1120]/95 p-4 shadow-xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{tt('cartQty', 'Cart Qty')}</p>
                  <p className="text-2xl font-black text-violet-400 mt-1">{summary.cartCount}</p>
                </div>
                <div className="rounded-3xl border border-amber-500/20 bg-[#0d1120]/95 p-4 shadow-xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{tt('lowStock', 'Low Stock')}</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">{summary.lowStockCount}</p>
                </div>
                <div className="rounded-3xl border border-emerald-500/20 bg-[#0d1120]/95 p-4 shadow-xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{tt('totalLabel', 'Total')}</p>
                  <p className="text-xl font-black text-emerald-400 mt-1">{formatMoney(summary.total)}</p>
                </div>
              </div>

              {entryTab === 'Sale' && hasPermission('create_sale') && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      await fetchDrafts();
                      setShowDrafts(!showDrafts);
                    }}
                    className="text-xs bg-indigo-500/10 text-indigo-300 px-4 py-2 rounded-2xl hover:bg-indigo-500/20 flex items-center gap-2 border border-indigo-500/20 font-black"
                  >
                    <RotateCcw size={14} />
                    {showDrafts ? tt('closeDrafts', 'Close Drafts') : `${tt('savedDrafts', 'Saved Drafts')} (${drafts.length})`}
                  </button>
                </div>
              )}

              {showDrafts && entryTab === 'Sale' && (
                <div className="bg-[#0d1120]/95 border border-indigo-500/20 rounded-3xl p-4 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  <h3 className="text-sm font-black text-indigo-400 mb-2">{tt('savedHoldInvoices', 'Saved Hold Invoices')}</h3>
                  {drafts.length === 0 && <p className="text-slate-500 text-xs">{tt('noSavedDrafts', 'No saved drafts.')}</p>}
                  {drafts.map((d) => (
                    <div
                      key={d.id}
                      className="flex justify-between items-center bg-black/30 p-3 rounded-2xl border border-white/5"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{d.draftName}</p>
                        <p className="text-[10px] text-slate-400">
                          {d.type} | {d.cart?.length || 0} {tt('items', 'items')} |{' '}
                          {d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : 'Loading...'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => restoreDraft(d)}
                          className="px-3 py-2 bg-cyan-600 rounded-xl text-xs font-bold text-white"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDraft(d.id)}
                          className="px-3 py-2 bg-rose-600 rounded-xl text-xs text-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
                <div className="space-y-4 min-w-0">
                  <div className="bg-[#0d1120]/95 border border-cyan-500/20 rounded-3xl p-4 shadow-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <User size={16} className="text-cyan-400" />
                      <h2 className="font-black text-sm text-slate-200">
                        {entryTab === 'Sale' ? 'Customer' : 'Supplier'}
                      </h2>
                    </div>

                    <div className="relative z-20 space-y-2">
                      <div className="relative">
                        <User
                          className={`absolute left-3 top-3.5 ${
                            selectedPerson ? 'text-green-400' : 'text-cyan-500'
                          }`}
                          size={16}
                        />
                        <input
                          value={personSearch}
                          onChange={(e) => {
                            setPersonSearch(e.target.value);
                            setSelectedPerson(null);
                            setShowPersonDropdown(true);
                          }}
                          onFocus={() => setShowPersonDropdown(true)}
                          onBlur={() => setTimeout(() => setShowPersonDropdown(false), 200)}
                          placeholder={
                            entryTab === 'Sale'
                              ? tt('customerSearchPlaceholder', 'Search customer or type new customer')
                              : tt('supplierSearchPlaceholder', 'Search supplier or type new supplier')
                          }
                          className={`w-full bg-black/40 border rounded-2xl pl-10 pr-3 py-3 text-xs text-white outline-none transition-colors ${
                            selectedPerson
                              ? 'border-green-500/50'
                              : 'border-cyan-500/20 focus:border-cyan-400'
                          }`}
                        />

                        {showPersonDropdown && personSearch.length > 0 && filteredPersons.length > 0 && (
                          <div className="absolute top-full left-0 mt-1 w-full bg-slate-950 border border-cyan-500/30 rounded-2xl shadow-xl max-h-56 overflow-y-auto custom-scrollbar z-50">
                            {filteredPersons.map((p) => (
                              <div
                                key={p.id}
                                onMouseDown={() => {
                                  setSelectedPerson(p);
                                  setPersonSearch(p.name);
                                  setShowPersonDropdown(false);
                                  setNewPersonPhone('');
                                  setNewPersonAddress('');
                                }}
                                className="px-4 py-3 hover:bg-cyan-600/30 cursor-pointer border-b border-white/5 last:border-0"
                              >
                                <p className="text-sm font-bold text-white">{p.name}</p>
                                {p.phone && <p className="text-[10px] text-cyan-400">{p.phone}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {!selectedPerson && personSearch.trim().length > 0 && (
                        <div className="p-3 bg-green-500/10 rounded-2xl border border-green-500/20 shadow-inner">
                          <p className="text-[11px] font-bold text-green-400 mb-2">
                            <span className="text-white">"{personSearch}"</span> {tt('saveAsNew', 'Will save as new')}
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              value={newPersonPhone}
                              onChange={(e) => setNewPersonPhone(e.target.value)}
                              placeholder={tt('phoneOptional', 'Phone (Optional)')}
                              className="w-full sm:w-1/2 bg-black/40 border border-green-500/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-green-400"
                            />
                            <input
                              value={newPersonAddress}
                              onChange={(e) => setNewPersonAddress(e.target.value)}
                              placeholder={tt('addressOptional', 'Address (Optional)')}
                              className="w-full sm:w-1/2 bg-black/40 border border-green-500/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-green-400"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#0d1120]/95 border border-cyan-500/20 rounded-3xl p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Boxes size={17} className="text-cyan-400" />
                        <h2 className="font-black text-sm text-slate-200">{tt('productsLabel', 'Products')}</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-black"
                      >
                        <ScanLine size={14} />
                        {tt('scanBarcode', 'Scan Barcode')}
                      </button>
                    </div>

                    <ProductSearch
                      categories={categories}
                      selCategory={selCategory}
                      setSelCategory={setSelCategory}
                      prodSearch={prodSearch}
                      setProdSearch={setProdSearch}
                      setShowScanner={setShowScanner}
                    />

                    <div className="relative z-10 mt-4">
                      {debouncedSearch.length > 0 ? (
                        <ProductDropdown products={filteredProducts} onSelect={handleSelectProduct} isOpen />
                      ) : (
                        <ProductGrid products={filteredProducts} onSelect={handleSelectProduct} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 xl:sticky xl:top-4">
                  <div className="bg-[#0d1120]/95 border border-cyan-500/20 rounded-3xl p-4 shadow-2xl shadow-cyan-950/20">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <ReceiptText size={18} className="text-cyan-400" />
                        <h2 className="text-sm font-black text-slate-200">{tt('currentOrder', 'Current Order')}</h2>
                      </div>

                      {entryTab === 'Sale' && (
                        <button
                          type="button"
                          onClick={handleHoldInvoiceClick}
                          disabled={cart.length === 0}
                          className={`text-[10px] px-3 py-2 rounded-xl font-bold transition-colors flex items-center gap-1 ${
                            cart.length === 0
                              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                              : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                          }`}
                        >
                          <PauseCircle size={12} />
                          {tt('hold', 'Hold')}
                        </button>
                      )}
                    </div>

                    <CartSection
                      cart={cart}
                      products={products}
                      onUpdateQty={updateCartItemQty}
                      onUpdateUnit={updateCartItemUnit}
                      onUpdatePriceType={updateCartItemPriceType}
                      onUpdateDiscount={updateCartItemDiscount}
                      onUpdatePrice={updateCartItemPrice}
                      onRemove={removeCartItem}
                    />

                    {cart.length > 0 ? (
                      <div className="mt-4 bg-black/50 border border-cyan-500/10 rounded-2xl p-4 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>{tt('subtotal', 'Subtotal')}</span>
                          <span>{formatMoney(cartTotals.subtotal)}</span>
                        </div>

                        {cartTotals.itemDiscounts > 0 && (
                          <div className="flex justify-between text-amber-400">
                            <span>{tt('itemDiscounts', 'Item Discounts')}</span>
                            <span>-{formatMoney(cartTotals.itemDiscounts)}</span>
                          </div>
                        )}

                        {entryTab === 'Sale' && (
                          <div className="flex justify-between items-center text-amber-400 border-t border-white/5 pt-2">
                            <span className="flex items-center gap-1">
                              {tt('invoiceDiscount', 'Invoice Discount')}
                              <select
                                value={globalDiscountType}
                                onChange={(e) => setGlobalDiscountType(e.target.value)}
                                className="bg-black/50 text-white rounded px-1 py-0.5 outline-none border border-amber-500/20"
                              >
                                <option value="%">%</option>
                                <option value="flat">Ks</option>
                              </select>
                            </span>
                            <input
                              type="number"
                              value={globalDiscountAmt}
                              onChange={(e) => setGlobalDiscountAmt(e.target.value)}
                              placeholder="0"
                              className="w-20 bg-black/50 border border-amber-500/30 rounded px-2 py-1 text-right outline-none focus:border-amber-400 text-amber-400"
                            />
                          </div>
                        )}

                        {cartTotals.globalDisc > 0 && (
                          <div className="flex justify-between text-amber-400">
                            <span>{tt('appliedDiscount', 'Applied Discount')}</span>
                            <span>-{formatMoney(cartTotals.globalDisc)}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-xl font-black text-cyan-300 border-t border-cyan-500/20 pt-3 mt-3">
                          <span>{tt('total', 'TOTAL')}</span>
                          <span>{formatMoney(cartTotals.total)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/10 rounded-2xl">
                        {tt('selectProductStart', 'Select product to start sale')}
                      </div>
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="bg-[#0d1120]/95 border border-emerald-500/20 rounded-3xl p-4 shadow-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard size={18} className="text-emerald-400" />
                        <h2 className="text-sm font-black text-slate-200">{tt('paymentMethod', 'Payment')}</h2>
                      </div>

                      <PaymentSection
                        paymentMethod={paymentMethod}
                        setPaymentMethod={setPaymentMethod}
                        paidAmount={paidAmount}
                        setPaidAmount={setPaidAmount}
                        submitTransaction={submitTransaction}
                        loading={loading}
                        entryTab={entryTab}
                      />
                    </div>
                  )}

                  <ReceiptPreview record={liveReceiptRecord} shopSettings={shopSettings} compact />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0d1120]/95 border border-emerald-500/20 rounded-3xl p-4">
                      <p className="text-[10px] text-slate-500 font-black uppercase">{tt('paidLabel', 'Paid')}</p>
                      <p className="text-lg font-black text-emerald-400">{formatMoney(summary.paid)}</p>
                    </div>
                    <div className="bg-[#0d1120]/95 border border-rose-500/20 rounded-3xl p-4">
                      <p className="text-[10px] text-slate-500 font-black uppercase">{tt('balance', 'Balance')}</p>
                      <p className="text-lg font-black text-rose-400">{formatMoney(summary.balance)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      <ReceiptModal
        receiptModal={receiptModal}
        setReceiptModal={setReceiptModal}
        shopSettings={shopSettings}
        doPrint={doPrint}
        printPageHeightMm={printPageHeightMm}
      />
    </>
  );
}
