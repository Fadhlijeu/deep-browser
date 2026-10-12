import React, { useRef, useState, useEffect, useCallback } from 'react';
import { TabItem } from '../../types';

declare const chrome: any;

interface TabStripProps {
  tabs: TabItem[];
}

export const TabStrip: React.FC<TabStripProps> = ({ tabs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
    }
    window.addEventListener('resize', checkScroll);
    return () => {
      if (el) el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [tabs, checkScroll]);

  const slide = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -140 : 140;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkScroll, 200);
    }
  };

  if (!tabs || tabs.length === 0) return null;

  const handleSelectTab = (tabId: number) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.update(tabId, { active: true });
    }
  };

  return (
    <div className="slider-container tab-slider-container">
      {/* Left Slider Arrow */}
      {canScrollLeft && (
        <button
          className="slider-nav-btn slider-nav-left"
          onClick={() => slide('left')}
          title="Scroll tabs kiri"
          aria-label="Scroll tabs kiri"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>chevron_left</span>
        </button>
      )}

      {/* Scrollable Track */}
      <div className="slider-track tab-strip" ref={scrollRef}>
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

      {/* Right Slider Arrow */}
      {canScrollRight && (
        <button
          className="slider-nav-btn slider-nav-right"
          onClick={() => slide('right')}
          title="Scroll tabs kanan"
          aria-label="Scroll tabs kanan"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>chevron_right</span>
        </button>
      )}
    </div>
  );
};
