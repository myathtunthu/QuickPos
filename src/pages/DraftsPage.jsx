import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { PauseCircle, Trash2, ShoppingCart, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DraftsPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;
  const navigate = useNavigate();
  
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDrafts = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'pos_drafts'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // အသစ်များကို အပေါ်ဆုံးတွင် ပြမည်
      data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setDrafts(data);
    } catch (error) {
      console.error("Error fetching drafts:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDrafts();
  }, [tenantId]);

  const handleDelete = async (id) => {
    if (!window.confirm("ဤ Hold Invoice ကို ဖျက်ရန် သေချာပါသလား? (ပြန်လည်ရယူ၍ မရနိုင်ပါ)")) return;
    try {
      await deleteDoc(doc(db, 'pos_drafts', id));
      setDrafts(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error("Error deleting draft:", error);
      alert("ဖျက်ရာတွင် အမှားအယွင်းဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  };

  const handleRestore = (draft) => {
    // Entry Page သို့ Draft Data များ သယ်ဆောင်သွားမည်
    navigate('/entry', { state: { draftToRestore: draft } });
  };

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-20">
      
      <div className="flex justify-between items-center bg-[#0d1120] p-6 rounded-3xl border-2 border-amber-500/15 shadow-xl">
        <div>
          <h3 className="font-black text-2xl flex items-center gap-3"><PauseCircle className="text-amber-500"/> Hold Invoices</h3>
          <p className="text-slate-400 text-sm mt-1">ခဏဆိုင်းထားသော ဘေလ်မှတ်တမ်းများ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <p className="text-slate-500 px-2">Loading drafts...</p>}
        {!loading && drafts.length === 0 && <p className="text-slate-500 px-2">ခဏဆိုင်းထားသော ဘေလ်များ မရှိပါ။</p>}
        
        {drafts.map((draft) => (
          <div key={draft.id} className="bg-[#0d1120] border-2 border-amber-500/20 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-black text-lg text-white">{draft.draftName || 'အမည်မသိ'}</h4>
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${draft.type === 'Purchase' ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                  {draft.type || 'Sale'}
                </span>
              </div>
              <p className="text-sm text-slate-400 flex items-center gap-2 mb-1">
                <ShoppingCart size={14}/> Items: <span className="font-bold text-white">{draft.cart?.length || 0}</span>
              </p>
              <p className="text-sm text-slate-400 flex items-center gap-2 mb-4">
                <Clock size={14}/> Time: <span className="text-white">{draft.createdAt?.toDate ? draft.createdAt.toDate().toLocaleString() : 'Just now'}</span>
              </p>
              <div className="bg-black/40 border border-white/5 p-3 rounded-xl mb-4">
                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Total Amount</p>
                <p className="text-xl font-black text-amber-400">{Number(draft.cartTotals?.total || 0).toLocaleString()} Ks</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button onClick={() => handleRestore(draft)} className="flex-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-500/30 py-2.5 rounded-xl font-bold transition-colors">
                ပြန်လည်ရယူမည်
              </button>
              <button onClick={() => handleDelete(draft.id)} className="px-4 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/30 rounded-xl transition-colors">
                <Trash2 size={18}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
