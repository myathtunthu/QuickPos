import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  DollarSign,
  Package2,
  X,
  Printer,
  User,
} from 'lucide-react';

export default function EntryPage() {

  // ─────────────────────────────────────────────
  // DEMO PRODUCTS
  // ─────────────────────────────────────────────

  const [products] = useState([
    {
      id: '1',
      name: 'Shark Energy Drink',
      category: 'Drink',
      stockBase: 240,

      units: [
        {
          name: 'ဖာ',
          factor: 24,
          cost: 9500,
          barcode: '1111',
          prices: {
            retail: 12000,
            wholesaleA: 11500,
            wholesaleB: 11000,
            wholesaleC: 10500,
          },
        },

        {
          name: 'ကဒ်',
          factor: 6,
          cost: 2500,
          barcode: '2222',
          prices: {
            retail: 3200,
            wholesaleA: 3000,
            wholesaleB: 2900,
            wholesaleC: 2800,
          },
        },

        {
          name: 'ဘူး',
          factor: 1,
          cost: 400,
          barcode: '3333',
          prices: {
            retail: 600,
            wholesaleA: 550,
            wholesaleB: 500,
            wholesaleC: 480,
          },
        },
      ],
    },

    {
      id: '2',
      name: 'Coke',
      category: 'Drink',
      stockBase: 120,

      units: [
        {
          name: 'ဖာ',
          factor: 24,
          cost: 12000,
          barcode: '4444',
          prices: {
            retail: 14500,
            wholesaleA: 14000,
            wholesaleB: 13500,
            wholesaleC: 13000,
          },
        },

        {
          name: 'ဘူး',
          factor: 1,
          cost: 500,
          barcode: '5555',
          prices: {
            retail: 800,
            wholesaleA: 750,
            wholesaleB: 700,
            wholesaleC: 650,
          },
        },
      ],
    },
  ]);

  // ─────────────────────────────────────────────
  // STATES
  // ─────────────────────────────────────────────

  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [selectedUnit, setSelectedUnit] = useState(null);

  const [priceType, setPriceType] = useState('retail');

  const [quantity, setQuantity] = useState(1);

  const [unitPrice, setUnitPrice] = useState('');

  const [cart, setCart] = useState([]);

  const [customer, setCustomer] = useState('');

  const [paymentType, setPaymentType] = useState('Cash');

  const [showReceipt, setShowReceipt] = useState(false);

  const [barcodeInput, setBarcodeInput] = useState('');

  const searchRef = useRef();

  // ─────────────────────────────────────────────
  // FILTER PRODUCTS
  // ─────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, products]);

  // ─────────────────────────────────────────────
  // AUTO PRICE
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (selectedUnit) {
      setUnitPrice(selectedUnit.prices?.[priceType] || 0);
    }
  }, [selectedUnit, priceType]);

  // ─────────────────────────────────────────────
  // BARCODE SCAN
  // ─────────────────────────────────────────────

  const handleBarcode = (code) => {

    for (const product of products) {

      const foundUnit = product.units.find(
        (u) => u.barcode === code
      );

      if (foundUnit) {

        setSelectedProduct(product);

        setSelectedUnit(foundUnit);

        setPriceType('retail');

        setUnitPrice(foundUnit.prices.retail);

        setSearch(product.name);

        return;
      }
    }

    alert('Barcode not found');
  };

  // ─────────────────────────────────────────────
  // ADD TO CART
  // ─────────────────────────────────────────────

  const addToCart = () => {

    if (!selectedProduct) {
      return alert('Select product');
    }

    if (!selectedUnit) {
      return alert('Select unit');
    }

    const baseQty =
      Number(quantity) * Number(selectedUnit.factor);

    if (baseQty > selectedProduct.stockBase) {
      return alert('Stock မလုံလောက်ပါ');
    }

    const newItem = {
      id: Date.now(),

      productId: selectedProduct.id,

      name: selectedProduct.name,

      unit: selectedUnit.name,

      factor: selectedUnit.factor,

      quantity: Number(quantity),

      baseQuantity: baseQty,

      priceType,

      unitPrice: Number(unitPrice),

      subtotal:
        Number(quantity) * Number(unitPrice),
    };

    setCart((prev) => [...prev, newItem]);

    resetForm();
  };

  // ─────────────────────────────────────────────
  // RESET FORM
  // ─────────────────────────────────────────────

  const resetForm = () => {

    setSearch('');

    setSelectedProduct(null);

    setSelectedUnit(null);

    setQuantity(1);

    setUnitPrice('');
  };

  // ─────────────────────────────────────────────
  // TOTALS
  // ─────────────────────────────────────────────

  const total = useMemo(() => {
    return cart.reduce(
      (s, i) => s + i.subtotal,
      0
    );
  }, [cart]);

  // ─────────────────────────────────────────────
  // REMOVE CART
  // ─────────────────────────────────────────────

  const removeCartItem = (id) => {
    setCart((prev) =>
      prev.filter((x) => x.id !== id)
    );
  };

  // ─────────────────────────────────────────────
  // PRINT
  // ─────────────────────────────────────────────

  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white pb-40">

      {/* HEADER */}

      <div className="sticky top-0 z-40 bg-[#050816]/90 backdrop-blur-xl border-b border-cyan-500/10 p-4">

        <div className="flex items-center gap-3">

          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
            <ShoppingCart className="text-cyan-400" />
          </div>

          <div>
            <h1 className="text-2xl font-black">
              POS Entry
            </h1>

            <p className="text-sm text-slate-400">
              Wholesale + Unit System
            </p>
          </div>

        </div>

      </div>

      {/* BODY */}

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-6 p-4">

        {/* LEFT */}

        <div className="space-y-5">

          {/* CUSTOMER */}

          <div className="bg-[#0f172a] rounded-3xl border border-cyan-500/10 p-5">

            <label className="text-xs uppercase text-slate-500 font-black">
              Customer
            </label>

            <div className="relative mt-2">

              <User
                className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500"
                size={18}
              />

              <input
                value={customer}
                onChange={(e) =>
                  setCustomer(e.target.value)
                }
                placeholder="Customer Name"
                className="w-full bg-black/40 border border-cyan-500/20 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-cyan-400"
              />

            </div>

          </div>

          {/* BARCODE */}

          <div className="bg-[#0f172a] rounded-3xl border border-blue-500/10 p-5">

            <label className="text-xs uppercase text-slate-500 font-black">
              Barcode Scan
            </label>

            <div className="flex gap-3 mt-2">

              <div className="relative flex-1">

                <ScanBarcode
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"
                  size={20}
                />

                <input
                  value={barcodeInput}
                  onChange={(e) =>
                    setBarcodeInput(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleBarcode(barcodeInput);
                      setBarcodeInput('');
                    }
                  }}
                  placeholder="Scan barcode..."
                  className="w-full bg-black/40 border border-blue-500/20 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-blue-400"
                />

              </div>

            </div>

          </div>

          {/* PRODUCT SEARCH */}

          <div className="bg-[#0f172a] rounded-3xl border border-cyan-500/10 p-5">

            <label className="text-xs uppercase text-slate-500 font-black">
              Product
            </label>

            <div className="relative mt-2">

              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500"
                size={18}
              />

              <input
                ref={searchRef}
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search product..."
                className="w-full bg-black/40 border border-cyan-500/20 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-cyan-400"
              />

            </div>

            {/* DROPDOWN */}

            {search && (
              <div className="mt-3 max-h-72 overflow-y-auto space-y-2">

                {filteredProducts.map((p) => (

                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProduct(p);
                      setSelectedUnit(p.units[0]);
                      setSearch(p.name);
                    }}
                    className="w-full text-left bg-black/30 hover:bg-cyan-500/10 border border-white/5 rounded-2xl p-4 transition-all"
                  >

                    <div className="flex justify-between items-center">

                      <div>

                        <p className="font-black">
                          {p.name}
                        </p>

                        <p className="text-sm text-slate-400">
                          {p.category}
                        </p>

                      </div>

                      <div className="text-right">

                        <p className="text-cyan-400 font-black">
                          {p.stockBase}
                        </p>

                        <p className="text-xs text-slate-500">
                          Base Stock
                        </p>

                      </div>

                    </div>

                  </button>

                ))}

              </div>
            )}

          </div>

          {/* UNIT */}

          {selectedProduct && (

            <div className="bg-[#0f172a] rounded-3xl border border-cyan-500/10 p-5">

              <label className="text-xs uppercase text-slate-500 font-black">
                Unit Selection
              </label>

              <div className="grid grid-cols-3 gap-3 mt-3">

                {selectedProduct.units.map((u) => (

                  <button
                    key={u.name}
                    onClick={() => setSelectedUnit(u)}
                    className={`p-4 rounded-2xl border transition-all ${
                      selectedUnit?.name === u.name
                        ? 'bg-cyan-600 border-cyan-400'
                        : 'bg-black/30 border-white/5'
                    }`}
                  >

                    <p className="font-black">
                      {u.name}
                    </p>

                    <p className="text-xs mt-1">
                      x{u.factor}
                    </p>

                  </button>

                ))}

              </div>

            </div>

          )}

          {/* PRICE TYPES */}

          {selectedUnit && (

            <div className="bg-[#0f172a] rounded-3xl border border-cyan-500/10 p-5">

              <label className="text-xs uppercase text-slate-500 font-black">
                Price Type
              </label>

              <div className="grid grid-cols-2 gap-3 mt-3">

                {[
                  'retail',
                  'wholesaleA',
                  'wholesaleB',
                  'wholesaleC',
                ].map((t) => (

                  <button
                    key={t}
                    onClick={() => setPriceType(t)}
                    className={`p-4 rounded-2xl border font-black transition-all ${
                      priceType === t
                        ? 'bg-emerald-600 border-emerald-400'
                        : 'bg-black/30 border-white/5'
                    }`}
                  >

                    {t}

                  </button>

                ))}

              </div>

            </div>

          )}

          {/* QTY + PRICE */}

          {selectedUnit && (

            <div className="bg-[#0f172a] rounded-3xl border border-cyan-500/10 p-5">

              <div className="grid grid-cols-2 gap-4">

                <div>

                  <label className="text-xs uppercase text-slate-500 font-black">
                    Quantity
                  </label>

                  <div className="flex items-center gap-2 mt-2">

                    <button
                      onClick={() =>
                        setQuantity((q) =>
                          Math.max(1, q - 1)
                        )
                      }
                      className="w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center"
                    >
                      <Minus size={18} />
                    </button>

                    <input
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(e.target.value)
                      }
                      className="flex-1 h-12 bg-black/40 border border-cyan-500/20 rounded-xl text-center font-black"
                    />

                    <button
                      onClick={() =>
                        setQuantity((q) =>
                          Number(q) + 1
                        )
                      }
                      className="w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center"
                    >
                      <Plus size={18} />
                    </button>

                  </div>

                </div>

                <div>

                  <label className="text-xs uppercase text-slate-500 font-black">
                    Unit Price
                  </label>

                  <input
                    value={unitPrice}
                    onChange={(e) =>
                      setUnitPrice(e.target.value)
                    }
                    className="w-full mt-2 h-12 bg-black/40 border border-cyan-500/20 rounded-xl px-4 font-black text-cyan-400"
                  />

                </div>

              </div>

              {/* TOTAL */}

              <div className="mt-5 bg-black/30 rounded-2xl p-5">

                <div className="flex justify-between">

                  <span className="text-slate-400">
                    Subtotal
                  </span>

                  <span className="text-2xl font-black text-cyan-400">
                    {(quantity * unitPrice).toLocaleString()} Ks
                  </span>

                </div>

              </div>

              <button
                onClick={addToCart}
                className="w-full mt-5 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 font-black text-lg hover:scale-[1.01] transition-all"
              >

                Add To Cart

              </button>

            </div>

          )}

        </div>

        {/* RIGHT */}

        <div className="space-y-5">

          {/* CART */}

          <div className="bg-[#0f172a] rounded-3xl border border-cyan-500/10 p-5">

            <div className="flex justify-between items-center">

              <h2 className="text-xl font-black flex items-center gap-2">
                <Package2 size={20} />
                Cart
              </h2>

              <span className="text-cyan-400 font-black">
                {cart.length} items
              </span>

            </div>

            <div className="mt-5 space-y-3 max-h-[500px] overflow-y-auto pr-1">

              {cart.map((item) => (

                <div
                  key={item.id}
                  className="bg-black/30 rounded-2xl border border-white/5 p-4"
                >

                  <div className="flex justify-between">

                    <div>

                      <p className="font-black">
                        {item.name}
                      </p>

                      <p className="text-sm text-slate-400 mt-1">
                        {item.quantity} {item.unit}
                      </p>

                    </div>

                    <button
                      onClick={() =>
                        removeCartItem(item.id)
                      }
                      className="text-rose-400"
                    >
                      <Trash2 size={18} />
                    </button>

                  </div>

                  <div className="mt-3 flex justify-between text-sm">

                    <span className="text-slate-400">
                      {item.priceType}
                    </span>

                    <span className="font-black text-cyan-400">
                      {item.subtotal.toLocaleString()} Ks
                    </span>

                  </div>

                </div>

              ))}

            </div>

          </div>

          {/* PAYMENT */}

          <div className="bg-[#0f172a] rounded-3xl border border-cyan-500/10 p-5">

            <label className="text-xs uppercase text-slate-500 font-black">
              Payment Type
            </label>

            <div className="grid grid-cols-2 gap-3 mt-3">

              <button
                onClick={() =>
                  setPaymentType('Cash')
                }
                className={`p-4 rounded-2xl border font-black ${
                  paymentType === 'Cash'
                    ? 'bg-cyan-600 border-cyan-400'
                    : 'bg-black/30 border-white/5'
                }`}
              >
                Cash
              </button>

              <button
                onClick={() =>
                  setPaymentType('Credit')
                }
                className={`p-4 rounded-2xl border font-black ${
                  paymentType === 'Credit'
                    ? 'bg-rose-600 border-rose-400'
                    : 'bg-black/30 border-white/5'
                }`}
              >
                Credit
              </button>

            </div>

          </div>

          {/* SUMMARY */}

          <div className="sticky bottom-6 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 backdrop-blur-xl rounded-3xl border border-cyan-500/20 p-6">

            <div className="flex justify-between items-center">

              <div>

                <p className="text-sm text-slate-400">
                  Total Amount
                </p>

                <h2 className="text-4xl font-black text-cyan-400 mt-1">
                  {total.toLocaleString()}
                </h2>

              </div>

              <DollarSign
                size={42}
                className="text-cyan-400"
              />

            </div>

            <button
              onClick={() => setShowReceipt(true)}
              className="w-full mt-5 py-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-xl font-black hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
            >

              <CreditCard size={22} />

              Confirm Order

            </button>

          </div>

        </div>

      </div>

      {/* RECEIPT */}

      {showReceipt && (

        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">

          <div className="bg-white text-black w-full max-w-md rounded-3xl p-8">

            <div className="flex justify-between items-center">

              <h2 className="text-2xl font-black">
                Receipt
              </h2>

              <button
                onClick={() =>
                  setShowReceipt(false)
                }
              >
                <X />
              </button>

            </div>

            <div className="mt-6 space-y-3">

              {cart.map((item) => (

                <div
                  key={item.id}
                  className="flex justify-between"
                >

                  <div>

                    <p className="font-bold">
                      {item.name}
                    </p>

                    <p className="text-sm text-slate-500">
                      {item.quantity} {item.unit}
                    </p>

                  </div>

                  <span className="font-black">
                    {item.subtotal.toLocaleString()}
                  </span>

                </div>

              ))}

            </div>

            <div className="border-t mt-6 pt-5 flex justify-between text-2xl font-black">

              <span>Total</span>

              <span>
                {total.toLocaleString()} Ks
              </span>

            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">

              <button
                onClick={printReceipt}
                className="py-4 rounded-2xl bg-cyan-600 text-white font-black flex items-center justify-center gap-2"
              >

                <Printer size={18} />

                Print

              </button>

              <button
                onClick={() =>
                  setShowReceipt(false)
                }
                className="py-4 rounded-2xl bg-slate-200 font-black"
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
