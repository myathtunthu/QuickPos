import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Button from '../components/UI/Button';
import { useToastStore } from '../store/toastStore';

const MAX_DESCRIPTION_LENGTH = 250;

const EXPENSE_CATEGORIES = [
  { label: 'Utilities (Electricity/Water)', value: 'utilities' },
  { label: 'Staff Meals/Travel', value: 'staff' },
  { label: 'Maintenance & Repairs', value: 'maintenance' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Transport / Delivery', value: 'transport' },
  { label: 'Rent', value: 'rent' },
  { label: 'Other Misc', value: 'misc' },
];

const initialForm = {
  amount: '',
  category: 'utilities',
  description: '',
};

export default function ExpenseModal({ isOpen, onClose }) {
  const { userData } = useAuth();
  const addToast = useToastStore(state => state.addToast);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});

  const categoryValues = useMemo(() => new Set(EXPENSE_CATEGORIES.map(item => item.value)), []);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialForm);
      setErrors({});
      setLoading(false);
    }
  }, [isOpen]);

  const validate = () => {
    const nextErrors = {};
    const amount = Number(formData.amount);
    const description = formData.description.trim();

    if (!userData?.tenantId) {
      nextErrors.form = 'Tenant မတွေ့ပါ။ ပြန်လည် login ဝင်ပါ။';
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = 'အသုံးစရိတ်ငွေကို သုညထက်ကြီးသော ဂဏန်းအဖြစ် ထည့်ပါ။';
    }

    if (!categoryValues.has(formData.category)) {
      nextErrors.category = 'အသုံးစရိတ်အမျိုးအစား မမှန်ပါ။';
    }

    if (!description) {
      nextErrors.description = 'အသုံးစရိတ်အကြောင်းအရာကို ထည့်ပါ။';
    } else if (description.length > MAX_DESCRIPTION_LENGTH) {
      nextErrors.description = `စာလုံးရေ ${MAX_DESCRIPTION_LENGTH} ထက်မကျော်ရပါ။`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !validate()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        tenantId: userData.tenantId,
        recordedBy: userData.name || userData.email || userData.uid || 'Unknown User',
        recordedByUid: userData.uid || null,
        amount: Number(formData.amount),
        category: formData.category,
        description: formData.description.trim(),
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
      });
      addToast('Expense recorded successfully', 'success');
      setFormData(initialForm);
      onClose?.();
    } catch (error) {
      addToast(error?.message || 'Failed to record expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? undefined : onClose} title="RECORD EXPENSE">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="rounded-lg border border-neon-pink/40 bg-neon-pink/10 p-3 text-sm text-neon-pink">
            {errors.form}
          </div>
        )}

        <Input
          label="Amount (MMK)"
          type="number"
          min="1"
          step="1"
          inputMode="decimal"
          required
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          error={errors.amount}
        />

        <Select
          label="Expense Category"
          options={EXPENSE_CATEGORIES}
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          error={errors.category}
        />

        <Input
          label="Description"
          required
          value={formData.description}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="What was this expense for?"
          error={errors.description}
        />

        <p className="text-xs text-gray-500 text-right">
          {formData.description.trim().length}/{MAX_DESCRIPTION_LENGTH}
        </p>

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={loading}>Save Expense</Button>
        </div>
      </form>
    </Modal>
  );
}
