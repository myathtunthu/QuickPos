import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase/config';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { useToastStore } from '../store/toastStore';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function StockTransferModal({ isOpen, onClose, product }) {
  const { userData } = useAuth();
  const addToast = useToastStore(state => state.addToast);
  const [loading, setLoading] = useState(false);
  const [transferQty, setTransferQty] = useState('');
  const [targetTenantId, setTargetTenantId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const currentStock = useMemo(() => toNumber(product?.stock), [product?.stock]);
  const unitLabel = product?.baseUnit || product?.unit || 'pcs';
  const allowDecimal = Boolean(product?.allowDecimalQuantity || product?.allowDecimal || product?.baseUnit !== 'pcs');

  useEffect(() => {
    if (isOpen) {
      setTransferQty('');
      setTargetTenantId('');
      setNote('');
      setError('');
      setLoading(false);
    }
  }, [isOpen, product?.id]);

  const validate = () => {
    const qty = Number(transferQty);
    const target = targetTenantId.trim();

    if (!userData?.tenantId) {
      setError('Tenant မတွေ့ပါ။ ပြန်လည် login ဝင်ပါ။');
      return false;
    }
    if (!product?.id) {
      setError('Transfer လုပ်မည့် product မတွေ့ပါ။');
      return false;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Transfer quantity ကို သုညထက်ကြီးသော ဂဏန်းအဖြစ် ထည့်ပါ။');
      return false;
    }
    if (!allowDecimal && !Number.isInteger(qty)) {
      setError('ဤပစ္စည်းသည် decimal quantity မရပါ။ အပြည့်ကိန်းသာ ထည့်ပါ။');
      return false;
    }
    if (qty > currentStock) {
      setError('လက်ကျန် stock ထက် ပို၍ transfer မလုပ်နိုင်ပါ။');
      return false;
    }
    if (!target) {
      setError('Target Branch ID ထည့်ပါ။');
      return false;
    }
    if (target === userData.tenantId) {
      setError('မိမိ branch/tenant သို့ ပြန် transfer မလုပ်နိုင်ပါ။');
      return false;
    }

    setError('');
    return true;
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (loading || !validate()) return;

    const qty = Number(transferQty);
    const target = targetTenantId.trim();

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const sourceRef = doc(db, 'pos_products', product.id);
        const sourceSnap = await transaction.get(sourceRef);

        if (!sourceSnap.exists()) {
          throw new Error('Product မတွေ့ပါ။');
        }

        const sourceData = sourceSnap.data();
        if (sourceData.tenantId !== userData.tenantId) {
          throw new Error('Product tenant မကိုက်ညီပါ။');
        }

        const freshStock = toNumber(sourceData.stock);
        if (qty > freshStock) {
          throw new Error('လက်ရှိ stock မလုံလောက်တော့ပါ။');
        }

        const logRef = doc(collection(db, 'stock_logs'));
        transaction.update(sourceRef, {
          stock: freshStock - qty,
          updatedAt: serverTimestamp(),
          lastTransferAt: serverTimestamp(),
        });

        transaction.set(logRef, {
          tenantId: userData.tenantId,
          productId: product.id,
          productName: sourceData.name || product.name || 'Unknown Product',
          sourceTenantId: userData.tenantId,
          targetTenantId: target,
          quantity: qty,
          unit: sourceData.baseUnit || sourceData.unit || unitLabel,
          status: 'pending_receive',
          note: note.trim(),
          transferredBy: userData.name || userData.email || userData.uid || 'Unknown User',
          transferredByUid: userData.uid || null,
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp(),
        });
      });

      addToast('Stock transfer request created', 'success');
      onClose?.();
    } catch (error) {
      addToast(error?.message || 'Transfer failed', 'error');
      setError(error?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? undefined : onClose} title={`TRANSFER: ${product?.name || ''}`}>
      <form onSubmit={handleTransfer} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-neon-pink/40 bg-neon-pink/10 p-3 text-sm text-neon-pink">
            {error}
          </div>
        )}

        <div className="bg-gray-900 p-3 rounded border border-gray-800">
          <p className="text-sm text-gray-400">
            Current Stock:{' '}
            <span className="text-white font-bold">{currentStock} {unitLabel}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Transfer သည် source branch မှ stock လျှော့ပြီး target branch တွင် receive approval စောင့်သော pending record ဖန်တီးပါမည်။
          </p>
        </div>

        <Input
          label={`Transfer Quantity (${unitLabel})`}
          type="number"
          required
          min="0"
          step={allowDecimal ? '0.001' : '1'}
          max={currentStock}
          inputMode="decimal"
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

        <Input
          label="Transfer Note (optional)"
          value={note}
          maxLength={180}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason or delivery note"
        />

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={loading}>Transfer Stock</Button>
        </div>
      </form>
    </Modal>
  );
}
