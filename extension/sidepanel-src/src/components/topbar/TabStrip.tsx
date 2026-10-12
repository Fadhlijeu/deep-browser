import React from 'react';
import { TabItem } from '../../types';

interface TabStripProps {
  tabs: TabItem[];
}

export const TabStrip: React.FC<TabStripProps> = ({ tabs }) => {
  if (!tabs || tabs.length === 0) return null;

  const handleSelectTab = (tabId: number) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.update(tabId, { active: true });
    }
  };

  return (
    <div className="tab-strip">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab-chip ${t.active ? 'active' : ''}`}
          onClick={() => handleSelectTab(t.id)}
          title={`${t.title} (${t.url})`}
        >
          {t.favIconUrl ? (
            <img
              src={t.favIconUrl}
              alt=""
              style={{ width: '12px', height: '12px', borderRadius: '2px', flexShrink: 0 }}
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>public</span>
          )}
          <span>{t.title}</span>
        </button>
      ))}
    </div>
  );
};
