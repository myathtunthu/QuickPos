import React from 'react';

export default function GuideModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Help Center</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <section>
            <h3 className="font-bold">POS Setup Guide</h3>
            <p>Set shop name, phone, address, currency, receipt footer, and logo before daily use.</p>
          </section>
          <section>
            <h3 className="font-bold">Backup & Restore Guide</h3>
            <p>Export browser JSON backup regularly and keep copies outside the POS device.</p>
          </section>
          <section>
            <h3 className="font-bold">Telegram Backup Guide</h3>
            <p>Create a Telegram bot, add it as channel admin, get token/chat ID, then test backup delivery.</p>
          </section>
          <section>
            <h3 className="font-bold">CSV Import Guide</h3>
            <p>Use the provided CSV format. Check columns before importing products, customers, or suppliers.</p>
          </section>
          <section>
            <h3 className="font-bold">Logo Upload Guide</h3>
            <p>Use a square PNG logo when possible. Crop and save before printing receipts.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
