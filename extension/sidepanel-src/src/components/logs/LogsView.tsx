import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, 
  Eye, 
  Brain, 
  CheckCircle2, 
  AlertTriangle, 
  Compass, 
  Search, 
  Copy, 
  Check, 
  Trash2, 
  Download, 
  ChevronRight, 
  ChevronDown,
  X, 
  ShieldCheck, 
  Activity, 
  Maximize2 
} from 'lucide-react';
import { LogEvent, LogCategory } from '../../types';
import { normalizeImageSrc } from '../thread/ToolStepCard';

interface LogsViewProps {
  events: LogEvent[];
  filter: LogCategory;
  search: string;
  runState?: string;
  onSetFilter: (f: LogCategory) => void;
  onSetSearch: (s: string) => void;
  onClearLogs?: () => void;
}

export const LogsView: React.FC<LogsViewProps> = ({
  events,
  filter,
  search,
  runState = 'idle',
  onSetFilter,
  onSetSearch,
  onClearLogs,
}) => {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});
  const [modalImage, setModalImage] = useState<string | null>(null);
  const listBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive while running
  useEffect(() => {
    if (runState === 'running' && listBottomRef.current) {
      listBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events.length, runState]);

  // Compute category counts
  const counts = {
    all: events.length,
    tools: events.filter((e) => e.category === 'tools').length,
    reasoning: events.filter((e) => e.category === 'reasoning').length,
    observations: events.filter((e) => e.category === 'observations').length,
    verifications: events.filter((e) => e.category === 'verifications').length,
    approvals: events.filter((e) => e.category === 'approvals').length,
    errors: events.filter((e) => e.category === 'errors').length,
  };

  const filteredEvents = events.filter((e) => {
    if (filter !== 'all' && e.category !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const msgMatch = (e.message || '').toLowerCase().includes(q);
      const typeMatch = (e.type || '').toLowerCase().includes(q);
      return msgMatch || typeMatch;
    }
    return true;
  });

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyAll = () => {
    navigator.clipboard?.writeText?.(JSON.stringify(events, null, 2));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const copyItem = (evt: LogEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(JSON.stringify(evt, null, 2));
    setCopiedId(evt.id);
    setTimeout(() => setCopiedId(null), 1400);
  };

  const exportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `deep-browser-logs-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getPayloadImage = (payload: any): string | null => {
    if (!payload || typeof payload !== 'object') return null;
    const img = payload.screenshotDataUrl || payload.screenshot || payload.dataUrl;
    return normalizeImageSrc(img);
  };

  const getCleanPayload = (payload: any): any => {
    if (!payload || typeof payload !== 'object') return payload;
    const copy: any = { ...payload };
    if (copy.screenshotDataUrl && normalizeImageSrc(copy.screenshotDataUrl)) {
      copy.screenshotDataUrl = '[Gambar Tangkapan Layar Viewport]';
    }
    if (copy.screenshot && normalizeImageSrc(copy.screenshot)) {
      copy.screenshot = '[Gambar Tangkapan Layar Viewport]';
    }
    return copy;
  };

  const getCategoryMeta = (cat: LogCategory, type: string) => {
    const up = type.toUpperCase();
    if (cat === 'errors' || up.includes('ERR') || up.includes('FAIL')) {
      return { icon: AlertTriangle, label: 'Error', colorClass: 'error' };
    }
    if (cat === 'reasoning' || up.includes('REASON') || up.includes('PLAN')) {
      return { icon: Brain, label: 'Reasoning', colorClass: 'reasoning' };
    }
    if (cat === 'verifications' || up.includes('VERIF')) {
      return { icon: CheckCircle2, label: 'Verifikasi', colorClass: 'verifications' };
    }
    if (cat === 'observations' || up.includes('OBSERV') || up.includes('SCREEN')) {
      return { icon: Eye, label: 'Observasi', colorClass: 'observations' };
    }
    if (cat === 'approvals' || up.includes('APPROV') || up.includes('HITL')) {
      return { icon: ShieldCheck, label: 'Persetujuan', colorClass: 'approvals' };
    }
    if (up.includes('NAV')) {
      return { icon: Compass, label: 'Navigasi', colorClass: 'navigation' };
    }
    return { icon: Terminal, label: 'Tool Call', colorClass: 'tools' };
  };

  const FILTER_TABS: { id: LogCategory; label: string; count: number }[] = [
    { id: 'all', label: 'Semua', count: counts.all },
    { id: 'tools', label: 'Tools', count: counts.tools },
    { id: 'reasoning', label: 'Reasoning', count: counts.reasoning },
    { id: 'observations', label: 'Observasi', count: counts.observations },
    { id: 'verifications', label: 'Verifikasi', count: counts.verifications },
    { id: 'approvals', label: 'Persetujuan', count: counts.approvals },
    { id: 'errors', label: 'Errors', count: counts.errors },
  ];

  return (
    <div className="logs-view-container">
      {/* Top Console Toolbar */}
      <div className="logs-toolbar">
        {/* Search input with clean icon */}
        <div className="logs-search-wrapper">
          <Search size={13} className="logs-search-icon" />
          <input
            type="text"
            className="logs-search-input"
            placeholder="Cari event, aksi, parameter, atau log..."
            value={search}
            onChange={(e) => onSetSearch(e.target.value)}
          />
          {search && (
            <button className="logs-clear-search-btn" onClick={() => onSetSearch('')} title="Reset pencarian">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Global actions */}
        <div className="logs-toolbar-actions">
          <button className="logs-tool-btn" onClick={copyAll} title="Salin semua log sebagai JSON">
            {copiedAll ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copiedAll ? 'Tersalin' : 'Salin JSON'}</span>
          </button>
          <button className="logs-tool-btn" onClick={exportJson} title="Ekspor log ke file JSON">
            <Download size={12} />
            <span>Ekspor</span>
          </button>
          {onClearLogs && (
            <button 
              className="logs-tool-btn danger" 
              onClick={onClearLogs} 
              disabled={events.length === 0}
              title="Bersihkan rekaman log sesi ini"
            >
              <Trash2 size={12} />
              <span>Bersihkan</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="logs-filter-strip">
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              className={`logs-filter-chip ${isActive ? 'active' : ''}`}
              onClick={() => onSetFilter(tab.id)}
            >
              <span>{tab.label}</span>
              <span className={`logs-chip-count ${isActive ? 'active' : ''}`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* Logs Event Feed */}
      <div className="logs-feed-scroll">
        {filteredEvents.length === 0 ? (
          <div className="logs-empty-state">
            <Activity size={24} className="logs-empty-icon" />
            <span className="logs-empty-title">Tidak Ada Rekaman Log</span>
            <p className="logs-empty-desc">
              {search
                ? `Tidak ditemukan event yang cocok dengan "${search}".`
                : 'Aktivitas browser, eksekusi tool, dan penalaran model akan tercatat otomatis di sini.'}
            </p>
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const meta = getCategoryMeta(evt.category, evt.type);
            const Icon = meta.icon;
            const imgUrl = getPayloadImage(evt.payload);
            const isPayloadOpen = Boolean(expandedPayloads[evt.id]);
            const payloadClean = getCleanPayload(evt.payload);
            const hasPayload = payloadClean && Object.keys(payloadClean).length > 0;
            const isItemCopied = copiedId === evt.id;

            return (
              <div key={evt.id} className="log-card">
                {/* Card Header Strip */}
                <div className="log-card-header">
                  <div className="log-badge-group">
                    <span className={`log-type-badge ${meta.colorClass}`}>
                      <Icon size={11} />
                      <span>{evt.type}</span>
                    </span>
                    {evt.step != null && (
                      <span className="log-step-badge">Step #{evt.step}</span>
                    )}
                  </div>

                  <div className="log-meta-right">
                    <span className="log-timestamp">
                      {new Date(evt.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                      })}
                    </span>
                    <button
                      className="log-copy-single-btn"
                      onClick={(e) => copyItem(evt, e)}
                      title="Salin event ini"
                    >
                      {isItemCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>

                {/* Primary Message */}
                <div className="log-message-row">
                  {evt.message}
                </div>

                {/* Screenshot visual preview if present in log */}
                {imgUrl && (
                  <div className="log-screenshot-wrapper">
                    <div className="log-screenshot-header">
                      <span>Tangkapan Layar Viewport</span>
                      <button 
                        className="log-expand-img-btn"
                        onClick={() => setModalImage(imgUrl)}
                        title="Perbesar gambar"
                      >
                        <Maximize2 size={10} />
                        <span>Perbesar</span>
                      </button>
                    </div>
                    <div 
                      className="log-screenshot-thumb"
                      onClick={() => setModalImage(imgUrl)}
                    >
                      <img src={imgUrl} alt="Tangkapan Layar Log" />
                    </div>
                  </div>
                )}

                {/* Structured Payload Accordion */}
                {hasPayload && (
                  <div className="log-payload-wrapper">
                    <button
                      type="button"
                      className="log-payload-toggle"
                      onClick={() => togglePayload(evt.id)}
                    >
                      {isPayloadOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span>Payload Data ({Object.keys(payloadClean).length} kunci)</span>
                    </button>

                    {isPayloadOpen && (
                      <div className="log-payload-content">
                        <pre>{JSON.stringify(payloadClean, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Live Running Indicator for In-Progress Steps */}
        {runState === 'running' && (
          <div className="log-running-card">
            <div className="sleek-pulse-indicator">
              <span />
              <span />
              <span />
            </div>
            <span>Mengeksekusi tindakan & event browser berikutnya...</span>
          </div>
        )}

        <div ref={listBottomRef} />
      </div>

      {/* Lightbox Modal for Screenshot Enlarge */}
      {modalImage && (
        <div className="modal-backdrop" onClick={() => setModalImage(null)} style={{ zIndex: 9999 }}>
          <div className="screenshot-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="screenshot-modal-header">
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Tangkapan Layar Log</span>
              <button className="icon-btn" onClick={() => setModalImage(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="screenshot-modal-body">
              <img src={modalImage} alt="Preview Screenshot" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
