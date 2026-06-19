
import React from 'react';

export default function GuideModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white w-[90%] max-w-lg p-4 rounded-lg">
        <h2 className="text-lg font-bold mb-3">Help Center</h2>

        <ul className="space-y-2 text-sm">
          <li>• POS Setup Guide</li>
          <li>• Backup & Restore Guide</li>
          <li>• Telegram Backup Setup</li>
          <li>• CSV Import Guide</li>
          <li>• Logo Upload Guide</li>
        </ul>

        <div className="mt-4 text-right">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-red-500 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
