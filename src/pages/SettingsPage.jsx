import React, { useState } from 'react';
import GuideModal from '../components/Settings/GuideModal';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Settings</h1>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Help / Guide
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
        {['general', 'backup', 'guides', 'language'].map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm font-semibold capitalize ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {activeTab === 'general' && <div>General Settings</div>}
        {activeTab === 'backup' && <div>Backup & Restore Settings</div>}
        {activeTab === 'guides' && <div>Open the Help / Guide button above.</div>}
        {activeTab === 'language' && <div>Language Settings</div>}
      </div>

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
