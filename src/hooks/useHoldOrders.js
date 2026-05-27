import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useHoldOrders(tenantId) {
  const [holdOrders, setHoldOrders] = useState([]);

  const loadHoldOrders = async () => {
    if (!tenantId) return;
    const q = query(
      collection(db, 'held_orders'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    setHoldOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const saveHoldOrder = async (orderData) => {
    if (!tenantId) return;
    await addDoc(collection(db, 'held_orders'), {
      ...orderData,
      tenantId,
      createdAt: new Date().toISOString()
    });
    await loadHoldOrders();
  };

  const deleteHoldOrder = async (orderId) => {
    await deleteDoc(doc(db, 'held_orders', orderId));
    await loadHoldOrders();
  };

  useEffect(() => {
    loadHoldOrders();
  }, [tenantId]);

  return { holdOrders, saveHoldOrder, deleteHoldOrder, loadHoldOrders };
}
