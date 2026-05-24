import { useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { useToastStore } from '../store/toastStore';
import { Clock, Play, Square } from 'lucide-react';

/**
 * Cashier Shift Management
 */
export default function ShiftModal({ isOpen, onClose, isStarting = true }) {
  const { userData } = useAuth();
  const addToast = useToastStore(state => state.addToast);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'shifts'), {
        tenantId: userData.tenantId,
        userId: userData.uid,
        userName: userData.name,
        type: isStarting ? 'start' : 'end',
        cashInDrawer: Number(amount),
        timestamp: serverTimestamp()
      });
      addToast(`Shift ${isStarting ? 'started' : 'ended'} successfully`);
      onClose();
    } catch (error) {
      addToast('Failed to record shift', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isStarting ? "START SHIFT" : "END SHIFT"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
          <Clock className={isStarting ? "text-neon-cyan" : "text-neon-pink"} />
          <div>
            <p className="text-white font-bold">{userData?.name}</p>
            <p className="text-xs text-gray-400 font-mono">Current Time: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
        
        <Input 
          label={isStarting ? "Starting Cash (MMK)" : "Ending Cash (MMK)"} 
          type="number"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter physical cash in drawer"
        />

        <div className="pt-4 flex justify-end">
          <Button 
            type="submit" 
            loading={loading}
            variant={isStarting ? 'primary' : 'danger'}
            icon={isStarting ? Play : Square}
          >
            {isStarting ? "Open Register" : "Close Register"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
