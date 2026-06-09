import { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { useToastStore } from '../store/toastStore';
import { Clock, Play, Square } from 'lucide-react';

export default function ShiftModal({ isOpen, onClose, isStarting = true }) {
  const { userData } = useAuth();
  const addToast = useToastStore(state => state.addToast);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setError('');
      setLoading(false);
    }
  }, [isOpen, isStarting]);

  const validateAmount = () => {
    const cashAmount = Number(amount);

    if (!userData?.tenantId) {
      setError('Tenant မတွေ့ပါ။ ပြန်လည် login ဝင်ပါ။');
      return false;
    }

    if (!Number.isFinite(cashAmount) || cashAmount < 0) {
      setError('Cash amount ကို သုည သို့မဟုတ် သုညထက်ကြီးသော ဂဏန်းအဖြစ် ထည့်ပါ။');
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !validateAmount()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'shifts'), {
        tenantId: userData.tenantId,
        userId: userData.uid || null,
        userName: userData.name || userData.email || 'Unknown User',
        type: isStarting ? 'start' : 'end',
        cashInDrawer: Number(amount),
        localTime: new Date().toISOString(),
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
      });
      addToast(`Shift ${isStarting ? 'started' : 'ended'} successfully`, 'success');
      onClose?.();
    } catch (error) {
      addToast(error?.message || 'Failed to record shift', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? undefined : onClose} title={isStarting ? 'START SHIFT' : 'END SHIFT'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
          <Clock className={isStarting ? 'text-neon-cyan' : 'text-neon-pink'} />
          <div>
            <p className="text-white font-bold">{userData?.name || userData?.email || 'Current User'}</p>
            <p className="text-xs text-gray-400 font-mono">
              Current Time: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>

        <Input
          label={isStarting ? 'Starting Cash (MMK)' : 'Ending Cash (MMK)'}
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter physical cash in drawer"
          error={error}
        />

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
            variant={isStarting ? 'primary' : 'danger'}
            icon={isStarting ? Play : Square}
          >
            {isStarting ? 'Open Register' : 'Close Register'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
