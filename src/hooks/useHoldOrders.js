import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useHoldOrders(tenantId) {
  const [holdOrders, setHoldOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadHoldOrders = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'held_orders'),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      setHoldOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error loading hold orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveHoldOrder = async (orderData) => {
    if (!tenantId) return;
    try {
      await addDoc(collection(db, 'held_orders'), {
        ...orderData,
        tenantId,
        createdAt: new Date().toISOString()
      });
      await loadHoldOrders();
      return true;
    } catch (error) {
      console.error("Error saving hold order:", error);
      return false;
    }
  };

  const deleteHoldOrder = async (orderId) => {
    try {
      await deleteDoc(doc(db, 'held_orders', orderId));
      await loadHoldOrders();
      return true;
    } catch (error) {
      console.error("Error deleting hold order:", error);
      return false;
    }
  };

  useEffect(() => {
    loadHoldOrders();
  }, [tenantId]);

  return { holdOrders, loading, saveHoldOrder, deleteHoldOrder, loadHoldOrders };
}
