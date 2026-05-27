import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { collection, doc, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ShoppingCart, PlusCircle, Trash2, Search, ScanBarcode,
  Wallet, X, Printer, Tag, User, Calendar, Loader2,
  AlertTriangle, Package, CreditCard, Pause, Play,
  ChevronDown, ChevronUp, Minus, Plus, FileText,
  CheckCircle, RefreshCw, Zap
} from 'lucide-react';

// ─── Price Types ────────────────────────────────────────────────────────────
const PRICE_TYPES = ['retail', 'wholesaleA', 'wholesaleB', 'wholesaleC'];
const PRICE_LABELS = {
  retail: 'Retail',
  wholesaleA: 'WS-A',
  wholesaleB: 'WS-B',
  wholesaleC: 'WS-C',
};
const PAYMENT_METHODS = ['Cash', 'Kpay', 'Wave', 'AYAPay', 'Credit'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => (Number(n) || 0).toLocaleString();

function playBeep(type = 'success') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type === 'success' ? 'sine' : 'square';
    osc.frequency.value = type === 'success' ? 900 : 180;
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function useDebounce(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// EntryTabs
const EntryTabs = memo(({ tab, onChange }) => (
  <div className="grid grid-cols-3 gap-2">
    {['Sale', 'Purchase', 'Expense'].map((t) => (
      <button
        key={t}
        onClick={() => onChange(t)}
        className={`py-1.5 rounded-lg font-black text-xs border transition-all ${
          tab === t
            ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-500/20'
            : 'bg-[#0d1120] border-white/5 text-slate-500 hover:border-white/10'
        }`}
      >
        {t}
      </button>
    ))}
  </div>
));

// CustomerSection
const CustomerSection = memo(({ personName, setPersonName, barcodeInput, setBarcodeInput, onBarcodeSubmit, onScanClick }) => (
  <div className="flex gap-1.5">
    <div className="relative flex-1">
      <User className="absolute left-2.5 top-2 text-cyan-500" size={14} />
      <input
        value={personName}
        onChange={(e) => setPersonName(e.target.value)}
        placeholder="Customer / Supplier"
        className="w-full bg-black/40 border border-cyan-500/20 rounded-lg pl-8 pr-2 py-2 text-xs text-white outline-none focus:border-cyan-500/50"
      />
    </div>
    <div className="relative flex-1">
      <ScanBarcode className="absolute left-2.5 top-2 text-blue-500" size={14} />
      <input
        value={barcodeInput}
        onChange={(e) => setBarcodeInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onBarcodeSubmit(barcodeInput); }}
        placeholder="Barcode / Enter"
        className="w-full bg-black/40 border border-blue-500/20 rounded-lg pl-8 pr-2 py-2 text-xs text-white outline-none focus:border-blue-500/50"
      />
    </div>
    <button
      onClick={onScanClick}
      className="px-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
    >
      <ScanBarcode size={16} />
    </button>
  </div>
));

// CategoryFilter
const CategoryFilter = memo(({ categories, selected, onSelect }) => (
  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
    {categories.map((cat) => (
      <button
        key={cat}
        onClick={() => onSelect(cat)}
        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
          selected === cat
            ? 'bg-cyan-600 text-white'
            : 'bg-black/40 text-slate-400 border border-white/5 hover:border-white/10'
        }`}
      >
        {cat}
      </button>
    ))}
  </div>
));

// ProductCard
const ProductCard = memo(({ prod, isSelected, onClick }) => (
  <button
    onClick={() => onClick(prod)}
    className={`bg-[#0d1120] border-2 rounded-lg p-1.5 text-center transition-all active:scale-95 ${
      isSelected ? 'border-cyan-400 bg-cyan-900/20' : 'border-white/5 hover:border-white/10'
    }`}
  >
    <div className="w-7 h-7 mx-auto bg-cyan-500/10 rounded-md flex items-center justify-center mb-0.5">
      <Package size={12} className="text-cyan-400" />
    </div>
    <p className="text-[10px] font-bold text-white truncate">{prod.name}</p>
    <p className="text-[10px] text-cyan-400 font-bold">
      {fmt(prod.packageUnits?.[0]?.prices?.retail || 0)}
    </p>
    <p className={`text-[10px] ${(prod.stockBase || 0) < 10 ? 'text-rose-400' : 'text-slate-500'}`}>
      ({prod.stockBase ?? prod.stock ?? 0})
    </p>
  </button>
));

// ProductSearch
const ProductSearch = memo(({ value, onChange }) => (
  <div className="relative">
    <Search className="absolute left-2.5 top-2 text-cyan-500" size={14} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search product..."
      className="w-full bg-black border border-cyan-500/20 rounded-lg pl-8 pr-8 py-2 text-xs text-white outline-none focus:border-cyan-500/40"
    />
    {value && (
      <button onClick={() => onChange('')} className="absolute right-2 top-1.5 text-slate-500 hover:text-white">
        <X size={14} />
      </button>
    )}
  </div>
));

// ProductDetailPanel
const ProductDetailPanel = memo(({ product, selectedUnit, priceType, unitPrice, quantity, entryTab, onUnitChange, onPriceTypeChange, onUnitPriceChange, onQuantityChange, onAdd, stockWarning }) => {
  if (!product || !selectedUnit) return null;

  const stockBase = product.stockBase ?? product.stock ?? 0;
  const stockNeeded = Number(quantity || 0) * (selectedUnit.multiplier || selectedUnit.factor || 1);
  const isOverStock = entryTab === 'Sale' && stockNeeded > stockBase;

  return (
    <div className="bg-[#0d1120] border border-cyan-500/20 rounded-lg p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-cyan-400">{product.name}</p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isOverStock ? 'bg-rose-900/30 text-rose-400 border border-rose-500/20' : 'bg-emerald-900/20 text-emerald-400'}`}>
          Stock: {stockBase}
        </span>
      </div>

      {stockWarning && (
        <div className="flex items-center gap-1 text-rose-400 text-[10px] bg-rose-950/30 border border-rose-500/20 rounded px-2 py-1">
          <AlertTriangle size={10} /> {stockWarning}
        </div>
      )}

      <div className="flex gap-1.5">
        {/* Unit selector */}
        <select
          value={selectedUnit?.name || ''}
          onChange={(e) => onUnitChange(e.target.value)}
          className="flex-1 bg-black border border-cyan-500/20 rounded-md px-2 py-1.5 text-[11px] text-white outline-none"
        >
          {product.packageUnits?.map((unit) => (
            <option key={unit.name} value={unit.name}>
              {unit.name} (×{unit.multiplier ?? unit.factor ?? 1})
            </option>
          ))}
        </select>

        {/* Price type */}
        {entryTab === 'Sale' && (
          <select
            value={priceType}
            onChange={(e) => onPriceTypeChange(e.target.value)}
            className="flex-1 bg-black border border-cyan-500/20 rounded-md px-2 py-1.5 text-[11px] text-white outline-none"
          >
            {PRICE_TYPES.map((pt) => (
              <option key={pt} value={pt}>{PRICE_LABELS[pt]}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-1.5 items-center">
        <div className="flex flex-col">
          <label className="text-[9px] text-slate-500 mb-0.5">Price</label>
          <input
            value={unitPrice}
            onChange={(e) => onUnitPriceChange(e.target.value)}
            className="w-20 bg-black/40 border border-cyan-500/20 rounded-md px-2 py-1.5 text-[11px] text-white text-center outline-none focus:border-cyan-400"
          />
        </div>
        <span className="text-slate-500 text-[10px] mt-4">×</span>
        <div className="flex flex-col">
          <label className="text-[9px] text-slate-500 mb-0.5">Qty</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onQuantityChange(String(Math.max(1, Number(quantity) - 1)))}
              className="w-6 h-6 rounded bg-black/40 border border-white/10 flex items-center justify-center text-white hover:bg-cyan-900/30"
            >
              <Minus size={10} />
            </button>
            <input
              value={quantity}
              onChange={(e) => onQuantityChange(e.target.value)}
              className="w-10 bg-black/40 border border-cyan-500/20 rounded-md px-1 py-1.5 text-[11px] text-white text-center outline-none focus:border-cyan-400"
            />
            <button
              onClick={() => onQuantityChange(String(Number(quantity) + 1))}
              className="w-6 h-6 rounded bg-black/40 border border-white/10 flex items-center justify-center text-white hover:bg-cyan-900/30"
            >
              <Plus size={10} />
            </button>
          </div>
        </div>
        <button
          onClick={onAdd}
          disabled={isOverStock && entryTab === 'Sale'}
          className="flex-1 mt-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-md font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all"
        >
          <PlusCircle size={12} /> Add
        </button>
      </div>

      {/* Subtotal preview */}
      {unitPrice && quantity && (
        <p className="text-right text-[10px] text-cyan-300 font-bold">
          = {fmt(Number(unitPrice) * Number(quantity))} Ks
          {selectedUnit && (
            <span className="text-slate-500 ml-1">
              (base: {Number(quantity) * (selectedUnit.multiplier ?? selectedUnit.factor ?? 1)})
            </span>
          )}
        </p>
      )}
    </div>
  );
});

// CartItem
const CartItem = memo(({ item, onRemove, onUpdateDiscount, onUpdateQty }) => {
  const [expanded, setExpanded] = useState(false);
  const subtotal = item.unitPrice * item.quantity - (item.itemDiscountAmt || 0);

  return (
    <div className="bg-black/40 border border-cyan-500/10 rounded-lg overflow-hidden">
      <div className="p-2 flex justify-between items-start gap-1">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xs truncate">{item.name}</p>
          <p className="text-cyan-400 text-[10px] mt-0.5">
            {fmt(item.unitPrice)} × {item.quantity} {item.unitName} = {fmt(subtotal)} Ks
          </p>
          <p className="text-[9px] text-slate-500">
            {PRICE_LABELS[item.priceType] || item.priceType} | ×{item.multiplier}
            {item.itemDiscountAmt > 0 && <span className="text-amber-400 ml-1">-{fmt(item.itemDiscountAmt)} disc</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-500 hover:text-white p-0.5"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={() => onRemove(item.id)} className="text-rose-400 hover:text-rose-300 p-0.5">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-2 pb-2 pt-1.5 flex gap-2 items-center">
          {/* Qty stepper */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdateQty(item.id, Math.max(1, item.quantity - 1))}
              className="w-5 h-5 rounded bg-black/60 border border-white/10 flex items-center justify-center text-white"
            >
              <Minus size={9} />
            </button>
            <span className="text-xs w-6 text-center text-white">{item.quantity}</span>
            <button
              onClick={() => onUpdateQty(item.id, item.quantity + 1)}
              className="w-5 h-5 rounded bg-black/60 border border-white/10 flex items-center justify-center text-white"
            >
              <Plus size={9} />
            </button>
          </div>
          {/* Item discount */}
          <div className="flex items-center gap-1 flex-1">
            <Tag size={10} className="text-amber-400" />
            <input
              value={item.itemDiscountAmt || ''}
              onChange={(e) => onUpdateDiscount(item.id, e.target.value)}
              placeholder="Item disc"
              className="w-full bg-black border border-amber-500/20 rounded px-1.5 py-1 text-[10px] text-white outline-none"
            />
            <span className="text-[10px] text-amber-400">Ks</span>
          </div>
        </div>
      )}
    </div>
  );
});

// CartSection
const CartSection = memo(({ cart, onRemove, onUpdateDiscount, onUpdateQty, globalDiscountAmt, setGlobalDiscountAmt, globalDiscountType, setGlobalDiscountType, cartTotals, paymentMethod, setPaymentMethod, paidAmount, setPaidAmount, onSubmit, onHold, loading }) => {
  if (cart.length === 0) return null;
  const change = Math.max(0, (Number(paidAmount) || 0) - cartTotals.total);
  const debt = Math.max(0, cartTotals.total - (paidAmount === '' ? cartTotals.total : Number(paidAmount) || 0));

  return (
    <div className="space-y-1.5">
      {cart.map((item) => (
        <CartItem
          key={item.id}
          item={item}
          onRemove={onRemove}
          onUpdateDiscount={onUpdateDiscount}
          onUpdateQty={onUpdateQty}
        />
      ))}

      {/* Global discount */}
      <div className="flex gap-1.5 items-end text-[10px]">
        <div className="flex-1">
          <label className="text-[9px] text-slate-500">Global Discount</label>
          <input
            value={globalDiscountAmt}
            onChange={(e) => setGlobalDiscountAmt(e.target.value)}
            placeholder="0"
            className="w-full bg-black/40 border border-amber-500/20 rounded-md px-2 py-1.5 text-amber-400 outline-none"
          />
        </div>
        {['%', 'Ks'].map((t) => (
          <button
            key={t}
            onClick={() => setGlobalDiscountType(t === 'Ks' ? 'flat' : '%')}
            className={`px-2.5 py-1.5 rounded text-[10px] font-bold transition-all ${
              (t === '%' ? globalDiscountType === '%' : globalDiscountType === 'flat')
                ? 'bg-amber-600 text-white'
                : 'bg-black/40 text-slate-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Totals */}
      <div className="bg-black/50 border border-cyan-500/20 rounded-lg p-2 space-y-1 text-[10px]">
        <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{fmt(cartTotals.subtotal)} Ks</span></div>
        {cartTotals.itemDiscounts > 0 && <div className="flex justify-between text-amber-400"><span>Item Disc</span><span>-{fmt(cartTotals.itemDiscounts)} Ks</span></div>}
        {cartTotals.globalDisc > 0 && <div className="flex justify-between text-amber-400"><span>Global Disc</span><span>-{fmt(cartTotals.globalDisc)} Ks</span></div>}
        <div className="flex justify-between text-sm font-black text-cyan-300 border-t border-cyan-500/20 pt-1.5">
          <span>TOTAL</span><span>{fmt(cartTotals.total)} Ks</span>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="grid grid-cols-5 gap-1">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m}
            onClick={() => setPaymentMethod(m)}
            className={`py-1.5 rounded-md text-[8px] font-bold border transition-all ${
              paymentMethod === m
                ? 'bg-cyan-600 border-cyan-400 text-white'
                : 'bg-black/40 border-white/5 text-slate-400 hover:border-white/10'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Paid Amount */}
      <div className="relative">
        <Wallet className="absolute left-2.5 top-1.5 text-emerald-400" size={12} />
        <input
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          placeholder={paymentMethod === 'Credit' ? '0' : 'Paid (empty = full)'}
          readOnly={paymentMethod === 'Credit'}
          className="w-full bg-black/40 border border-emerald-500/20 rounded-md pl-8 pr-2 py-1.5 text-[10px] text-emerald-300 outline-none focus:border-emerald-500/40"
        />
      </div>

      {/* Change / Debt indicator */}
      {paidAmount !== '' && (
        <div className="flex gap-2 text-[10px]">
          {change > 0 && <span className="text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded">Change: {fmt(change)} Ks</span>}
          {debt > 0 && paymentMethod !== 'Credit' && <span className="text-rose-400 bg-rose-900/20 px-2 py-0.5 rounded">Debt: {fmt(debt)} Ks</span>}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onHold}
          className="px-3 py-2.5 rounded-lg bg-amber-900/30 border border-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center gap-1 hover:bg-amber-900/50 transition-all"
        >
          <Pause size={12} /> Hold
        </button>
        <button
          onClick={onSubmit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-[0.99] transition-all shadow-lg shadow-cyan-500/20"
        >
          {loading
            ? <><Loader2 className="animate-spin" size={14} /> Processing...</>
            : <><CheckCircle size={14} /> Complete Sale</>
          }
        </button>
      </div>
    </div>
  );
});

// HoldOrders panel
const HoldOrdersPanel = memo(({ holdOrders, onRestore, onDelete }) => {
  if (holdOrders.length === 0) return (
    <div className="text-center text-slate-500 text-xs py-6">No held orders</div>
  );
  return (
    <div className="space-y-1.5">
      {holdOrders.map((order) => (
        <div key={order.id} className="bg-[#0d1120] border border-amber-500/20 rounded-lg p-2 flex justify-between items-start gap-2">
          <div>
            <p className="text-xs font-bold text-amber-300">{order.personName || 'Walk-in'}</p>
            <p className="text-[10px] text-slate-400">{order.cart.length} item(s) — {fmt(order.total)} Ks</p>
            <p className="text-[9px] text-slate-600">{new Date(order.savedAt).toLocaleTimeString()}</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onRestore(order)}
              className="px-2 py-1 bg-cyan-700 rounded text-[10px] font-bold text-white flex items-center gap-1"
            >
              <Play size={10} /> Restore
            </button>
            <button
              onClick={() => onDelete(order.id)}
              className="px-1.5 py-1 bg-rose-900/30 border border-rose-500/20 rounded text-rose-400"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});

// ReceiptModal
const ReceiptModal = memo(({ record, shopName, shopPhone, shopAddress, onPrint, onClose }) => {
  if (!record) return null;
  const items = record.itemsDetail || [];
  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white text-black rounded-3xl p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="text-center border-b border-dashed pb-4 mb-4">
          <h2 className="text-xl font-black">{shopName}</h2>
          <p className="text-xs text-gray-500">📞 {shopPhone}</p>
          <p className="text-xs text-gray-500">📍 {shopAddress}</p>
          <p className="text-xs text-gray-500 mt-1">📅 {record.date}</p>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{record.id?.slice(-8)}</p>
        </div>
        <div className="space-y-2 text-sm mb-4">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between gap-1">
              <span className="flex-1">
                {item.name} ×{item.quantity} <span className="text-gray-400 text-xs">({item.unitName})</span>
                {item.priceType !== 'retail' && <span className="text-xs text-gray-400 ml-1">[{PRICE_LABELS[item.priceType]}]</span>}
                {item.itemDiscountAmt > 0 && <span className="block text-xs text-gray-400">Disc: -{fmt(item.itemDiscountAmt)}</span>}
              </span>
              <span className="font-bold">{fmt(item.unitPrice * item.quantity - (item.itemDiscountAmt || 0))}</span>
            </div>
          ))}
        </div>
        {(record.globalDiscount || 0) > 0 && (
          <p className="text-right text-sm text-gray-500 mb-1">Disc: -{fmt(record.globalDiscount)} Ks</p>
        )}
        <div className="border-t pt-3 flex justify-between text-xl font-black mb-2">
          <span>TOTAL</span><span>{fmt(record.amount)} Ks</span>
        </div>
        <div className="text-sm text-right space-y-0.5 text-gray-600 mb-4">
          <p>Method: {record.paymentMethod}</p>
          <p>Paid: {fmt(record.paidAmount)} Ks</p>
          {record.remainingDebt > 0 && <p className="text-rose-600 font-bold">Debt: {fmt(record.remainingDebt)} Ks</p>}
        </div>
        <p className="text-center text-xs text-gray-400 border-t pt-3 mb-4">ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်</p>
        <div className="flex gap-2">
          <button
            onClick={() => onPrint(record)}
            className="flex-1 py-3 rounded-2xl bg-cyan-600 text-white font-black flex items-center justify-center gap-2"
          >
            <Printer size={16} /> Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-gray-200 text-black font-black"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

// BarcodeScannerModal
const BarcodeScannerModal = memo(({ onClose }) => (
  <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
    <div className="w-full max-w-lg bg-[#0d1120] border border-cyan-500/20 rounded-3xl p-6">
      <div className="flex justify-between mb-5">
        <h2 className="text-xl font-black"><ScanBarcode className="inline text-cyan-400 mr-2" />Scanner</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
      </div>
      <div id="barcode-reader" className="overflow-hidden rounded-2xl" />
    </div>
  </div>
));

// ExpenseSection
const ExpenseSection = memo(({ title, setTitle, amount, setAmount, onSubmit, loading }) => (
  <div className="space-y-2">
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="Expense Title"
      className="w-full bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/40"
    />
    <input
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
      placeholder="Amount (Ks)"
      type="number"
      className="w-full bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/40"
    />
    <button
      onClick={onSubmit}
      disabled={loading || !title || !amount}
      className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 font-black text-xs disabled:opacity-50 active:scale-[0.99] transition-all"
    >
      {loading ? 'Saving...' : 'Save Expense'}
    </button>
  </div>
));

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EntryPage({ products = [] }) {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;
  const shopName = profile?.shopName || 'QuickPOS';
  const shopPhone = profile?.phone || '09-123456789';
  const shopAddress = profile?.address || 'No.123, Yangon';

  const todayISO = new Date().toISOString().split('T')[0];

  // ── State ────────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [entryTab, setEntryTab] = useState('Sale');
  const [entryDate, setEntryDate] = useState(todayISO);
  const [activePanel, setActivePanel] = useState('entry'); // 'entry' | 'hold'

  // Customer / Barcode
  const [personName, setPersonName] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Product selection
  const [prodSearch, setProdSearch] = useState('');
  const debouncedSearch = useDebounce(prodSearch, 150);
  const [selCategory, setSelCategory] = useState('All');
  const [selProdId, setSelProdId] = useState('');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [priceType, setPriceType] = useState('retail');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [stockWarning, setStockWarning] = useState('');

  // Cart
  const [cart, setCart] = useState([]);
  const [globalDiscountAmt, setGlobalDiscountAmt] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('%');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');

  // Hold Orders (local state)
  const [holdOrders, setHoldOrders] = useState([]);

  // Modals
  const [showScanner, setShowScanner] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });

  // Expense
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmt, setExpenseAmt] = useState('');

  const scannerRef = useRef(null);

  // ── Credit => paid = 0 ───────────────────────────────────────────────────────
  useEffect(() => {
    if (paymentMethod === 'Credit') setPaidAmount('0');
  }, [paymentMethod]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const categories = useMemo(
    () => ['All', ...new Set(products.map((p) => p.category).filter(Boolean))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selCategory !== 'All') result = result.filter((p) => p.category === selCategory);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.barcode || '').includes(q) ||
          (p.packageUnits || []).some((u) =>
            (u.barcode || '') === q ||
            Object.values(u.barcodes || {}).includes(q)
          )
      );
    }
    return result.slice(0, 30);
  }, [products, debouncedSearch, selCategory]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selProdId) || null,
    [products, selProdId]
  );

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((a, i) => a + i.unitPrice * i.quantity, 0);
    const itemDiscounts = cart.reduce((a, i) => a + Number(i.itemDiscountAmt || 0), 0);
    const base = subtotal - itemDiscounts;
    const globalDisc =
      globalDiscountType === '%'
        ? base * (Number(globalDiscountAmt || 0) / 100)
        : Number(globalDiscountAmt || 0);
    return { subtotal, itemDiscounts, globalDisc, total: Math.max(base - globalDisc, 0) };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const selectProduct = useCallback((prod) => {
    setSelProdId(prod.id);
    setProdSearch(prod.name);
    const defaultUnit = prod.packageUnits?.[0] || null;
    setSelectedUnit(defaultUnit);
    if (defaultUnit) {
      setUnitPrice(
        String(
          entryTab === 'Sale'
            ? defaultUnit.prices?.[priceType] || defaultUnit.prices?.retail || 0
            : defaultUnit.costPrice || defaultUnit.cost || 0
        )
      );
    }
    setQuantity('1');
    setStockWarning('');
  }, [entryTab, priceType]);

  const handleUnitChange = useCallback((unitName) => {
    const prod = products.find((p) => p.id === selProdId);
    const unit = prod?.packageUnits?.find((u) => u.name === unitName);
    if (!unit) return;
    setSelectedUnit(unit);
    setUnitPrice(
      String(
        entryTab === 'Sale'
          ? unit.prices?.[priceType] || unit.prices?.retail || 0
          : unit.costPrice || unit.cost || 0
      )
    );
    setStockWarning('');
  }, [products, selProdId, entryTab, priceType]);

  const handlePriceTypeChange = useCallback((type) => {
    setPriceType(type);
    if (selectedUnit) setUnitPrice(String(selectedUnit.prices?.[type] || 0));
  }, [selectedUnit]);

  const handleBarcodeSubmit = useCallback((value) => {
    const code = value.trim();
    if (!code) return;
    for (const p of products) {
      for (const unit of p.packageUnits || []) {
        const matches =
          unit.barcode === code ||
          unit.barcodes?.retail === code ||
          unit.barcodes?.wholesale === code ||
          Object.values(unit.barcodes || {}).includes(code);
        if (matches) {
          setSelProdId(p.id);
          setProdSearch(p.name);
          setSelectedUnit(unit);
          setUnitPrice(
            String(
              entryTab === 'Sale'
                ? unit.prices?.[priceType] || unit.prices?.retail || 0
                : unit.costPrice || unit.cost || 0
            )
          );
          setQuantity('1');
          playBeep('success');
          setBarcodeInput('');
          setStockWarning('');
          return;
        }
      }
    }
    playBeep('error');
  }, [products, entryTab, priceType]);

  const addToCart = useCallback(() => {
    if (!selProdId || !selectedUnit || !unitPrice || !quantity) return;
    const prod = products.find((x) => x.id === selProdId);
    if (!prod) return;

    const factor = selectedUnit.multiplier ?? selectedUnit.factor ?? 1;
    const stockBase = prod.stockBase ?? Number(prod.stock) ?? 0;

    if (entryTab === 'Sale') {
      const stockNeeded = Number(quantity) * factor;
      if (stockBase < stockNeeded) {
        setStockWarning(`Stock မလုံလောက်ပါ (${stockBase} base units available)`);
        playBeep('error');
        return;
      }
    }

    const pr = Number(unitPrice);
    const q = Number(quantity);
    const baseQty = q * factor;

    setCart((prev) => {
      const ex = prev.find(
        (x) =>
          x.productId === prod.id &&
          x.unitName === selectedUnit.name &&
          x.priceType === priceType
      );
      if (ex) {
        return prev.map((x) =>
          x.id === ex.id
            ? { ...x, quantity: x.quantity + q, baseQuantity: x.baseQuantity + baseQty }
            : x
        );
      }
      return [
        ...prev,
        {
          id: Date.now(),
          productId: prod.id,
          name: prod.name,
          unitName: selectedUnit.name,
          multiplier: factor,
          quantity: q,
          baseQuantity: baseQty,
          priceType,
          unitPrice: pr,
          costPrice:
            entryTab === 'Sale'
              ? selectedUnit.costPrice || selectedUnit.cost || 0
              : pr,
          itemDiscountAmt: 0,
        },
      ];
    });

    setProdSearch('');
    setSelProdId('');
    setSelectedUnit(null);
    setUnitPrice('');
    setQuantity('1');
    setStockWarning('');
    playBeep('success');
  }, [selProdId, selectedUnit, unitPrice, quantity, products, entryTab, priceType]);

  const removeFromCart = useCallback((id) => setCart((prev) => prev.filter((c) => c.id !== id)), []);

  const updateItemDiscount = useCallback((id, amt) => {
    setCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, itemDiscountAmt: Number(amt) || 0 } : c))
    );
  }, []);

  const updateItemQty = useCallback((id, qty) => {
    setCart((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, quantity: qty, baseQuantity: qty * (c.multiplier || 1) }
          : c
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setPersonName('');
    setGlobalDiscountAmt('');
    setPaidAmount('');
    setPaymentMethod('Cash');
    setProdSearch('');
    setSelProdId('');
    setSelectedUnit(null);
    setUnitPrice('');
    setQuantity('1');
    setStockWarning('');
  }, []);

  // Hold Order
  const holdOrder = useCallback(() => {
    if (cart.length === 0) return;
    setHoldOrders((prev) => [
      ...prev,
      {
        id: Date.now(),
        personName,
        cart: [...cart],
        total: cartTotals.total,
        globalDiscountAmt,
        globalDiscountType,
        paymentMethod,
        savedAt: Date.now(),
      },
    ]);
    clearCart();
  }, [cart, personName, cartTotals.total, globalDiscountAmt, globalDiscountType, paymentMethod, clearCart]);

  const restoreHoldOrder = useCallback((order) => {
    setCart(order.cart);
    setPersonName(order.personName || '');
    setGlobalDiscountAmt(order.globalDiscountAmt || '');
    setGlobalDiscountType(order.globalDiscountType || '%');
    setPaymentMethod(order.paymentMethod || 'Cash');
    setHoldOrders((prev) => prev.filter((o) => o.id !== order.id));
    setActivePanel('entry');
  }, []);

  const deleteHoldOrder = useCallback((id) => {
    setHoldOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  // Scanner
  useEffect(() => {
    if (!showScanner) return;
    let html5QrCode;
    const start = async () => {
      try {
        html5QrCode = new Html5Qrcode('barcode-reader');
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => {
            handleBarcodeSubmit(text);
            if (scannerRef.current) {
              scannerRef.current.stop().catch(() => {});
              scannerRef.current = null;
            }
            setShowScanner(false);
          },
          () => {}
        );
      } catch {
        setShowScanner(false);
      }
    };
    start();
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [showScanner, handleBarcodeSubmit]);

  // Submit Transaction
  const submitTransaction = async () => {
    if (cart.length === 0 || !tenantId) return;

    // Final stock check
    if (entryTab === 'Sale') {
      for (const item of cart) {
        const p = products.find((x) => x.id === item.productId);
        const stockBase = p?.stockBase ?? Number(p?.stock) ?? 0;
        if (p && stockBase < item.baseQuantity) {
          alert(`Stock မလုံလောက်ပါ: ${item.name}`);
          return;
        }
      }
    }

    // Validate amounts
    if (cart.some((i) => isNaN(i.unitPrice) || i.unitPrice < 0)) {
      alert('Invalid price detected');
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const ref = doc(collection(db, 'pos_records'));
      const total = cartTotals.total;
      const paid = paidAmount === '' ? total : Number(paidAmount || 0);
      const debt = Math.max(0, total - paid);

      const rec = {
        type: entryTab,
        tenantId,
        personName: personName || 'Walk-in',
        itemsDetail: cart.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          baseQuantity: i.baseQuantity,
          unitPrice: i.unitPrice,
          costPrice: i.costPrice,
          itemDiscountAmt: i.itemDiscountAmt,
          unitName: i.unitName,
          multiplier: i.multiplier,
          priceType: i.priceType,
        })),
        amount: total,
        subtotal: cartTotals.subtotal,
        itemDiscount: cartTotals.itemDiscounts,
        globalDiscount: cartTotals.globalDisc,
        paymentMethod,
        paidAmount: paid,
        remainingDebt: debt,
        date: entryDate,
        createdAt: serverTimestamp(),
      };

      batch.set(ref, rec);

      // Update stock (base units)
      cart.forEach((item) => {
        const p = products.find((x) => x.id === item.productId);
        if (p) {
          const currentStock = p.stockBase ?? Number(p.stock) ?? 0;
          const newStock = entryTab === 'Sale'
            ? Math.max(0, currentStock - item.baseQuantity)
            : currentStock + item.baseQuantity;
          batch.update(doc(db, 'pos_products', item.productId), { stockBase: newStock });
        }
      });

      await batch.commit();
      setReceiptModal({ show: true, record: { ...rec, id: ref.id } });
      clearCart();
    } catch (err) {
      console.error(err);
      alert('Error saving transaction');
    }
    setLoading(false);
  };

  // Submit Expense
  const submitExpense = async () => {
    if (!expenseTitle || !expenseAmt || !tenantId) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'pos_records'), {
        type: 'Expense',
        tenantId,
        item: expenseTitle,
        amount: Number(expenseAmt),
        date: entryDate,
        createdAt: serverTimestamp(),
      });
      setExpenseTitle('');
      setExpenseAmt('');
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Print Receipt
  const doPrint = (record) => {
    const items = record.itemsDetail || [];
    const w = window.open('', '_blank', 'width=400,height=650');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
<style>
body{font-family:'Courier New',monospace;font-size:13px;width:360px;margin:10px auto;padding:15px;border:2px dashed #000;background:#fff;}
.header{text-align:center;border-bottom:2px dashed #000;padding-bottom:12px;margin-bottom:12px;}
.shop-name{font-size:20px;font-weight:bold;}
.shop-info{font-size:11px;color:#555;margin:3px 0;}
table{width:100%;border-collapse:collapse;margin:10px 0;}
th{text-align:left;border-bottom:1px solid #000;padding:4px 0;font-size:12px;}
td{padding:4px 0;font-size:12px;}
td:last-child{text-align:right;}
.total-row{font-weight:bold;font-size:18px;border-top:2px solid #000;padding-top:10px;margin-top:8px;}
.footer{text-align:center;margin-top:15px;font-size:11px;color:#555;border-top:1px dashed #000;padding-top:10px;}
.disc{color:#888;font-size:11px;}
</style></head><body>
<div class="header">
<div class="shop-name">${shopName}</div>
<div class="shop-info">📞 ${shopPhone}</div>
<div class="shop-info">📍 ${shopAddress}</div>
<div class="shop-info">📅 ${record.date || ''}</div>
<div class="shop-info">🧾 #${record.id?.slice(-8) || ''}</div>
</div>
<table>
<thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
<tbody>
${items.map((i) => `
<tr>
<td>${i.name}${i.itemDiscountAmt > 0 ? `<br><small class="disc">Disc: -${fmt(i.itemDiscountAmt)}</small>` : ''}</td>
<td>${i.quantity}</td>
<td>${i.unitName || '-'}${i.priceType !== 'retail' ? `<br><small>${PRICE_LABELS[i.priceType] || i.priceType}</small>` : ''}</td>
<td>${fmt(i.unitPrice * i.quantity - (i.itemDiscountAmt || 0))}</td>
</tr>`).join('')}
</tbody>
</table>
${record.globalDiscount > 0 ? `<p class="disc" style="text-align:right">Global Disc: -${fmt(record.globalDiscount)} Ks</p>` : ''}
<div class="total-row" style="text-align:right;">TOTAL: ${fmt(record.amount)} Ks</div>
<p style="text-align:right;font-size:12px;margin:4px 0;">Method: ${record.paymentMethod}</p>
<p style="text-align:right;font-size:12px;margin:4px 0;">Paid: ${fmt(record.paidAmount || 0)} Ks</p>
${record.remainingDebt > 0 ? `<p style="text-align:right;font-size:12px;font-weight:bold;color:#cc0000;">Debt: ${fmt(record.remainingDebt)} Ks</p>` : ''}
<div class="footer">ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်<br>Thank you for your purchase!</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    w.document.close();
  };

  // ── Tab change ───────────────────────────────────────────────────────────────
  const handleTabChange = (tab) => {
    setEntryTab(tab);
    clearCart();
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-2 sm:p-4 pb-28 text-white max-w-6xl mx-auto space-y-3 bg-[#080c14] min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg sm:text-xl font-black text-cyan-400">
            <ShoppingCart size={20} className="inline mr-1" />
            POS ENTRY
          </h1>
          {holdOrders.length > 0 && (
            <button
              onClick={() => setActivePanel(activePanel === 'hold' ? 'entry' : 'hold')}
              className="relative px-2 py-0.5 bg-amber-900/40 border border-amber-500/30 rounded-full text-amber-400 text-[10px] font-bold"
            >
              <Pause size={9} className="inline mr-0.5" />
              {holdOrders.length} Hold
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 bg-black/40 border border-cyan-500/20 rounded-2xl px-3 py-1">
          <Calendar size={14} className="text-cyan-400" />
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="bg-transparent text-xs font-bold text-cyan-300 outline-none w-28"
            style={{ colorScheme: 'dark' }}
          />
        </div>
      </div>

      {/* Tabs */}
      <EntryTabs tab={entryTab} onChange={handleTabChange} />

      {/* Hold Orders Panel */}
      {activePanel === 'hold' && (
        <div className="bg-[#0d1120] border border-amber-500/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-black text-amber-400">
              <Pause size={12} className="inline mr-1" />
              HELD ORDERS
            </p>
            <button onClick={() => setActivePanel('entry')} className="text-slate-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <HoldOrdersPanel
            holdOrders={holdOrders}
            onRestore={restoreHoldOrder}
            onDelete={deleteHoldOrder}
          />
        </div>
      )}

      {/* Expense Tab */}
      {entryTab === 'Expense' ? (
        <ExpenseSection
          title={expenseTitle}
          setTitle={setExpenseTitle}
          amount={expenseAmt}
          setAmount={setExpenseAmt}
          onSubmit={submitExpense}
          loading={loading}
        />
      ) : (
        <>
          {/* Customer + Barcode */}
          <CustomerSection
            personName={personName}
            setPersonName={setPersonName}
            barcodeInput={barcodeInput}
            setBarcodeInput={setBarcodeInput}
            onBarcodeSubmit={handleBarcodeSubmit}
            onScanClick={() => setShowScanner(true)}
          />

          {/* Categories */}
          <CategoryFilter
            categories={categories}
            selected={selCategory}
            onSelect={setSelCategory}
          />

          {/* Search */}
          <ProductSearch value={prodSearch} onChange={setProdSearch} />

          {/* Product Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 max-h-48 overflow-y-auto">
            {filteredProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                prod={prod}
                isSelected={selProdId === prod.id}
                onClick={selectProduct}
              />
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center text-slate-500 text-xs py-6">
                No products found
              </div>
            )}
          </div>

          {/* Product Detail / Add to Cart */}
          <ProductDetailPanel
            product={selectedProduct}
            selectedUnit={selectedUnit}
            priceType={priceType}
            unitPrice={unitPrice}
            quantity={quantity}
            entryTab={entryTab}
            onUnitChange={handleUnitChange}
            onPriceTypeChange={handlePriceTypeChange}
            onUnitPriceChange={setUnitPrice}
            onQuantityChange={setQuantity}
            onAdd={addToCart}
            stockWarning={stockWarning}
          />

          {/* Cart */}
          <CartSection
            cart={cart}
            onRemove={removeFromCart}
            onUpdateDiscount={updateItemDiscount}
            onUpdateQty={updateItemQty}
            globalDiscountAmt={globalDiscountAmt}
            setGlobalDiscountAmt={setGlobalDiscountAmt}
            globalDiscountType={globalDiscountType}
            setGlobalDiscountType={setGlobalDiscountType}
            cartTotals={cartTotals}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            paidAmount={paidAmount}
            setPaidAmount={setPaidAmount}
            onSubmit={submitTransaction}
            onHold={holdOrder}
            loading={loading}
          />

          {/* Empty cart CTA */}
          {cart.length === 0 && !selProdId && (
            <div className="text-center py-6 text-slate-600 text-xs">
              <ShoppingCart size={28} className="mx-auto mb-2 opacity-30" />
              Select a product to begin
            </div>
          )}
        </>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <BarcodeScannerModal onClose={() => setShowScanner(false)} />
      )}

      {/* Receipt Modal */}
      {receiptModal.show && (
        <ReceiptModal
          record={receiptModal.record}
          shopName={shopName}
          shopPhone={shopPhone}
          shopAddress={shopAddress}
          onPrint={doPrint}
          onClose={() => setReceiptModal({ show: false, record: null })}
        />
      )}
    </div>
  );
}
