import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { useToastStore } from '../store/toastStore';

/**
 * Stock Transfer System (Between Branches/Warehouses)
 */
export default function StockTransferModal({ isOpen, onClose, product }) {
  const { userData } = useAuth();
  const addToast = useToastStore(state => state.addToast);
  const [loading, setLoading] = useState(false);
  const [transferQty, setTransferQty] = useState('');
  const [targetTenantId, setTargetTenantId] = useState(''); // e.g. "branch_b_id"

  const handleTransfer = async (e) => {
    e.preventDefault();
    const qty = Number(transferQty);
    if (qty <= 0 || qty > product.stock) {
      addToast('Invalid transfer quantity', 'error');
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Deduct from current store
      const sourceRef = doc(db, 'pos_products', product.id);
      batch.update(sourceRef, { stock: product.stock - qty });

      // 2. Log the transfer
      const logRef = doc(collection(db, 'stock_logs'));
      batch.set(logRef, {
        productId: product.id,
        productName: product.name,
        sourceTenantId: userData.tenantId,
        targetTenantId,
        quantity: qty,
        transferredBy: userData.name,
        timestamp: serverTimestamp()
      });

      // (In a real system, you would also query the target store's inventory and increment it here using a Cloud Function for cross-tenant security)

      await batch.commit();
      addToast('Stock transfer initiated');
      onClose();
    } catch (error) {
      console.error(error);
      addToast('Transfer failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`TRANSFER: ${product?.name}`}>
      <form onSubmit={handleTransfer} className="space-y-4">
        <div className="bg-gray-900 p-3 rounded border border-gray-800">
          <p className="text-sm text-gray-400">Current Stock: <span className="text-white font-bold">{product?.stock}</span></p>
        </div>
        
        <Input 
          label="Transfer Quantity" 
          type="number"
          required
          max={product?.stock}
          value={transferQty}
          onChange={(e) => setTransferQty(e.target.value)}
        />
        <Input 
          label="Target Branch ID" 
          required
          value={targetTenantId}
          onChange={(e) => setTargetTenantId(e.target.value)}
          placeholder="e.g. branch_mandalay_01"
        />
        <div className="pt-4 flex justify-end">
          <Button type="submit" loading={loading}>Transfer Stock</Button>
        </div>
      </form>
    </Modal>
  );
}
