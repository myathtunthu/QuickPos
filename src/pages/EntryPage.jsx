from pathlib import Path

code = r'''import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useCart } from '../hooks/useCart';
import useDebounce from '../hooks/useDebounce';
import {
  AlertTriangle,
  Calendar,
  CreditCard,
  Minus,
  PauseCircle,
  Printer,
  ReceiptText,
  RotateCcw,
  Save,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

import ConfirmDialog from '../components/UI/ConfirmDialog';
import { showToast } from '../components/UI/Toast';
import logger from '../utils/logger';

import ProductSearch from '../components/entry/ProductSearch';
import ProductGrid from '../components/entry/ProductGrid';
import ProductDropdown from '../components/entry/ProductDropdown';
import CartSection from '../components/entry/CartSection';
import PaymentSection from '../components/entry/PaymentSection';

const PAYMENT_METHODS = ['Cash', 'Wave', 'KBZPay', 'Bank', 'Credit'];
const VOUCHER_PREFIXES = {
  sale: 'SAL',
  purchase: 'PUR',
  expense: 'EXP',
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(value) {
  return toNumber(value).toLocaleString();
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function safeTrim(value) {
  return String(value || '').trim();
}

function cleanDisplayName(profile) {
  const raw =
    profile?.displayName ||
    profile?.fullName ||
    profile?.name ||
    profile?.username ||
    profile?.email ||
    profile?.user?.email ||
    'Cashier';

  const clean = String(raw).trim();
  if (!clean) return 'Cashier';
  if (clean.includes('@')) return clean.split('@')[0];
  return clean;
}

function getProductName(product) {
  return product?.name || product?.productName || product?.itemName || product?.title || 'Unnamed Product';
}

function getProductStock(product) {
  return toNumber(product?.stockBase ?? product?.stock ?? product?.qty ?? product?.quantity ?? 0);
}

function getProductCost(product) {
  return toNumber(
    product?.costPrice ??
      product?.cost ??
      product?.buyPrice ??
      product?.packageUnits?.[0]?.costPrice ??
      product?.packageUnits?.[0]?.cost ??
      product?.packages?.[0]?.costPrice ??
      0
  );
}

function getItemCostPrice(item, products) {
  const product =
    products.find((p) => p.id === item.productId) ||
    products.find((p) => getProductName(p) === item.name) ||
    null;

  return toNumber(
    item.costPrice ??
      item.cost ??
      product?.costPrice ??
      product?.cost ??
      product?.buyPrice ??
      product?.packageUnits?.find((u) => u.name === item.unitName)?.costPrice ??
      product?.packageUnits?.[0]?.costPrice ??
      0
  );
}

function buildVoucherNo(type, count, dateISO) {
  const safeType = String(type || 'sale').toLowerCase();
  const prefix = VOUCHER_PREFIXES[safeType] || 'SAL';
  const compactDate = String(dateISO || todayISO()).replaceAll('-', '');
  return `${prefix}-${compactDate}-${String(count || 1).padStart(4, '0')}`;
}

function getTimeNow() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getDefaultUnit(product) {
  return (
    product?.packageUnits?.find((unit) => toNumber(unit.multiplier) === 1) ||
    product?.packageUnits?.[0] || {
      name: product?.unitName || 'ခု',
      multiplier: 1,
      prices: {
        retail: toNumber(product?.price ?? product?.sellPrice ?? 0),
        wholesale: toNumber(product?.wholesalePrice ?? product?.price ?? product?.sellPrice ?? 0),
      },
      costPrice: getProductCost(product),
    }
  );
}

function canDo(profile, hasPermission, permission) {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'owner') return true;
  if (typeof hasPermission === 'function') return hasPermission(permission);
  return Array.isArray(profile.permissions) && profile.permissions.includes(permission);
}

function normalizePerson(person) {
  return {
    id: person.id,
    name: person.name || person.fullName || person.customerName || person.supplierName || 'Unknown',
    phone: person.phone || '',
    address: person.address || '',
    totalDebt: toNumber(person.totalDebt),
    ...person,
  };
}

function isWalkInName(name, entryTab) {
  const v = String(name || '').trim().toLowerCase();
  if (entryTab === 'Sale') return !v || v === 'walk-in' || v === 'walk in' || v === 'walk-in customer';
  return !v || v === 'unknown supplier';
}

function ScannerModal({ onClose, onScan }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const streamRef = useRef(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const lastScannedRef = useRef({ code: '', time: 0 });
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
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

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        await codeReader.decodeFromConstraints(constraints, videoRef.current, (result) => {
          if (!result?.text) return;

          const now = Date.now();
          const text = result.text.trim();

          if (text === lastScannedRef.current.code && now - lastScannedRef.current.time < 1400) {
            return;
          }

          lastScannedRef.current = { code: text, time: now };
          setIsProcessing(true);
          onScanRef.current?.(text);
          window.setTimeout(() => setIsProcessing(false), 700);
        });
      } catch (error) {
        logger.error('Camera scanner error:', error);
        setCameraError('Camera access denied or not available.');
      }
    };

    startScanner();

    return () => {
      mounted = false;
      try {
        readerRef.current?.reset?.();
      } catch (error) {
        logger.error('Scanner cleanup error:', error);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#0d1120] shadow-2xl shadow-cyan-950/40">
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-5 py-4">
          <div>
            <h3 className="font-black text-white">Barcode Scanner</h3>
            <p className="text-xs text-slate-400">Camera ကို barcode ပေါ်ချိန်ပါ</p>
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current?.()}
            className="rounded-xl bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20"
            aria-label="Close scanner"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative bg-black">
          {cameraError ? (
            <div className="p-8 text-center font-bold text-rose-400">{cameraError}</div>
          ) : (
            <video ref={videoRef} className="h-[320px] w-full object-cover" autoPlay playsInline muted />
          )}

          {!cameraError && (
            <div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-cyan-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          )}

          {isProcessing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#06111f]/90">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
              <p className="font-black text-cyan-300">ပစ္စည်းထည့်နေပါသည်...</p>
            </div>
          )}
        </div>

        <div className="bg-emerald-500/10 px-5 py-3 text-center text-xs font-black text-emerald-400">
          Continuous scan ဖွင့်ထားသည်
        </div>
      </div>
    </div>
  );
}

function PromptModal({ value, onChange, onCancel, onSubmit }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-sm rounded-3xl border border-cyan-500/30 bg-[#0d1120] p-6 shadow-2xl">
        <h3 className="mb-4 text-xl font-black text-cyan-400">Hold Bill အမည်</h3>
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mb-5 w-full rounded-2xl border border-white/10 bg-black/50 p-3 text-white outline-none focus:border-cyan-400"
          placeholder="ဥပမာ - စားပွဲ ၃ / Customer Name"
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-2xl bg-cyan-500 py-3 font-black text-[#06111f] active:scale-95"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl bg-slate-700 py-3 font-black text-white active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptContent({ record, shopSettings, compact = false }) {
  if (!record) return null;

  const items = Array.isArray(record.itemsDetail) ? record.itemsDetail : [];
  const discount = toNumber(record.itemDiscount) + toNumber(record.globalDiscount);
  const hasLogo = Boolean(shopSettings?.logoUrl);

  return (
    <div className={`${compact ? 'text-[10px]' : 'text-[12px]'} leading-tight text-black`}>
      <div className="mb-2 text-center">
        {hasLogo && (
          <img
            src={shopSettings.logoUrl}
            alt={shopSettings.shopName || 'Shop Logo'}
            loading="lazy"
            className={`${compact ? 'h-9' : 'h-12'} mx-auto mb-1 w-auto object-contain`}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
        <h2 className={`${compact ? 'text-[14px]' : 'text-[18px]'} m-0 font-black uppercase`}>
          {shopSettings.shopName || 'Shop'}
        </h2>
        {shopSettings.address && <p className="m-0 mt-1">{shopSettings.address}</p>}
        {shopSettings.phone && <p className="m-0">Tel: {shopSettings.phone}</p>}
      </div>

      <div className="mb-2 border-y border-dashed border-black py-2">
        <div className="flex justify-between gap-3">
          <span>Voucher:</span>
          <span className="font-bold">{record.voucherNo || record.invoiceNo || '-'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Date:</span>
          <span>
            {record.date || '-'} {record.time || ''}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Cashier:</span>
          <span>{record.cashier || '-'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>{record.type === 'Purchase' ? 'Supplier:' : 'Customer:'}</span>
          <span>{record.personName || '-'}</span>
        </div>
      </div>

      <table className="mb-2 w-full border-collapse">
        <thead>
          <tr className="border-b border-black">
            <th className="pb-1 text-left font-black">Item</th>
            <th className="pb-1 text-right font-black">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const amount = toNumber(item.itemTotal, toNumber(item.unitPrice) * toNumber(item.quantity, 1) - toNumber(item.itemDiscountAmt));
            return (
              <tr key={`${item.productId || item.name}-${index}`}>
                <td className="py-1 align-top">
                  <div className="font-bold">{item.name || 'Item'}</div>
                  <div className="text-[10px]">
                    {formatMoney(item.quantity)} {item.unitName || ''} x {formatMoney(item.unitPrice)}
                    {toNumber(item.itemDiscountAmt) > 0 ? ` (-${formatMoney(item.itemDiscountAmt)})` : ''}
                  </div>
                </td>
                <td className="py-1 text-right align-top font-bold">{formatMoney(amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mb-2 border-t border-dashed border-black pt-2">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatMoney(record.subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>-{formatMoney(discount)}</span>
          </div>
        )}
      </div>

      <div className="mb-2 flex justify-between border-t border-black pt-2 text-[14px] font-black">
        <span>TOTAL:</span>
        <span>{formatMoney(record.amount)}</span>
      </div>

      <div className="mb-3 border-t border-black pt-2">
        <div className="flex justify-between">
          <span>Paid ({record.paymentMethod || 'Cash'}):</span>
          <span>{formatMoney(record.paidAmount)}</span>
        </div>
        {toNumber(record.remainingDebt) > 0 ? (
          <div className="flex justify-between font-black">
            <span>Credit Balance:</span>
            <span>{formatMoney(record.remainingDebt)}</span>
          </div>
        ) : (
          <div className="flex justify-between font-black">
            <span>Change:</span>
            <span>{formatMoney(record.changeAmount)}</span>
          </div>
        )}
      </div>

      <div className="mb-1 text-center text-[13px] font-black">
        {toNumber(record.remainingDebt) > 0 ? '*** CREDIT ***' : '*** PAID ***'}
      </div>
      <div className="text-center text-[10px]">{shopSettings.footerText || 'Thank you for your business!'}</div>
    </div>
  );
}

function ReceiptModal({ record, shopSettings, onClose, onPrint }) {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm print:hidden">
      <div className="flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#0d1120] shadow-2xl">
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-4 py-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <ReceiptText size={18} />
            <span className="font-black">Receipt Preview</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="rounded-xl bg-white/5 p-2 text-slate-300 hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-4">
          <div className="mx-auto w-[80mm] max-w-full rounded bg-white p-4 shadow-xl">
            <ReceiptContent record={record} shopSettings={shopSettings} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-cyan-500/20 bg-[#0d1120] p-3">
          <button
            type="button"
            onClick={onPrint}
            className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-3 font-black text-[#06111f] active:scale-95"
          >
            <Printer size={18} /> Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-emerald-500/15 py-3 font-black text-emerald-300 active:scale-95"
          >
            New Transaction
          </button>
        </div>
      </div>
    </div>
  );
}

function SidePanel({
  cart,
  products,
  entryTab,
  cartTotals,
  globalDiscountAmt,
  setGlobalDiscountAmt,
  globalDiscountType,
  setGlobalDiscountType,
  paymentMethod,
  setPaymentMethod,
  paidAmount,
  setPaidAmount,
  submitTransaction,
  loading,
  handleHoldInvoiceClick,
  receiptRecord,
  shopSettings,
  onUpdateQty,
  onUpdateUnit,
  onUpdatePriceType,
  onUpdateDiscount,
  onUpdatePrice,
  onRemove,
}) {
  const total = toNumber(cartTotals.total);
  const paid = paidAmount === '' ? total : toNumber(paidAmount);
  const balance = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  const itemsCount = cart.reduce((sum, item) => sum + toNumber(item.quantity), 0);

  const handleDiscountChange = (event) => {
    const value = event.target.value;
    if (value === '' || toNumber(value) >= 0) {
      setGlobalDiscountAmt(value);
    }
  };

  return (
    <div className="space-y-4 xl:sticky xl:top-4">
      <section className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-3 shadow-2xl shadow-cyan-950/20">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cart Summary</p>
            <h2 className="text-lg font-black text-white">{itemsCount} items</h2>
          </div>
          {entryTab === 'Sale' && (
            <button
              type="button"
              onClick={handleHoldInvoiceClick}
              disabled={cart.length === 0 || loading}
              className="flex items-center gap-1 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PauseCircle size={14} /> Hold
            </button>
          )}
        </div>

        <CartSection
          cart={cart}
          products={products}
          onUpdateQty={onUpdateQty}
          onUpdateUnit={onUpdateUnit}
          onUpdatePriceType={onUpdatePriceType}
          onUpdateDiscount={onUpdateDiscount}
          onUpdatePrice={onUpdatePrice}
          onRemove={onRemove}
        />

        {cart.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <ShoppingCart className="mx-auto mb-2 text-slate-600" size={28} />
            <p className="font-bold text-slate-500">Cart ထဲမှာ ပစ္စည်းမရှိသေးပါ</p>
            <p className="mt-1 text-xs text-slate-600">Product ကိုရွေးပြီး sale စတင်ပါ</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2 rounded-2xl border border-cyan-500/10 bg-black/40 p-3 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Subtotal</span>
              <span>{formatMoney(cartTotals.subtotal)} Ks</span>
            </div>

            {toNumber(cartTotals.itemDiscounts) > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Item Discounts</span>
                <span>-{formatMoney(cartTotals.itemDiscounts)} Ks</span>
              </div>
            )}

            {entryTab === 'Sale' && (
              <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-amber-400">
                <div className="flex items-center gap-1">
                  <span>Invoice Discount</span>
                  <select
                    value={globalDiscountType}
                    onChange={(event) => setGlobalDiscountType(event.target.value)}
                    className="rounded border border-amber-500/20 bg-black/60 px-1 py-0.5 text-white outline-none"
                    aria-label="Discount type"
                  >
                    <option value="%">%</option>
                    <option value="flat">Ks</option>
                  </select>
                </div>
                <input
                  type="number"
                  min="0"
                  value={globalDiscountAmt}
                  onChange={handleDiscountChange}
                  placeholder="0"
                  className="w-20 rounded border border-amber-500/30 bg-black/60 px-2 py-1 text-right text-amber-300 outline-none focus:border-amber-400"
                  aria-label="Invoice discount"
                />
              </div>
            )}

            {toNumber(cartTotals.globalDisc) > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Applied Discount</span>
                <span>-{formatMoney(cartTotals.globalDisc)} Ks</span>
              </div>
            )}

            <div className="flex justify-between border-t border-cyan-500/20 pt-3 text-xl font-black text-cyan-300">
              <span>TOTAL</span>
              <span>{formatMoney(cartTotals.total)} Ks</span>
            </div>
          </div>
        )}
      </section>

      {cart.length > 0 && (
        <section className="rounded-3xl border border-emerald-500/20 bg-[#0d1120]/95 p-3 shadow-2xl shadow-emerald-950/10">
          <div className="mb-3 flex items-center gap-2">
            <Wallet size={18} className="text-emerald-400" />
            <h2 className="font-black text-white">Payment</h2>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-xs font-black uppercase text-emerald-300">Paid</p>
              <p className="text-lg font-black text-white">{formatMoney(paid)} Ks</p>
            </div>
            <div className={`rounded-2xl border p-3 ${balance > 0 ? 'border-rose-500/20 bg-rose-500/10' : 'border-cyan-500/20 bg-cyan-500/10'}`}>
              <p className="text-xs font-black uppercase text-slate-300">{balance > 0 ? 'Balance' : 'Change'}</p>
              <p className={`text-lg font-black ${balance > 0 ? 'text-rose-300' : 'text-cyan-300'}`}>
                {formatMoney(balance > 0 ? balance : change)} Ks
              </p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => {
                  setPaymentMethod(method);
                  if (method === 'Credit') setPaidAmount('0');
                }}
                className={`rounded-2xl border px-3 py-2 text-xs font-black transition-all active:scale-95 ${
                  paymentMethod === method
                    ? 'border-cyan-400 bg-cyan-500 text-[#06111f]'
                    : 'border-white/10 bg-black/30 text-slate-300 hover:border-cyan-500/40'
                }`}
              >
                {method}
              </button>
            ))}
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
        </section>
      )}

      <section className="hidden rounded-3xl border border-white/10 bg-[#0d1120]/95 p-3 shadow-2xl xl:block">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-black text-white">
            <ReceiptText size={18} className="text-cyan-400" />
            Receipt Preview
          </h2>
        </div>
        <div className="mx-auto min-h-[360px] w-[80mm] max-w-full rounded-2xl bg-white p-3">
          {receiptRecord ? (
            <ReceiptContent record={receiptRecord} shopSettings={shopSettings} compact />
          ) : (
            <div className="flex h-[330px] flex-col items-center justify-center text-center text-slate-400">
              <ReceiptText size={32} />
              <p className="mt-2 text-xs font-bold">Sale ပြီးရင် receipt preview ပေါ်မယ်</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function EntryPage({ products = [] }) {
  const { profile, hasPermission } = useAuth();
  const tenantId = profile?.tenantId || null;
  const cashierName = cleanDisplayName(profile);

  const canCreateSale = canDo(profile, hasPermission, 'create_sale');
  const canCreatePurchase = canDo(profile, hasPermission, 'create_purchase');
  const canCreateExpense = canDo(profile, hasPermission, 'create_expense');

  const [entryDate, setEntryDate] = useState(todayISO());
  const [entryTab, setEntryTab] = useState(canCreateSale ? 'Sale' : canCreatePurchase ? 'Purchase' : canCreateExpense ? 'Expense' : 'Sale');

  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newPersonAddress, setNewPersonAddress] = useState('');

  const [shopSettings, setShopSettings] = useState({
    shopName: profile?.shopName || profile?.businessName || 'NexPOS',
    phone: profile?.phone || '',
    address: profile?.address || '',
    logoUrl: profile?.logoUrl || '',
    footerText: 'Thank you for your business!',
  });

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
  } = useCart(Array.isArray(products) ? products : [], entryTab);

  const safeProducts = Array.isArray(products) ? products : [];

  const keepCurrentScrollPosition = useCallback(() => {
    const y = lastScrollPositionRef.current;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: 'auto' });
      });
    });
  }, []);

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
            shopName: settings.shopName || settings.businessName || profile?.shopName || 'NexPOS',
            phone: settings.phone || settings.shopPhone || '',
            address: settings.address || settings.shopAddress || '',
            logoUrl: settings.logoUrl || settings.logo || settings.shopLogo || '',
            footerText: settings.footerText || settings.invoiceFooterText || 'Thank you for your business!',
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

    return personList
      .filter((person) => {
        const name = String(person.name || '').toLowerCase();
        const phone = String(person.phone || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 20);
  }, [personList, personSearch]);

  const categories = useMemo(() => ['All', ...new Set(safeProducts.map((p) => p.category).filter(Boolean))], [safeProducts]);

  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    return safeProducts.filter((product) => {
      if (selCategory !== 'All' && product.category !== selCategory) return false;
      if (!q) return true;

      const nameMatch = getProductName(product).toLowerCase().includes(q);
      const skuMatch = String(product.sku || product.code || product.barcode || '').toLowerCase().includes(q);
      const unitMatch = product.packageUnits?.some((unit) => {
        return (
          String(unit.barcode || '').toLowerCase().includes(q) ||
          String(unit.barcodes?.retail || '').toLowerCase().includes(q) ||
          String(unit.barcodes?.wholesale || '').toLowerCase().includes(q)
        );
      });

      return nameMatch || skuMatch || unitMatch;
    });
  }, [safeProducts, debouncedSearch, selCategory]);

  const barcodeMap = useMemo(() => {
    const map = new Map();

    safeProducts.forEach((product) => {
      const defaultUnit = getDefaultUnit(product);

      if (product.barcode) {
        map.set(String(product.barcode).trim().toLowerCase(), { product, unit: defaultUnit });
      }

      product.packageUnits?.forEach((unit) => {
        const barcodes = [unit.barcode, unit.barcodes?.retail, unit.barcodes?.wholesale].filter(Boolean);
        barcodes.forEach((barcode) => map.set(String(barcode).trim().toLowerCase(), { product, unit }));
      });
    });

    return map;
  }, [safeProducts]);

  const summary = useMemo(() => {
    const total = toNumber(cartTotals.total);
    const paid = paidAmount === '' ? total : toNumber(paidAmount);
    const balance = Math.max(0, total - paid);
    const change = Math.max(0, paid - total);
    const itemCount = cart.reduce((sum, item) => sum + toNumber(item.quantity), 0);
    const lowStockCount = safeProducts.filter((product) => getProductStock(product) <= toNumber(product.minStock ?? product.minStockAlert ?? 5)).length;

    return {
      total,
      paid,
      balance,
      change,
      itemCount,
      lowStockCount,
      productCount: safeProducts.length,
    };
  }, [cart, cartTotals.total, paidAmount, safeProducts]);

  const handleSelectProduct = useCallback(
    (product) => {
      if (typeof window !== 'undefined') {
        lastScrollPositionRef.current = window.scrollY || window.pageYOffset || 0;
      }

      const defaultUnit = getDefaultUnit(product);
      const response = addToCart(product, defaultUnit, 'retail', 1);

      if (response?.success) {
        setProdSearch('');
        keepCurrentScrollPosition();
      } else {
        showToast(response?.message || 'ပစ္စည်းထည့်၍ မရပါ', 'error');
      }
    },
    [addToCart, keepCurrentScrollPosition]
  );

  const handleBarcodeScanned = useCallback(
    (text) => {
      const cleanText = String(text || '').trim().toLowerCase();
      const match = barcodeMap.get(cleanText);

      if (!match) {
        showToast(`Barcode (${text}) ဖြင့် ပစ္စည်းရှာမတွေ့ပါ`, 'error');
        return;
      }

      const response = addToCart(match.product, match.unit, 'retail', 1);
      if (!response?.success) {
        showToast(response?.message || 'ပစ္စည်းထည့်၍ မရပါ', 'error');
        return;
      }

      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } catch (error) {
        logger.error('Beep error:', error);
      }
    },
    [addToCart, barcodeMap]
  );

  const handleTabChange = (tab) => {
    if (entryTab === tab) return;

    if (cart.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'Tab ပြောင်းမည်',
        message: 'လက်ရှိ cart ကို ဖျက်ပြီး tab ပြောင်းမှာ သေချာပါသလား?',
        onConfirm: () => {
          clearCart();
          setEntryTab(tab);
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        },
      });
      return;
    }

    clearCart();
    setEntryTab(tab);
  };

  const handleHoldInvoiceClick = () => {
    if (cart.length === 0) return;

    const invalidItem = cart.find((item) => item.quantity === '' || toNumber(item.quantity) <= 0);
    if (invalidItem) {
      showToast(`"${invalidItem.name}" ၏ Qty မှားနေပါသည်`, 'error');
      return;
    }

    setPromptModal({ isOpen: true, name: personSearch || '' });
  };

  const executeHoldInvoice = async () => {
    const name = promptModal.name.trim();
    if (!name) {
      showToast('Hold Bill အမည်ထည့်ပါ', 'error');
      return;
    }

    if (!tenantId) {
      showToast('Tenant မတွေ့ပါ', 'error');
      return;
    }

    setLoading(true);

    try {
      const draftRef = doc(collection(db, 'pos_drafts'));
      const sanitizedCart = cart.map((item) => ({
        id: item.id || `${Date.now()}-${Math.random()}`,
        productId: item.productId || '',
        productSnapshot: safeProducts.find((p) => p.id === item.productId) || null,
        name: item.name || '',
        unitName: item.unitName || '',
        multiplier: toNumber(item.multiplier, 1),
        priceType: item.priceType || 'retail',
        unitPrice: toNumber(item.unitPrice),
        quantity: toNumber(item.quantity, 1),
        baseQuantity: toNumber(item.baseQuantity, toNumber(item.quantity, 1)),
        itemDiscountAmt: toNumber(item.itemDiscountAmt),
        notes: item.notes || '',
      }));

      await setDoc(draftRef, {
        tenantId,
        draftName: name,
        type: entryTab,
        cart: sanitizedCart,
        personSearch,
        selectedPerson,
        newPersonPhone,
        newPersonAddress,
        globalDiscountAmt,
        globalDiscountType,
        paymentMethod,
        paidAmount,
        cartTotals: {
          subtotal: toNumber(cartTotals.subtotal),
          itemDiscounts: toNumber(cartTotals.itemDiscounts),
          globalDisc: toNumber(cartTotals.globalDisc),
          total: toNumber(cartTotals.total),
        },
        createdAt: serverTimestamp(),
        createdAtLocal: Date.now(),
      });

      clearCart();
      setPersonSearch('');
      setSelectedPerson(null);
      setNewPersonPhone('');
      setNewPersonAddress('');
      setPaidAmount('');
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

      if (Array.isArray(draft.cart)) {
        setCart(draft.cart.map((item) => ({ ...item, id: item.id || `${Date.now()}-${Math.random()}` })));
      }

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
      setConfirmDialog({
        isOpen: true,
        title: 'Draft ပြန်ယူမည်',
        message: 'လက်ရှိ cart ကို ဖျက်ပြီး Hold Bill ပြန်ယူမှာ သေချာပါသလား?',
        onConfirm: () => executeRestoreDraft(draft),
      });
      return;
    }

    executeRestoreDraft(draft);
  };

  const deleteDraft = (draftId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Draft ဖျက်မည်',
      message: 'ဒီ Hold Bill ကို ဖျက်မှာ သေချာပါသလား?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'pos_drafts', draftId));
          await fetchDrafts();
          showToast('Draft ဖျက်ပြီးပါပြီ', 'success');
        } catch (error) {
          logger.error('Delete draft error:', error);
          showToast(`Draft ဖျက်မရပါ: ${error.message}`, 'error');
        } finally {
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        }
      },
    });
  };

  const refreshPersons = useCallback(async () => {
    if (!tenantId) return;

    try {
      const [customerSnap, supplierSnap] = await Promise.all([
        getDocs(query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId))),
        getDocs(query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId))),
      ]);

      setCustomers(customerSnap.docs.map((d) => normalizePerson({ id: d.id, ...d.data() })));
      setSuppliers(supplierSnap.docs.map((d) => normalizePerson({ id: d.id, ...d.data() })));
    } catch (error) {
      logger.error('Refresh person error:', error);
    }
  }, [tenantId]);

  const submitExpense = async () => {
    if (submitLock.current || loading) return;
    if (!tenantId) {
      showToast('Tenant မတွေ့ပါ', 'error');
      return;
    }

    const title = expenseTitle.trim();
    const amount = toNumber(expenseAmt);

    if (!title) {
      showToast('Expense title ထည့်ပါ', 'error');
      return;
    }

    if (amount <= 0) {
      showToast('Expense amount မှန်မှန်ထည့်ပါ', 'error');
      return;
    }

    submitLock.current = true;
    setLoading(true);

    try {
      const counterRef = doc(db, 'pos_counters', tenantId);
      const counterSnap = await getDoc(counterRef);
      const nextCount = (counterSnap.exists() ? toNumber(counterSnap.data().expenseCount) : 0) + 1;
      const voucherNo = buildVoucherNo('Expense', nextCount, entryDate);

      const batch = writeBatch(db);
      const recordRef = doc(collection(db, 'pos_records'));

      batch.set(recordRef, {
        id: recordRef.id,
        type: 'Expense',
        tenantId,
        item: title,
        amount,
        paidAmount: amount,
        paymentMethod: 'Cash',
        cashier: cashierName,
        cashierEmail: profile?.email || '',
        voucherNo,
        date: entryDate,
        time: getTimeNow(),
        createdAt: serverTimestamp(),
        createdAtLocal: Date.now(),
      });

      batch.set(
        counterRef,
        {
          tenantId,
          expenseCount: increment(1),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();

      setExpenseTitle('');
      setExpenseAmt('');
      showToast('Expense သိမ်းပြီးပါပြီ', 'success');
    } catch (error) {
      logger.error('Expense save error:', error);
      showToast(`Expense သိမ်းမရပါ: ${error.message}`, 'error');
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  const submitTransaction = async () => {
    if (submitLock.current || loading) return;

    if (!tenantId) {
      showToast('Tenant မတွေ့ပါ', 'error');
      return;
    }

    if (cart.length === 0) {
      showToast('Cart ထဲမှာ ပစ္စည်းမရှိပါ', 'error');
      return;
    }

    const invalidItem = cart.find((item) => item.quantity === '' || toNumber(item.quantity) <= 0);
    if (invalidItem) {
      showToast(`"${invalidItem.name}" ၏ Qty မှားနေပါသည်`, 'error');
      return;
    }

    const total = toNumber(cartTotals.total);
    if (total <= 0) {
      showToast('Total amount မှားနေပါသည်', 'error');
      return;
    }

    const paid = paymentMethod === 'Credit' ? 0 : paidAmount === '' ? total : toNumber(paidAmount);
    if (paid < 0) {
      showToast('Paid amount negative မဖြစ်ရပါ', 'error');
      return;
    }

    const remainingDebt = Math.max(0, total - paid);
    const changeAmount = Math.max(0, paid - total);

    let personIdForRecord = selectedPerson?.id || null;
    let personNameForRecord =
      selectedPerson?.name ||
      safeTrim(personSearch) ||
      (entryTab === 'Sale' ? 'Walk-in' : 'Unknown Supplier');

    if (remainingDebt > 0 && isWalkInName(personNameForRecord, entryTab)) {
      showToast(`${entryTab === 'Sale' ? 'Customer' : 'Supplier'} အမည် ထည့်မှ Credit သုံးလို့ရပါမယ်`, 'error');
      return;
    }

    submitLock.current = true;
    setLoading(true);

    try {
      let savedRecord = null;

      await runTransaction(db, async (transaction) => {
        const stockUpdates = [];

        for (const item of cart) {
          if (!item.productId) continue;

          const productRef = doc(db, 'pos_products', item.productId);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw new Error(`ပစ္စည်းရှာမတွေ့ပါ: ${item.name}`);
          }

          const productData = productSnap.data();
          const currentStock = getProductStock(productData);
          const qtyBase = toNumber(item.baseQuantity, toNumber(item.quantity, 1));

          if (entryTab === 'Sale' && qtyBase > currentStock) {
            throw new Error(`"${item.name}" Stock မလုံလောက်ပါ။ လက်ကျန်: ${formatMoney(currentStock)}`);
          }

          stockUpdates.push({
            ref: productRef,
            nextStock: entryTab === 'Sale' ? currentStock - Math.abs(qtyBase) : currentStock + Math.abs(qtyBase),
          });
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

          transaction.set(newPersonRef, {
            tenantId,
            name: personNameForRecord,
            phone: safeTrim(newPersonPhone),
            address: safeTrim(newPersonAddress),
            totalDebt: remainingDebt,
            totalPurchase: entryTab === 'Sale' ? total : 0,
            totalPaid: entryTab === 'Sale' ? paid : 0,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (personRef && personSnap?.exists() && remainingDebt > 0) {
          const currentDebt = toNumber(personSnap.data().totalDebt);
          transaction.update(personRef, {
            totalDebt: currentDebt + remainingDebt,
            updatedAt: serverTimestamp(),
          });
        }

        transaction.set(
          counterRef,
          {
            tenantId,
            [countField]: increment(1),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        const voucherNo = buildVoucherNo(entryTab, nextCount, entryDate);
        const recordRef = doc(collection(db, 'pos_records'));

        const itemsDetail = cart.map((item) => {
          const quantity = toNumber(item.quantity, 1);
          const unitPrice = toNumber(item.unitPrice);
          const itemDiscountAmt = toNumber(item.itemDiscountAmt);
          const costPrice = getItemCostPrice(item, safeProducts);
          const itemTotal = unitPrice * quantity - itemDiscountAmt;
          const itemProfit = itemTotal - costPrice * quantity;

          return {
            productId: item.productId || '',
            name: item.name || 'Unknown Item',
            quantity,
            unitName: item.unitName || 'ခု',
            multiplier: toNumber(item.multiplier, 1),
            baseQuantity: toNumber(item.baseQuantity, quantity),
            priceType: item.priceType || 'retail',
            unitPrice,
            costPrice,
            itemDiscountAmt,
            itemTotal,
            itemProfit,
          };
        });

        const totalCost = itemsDetail.reduce((sum, item) => sum + toNumber(item.costPrice) * toNumber(item.quantity), 0);
        const grossProfit = entryTab === 'Sale' ? total - totalCost : 0;

        const recordData = {
          id: recordRef.id,
          type: entryTab,
          tenantId,
          personName: personNameForRecord,
          customerId: entryTab === 'Sale' ? personIdForRecord : null,
          supplierId: entryTab === 'Purchase' ? personIdForRecord : null,
          cashier: cashierName,
          cashierEmail: profile?.email || '',
          voucherNo,
          invoiceNo: voucherNo,
          date: entryDate,
          time: getTimeNow(),
          itemsDetail,
          item: itemsDetail.length > 1 ? 'Multiple' : itemsDetail[0]?.name || 'Multiple',
          amount: total,
          subtotal: toNumber(cartTotals.subtotal),
          itemDiscount: toNumber(cartTotals.itemDiscounts),
          globalDiscount: toNumber(cartTotals.globalDisc),
          paymentMethod,
          paymentType: paymentMethod,
          paidAmount: paid,
          remainingDebt,
          changeAmount,
          totalCost,
          grossProfit,
          profit: grossProfit,
          status: remainingDebt > 0 ? 'Pending' : 'Completed',
          createdAt: serverTimestamp(),
          createdAtLocal: Date.now(),
        };

        transaction.set(recordRef, recordData);

        for (const update of stockUpdates) {
          transaction.update(update.ref, {
            stockBase: update.nextStock,
            stock: update.nextStock,
            updatedAt: serverTimestamp(),
          });
        }

        if (!isWalkInName(personNameForRecord, entryTab) || paid > 0 || remainingDebt > 0) {
          const ledgerRef = doc(collection(db, 'pos_ledgers'));
          transaction.set(ledgerRef, {
            tenantId,
            recordId: recordRef.id,
            voucherNo,
            type: entryTab,
            personId: personIdForRecord || null,
            personName: personNameForRecord,
            total,
            paid,
            due: remainingDebt,
            paymentMethod,
            date: entryDate,
            time: recordData.time,
            createdAt: serverTimestamp(),
            createdAtLocal: Date.now(),
          });
        }

        if (paid > 0) {
          const paymentRef = doc(collection(db, 'pos_payments'));
          transaction.set(paymentRef, {
            tenantId,
            recordId: recordRef.id,
            voucherNo,
            type: entryTab === 'Sale' ? 'Customer Payment' : 'Supplier Payment',
            personId: personIdForRecord || null,
            personName: personNameForRecord,
            amount: paid,
            paymentMethod,
            cashier: cashierName,
            date: entryDate,
            time: recordData.time,
            createdAt: serverTimestamp(),
            createdAtLocal: Date.now(),
          });
        }

        savedRecord = recordData;
      });

      setReceiptModal({ show: true, record: savedRecord });
      setLatestReceipt(savedRecord);

      clearCart();
      setPersonSearch('');
      setSelectedPerson(null);
      setNewPersonPhone('');
      setNewPersonAddress('');
      setPaidAmount('');
      setPaymentMethod('Cash');

      await refreshPersons();
      showToast(`${entryTab} သိမ်းပြီးပါပြီ`, 'success');
    } catch (error) {
      logger.error('Transaction save error:', error);
      showToast(error.message || 'Transaction သိမ်းမရပါ', 'error');
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.setTimeout(() => window.print(), 80);
  };

  const personLabel = entryTab === 'Sale' ? 'Customer' : 'Supplier';

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
        <PromptModal
          value={promptModal.name}
          onChange={(name) => setPromptModal({ ...promptModal, name })}
          onCancel={() => setPromptModal({ isOpen: false, name: '' })}
          onSubmit={executeHoldInvoice}
        />
      )}

      {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onScan={handleBarcodeScanned} />}

      {receiptModal.show && receiptModal.record && (
        <ReceiptModal
          record={receiptModal.record}
          shopSettings={shopSettings}
          onClose={() => setReceiptModal({ show: false, record: null })}
          onPrint={handlePrint}
        />
      )}

      <div className="min-h-screen bg-[#060816] text-white print:hidden">
        <div className="mx-auto max-w-[1600px] space-y-4 p-3 pb-32 sm:p-4 lg:p-6">
          <header className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-4 shadow-2xl shadow-cyan-950/20">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-400">
                  <Zap size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-black sm:text-2xl">
                    <span className="text-white">POS</span> <span className="text-cyan-400">/ New Sale</span>
                  </h1>
                  <p className="text-xs font-bold text-slate-500">
                    {shopSettings.shopName || 'Shop'} • Cashier: {cashierName}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-black/30 px-3 py-2">
                  <Calendar size={16} className="text-cyan-400" />
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(event) => setEntryDate(event.target.value)}
                    className="w-[130px] bg-transparent text-sm font-bold text-cyan-200 outline-none"
                    style={{ colorScheme: 'dark' }}
                    aria-label="Entry date"
                  />
                </div>

                <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
                  {canCreateSale && (
                    <button
                      type="button"
                      onClick={() => handleTabChange('Sale')}
                      className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                        entryTab === 'Sale' ? 'bg-cyan-500 text-[#06111f]' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sale
                    </button>
                  )}
                  {canCreatePurchase && (
                    <button
                      type="button"
                      onClick={() => handleTabChange('Purchase')}
                      className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                        entryTab === 'Purchase' ? 'bg-cyan-500 text-[#06111f]' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Purchase
                    </button>
                  )}
                  {canCreateExpense && (
                    <button
                      type="button"
                      onClick={() => handleTabChange('Expense')}
                      className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                        entryTab === 'Expense' ? 'bg-cyan-500 text-[#06111f]' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Expense
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          {entryTab === 'Expense' ? (
            <section className="mx-auto max-w-2xl rounded-3xl border border-amber-500/20 bg-[#0d1120]/95 p-5 shadow-2xl shadow-amber-950/10">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-400">
                  <Minus size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Record Expense</h2>
                  <p className="text-xs font-bold text-slate-500">နေ့စဉ် အသုံးစရိတ်များ မှတ်တမ်းတင်ရန်</p>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  value={expenseTitle}
                  onChange={(event) => setExpenseTitle(event.target.value)}
                  placeholder="Expense title (ဥပမာ - မီတာခ)"
                  className="w-full rounded-2xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-400"
                />
                <input
                  type="number"
                  min="0"
                  value={expenseAmt}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === '' || toNumber(value) >= 0) setExpenseAmt(value);
                  }}
                  placeholder="Amount (Ks)"
                  className="w-full rounded-2xl border border-amber-500/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={submitExpense}
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 font-black text-[#1b1203] shadow-lg shadow-amber-950/30 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
                >
                  {loading ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <main className="min-w-0 space-y-4">
                <section className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-3 shadow-2xl shadow-cyan-950/10 sm:p-4">
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                      <p className="text-[10px] font-black uppercase text-cyan-300">Products</p>
                      <p className="text-xl font-black text-white">{summary.productCount}</p>
                    </div>
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3">
                      <p className="text-[10px] font-black uppercase text-rose-300">Low Stock</p>
                      <p className="text-xl font-black text-white">{summary.lowStockCount}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <p className="text-[10px] font-black uppercase text-emerald-300">Cart Items</p>
                      <p className="text-xl font-black text-white">{summary.itemCount}</p>
                    </div>
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3">
                      <p className="text-[10px] font-black uppercase text-violet-300">Total</p>
                      <p className="text-xl font-black text-white">{formatMoney(summary.total)}</p>
                    </div>
                  </div>

                  <div className="relative z-30">
                    <div className="relative">
                      <User
                        className={`absolute left-3 top-1/2 -translate-y-1/2 ${selectedPerson ? 'text-emerald-400' : 'text-cyan-500'}`}
                        size={16}
                      />
                      <input
                        value={personSearch}
                        onChange={(event) => {
                          setPersonSearch(event.target.value);
                          setSelectedPerson(null);
                          setShowPersonDropdown(true);
                        }}
                        onFocus={() => setShowPersonDropdown(true)}
                        onBlur={() => window.setTimeout(() => setShowPersonDropdown(false), 200)}
                        placeholder={`${personLabel} အမည် ရှာရန် / အသစ်ထည့်ရန်`}
                        className={`w-full rounded-2xl border bg-black/40 py-3 pl-10 pr-3 text-sm text-white outline-none ${
                          selectedPerson ? 'border-emerald-500/40' : 'border-cyan-500/20 focus:border-cyan-400'
                        }`}
                      />

                      {showPersonDropdown && personSearch.trim().length > 0 && filteredPersons.length > 0 && (
                        <div className="absolute left-0 top-full z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-cyan-500/30 bg-[#0b1220] shadow-2xl">
                          {filteredPersons.map((person) => (
                            <button
                              key={person.id}
                              type="button"
                              onMouseDown={() => {
                                setSelectedPerson(person);
                                setPersonSearch(person.name);
                                setNewPersonPhone('');
                                setNewPersonAddress('');
                                setShowPersonDropdown(false);
                              }}
                              className="block w-full border-b border-white/5 px-4 py-3 text-left last:border-b-0 hover:bg-cyan-500/10"
                            >
                              <p className="font-black text-white">{person.name}</p>
                              <p className="text-xs text-slate-400">
                                {person.phone || 'No phone'} • Debt: {formatMoney(person.totalDebt)} Ks
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {!selectedPerson && personSearch.trim().length > 0 && !isWalkInName(personSearch, entryTab) && (
                      <div className="mt-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <p className="mb-2 text-xs font-bold text-emerald-300">
                          <span className="text-white">"{personSearch}"</span> ကို {personLabel} အသစ်အဖြစ် သိမ်းမည်
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            value={newPersonPhone}
                            onChange={(event) => setNewPersonPhone(event.target.value)}
                            placeholder="Phone"
                            className="rounded-xl border border-emerald-500/20 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                          />
                          <input
                            value={newPersonAddress}
                            onChange={(event) => setNewPersonAddress(event.target.value)}
                            placeholder="Address"
                            className="rounded-xl border border-emerald-500/20 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-3 shadow-2xl shadow-cyan-950/10 sm:p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="flex items-center gap-2 font-black text-white">
                      <Search size={18} className="text-cyan-400" />
                      Quick Filters
                    </h2>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelCategory('All');
                          setProdSearch('');
                        }}
                        className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-black text-white active:scale-95"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        aria-label="Open barcode scanner"
                        className="flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-[#06111f] active:scale-95"
                      >
                        <ScanLine size={16} /> Scan
                      </button>
                    </div>
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

                    {filteredProducts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                        <AlertTriangle className="mx-auto mb-2 text-slate-600" size={30} />
                        <p className="font-bold text-slate-500">Product မတွေ့ပါ</p>
                        <p className="mt-1 text-xs text-slate-600">Search / Category ပြန်စစ်ပါ</p>
                      </div>
                    )}
                  </div>
                </section>

                <div className="xl:hidden">
                  <SidePanel
                    cart={cart}
                    products={safeProducts}
                    entryTab={entryTab}
                    cartTotals={cartTotals}
                    globalDiscountAmt={globalDiscountAmt}
                    setGlobalDiscountAmt={setGlobalDiscountAmt}
                    globalDiscountType={globalDiscountType}
                    setGlobalDiscountType={setGlobalDiscountType}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    paidAmount={paidAmount}
                    setPaidAmount={setPaidAmount}
                    submitTransaction={submitTransaction}
                    loading={loading}
                    handleHoldInvoiceClick={handleHoldInvoiceClick}
                    receiptRecord={latestReceipt}
                    shopSettings={shopSettings}
                    onUpdateQty={updateCartItemQty}
                    onUpdateUnit={updateCartItemUnit}
                    onUpdatePriceType={updateCartItemPriceType}
                    onUpdateDiscount={updateCartItemDiscount}
                    onUpdatePrice={updateCartItemPrice}
                    onRemove={removeCartItem}
                  />
                </div>

                {canCreateSale && entryTab === 'Sale' && (
                  <section className="rounded-3xl border border-indigo-500/20 bg-[#0d1120]/95 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-sm font-black text-indigo-300">
                        <RotateCcw size={16} /> Saved Hold Bills
                      </h2>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetchDrafts();
                          setShowDrafts((prev) => !prev);
                        }}
                        className="rounded-xl bg-indigo-500/10 px-3 py-2 text-xs font-black text-indigo-300"
                      >
                        {showDrafts ? 'Hide' : `Show (${drafts.length})`}
                      </button>
                    </div>

                    {showDrafts && (
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {drafts.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">
                            Hold Bill မရှိပါ
                          </p>
                        ) : (
                          drafts.map((draft) => (
                            <div key={draft.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/30 p-3">
                              <div className="min-w-0">
                                <p className="truncate font-black text-white">{draft.draftName}</p>
                                <p className="text-xs text-slate-500">
                                  {draft.cart?.length || 0} items • {formatMoney(draft.cartTotals?.total)} Ks
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => restoreDraft(draft)}
                                  className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-[#06111f]"
                                >
                                  Restore
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteDraft(draft.id)}
                                  className="rounded-xl bg-rose-500/20 p-2 text-rose-300"
                                  aria-label="Delete draft"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </section>
                )}
              </main>

              <aside className="hidden xl:block">
                <SidePanel
                  cart={cart}
                  products={safeProducts}
                  entryTab={entryTab}
                  cartTotals={cartTotals}
                  globalDiscountAmt={globalDiscountAmt}
                  setGlobalDiscountAmt={setGlobalDiscountAmt}
                  globalDiscountType={globalDiscountType}
                  setGlobalDiscountType={setGlobalDiscountType}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  paidAmount={paidAmount}
                  setPaidAmount={setPaidAmount}
                  submitTransaction={submitTransaction}
                  loading={loading}
                  handleHoldInvoiceClick={handleHoldInvoiceClick}
                  receiptRecord={latestReceipt}
                  shopSettings={shopSettings}
                  onUpdateQty={updateCartItemQty}
                  onUpdateUnit={updateCartItemUnit}
                  onUpdatePriceType={updateCartItemPriceType}
                  onUpdateDiscount={updateCartItemDiscount}
                  onUpdatePrice={updateCartItemPrice}
                  onRemove={removeCartItem}
                />
              </aside>
            </div>
          )}
        </div>
      </div>

      {latestReceipt && (
        <div id="receipt-print-area" className="hidden bg-white text-black print:block">
          <ReceiptContent record={latestReceipt} shopSettings={shopSettings} />
        </div>
      )}

      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }

          html,
          body {
            width: 80mm !important;
            min-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden !important;
          }

          #receipt-print-area,
          #receipt-print-area * {
            visibility: visible !important;
          }

          #receipt-print-area {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }

          #receipt-print-area table {
            width: 100% !important;
          }
        }

        @media screen {
          #receipt-print-area {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
'''

path = Path('/mnt/data/EntryPage.jsx')
path.write_text(code, encoding='utf-8')
path
