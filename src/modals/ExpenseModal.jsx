import { useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Button from '../components/UI/Button';
import { useToastStore } from '../store/toastStore';

/**
 * Daily Expense Categories and Tracking
 */
export default function ExpenseModal({ isOpen, onClose }) {
  const { userData } = useAuth();
  const addToast = useToastStore(state => state.addToast);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    category: 'utilities',
    description: ''
  });

  const categories = [
    { label: 'Utilities (Electricity/Water)', value: 'utilities' },
    { label: 'Staff Meals/Travel', value: 'staff' },
    { label: 'Maintenance & Repairs', value: 'maintenance' },
    { label: 'Marketing', value: 'marketing' },
    { label: 'Other Misc', value: 'misc' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        tenantId: userData.tenantId,
        recordedBy: userData.name,
        amount: Number(formData.amount),
        category: formData.category,
        description: formData.description,
        timestamp: serverTimestamp()
      });
      addToast('Expense recorded successfully');
      setFormData({ amount: '', category: 'utilities', description: '' });
      onClose();
    } catch (error) {
      addToast('Failed to record expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="RECORD EXPENSE">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input 
          label="Amount (MMK)" 
          type="number"
          required
          value={formData.amount}
          onChange={(e) => setFormData({...formData, amount: e.target.value})}
        />
        <Select 
          label="Expense Category" 
          options={categories}
          value={formData.category}
          onChange={(e) => setFormData({...formData, category: e.target.value})}
        />
        <Input 
          label="Description" 
          required
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="What was this expense for?"
        />
        <div className="pt-4 flex justify-end">
          <Button type="submit" loading={loading}>Save Expense</Button>
        </div>
      </form>
    </Modal>
  );
}
