// pages/EntryPage.jsx

import { useState, useEffect, useMemo, useCallback } from 'react';

import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../firebase/config';

import { useAuth } from '../context/AuthContext';

import { useCart } from '../hooks/useCart';
import { useProductFilter } from '../hooks/useProductFilter';
import { useHoldOrders } from '../hooks/useHoldOrders';

import EntryTabs from '../components/entry/EntryTabs';
import CustomerSection from '../components/entry/CustomerSection';
import BarcodeSection from '../components/entry/BarcodeSection';
import ProductSearch from '../components/entry/ProductSearch';
import ProductDropdown from '../components/entry/ProductDropdown';
import ProductUnitSelector from '../components/entry/ProductUnitSelector';
import CartSection from '../components/entry/CartSection';
import HoldOrders from '../components/entry/HoldOrders';
import ReceiptModal from '../components/entry/ReceiptModal';
import QuickActions from '../components/entry/QuickActions';

import {
  ShoppingCart,
  Loader2,
  AlertTriangle,
  Package,
} from 'lucide-react';

export default function EntryPage({

  products = [],
  customers = [],
  suppliers = [],

}) {

  // =========================
  // AUTH
  // =========================

  const { profile } = useAuth();

  const tenantId = profile?.tenantId;

  // =========================
  // STATES
  // =========================

  const todayISO =
    new Date().toISOString().split('T')[0];

  const [entryTab, setEntryTab] =
    useState('Sale');

  const [entryDate, setEntryDate] =
    useState(todayISO);

  const [personName, setPersonName] =
    useState('');

  const [selectedProduct, setSelectedProduct] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [receiptModal, setReceiptModal] =
    useState({
      show: false,
      record: null,
    });

  // =========================
  // SHOP INFO
  // =========================

  const shop = useMemo(() => ({
    name: profile?.shopName || 'QuickPOS',
    phone: profile?.phone || '',
    address: profile?.address || '',
    logoUrl: profile?.logoUrl || '',
    cashier: profile?.displayName || 'Cashier',
  }), [profile]);

  // =========================
  // HOOKS
  // =========================

  const cart = useCart();

  const filter =
    useProductFilter(products);

  const hold =
    useHoldOrders(tenantId);

  // =========================
  // FORMAT
  // =========================

  const fmt = useCallback((n) => {
    return (
      Number(n || 0)
    ).toLocaleString();
  }, []);

  // =========================
  // RESET
  // =========================

  useEffect(() => {

    cart.clearCart();

    setSelectedProduct(null);

  }, [entryTab]);

  // =========================
  // CREDIT AUTO
  // =========================

  useEffect(() => {

    if (
      cart.paymentMethod === 'Credit'
    ) {
      cart.setPaidAmount('0');
    }

  }, [cart.paymentMethod]);

  // =========================
  // PRODUCT SELECT
  // =========================

  const handleSelectProduct =
    useCallback((product) => {

      setSelectedProduct(product);

    }, []);

  // =========================
  // BARCODE SCAN
  // =========================

  const handleBarcodeScanned =
    useCallback((result) => {

      if (!result) return;

      const {
        product,
        unit,
        priceType,
      } = result;

      setSelectedProduct({
        ...product,
        scannedUnit: unit,
        scannedPriceType: priceType,
      });

      playBeep();

    }, []);

  // =========================
  // ADD TO CART
  // =========================

  const handleAddToCart =
    useCallback((item) => {

      if (!item) return;

      // =====================
      // STOCK VALIDATION
      // =====================

      if (
        entryTab === 'Sale'
      ) {

        const stock =
          Number(item.stockBase || 0);

        if (
          item.baseQuantity > stock
        ) {

          alert(
            `Stock မလုံလောက်ပါ\n\n${item.name}`
          );

          playBeep('error');

          return;
        }
      }

      cart.addItem(item);

      setSelectedProduct(null);

      playBeep();

    }, [
      cart,
      entryTab,
    ]);

  // =========================
  // HOLD ORDER
  // =========================

  const handleHoldOrder =
    async () => {

      if (
        cart.cart.length <= 0
      ) return;

      const payload = {

        personName,

        paymentMethod:
          cart.paymentMethod,

        paidAmount:
          cart.paidAmount,

        globalDiscountAmt:
          cart.globalDiscountAmt,

        globalDiscountType:
          cart.globalDiscountType,

        totalsSnapshot:
          cart.totals,

        cart: cart.cart,
      };

      await hold.holdOrder(payload);

      cart.clearCart();

      setPersonName('');
    };

  // =========================
  // RESTORE HOLD
  // =========================

  const handleRestoreOrder =
    useCallback((order) => {

      if (!order) return;

      cart.clearCart();

      order.cart?.forEach(item => {
        cart.addItem(item);
      });

      setPersonName(
        order.personName || ''
      );

      cart.setPaymentMethod(
        order.paymentMethod || 'Cash'
      );

      cart.setPaidAmount(
        order.paidAmount || ''
      );

      cart.setGlobalDiscountAmt(
        order.globalDiscountAmt || ''
      );

      cart.setGlobalDiscountType(
        order.globalDiscountType || '%'
      );

    }, [cart]);

  // =========================
  // SUBMIT
  // =========================

  const handleSubmitTransaction =
    async () => {

      if (
        cart.cart.length <= 0
      ) {

        alert(
          'Cart ထဲမှာ ပစ္စည်းမရှိပါ'
        );

        return;
      }

      if (!tenantId) return;

      setLoading(true);

      try {

        // ===================
        // FINAL VALIDATION
        // ===================

        if (
          entryTab === 'Sale'
        ) {

          for (
            const item of cart.cart
          ) {

            const product =
              products.find(
                p => p.id === item.productId
              );

            if (!product)
              continue;

            const need =
              Number(item.baseQuantity || 0);

            const stock =
              Number(product.stockBase || 0);

            if (
              need > stock
            ) {

              alert(
                `Stock မလုံလောက်ပါ\n\n${item.name}`
              );

              setLoading(false);

              return;
            }
          }
        }

        // ===================
        // FIREBASE BATCH
        // ===================

        const batch =
          writeBatch(db);

        const recordRef =
          doc(
            collection(
              db,
              'pos_records'
            )
          );

        const total =
          cart.totals.total;

        const paid =
          cart.paidAmount === ''
            ? total
            : Number(
                cart.paidAmount || 0
              );

        const debt =
          Math.max(
            0,
            total - paid
          );

        // ===================
        // RECORD
        // ===================

        const record = {

          tenantId,

          type: entryTab,

          personName:
            personName || 'Walk-in',

          date: entryDate,

          paymentMethod:
            cart.paymentMethod,

          paidAmount: paid,

          remainingDebt: debt,

          subtotal:
            cart.totals.subtotal,

          itemDiscount:
            cart.totals.itemDiscounts,

          globalDiscount:
            cart.totals.globalDisc,

          amount: total,

          itemsDetail:
            cart.cart.map(item => ({

              productId:
                item.productId,

              name:
                item.name,

              quantity:
                item.quantity,

              unitName:
                item.unitName,

              factor:
                item.factor,

              baseQuantity:
                item.baseQuantity,

              unitPrice:
                item.unitPrice,

              costPrice:
                item.costPrice,

              subtotal:
                item.subtotal,

              priceType:
                item.priceType,

              notes:
                item.notes || '',

            })),

          cashier:
            profile?.displayName || '',

          createdAt:
            serverTimestamp(),
        };

        batch.set(
          recordRef,
          record
        );

        // ===================
        // UPDATE STOCK
        // ===================

        for (
          const item of cart.cart
        ) {

          const product =
            products.find(
              p => p.id === item.productId
            );

          if (!product)
            continue;

          const currentStock =
            Number(
              product.stockBase || 0
            );

          const qty =
            Number(
              item.baseQuantity || 0
            );

          const updatedStock =
            entryTab === 'Sale'
              ? currentStock - qty
              : currentStock + qty;

          batch.update(

            doc(
              db,
              'pos_products',
              item.productId
            ),

            {
              stockBase:
                updatedStock,
            }
          );
        }

        // ===================
        // COMMIT
        // ===================

        await batch.commit();

        // ===================
        // RECEIPT
        // ===================

        setReceiptModal({
          show: true,
          record: {
            ...record,
            id: recordRef.id,
          },
        });

        // ===================
        // RESET
        // ===================

        cart.clearCart();

        setPersonName('');

        playBeep();

      } catch (err) {

        console.error(err);

        alert(
          'Transaction Save Error'
        );

        playBeep('error');

      }

      setLoading(false);
    };

  // =========================
  // UI
  // =========================

  return (

    <div className="
      min-h-screen
      bg-[#070b12]
      text-white
      pb-40
    ">

      {/* HEADER */}

      <div className="
        sticky
        top-0
        z-40
        bg-[#070b12]/90
        backdrop-blur
        border-b
        border-cyan-500/10
        p-3
      ">

        <div className="
          flex
          items-center
          justify-between
        ">

          <div>

            <h1 className="
              text-xl
              font-black
              text-cyan-400
            ">
              POS ENTRY
            </h1>

            <p className="
              text-xs
              text-slate-500
            ">
              Wholesale ERP POS
            </p>

          </div>

          <div className="
            flex
            items-center
            gap-2
          ">

            <div className="
              px-3
              py-1
              rounded-xl
              bg-cyan-500/10
              text-cyan-400
              text-sm
            ">
              {cart.cart.length}
            </div>

            <ShoppingCart
              size={20}
              className="text-cyan-400"
            />

          </div>

        </div>

      </div>

      {/* BODY */}

      <div className="
        p-2
        space-y-3
        max-w-6xl
        mx-auto
      ">

        {/* TABS */}

        <EntryTabs
          entryTab={entryTab}
          setEntryTab={setEntryTab}
        />

        {/* CUSTOMER */}

        <CustomerSection
          personName={personName}
          setPersonName={setPersonName}
          entryDate={entryDate}
          setEntryDate={setEntryDate}
          entryTab={entryTab}
        />

        {/* BARCODE */}

        <BarcodeSection
          products={products}
          onBarcodeScanned={
            handleBarcodeScanned
          }
        />

        {/* SEARCH */}

        <ProductSearch
          search={filter.search}
          setSearch={filter.setSearch}
          categories={filter.categories}
          selCategory={filter.category}
          setSelCategory={
            filter.setCategory
          }
        />

        {/* PRODUCT DROPDOWN */}

        <ProductDropdown

          products={
            filter.filtered.slice(0, 20)
          }

          selectedId={
            selectedProduct?.id
          }

          onSelect={
            handleSelectProduct
          }

          fmt={fmt}
        />

        {/* SELECTED PRODUCT */}

        {selectedProduct && (

          <div className="
            rounded-2xl
            border
            border-cyan-500/10
            bg-[#0d1522]
            p-3
          ">

            <div className="
              flex
              items-center
              justify-between
              mb-3
            ">

              <div>

                <h2 className="
                  font-bold
                  text-cyan-400
                ">
                  {selectedProduct.name}
                </h2>

                <p className="
                  text-xs
                  text-slate-500
                ">
                  Base Stock:
                  {' '}
                  {fmt(
                    selectedProduct.stockBase
                  )}
                </p>

              </div>

              {(
                Number(
                  selectedProduct.stockBase || 0
                ) <=
                Number(
                  selectedProduct.minStock || 5
                )
              ) && (

                <div className="
                  flex
                  items-center
                  gap-1
                  text-xs
                  text-amber-400
                ">

                  <AlertTriangle
                    size={14}
                  />

                  Low Stock

                </div>

              )}

            </div>

            <ProductUnitSelector

              product={selectedProduct}

              entryTab={entryTab}

              onAddToCart={
                handleAddToCart
              }

            />

          </div>

        )}

        {/* HOLD ORDERS */}

        <HoldOrders

          orders={hold.orders}

          onRestore={
            handleRestoreOrder
          }

          onDelete={
            hold.deleteOrder
          }

          fmt={fmt}

        />

        {/* QUICK ACTION */}

        <QuickActions />

      </div>

      {/* CART */}

      {cart.cart.length > 0 && (

        <div className="
          fixed
          bottom-0
          left-0
          right-0
          z-50
          border-t
          border-cyan-500/10
          bg-[#08101c]
          backdrop-blur-xl
          max-h-[65vh]
          overflow-y-auto
        ">

          <CartSection

            cart={cart.cart}

            totals={cart.totals}

            loading={loading}

            paymentMethod={
              cart.paymentMethod
            }

            setPaymentMethod={
              cart.setPaymentMethod
            }

            paidAmount={
              cart.paidAmount
            }

            setPaidAmount={
              cart.setPaidAmount
            }

            globalDiscountAmt={
              cart.globalDiscountAmt
            }

            setGlobalDiscountAmt={
              cart.setGlobalDiscountAmt
            }

            globalDiscountType={
              cart.globalDiscountType
            }

            setGlobalDiscountType={
              cart.setGlobalDiscountType
            }

            cartActions={{

              removeItem:
                cart.removeItem,

              updateItemQuantity:
                cart.updateItemQuantity,

              updateItemDiscount:
                cart.updateItemDiscount,

              updateItemNotes:
                cart.updateItemNotes,

            }}

            onSubmit={
              handleSubmitTransaction
            }

            onHold={
              handleHoldOrder
            }

            fmt={fmt}

          />

        </div>

      )}

      {/* RECEIPT */}

      {receiptModal.show && (

        <ReceiptModal

          record={
            receiptModal.record
          }

          shop={shop}

          fmt={fmt}

          onClose={() =>
            setReceiptModal({
              show: false,
              record: null,
            })
          }

        />

      )}

      {/* LOADING */}

      {loading && (

        <div className="
          fixed
          inset-0
          bg-black/60
          z-[100]
          flex
          items-center
          justify-center
        ">

          <div className="
            bg-[#101826]
            border
            border-cyan-500/20
            rounded-2xl
            p-6
            flex
            flex-col
            items-center
            gap-3
          ">

            <Loader2
              className="
                animate-spin
                text-cyan-400
              "
            />

            <p className="
              text-sm
              text-slate-300
            ">
              Saving Transaction...
            </p>

          </div>

        </div>

      )}

    </div>
  );
}

// =============================
// BEEP
// =============================

function playBeep(
  type = 'success'
) {

  try {

    const ctx =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

    const osc =
      ctx.createOscillator();

    const gain =
      ctx.createGain();

    osc.connect(gain);

    gain.connect(ctx.destination);

    osc.type =
      type === 'success'
        ? 'sine'
        : 'square';

    osc.frequency.value =
      type === 'success'
        ? 900
        : 180;

    gain.gain.value = 0.15;

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.3
    );

    osc.start();

    osc.stop(
      ctx.currentTime + 0.3
    );

  } catch {}

}
