import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { formatMMK } from '../utils/formatMMK';
import { TrendingDown } from 'lucide-react';

export default function ExpenseTab() {
  const { userData } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchExpenses = async () => {
      if (!userData?.tenantId) return;
      try {
        const q = query(
          collection(db, 'expenses'),
          where('tenantId', '==', userData.tenantId),
          orderBy('timestamp', 'desc')
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        setExpenses(data);
        setTotal(data.reduce((sum, item) => sum + item.amount, 0));
      } catch (error) {
        console.error("Error fetching expenses", error);
      } finally {
        setLoading(false);
      }
    };
    fetchExpenses();
  }, [userData]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Expenses...</div>;

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-l-4 border-neon-pink">
        <div>
          <p className="text-sm text-gray-400">Total Expenses</p>
          <h3 className="text-2xl font-bold text-white">{formatMMK(total)}</h3>
        </div>
        <TrendingDown size={32} className="text-neon-pink" />
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-900 text-xs uppercase text-gray-400 font-mono">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Staff</th>
              <th className="px-6 py-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {expenses.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-8 text-gray-500">No expenses recorded.</td></tr>
            ) : (
              expenses.map(expense => (
                <tr key={expense.id} className="hover:bg-gray-800/50">
                  <td className="px-6 py-4">{expense.timestamp?.toDate().toLocaleDateString()}</td>
                  <td className="px-6 py-4 uppercase text-xs">
                    <span className="bg-gray-800 px-2 py-1 rounded text-neon-cyan">{expense.category}</span>
                  </td>
                  <td className="px-6 py-4">{expense.description}</td>
                  <td className="px-6 py-4 text-xs font-mono">{expense.recordedBy}</td>
                  <td className="px-6 py-4 text-right font-bold text-neon-pink">{formatMMK(expense.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
