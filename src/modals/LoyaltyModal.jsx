import { useState } from 'react';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToastStore } from '../store/toastStore';
import { Gift } from 'lucide-react';

export default function LoyaltyModal({ isOpen, onClose, onApplyDiscount }) {
  const { userData } = useAuth();
  const addToast = useToastStore(state => state.addToast);
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const q = query(
        collection(db, 'customers'), 
        where('tenantId', '==', userData.tenantId),
        where('phone', '==', phone)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const custDoc = snap.docs[0];
        setCustomer({ id: custDoc.id, ...custDoc.data() });
        addToast('Customer found!', 'success');
      } else {
        setCustomer(null);
        addToast('No customer found with this phone number', 'warning');
      }
    } catch (error) {
      addToast('Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    const points = Number(redeemPoints);
    if (points <= 0 || points > (customer.points || 0)) {
      addToast('Invalid points amount', 'error');
      return;
    }

    setLoading(true);
    try {
      // Assuming 1 Point = 10 MMK discount
      const discountAmount = points * 10;
      
      // Deduct points from customer
      const custRef = doc(db, 'customers', customer.id);
      await updateDoc(custRef, {
        points: (customer.points || 0) - points
      });

      onApplyDiscount(discountAmount);
      addToast(`Redeemed ${points} points for ${discountAmount} MMK discount!`, 'success');
      onClose();
    } catch (error) {
      addToast('Failed to redeem points', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CUSTOMER LOYALTY">
      <div className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1">
            <Input 
              label="Customer Phone" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter 09..."
              required
            />
          </div>
          <div className="pt-5">
            <Button type="submit" loading={loading} icon={Gift}>Search</Button>
          </div>
        </form>

        {customer && (
          <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white font-bold">{customer.name}</p>
                <p className="text-xs text-gray-400">Available Points</p>
              </div>
              <div className="text-2xl font-bold text-neon-pink">
                {customer.points || 0} <span className="text-sm">Pts</span>
              </div>
            </div>
            
            <div className="flex gap-2 items-end pt-4 border-t border-gray-800">
              <div className="flex-1">
                <Input 
                  label="Points to Redeem" 
                  type="number"
                  value={redeemPoints}
                  max={customer.points || 0}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                />
              </div>
              <Button onClick={handleRedeem} loading={loading} disabled={!redeemPoints}>
                Apply
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
