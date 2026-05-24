import { useState } from 'react';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { formatMMK } from '../utils/formatMMK';
import { CheckCircle2 } from 'lucide-react';

export default function CheckoutModal({ isOpen, onClose, total, onConfirm }) {
  const [cashReceived, setCashReceived] = useState('');
  const [loading, setLoading] = useState(false);

  const receivedNum = Number(cashReceived);
  const changeAmount = receivedNum - total;
  const isSufficient = receivedNum >= total;

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="COMPLETE TRANSACTION">
      <div className="space-y-6">
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 text-center">
          <p className="text-sm text-gray-400 font-mono mb-1">TOTAL AMOUNT DUE</p>
          <h2 className="text-3xl font-bold text-neon-cyan">{formatMMK(total)}</h2>
        </div>

        <Input 
          label="CASH RECEIVED (MMK)" 
          type="number" 
          autoFocus
          value={cashReceived}
          onChange={(e) => setCashReceived(e.target.value)}
          placeholder="Enter amount received from customer"
        />

        <div className={`p-4 rounded-xl border ${changeAmount >= 0 ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
          <p className="text-sm text-gray-400 font-mono mb-1">CHANGE TO RETURN</p>
          <h3 className={`text-xl font-bold ${changeAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {changeAmount > 0 ? formatMMK(changeAmount) : 'MMK 0'}
          </h3>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button 
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
