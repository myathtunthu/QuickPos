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
  Printer,
  PauseCircle,
  RotateCcw,
  X,
  Search,
  ScanLine,
  Package,
  CreditCard,
  ReceiptText,
  DollarSign,
  Wallet,
  Sparkles,
  Trash2,
  Boxes,
  Plus,
} from 'lucide-react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

import ConfirmDialog from '../components/UI/ConfirmDialog';
import { showToast } from '../components/UI/Toast';
import logger from '../utils/logger';

import ProductSearch from '../components/entry/ProductSearch';
import ProductGrid from '../components/entry/ProductGrid';
import ProductDropdown from '../components/entry/ProductDropdown';
import CartSection from '../components/entry/CartSection';
import PaymentSection from '../components/entry/PaymentSection';

const cleanDisplayName = (profile) => {
  if (!profile) return 'Admin';

  const raw =
    profile.displayName ||
    profile.fullName ||
    profile.name ||
    profile.username ||
    profile.email ||
    'Admin';

  const clean = String(raw).trim();
  if (!clean) return 'Admin';

  return clean.includes('@') ? clean.split('@')[0] : clean;
};

const buildVoucherNo = (type = 'Sale', count = 1, dateISO = '') => {
  const safeType = String(type || 'Sale').toLowerCase();
  let prefix = 'INV';

  if (safeType === 'purchase') prefix = 'PUR';
  if (safeType === 'expense') prefix = 'EXP';

  const safeDate = String(dateISO || new Date().toISOString().split('T')[0]).replaceAll('-', '');
  const serial = String(Number(count) || 1).padStart(4, '0');

  return `${prefix}-${safeDate}-${serial}`;
};

const getItemCostPrice = (cartItem, products = []) => {
  const product = products.find((p) => p.id === cartItem?.productId);

  return (
    Number(
      cartItem?.costPrice ??
        cartItem?.cost ??
        product?.costPrice ??
        product?.packageUnits?.[0]?.costPrice ??
        product?.packages?.[0]?.costPrice ??
        0
    ) || 0
  );
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString()} Ks`;

const getProductStock = (product) => Number(product?.stockBase ?? product?.stock ?? 0) || 0;

const ScannerModal = ({ onClose, onScan }) => {
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const readerRef = useRef(null);
  const streamRef = useRef(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const lastScannedRef = useRef({ code: '', time: 0 });

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
    ]);

    const codeReader = new BrowserMultiFormatReader(hints);
    readerRef.current = codeReader;

    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        streamRef.current = stream;

        if (videoRef.current) videoRef.current.srcObject = stream;

        codeReader.decodeFromConstraints(constraints, videoRef.current, (result) => {
          if (!result) return;

          const now = Date.now();
          if (result.text === lastScannedRef.current.code && now - lastScannedRef.current.time < 1500) {
            return;
          }

          lastScannedRef.current = { code: result.text, time: now };
          setIsProcessing(true);

          if (onScanRef.current) onScanRef.current(result.text);

          setTimeout(() => setIsProcessing(false), 900);
        });
      })
      .catch((err) => {
        logger.error('Camera error:', err);
        setCameraError(true);
      });

    return () => {
      if (readerRef.current) readerRef.current.reset();
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-sm bg-[#0d1120] border border-cyan-500/30 rounded-3xl overflow-hidden relative shadow-2xl shadow-cyan-950/40">
        <div className="p-4 bg-cyan-500/10 flex justify-between items-center text-white border-b border-cyan-500/20">
          <h3 className="font-black flex items-center gap-2">
            <ScanLine size={18} className="text-cyan-400" />
            Barcode Scanner
          </h3>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="text-rose-400 hover:text-rose-300 font-black text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="relative bg-black">
          {cameraError ? (
            <div className="p-8 text-center text-rose-400 font-bold">
              Camera access denied or not available.
            </div>
          ) : (
            <video ref={videoRef} className="w-full h-auto min-h-[250px]" autoPlay playsInline muted />
          )}

          <div className="absolute inset-x-8 top-1/2 h-0.5 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.9)]" />

          {isProcessing && (
            <div className="absolute inset-0 bg-[#0d1120]/90 flex flex-col items-center justify-center z-10">
              <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-cyan-300 font-black text-base">ပစ္စည်းစာရင်းသွင်းနေပါသည်</p>
              <p className="text-sm font-bold text-slate-400 mt-1">ခဏစောင့်ပါ...</p>
            </div>
          )}
        </div>

        <div
          className={`p-4 text-center text-xs font-black transition-colors ${
            isProcessing ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {isProcessing
            ? 'စနစ်ထဲသို့ ထည့်သွင်းနေပါသည်...'
            : 'စကင်နာ ဖွင့်ထားဆဲဖြစ်သည် - ပစ္စည်းများ ဆက်တိုက်ဖတ်နိုင်ပါသည်'}
        </div>
      </div>
    </div>
  );
};

