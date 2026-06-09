import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { formatMMK } from '../utils/formatMMK';
import { CheckCircle2 } from 'lucide-react';

const toSafeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function CheckoutModal({ isOpen, onClose, total = 0, onConfirm }) {
  const [cashReceived, setCashReceived] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalAmount = useMemo(() => Math.max(0, toSafeNumber(total)), [total]);
  const receivedNum = useMemo(() => toSafeNumber(cashReceived), [cashReceived]);
  const changeAmount = Math.max(0, receivedNum - totalAmount);
  const isSufficient = receivedNum >= totalAmount;

  useEffect(() => {
    if (isOpen) {
      setCashReceived('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleCashChange = (e) => {
    const nextValue = e.target.value;
    setCashReceived(nextValue);

    if (nextValue === '') {
      setError('');
      return;
    }

    const amount = Number(nextValue);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('လက်ခံငွေကို သုညထက်ကြီးသော ဂဏန်းအဖြစ် ထည့်ပါ။');
    } else if (amount < totalAmount) {
      setError('လက်ခံငွေသည် ကျသင့်ငွေထက် နည်းနေပါသည်။');
    } else {
      setError('');
    }
  };

  const handleConfirm = async () => {
    if (loading) return;

    if (!isSufficient) {
      setError('ငွေမလုံလောက်သေးပါ။');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onConfirm?.({
        cashReceived: receivedNum,
        total: totalAmount,
        changeAmount,
      });
    } catch (err) {
      setError(err?.message || 'ငွေချေမှု အတည်ပြုရာတွင် ပြဿနာရှိနေပါသည်။');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? undefined : onClose} title="COMPLETE TRANSACTION">
      <div className="space-y-6">
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 text-center">
          <p className="text-sm text-gray-400 font-mono mb-1">TOTAL AMOUNT DUE</p>
          <h2 className="text-3xl font-bold text-neon-cyan">{formatMMK(totalAmount)}</h2>
        </div>

        <Input
          label="CASH RECEIVED (MMK)"
          type="number"
          autoFocus
          min="0"
          step="1"
          inputMode="decimal"
          value={cashReceived}
          onChange={handleCashChange}
          placeholder="Enter amount received from customer"
          error={error}
        />

        <div className={`p-4 rounded-xl border ${isSufficient ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
          <p className="text-sm text-gray-400 font-mono mb-1">CHANGE TO RETURN</p>
          <h3 className={`text-xl font-bold ${isSufficient ? 'text-green-400' : 'text-red-400'}`}>
            {formatMMK(changeAmount)}
          </h3>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!isSufficient || loading}
            loading={loading}
            icon={CheckCircle2}
          >
            Confirm Payment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
