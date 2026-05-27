import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useHoldOrders(tenantId) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, 'heldOrders'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(list);
    });
    return () => unsubscribe();
  }, [tenantId]);

  const holdOrder = useCallback(async (orderData) => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'heldOrders'), {
        ...orderData,
        tenantId,
        createdAt: serverTimestamp()
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const deleteOrder = useCallback(async (id) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'heldOrders', id));
    } finally {
      setLoading(false);
    }
  }, []);

  return { orders, loading, holdOrder, deleteOrder };
}
