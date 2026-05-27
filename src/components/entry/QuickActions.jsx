import { Lightbulb } from 'lucide-react';

export default function QuickActions() {
  return (
    <div className="bg-amber-900/20 border border-amber-500/20 rounded-lg p-2 text-[10px] text-amber-400">
      <p className="font-bold flex items-center gap-1"><Lightbulb size={12} /> AI Suggestions</p>
      <ul className="list-disc list-inside mt-1 space-y-0.5">
        <li>Top seller: Shark (24 units today)</li>
        <li>Low stock: Energy Drink (12 left)</li>
        <li>Price recommendation: Retail ဖာ - 12,500 Ks</li>
      </ul>
    </div>
  );
}
