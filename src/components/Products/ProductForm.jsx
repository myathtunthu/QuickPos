import { useState } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import Input from '../UI/Input';
import BarcodeScanner from './BarcodeScanner';
import { ScanBarcode } from 'lucide-react';

export default function ProductForm({ product, onClose, onSaved }) {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [formData, setFormData] = useState({
    name: product?.name || '',
    price: product?.price || '',
    cost: product?.cost || '',
    stock: product?.stock || '',
    minStock: product?.minStock || '5',
    barcode: product?.barcode || '',
    category: product?.category || 'General'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleScan = (barcode) => {
    setFormData(prev => ({ ...prev, barcode }));
    setShowScanner(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        cost: Number(formData.cost),
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
        tenantId: userData.tenantId,
        updatedAt: serverTimestamp()
      };

      if (product?.id) {
        await updateDoc(doc(db, 'pos_products', product.id), payload);
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, 'pos_products'), payload);
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Product Name"
        name="name"
        required
        value={formData.name}
        onChange={handleChange}
        placeholder="e.g. Coca Cola 330ml"
      />
      
      {/* Phone တွင် ၁ ကွက်စီ၊ Tablet/PC တွင် ၂ ကွက်စီ (sm:grid-cols-2) ပြောင်းထားပါသည် */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Selling Price (MMK)"
          name="price"
          type="number"
          required
          value={formData.price}
          onChange={handleChange}
        />
        <Input
          label="Cost Price (MMK)"
          name="cost"
          type="number"
          required
          value={formData.cost}
          onChange={handleChange}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Current Stock"
          name="stock"
          type="number"
          required
          value={formData.stock}
          onChange={handleChange}
        />
        <Input
          label="Min Stock Alert"
          name="minStock"
          type="number"
          required
          value={formData.minStock}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-mono uppercase tracking-widest text-gray-400">
          Barcode / SKU
        </label>
        <div className="flex space-x-2">
          <input
            className="input-cyber flex-1"
            name="barcode"
            value={formData.barcode}
            onChange={handleChange}
            placeholder="Scan or type barcode"
          />
          <button
            type="button"
            onClick={() => setShowScanner(!showScanner)}
            className="px-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-neon-cyan hover:text-neon-cyan transition-colors text-gray-400"
          >
            <ScanBarcode size={20} />
          </button>
        </div>
      </div>

      {showScanner && (
        <div className="mt-2">
          <BarcodeScanner onScanSuccess={handleScan} />
        </div>
      )}

      <Input
        label="Category"
        name="category"
        required
        value={formData.category}
        onChange={handleChange}
        placeholder="e.g. Beverages"
      />

      <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors w-full sm:w-auto text-center"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full sm:w-auto"
        >
          {loading ? 'Saving...' : product?.id ? 'Update Item' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}
