import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { cleanText, toFiniteNumber } from '../utils/entryHelpers';
import logger from '../utils/logger';

const sanitizeCartItems = (items = []) => (Array.isArray(items) ? items : []).map((item) => ({
  id: String(item?.id ?? ''),
  productId: String(item?.productId ?? ''),
  name: cleanText(item?.name, 'Item'),
  unitName: cleanText(item?.unitName, 'ခု'),
  multiplier: Math.max(1, toFiniteNumber(item?.multiplier, 1)),
  priceType: cleanText(item?.priceType, 'retail'),
  unitPrice: Math.max(0, toFiniteNumber(item?.unitPrice, 0)),
  costPrice: Math.max(0, toFiniteNumber(item?.costPrice, 0)),
  quantity: Math.max(0, toFiniteNumber(item?.quantity, 0)),
  baseQuantity: Math.max(0, toFiniteNumber(item?.baseQuantity, 0)),
  itemDiscountAmt: Math.max(0, toFiniteNumber(item?.itemDiscountAmt, 0)),
})).filter((item) => item.productId && item.quantity > 0);

const sanitizeOrder = (orderData = {}) => ({
  name: cleanText(orderData.name || orderData.customerName || orderData.personName, 'Held order'),
  entryTab: cleanText(orderData.entryTab || orderData.type, 'Sale'),
  paymentMethod: cleanText(orderData.paymentMethod, 'Cash'),
  personName: cleanText(orderData.personName || orderData.customerName || orderData.supplierName, ''),
  personPhone: cleanText(orderData.personPhone, ''),
  cart: sanitizeCartItems(orderData.cart || orderData.items || []),
  totals: {
    subtotal: Math.max(0, toFiniteNumber(orderData.totals?.subtotal ?? orderData.subtotal, 0)),
    itemDiscounts: Math.max(0, toFiniteNumber(orderData.totals?.itemDiscounts ?? orderData.itemDiscounts, 0)),
    globalDisc: Math.max(0, toFiniteNumber(orderData.totals?.globalDisc ?? orderData.globalDisc, 0)),
    total: Math.max(0, toFiniteNumber(orderData.totals?.total ?? orderData.total, 0)),
  },
  note: cleanText(orderData.note, ''),
});

export function useHoldOrders(tenantId) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tenantId) {
      setOrders([]);
      setError(null);
      return undefined;
    }

    const q = query(
      collection(db, 'heldOrders'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() })));
        setError(null);
      },
      (snapshotError) => {
        logger.error('Error listening held orders', snapshotError);
        setError(snapshotError);
        setOrders([]);
      }
    );

    return unsubscribe;
  }, [tenantId]);

  const holdOrder = useCallback(async (orderData) => {
    if (!tenantId) throw new Error('Tenant ID မရှိပါ');

    const sanitized = sanitizeOrder(orderData);
    if (sanitized.cart.length === 0) throw new Error('Hold လုပ်ရန် cart မရှိပါ');

    setLoading(true);
    setError(null);
    try {
      const ref = await addDoc(collection(db, 'heldOrders'), {
        ...sanitized,
        tenantId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    } catch (err) {
      logger.error('Error holding order', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const deleteOrder = useCallback(async (id) => {
    const safeId = String(id || '').trim();
    if (!safeId) throw new Error('ဖျက်ရန် order ID မရှိပါ');

    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'heldOrders', safeId));
    } catch (err) {
      logger.error('Error deleting held order', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { orders, loading, error, holdOrder, deleteOrder };
}

export default useHoldOrders;