const ReceiptPreview = ({ record, shopSettings, title = 'Receipt Preview', compact = false }) => {
  const items = Array.isArray(record?.itemsDetail) ? record.itemsDetail : [];
  const hasLogo = Boolean(shopSettings?.logoUrl);
  const totalDiscount = Number(record?.itemDiscount || 0) + Number(record?.globalDiscount || 0);
  const isCredit = Number(record?.remainingDebt || 0) > 0;
  const footerText = shopSettings?.receiptFooter || 'Thank you for your business!';

  return (
    <div className="bg-[#0d1120]/95 border border-cyan-500/20 rounded-3xl p-4 shadow-xl shadow-cyan-950/20">
      <div className="flex items-center justify-between mb-3 print:hidden">
        <div className="flex items-center gap-2">
          <ReceiptText size={18} className="text-cyan-400" />
          <h2 className="text-sm font-black text-slate-200">{title}</h2>
        </div>
        <span className="text-[10px] font-black text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-1">
          LIVE
        </span>
      </div>

      <div className={`mx-auto bg-white text-black shadow-inner ${compact ? 'max-w-[280px]' : 'max-w-sm'} rounded-sm p-3 font-mono text-[10px] leading-tight`}>
        <div className="text-center mb-2">
          {hasLogo && (
            <img
              src={shopSettings.logoUrl}
              alt={shopSettings.shopName || 'Shop Logo'}
              className="h-9 w-auto mx-auto mb-1 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="font-black text-[13px] uppercase tracking-wide">{shopSettings?.shopName || 'POS'}</div>
          {shopSettings?.address && <div className="text-[9px] mt-0.5">{shopSettings.address}</div>}
          {shopSettings?.phone && <div className="text-[9px]">Tel: {shopSettings.phone}</div>}
        </div>

        <div className="border-t border-b border-dashed border-black py-2 space-y-1">
          <div className="flex justify-between gap-3"><span>Voucher:</span><b>{record?.voucherNo || 'PREVIEW'}</b></div>
          <div className="flex justify-between gap-3"><span>Date:</span><span>{record?.date || '-'}</span></div>
          <div className="flex justify-between gap-3"><span>Time:</span><span>{record?.time || '-'}</span></div>
          <div className="flex justify-between gap-3"><span>Cashier:</span><span>{record?.cashier || '-'}</span></div>
          <div className="flex justify-between gap-3"><span>{record?.type === 'Purchase' ? 'Supplier:' : 'Customer:'}</span><span className="text-right">{record?.personName || 'Walk-in'}</span></div>
        </div>

        <table className="w-full my-2 border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">Item</th>
              <th className="text-right py-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="2" className="py-5 text-center text-gray-400">No items</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={`${item.name || 'item'}-${index}`}>
                  <td className="py-1 align-top pr-2">
                    <div className="font-bold break-words">{item.name || 'Item'}</div>
                    <div className="text-[9px] text-gray-600">
                      {Number(item.quantity || 0)} {item.unitName || ''} x {Number(item.unitPrice || 0).toLocaleString()}
                      {Number(item.itemDiscountAmt || 0) > 0 && ` (-${Number(item.itemDiscountAmt || 0).toLocaleString()})`}
                    </div>
                  </td>
                  <td className="py-1 align-top text-right font-bold whitespace-nowrap">
                    {Number(item.itemTotal ?? (Number(item.unitPrice || 0) * Number(item.quantity || 0) - Number(item.itemDiscountAmt || 0))).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="border-t border-dashed border-black pt-2 space-y-1">
          <div className="flex justify-between"><span>Subtotal:</span><span>{Number(record?.subtotal || 0).toLocaleString()}</span></div>
          {totalDiscount > 0 && <div className="flex justify-between"><span>Discount:</span><span>-{totalDiscount.toLocaleString()}</span></div>}
        </div>

        <div className="flex justify-between border-t border-black pt-2 mt-2 text-[12px] font-black">
          <span>TOTAL:</span><span>{Number(record?.amount || 0).toLocaleString()}</span>
        </div>

        <div className="border-t border-black pt-2 mt-2 space-y-1">
          <div className="flex justify-between"><span>Paid ({record?.paymentMethod || 'Cash'}):</span><span>{Number(record?.paidAmount || 0).toLocaleString()}</span></div>
          {isCredit ? (
            <div className="flex justify-between font-bold"><span>Credit Balance:</span><span>{Number(record?.remainingDebt || 0).toLocaleString()}</span></div>
          ) : (
            <div className="flex justify-between font-bold"><span>Change:</span><span>{Number(record?.changeAmount || 0).toLocaleString()}</span></div>
          )}
        </div>

        <div className="text-center font-black mt-3">{isCredit ? '*** CREDIT ***' : '*** PAID ***'}</div>
        {footerText && <div className="text-center text-[9px] mt-1">{footerText}</div>}
      </div>
    </div>
  );
};

export default function EntryPage({ products = [] }) {
  const { profile, hasPermission } = useAuth();
  const { t } = useLanguage();
  const tx = useCallback((key, fallback) => {
    try {
      const value = t?.(key);
      return value && value !== key ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }, [t]);
  const tenantId = profile?.tenantId;
  const cashierName = cleanDisplayName(profile);

  const [shopSettings, setShopSettings] = useState({
    shopName: profile?.shopName || profile?.businessName || profile?.storeName || 'POS',
    phone: profile?.phone || '',
    address: profile?.address || '',
    logoUrl: '',
    receiptFooter: 'Thank you for your business!',
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
              'Thank you for your business!',
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
        showToast('ဒေတာများရယူရာတွင် အမှားအယွင်းရှိနေပါသည်', 'error');
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
        name: item.name || 'Item',
        quantity,
        unitName: item.unitName || 'ခု',
        unitPrice,
        itemDiscountAmt,
        itemTotal,
      };
    });

    return {
      type: entryTab,
      voucherNo: 'PREVIEW',
      date: entryDate,
      time: currentTime,
      cashier: cashierName,
      personName: selectedPerson?.name || personSearch.trim() || (entryTab === 'Sale' ? 'Walk-in' : 'Unknown Supplier'),
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
  }, [cart, cartTotals, paidAmount, paymentMethod, entryTab, entryDate, cashierName, selectedPerson, personSearch]);

  const handleSelectProduct = useCallback(
    (product) => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

      const defaultUnit =
        product.packageUnits?.find((u) => Number(u.multiplier) === 1) ||
        product.packageUnits?.[0] || {
          name: 'ခု',
          multiplier: 1,
          prices: { retail: 0 },
        };

      const response = addToCart(product, defaultUnit, 'retail', 1);

      if (response.success) {
        setProdSearch('');
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
        });
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
        title: 'Tab ပြောင်းလဲခြင်း',
        message: 'Cart ထဲတွင် ပစ္စည်းများရှိနေပါသည်။ ဖယ်ရှားပြီး Tab အသစ်သို့ကူးပြောင်းမည်မှာ သေချာပါသလား?',
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
        'အမှား: Cart ထဲရှိ ပစ္စည်းအရေအတွက်များအား သေချာစွာ ထည့်သွင်းပေးပါ။',
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

      showToast('ဘေလ်ကို ခဏဆိုင်းထားလိုက်ပါပြီ။', 'success');
      clearCart();
      setPersonSearch('');
      setSelectedPerson(null);
      setNewPersonPhone('');
      setNewPersonAddress('');
      fetchDrafts();
    } catch (err) {
      logger.error('Error saving draft:', err);
      showToast(`Error saving draft: ${err.message}`, 'error');
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
      showToast('ဘေလ်မှတ်တမ်းအား ပြန်လည်ရယူပြီးပါပြီ။', 'success');
    } catch (err) {
      logger.error('Error restoring draft:', err);
    }
  };

  const restoreDraft = (draft) => {
    if (cart.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'Draft ပြန်လည်ရယူခြင်း',
        message: 'လက်ရှိ cart ကို ဖျက်ပြီး draft ကို ပြန်ယူမှာ သေချာပါသလား?',
        onConfirm: () => executeRestoreDraft(draft),
      });
      return;
    }

    executeRestoreDraft(draft);
  };

  const deleteDraft = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Draft ဖျက်သိမ်းခြင်း',
      message: 'ဤ Draft အား ဖျက်မှာ သေချာပါသလား?',
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });

        try {
          await deleteDoc(doc(db, 'pos_drafts', id));
          fetchDrafts();
          showToast('Draft ဖျက်သိမ်းပြီးပါပြီ', 'success');
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
      showToast('Expense သိမ်းဆည်းပြီးပါပြီ!', 'success');
    } catch (err) {
      logger.error('Error saving expense:', err);
      showToast('Error saving expense', 'error');
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
      showToast(`အမှား: "${invalidItem.name}" ၏ အရေအတွက် မှားယွင်းနေပါသည်။`, 'error');
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
      (entryTab === 'Sale' ? 'Walk-in' : 'Unknown Supplier');

    if (remainingDebt > 0 && personNameForRecord === (entryTab === 'Sale' ? 'Walk-in' : 'Unknown Supplier')) {
      showToast(
        `အကြွေး (Credit) ဖြင့် ${entryTab === 'Sale' ? 'ရောင်းချပါက' : 'ဝယ်ယူပါက'} အမည်ကို မဖြစ်မနေ ထည့်သွင်းပေးပါ။`,
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

          if (!prodSnap.exists()) throw new Error(`ပစ္စည်းရှာမတွေ့ပါ: ${item.name}`);

          const productData = prodSnap.data();
          const currentStockBase = Number(productData.stockBase ?? productData.stock ?? 0);
          const requiredQty = Number(item.baseQuantity) || Number(item.quantity) || 0;

          if (entryTab === 'Sale' && requiredQty > currentStockBase) {
            throw new Error(`"${item.name}" အတွက် Stock မလုံလောက်ပါ။ လက်ကျန်: ${currentStockBase}`);
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

        if (personNameForRecord !== 'Walk-in' && personNameForRecord !== 'Unknown Supplier' && !personIdForRecord) {
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
            name: i.name || 'Unknown Item',
            quantity,
            unitPrice,
            costPrice,
            itemDiscountAmt,
            unitName: i.unitName || 'ခု',
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
          item: itemsDetail.length > 1 ? 'Multiple' : itemsDetail[0]?.name || 'Multiple',
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

      showToast(`${entryTab} သိမ်းဆည်းပြီးပါပြီ။`, 'success');
    } catch (err) {
      logger.error('Transaction Error: ', err);
      showToast(err.message || 'Error saving transaction! Please check your connection and try again.', 'error');
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  const doPrint = () => window.print();

  const handleBarcodeScanned = (text) => {
    const cleanText = text.trim().toLowerCase();
    const match = barcodeMap.get(cleanText);

    if (!match) {
      showToast(`Barcode (${text}) ဖြင့် ပစ္စည်းရှာမတွေ့ပါ။`, 'error');
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

      {promptModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:hidden">
          <div className="bg-[#0d1120] border-2 border-cyan-500/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl shadow-cyan-950/40">
            <h3 className="text-xl font-black text-cyan-400 mb-4">ခဏဆိုင်းထားမည့် ဘေလ်အမည်</h3>
            <input
              autoFocus
              value={promptModal.name}
              onChange={(e) => setPromptModal({ ...promptModal, name: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-cyan-500 mb-6"
              placeholder="ဥပမာ - စားပွဲ ၃"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => executeHoldInvoice(promptModal.name)}
                className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold"
              >
                သိမ်းမည်
              </button>
              <button
                type="button"
                onClick={() => setPromptModal({ isOpen: false, name: '' })}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold"
              >
                ပယ်ဖျက်မည်
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <span className="text-cyan-400">Entry</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-bold mt-1">
                    {tx('entryReceiptSettingsNote', 'Shop receipt uses Settings logo/name/phone/address')} • {tx('cashier', 'Cashier')}: <span className="text-cyan-300">{cashierName}</span>
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
                    Sale
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
                    Purchase
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
                    Expense
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
                  Record Expense
                </h2>
                <input
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="Expense Title (e.g. မီတာခ)"
                  className="w-full bg-black/40 border border-amber-500/30 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-amber-400"
                />
                <input
                  type="number"
                  value={expenseAmt}
                  onChange={(e) => setExpenseAmt(e.target.value)}
                  placeholder="Amount (Ks)"
                  className="w-full bg-black/40 border border-amber-500/30 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={submitExpense}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 font-black text-sm active:scale-95 transition-transform disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
              <div className="bg-[#0d1120]/95 border border-white/5 rounded-3xl p-5">
                <h3 className="font-black text-slate-300 mb-3">Today Info</h3>
                <div className="space-y-3">
                  <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-slate-500 font-bold">Voucher Prefix</p>
                    <p className="text-amber-400 font-black">EXP</p>
                  </div>
                  <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                    <p className="text-xs text-slate-500 font-bold">Cashier</p>
                    <p className="text-white font-black">{cashierName}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-4 shadow-xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{tx('products', 'Products')}</p>
                  <p className="text-2xl font-black text-cyan-400 mt-1">{summary.productCount}</p>
                </div>
                <div className="rounded-3xl border border-violet-500/20 bg-[#0d1120]/95 p-4 shadow-xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{tx('cartQty', 'Cart Qty')}</p>
                  <p className="text-2xl font-black text-violet-400 mt-1">{summary.cartCount}</p>
                </div>
                <div className="rounded-3xl border border-amber-500/20 bg-[#0d1120]/95 p-4 shadow-xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{tx('lowStock', 'Low Stock')}</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">{summary.lowStockCount}</p>
                </div>
                <div className="rounded-3xl border border-emerald-500/20 bg-[#0d1120]/95 p-4 shadow-xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{tx('total', 'Total')}</p>
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
                    {showDrafts ? 'Close Drafts' : `Saved Drafts (${drafts.length})`}
                  </button>
                </div>
              )}

              {showDrafts && entryTab === 'Sale' && (
                <div className="bg-[#0d1120]/95 border border-indigo-500/20 rounded-3xl p-4 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  <h3 className="text-sm font-black text-indigo-400 mb-2">Saved Hold Invoices</h3>
                  {drafts.length === 0 && <p className="text-slate-500 text-xs">No saved drafts.</p>}
                  {drafts.map((d) => (
                    <div
                      key={d.id}
                      className="flex justify-between items-center bg-black/30 p-3 rounded-2xl border border-white/5"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{d.draftName}</p>
                        <p className="text-[10px] text-slate-400">
                          {d.type} | {d.cart?.length || 0} items |{' '}
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
                              ? 'Customer အမည် ရှာဖွေပါ (သို့) အသစ်ရိုက်ထည့်ပါ'
                              : 'Supplier အမည် ရှာဖွေပါ (သို့) အသစ်ရိုက်ထည့်ပါ'
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
                            <span className="text-white">"{personSearch}"</span> အား စာရင်းအသစ်အဖြစ် မှတ်သားမည်
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              value={newPersonPhone}
                              onChange={(e) => setNewPersonPhone(e.target.value)}
                              placeholder="ဖုန်းနံပါတ်"
                              className="w-full sm:w-1/2 bg-black/40 border border-green-500/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-green-400"
                            />
                            <input
                              value={newPersonAddress}
                              onChange={(e) => setNewPersonAddress(e.target.value)}
                              placeholder="လိပ်စာ"
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
                        <h2 className="font-black text-sm text-slate-200">{tx('productBoard', 'Product Board')}</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-black"
                      >
                        <ScanLine size={14} />
                        Scan
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
                        <h2 className="text-sm font-black text-slate-200">{tx('currentOrder', 'Current Order')}</h2>
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
                          Hold
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
                          <span>Subtotal</span>
                          <span>{formatMoney(cartTotals.subtotal)}</span>
                        </div>

                        {cartTotals.itemDiscounts > 0 && (
                          <div className="flex justify-between text-amber-400">
                            <span>Item Discounts</span>
                            <span>-{formatMoney(cartTotals.itemDiscounts)}</span>
                          </div>
                        )}

                        {entryTab === 'Sale' && (
                          <div className="flex justify-between items-center text-amber-400 border-t border-white/5 pt-2">
                            <span className="flex items-center gap-1">
                              Invoice Discount
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
                            <span>Applied Discount</span>
                            <span>-{formatMoney(cartTotals.globalDisc)}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-xl font-black text-cyan-300 border-t border-cyan-500/20 pt-3 mt-3">
                          <span>TOTAL</span>
                          <span>{formatMoney(cartTotals.total)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/10 rounded-2xl">
                        Select product to start sale.
                      </div>
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="bg-[#0d1120]/95 border border-emerald-500/20 rounded-3xl p-4 shadow-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard size={18} className="text-emerald-400" />
                        <h2 className="text-sm font-black text-slate-200">{tx('payment', 'Payment')}</h2>
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
                      <p className="text-[10px] text-slate-500 font-black uppercase">Paid</p>
                      <p className="text-lg font-black text-emerald-400">{formatMoney(summary.paid)}</p>
                    </div>
                    <div className="bg-[#0d1120]/95 border border-rose-500/20 rounded-3xl p-4">
                      <p className="text-[10px] text-slate-500 font-black uppercase">Balance</p>
                      <p className="text-lg font-black text-rose-400">{formatMoney(summary.balance)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {receiptModal.show && receiptModal.record && (
            <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
              <div className="w-full max-w-sm bg-white text-black rounded-xl p-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar font-sans">
                <div className="text-center mb-4">
                  {shopSettings.logoUrl && (
                    <img
                      src={shopSettings.logoUrl}
                      alt={shopSettings.shopName}
                      className="h-16 w-auto mx-auto mb-2 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <h2 className="text-2xl font-black text-gray-800 uppercase tracking-wider">
                    {shopSettings.shopName}
                  </h2>
                  {shopSettings.address && <p className="text-xs text-gray-500 mt-1">{shopSettings.address}</p>}
                  {shopSettings.phone && <p className="text-xs text-gray-500">Tel: {shopSettings.phone}</p>}
                </div>

                <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 text-[11px] font-semibold text-gray-600 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Voucher No:</span>
                    <span className="text-gray-900">{receiptModal.record.voucherNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date & Time:</span>
                    <span className="text-gray-900">
                      {receiptModal.record.date} | {receiptModal.record.time}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span className="text-gray-900">{receiptModal.record.cashier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{receiptModal.record.type === 'Purchase' ? 'Supplier:' : 'Customer:'}</span>
                    <span className="text-gray-900">{receiptModal.record.personName}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-300 text-gray-500">
                        <th className="text-left py-2 font-bold uppercase tracking-wider">Description</th>
                        <th className="text-right py-2 font-bold uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiptModal.record.itemsDetail.map((item, i) => (
                        <tr key={`${item.name}-${i}`} className="border-b border-gray-100 last:border-0">
                          <td className="py-2.5">
                            <div className="font-bold text-gray-800">{item.name}</div>
                            <div className="text-gray-500 text-[10px] mt-0.5">
                              {item.quantity} {item.unitName} x {Number(item.unitPrice).toLocaleString()}
                              {item.itemDiscountAmt > 0 &&
                                ` (-${Number(item.itemDiscountAmt).toLocaleString()})`}
                            </div>
                          </td>
                          <td className="py-2.5 text-right font-bold text-gray-800 align-top">
                            {Number(item.unitPrice * item.quantity - (item.itemDiscountAmt || 0)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-dashed border-gray-300 pt-3 text-[11px] font-semibold text-gray-600 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="text-gray-900">{formatMoney(receiptModal.record.subtotal)}</span>
                  </div>

                  {(receiptModal.record.itemDiscount > 0 || receiptModal.record.globalDiscount > 0) && (
                    <div className="flex justify-between text-red-500">
                      <span>Discount:</span>
                      <span>
                        -{formatMoney(receiptModal.record.itemDiscount + receiptModal.record.globalDiscount)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-300 pt-3 mt-3 flex justify-between text-lg font-black text-gray-900">
                  <span>GRAND TOTAL</span>
                  <span>{formatMoney(receiptModal.record.amount)}</span>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mt-4 space-y-1.5 text-xs font-semibold text-gray-600 border border-gray-200">
                  <div className="flex justify-between">
                    <span>Paid ({receiptModal.record.paymentMethod}):</span>
                    <span className="text-gray-900">{formatMoney(receiptModal.record.paidAmount)}</span>
                  </div>

                  {receiptModal.record.remainingDebt > 0 ? (
                    <div className="flex justify-between text-red-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5">
                      <span>Credit Balance:</span>
                      <span>{formatMoney(receiptModal.record.remainingDebt)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-green-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5">
                      <span>Change:</span>
                      <span>{formatMoney(receiptModal.record.changeAmount)}</span>
                    </div>
                  )}
                </div>

                <div className="text-center mt-6 flex flex-col items-center gap-2">
                  <span
                    className={`font-black tracking-widest border-2 px-4 py-1 rounded-sm text-sm ${
                      receiptModal.record.remainingDebt > 0
                        ? 'text-red-500 border-red-500'
                        : 'text-green-500 border-green-500'
                    }`}
                  >
                    {receiptModal.record.remainingDebt > 0 ? 'CREDIT' : 'PAID'}
                  </span>
                  {shopSettings.receiptFooter && (
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">{shopSettings.receiptFooter}</p>
                  )}
                </div>

                <div className="sticky bottom-0 bg-white pt-3 mt-4 flex flex-col gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={doPrint}
                    className="w-full py-3 rounded-xl bg-cyan-600 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-cyan-600/30"
                  >
                    <Printer size={18} />
                    {tx('printReceipt', 'Print Receipt')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptModal({ show: false, record: null })}
                    className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-colors"
                  >
                    {tx('newTransaction', 'New Transaction')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden !important;
          }
          .print\:hidden {
            display: none !important;
          }
          #root, #root * {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          #receipt-print-area, #receipt-print-area * {
            visibility: visible !important;
          }
          #receipt-print-area {
            display: block !important;
            position: absolute !important;
            left: 50% !important;
            top: 0 !important;
            transform: translateX(-50%) !important;
            width: 80mm !important;
            max-width: 80mm !important;
            min-height: 0 !important;
            margin: 0 auto !important;
            padding: 3mm 4mm !important;
            box-sizing: border-box !important;
            background: white !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid-page !important;
            font-size: 12px !important;
          }
          #receipt-print-area table {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {receiptModal.show && receiptModal.record && (
        <div id="receipt-print-area" className="hidden print:block bg-white text-black font-sans text-[11px] leading-tight">
          <div className="text-center mb-3">
            {shopSettings.logoUrl && (
              <img
                src={shopSettings.logoUrl}
                alt={shopSettings.shopName}
                className="h-12 w-auto mx-auto mb-1 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <h2 className="text-[18px] font-bold uppercase m-0">{shopSettings.shopName}</h2>
            {shopSettings.address && <p className="m-0 mt-1">{shopSettings.address}</p>}
            {shopSettings.phone && <p className="m-0">Tel: {shopSettings.phone}</p>}
          </div>

          <div className="border-t border-b border-dashed border-black py-2 mb-3 space-y-1">
            <div className="flex justify-between">
              <span>Voucher:</span>
              <span className="font-bold">{receiptModal.record.voucherNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>
                {receiptModal.record.date} {receiptModal.record.time}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{receiptModal.record.cashier}</span>
            </div>
            <div className="flex justify-between">
              <span>{receiptModal.record.type === 'Purchase' ? 'Supplier:' : 'Customer:'}</span>
              <span>{receiptModal.record.personName}</span>
            </div>
          </div>

          <table className="w-full border-collapse mb-3">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left pb-1 font-bold">Item</th>
                <th className="text-right pb-1 font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {receiptModal.record.itemsDetail.map((item, i) => (
                <tr key={`${item.name}-${i}`}>
                  <td className="py-1.5 align-top">
                    <div className="font-bold">{item.name}</div>
                    <div className="text-[10px] mt-0.5">
                      {item.quantity} {item.unitName} x {Number(item.unitPrice).toLocaleString()}
                      {item.itemDiscountAmt > 0 && ` (-${Number(item.itemDiscountAmt).toLocaleString()})`}
                    </div>
                  </td>
                  <td className="text-right py-1.5 align-top font-bold">
                    {Number(item.unitPrice * item.quantity - (item.itemDiscountAmt || 0)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-black pt-2 mb-2 space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{Number(receiptModal.record.subtotal).toLocaleString()}</span>
            </div>
            {(receiptModal.record?.itemDiscount > 0 || receiptModal.record?.globalDiscount > 0) && (
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>
                  -{Number(receiptModal.record.itemDiscount + receiptModal.record.globalDiscount).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-between font-bold border-t border-black pt-2 mb-3 text-[14px]">
            <span>TOTAL:</span>
            <span>{Number(receiptModal.record.amount).toLocaleString()}</span>
          </div>

          <div className="border-t border-black pt-2 mb-4 space-y-1">
            <div className="flex justify-between">
              <span>Paid ({receiptModal.record.paymentMethod}):</span>
              <span>{Number(receiptModal.record.paidAmount).toLocaleString()}</span>
            </div>

            {receiptModal.record.remainingDebt > 0 ? (
              <div className="flex justify-between font-bold">
                <span>Credit Balance:</span>
                <span>{Number(receiptModal.record.remainingDebt).toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex justify-between font-bold">
                <span>Change:</span>
                <span>{Number(receiptModal.record.changeAmount).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="text-center font-bold text-[14px] mb-2">
            {receiptModal.record.remainingDebt > 0 ? '*** CREDIT ***' : '*** PAID ***'}
          </div>
          {shopSettings.receiptFooter && <div className="text-center text-[10px]">{shopSettings.receiptFooter}</div>}
        </div>
      )}
    </>
  );
}
