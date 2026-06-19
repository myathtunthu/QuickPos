
import React, { useState } from 'react';
import GuideModal from './GuideModal';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="p-4 space-y-4">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Settings</h1>
        <button
          onClick={() => setShowGuide(true)}
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Help
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b">
        {['general','backup','guides','language'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 ${activeTab === tab ? 'border-b-2 border-blue-500' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="mt-4">
        {activeTab === 'general' && <div>General Settings (Shop Info, Logo, Address)</div>}
        {activeTab === 'backup' && <div>Backup & Restore Settings</div>}
        {activeTab === 'guides' && <div>Use Help Button above</div>}
        {activeTab === 'language' && <div>Language Settings</div>}
      </div>

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
