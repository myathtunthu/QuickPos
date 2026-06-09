import { useEffect, useState } from 'react';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToastStore } from '../store/toastStore';
import { Gift } from 'lucide-react';

const POINT_VALUE_MMK = 10;
const normalizePhone = (value = '') => value.replace(/[\s-]/g, '').trim();

export default function LoyaltyModal({ isOpen, onClose, onApplyDiscount }) {
  const { userData } = useAuth();
  const addToast = useToastStore(state => state.addToast);
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setCustomer(null);
      setRedeemPoints('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (loading) return;

    const normalizedPhone = normalizePhone(phone);
    if (!userData?.tenantId) {
      setError('Tenant မတွေ့ပါ။ ပြန်လည် login ဝင်ပါ။');
      return;
    }
    if (!normalizedPhone) {
      setError('Customer phone number ထည့်ပါ။');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const q = query(
        collection(db, 'customers'),
        where('tenantId', '==', userData.tenantId),
        where('phone', '==', normalizedPhone)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const custDoc = snap.docs[0];
        const data = custDoc.data();
        setCustomer({ id: custDoc.id, ...data, points: Number(data.points) || 0 });
        setRedeemPoints('');
        addToast('Customer found!', 'success');
      } else {
        setCustomer(null);
        addToast('No customer found with this phone number', 'warning');
      }
    } catch (error) {
      addToast(error?.message || 'Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (loading || !customer) return;

    const points = Number(redeemPoints);
    const availablePoints = Math.floor(Number(customer.points) || 0);

    if (!Number.isInteger(points) || points <= 0 || points > availablePoints) {
      setError('Redeem points ကို ရရှိထားသော point အတွင်း integer အဖြစ် ထည့်ပါ။');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const custRef = doc(db, 'customers', customer.id);
      const discountAmount = await runTransaction(db, async (transaction) => {
        const freshSnap = await transaction.get(custRef);
        if (!freshSnap.exists()) {
          throw new Error('Customer မတွေ့ပါ။');
        }

        const freshData = freshSnap.data();
        if (freshData.tenantId !== userData.tenantId) {
          throw new Error('Customer tenant မကိုက်ညီပါ။');
        }

        const freshPoints = Math.floor(Number(freshData.points) || 0);
        if (points > freshPoints) {
          throw new Error('Customer point မလုံလောက်တော့ပါ။');
        }

        transaction.update(custRef, {
          points: freshPoints - points,
          updatedAt: serverTimestamp(),
          lastRedeemedAt: serverTimestamp(),
        });

        return points * POINT_VALUE_MMK;
      });

      onApplyDiscount?.(discountAmount);
      addToast(`Redeemed ${points} points for ${discountAmount} MMK discount!`, 'success');
      onClose?.();
    } catch (error) {
      addToast(error?.message || 'Failed to redeem points', 'error');
      setError(error?.message || 'Failed to redeem points');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? undefined : onClose} title="CUSTOMER LOYALTY">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-neon-pink/40 bg-neon-pink/10 p-3 text-sm text-neon-pink">
            {error}
          </div>
        )}

        <form onSubmit={handleSearch} className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="Customer Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter 09..."
              autoComplete="tel"
              inputMode="tel"
              required
            />
          </div>
          <Button type="submit" loading={loading} disabled={loading} icon={Gift}>Search</Button>
        </form>

        {customer && (
          <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg space-y-4 mt-4">
            <div className="flex justify-between items-center gap-3">
              <div>
                <p className="text-white font-bold">{customer.name || 'Unnamed Customer'}</p>
                <p className="text-xs text-gray-400">Available Points</p>
              </div>
              <div className="text-2xl font-bold text-neon-pink">
                {Math.floor(customer.points || 0)} <span className="text-sm">Pts</span>
              </div>
            </div>

            <div className="flex gap-2 items-end pt-4 border-t border-gray-800">
              <div className="flex-1">
                <Input
                  label={`Points to Redeem (1 Pt = ${POINT_VALUE_MMK} MMK)`}
                  type="number"
                  min="1"
                  step="1"
                  value={redeemPoints}
                  max={Math.floor(customer.points || 0)}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={handleRedeem}
                loading={loading}
                disabled={!redeemPoints || loading}
              >
                Apply
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
