import React, { useState } from 'react';
import {
  Globe,
  MousePointer2,
  FileText,
  Upload,
  Camera,
  Layers,
  Search,
  BookOpen,
  Bot,
  Workflow,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { PRESET_OPTIONS } from '../../state/sidepanelStore';

interface ToolsViewProps {
  onUsePrompt: (promptText: string) => void;
}

interface ToolDef {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
}

const REGISTERED_TOOLS: ToolDef[] = [
  {
    id: 'click_element',
    name: 'Click element',
    category: 'Interaction',
    icon: 'mouse-pointer-2',
    description: 'Target a visible element using selector, index label, or text description with synthetic click event.',
    inputSchema: { index: 12, selector: 'button[type="submit"]', timeout_ms: 5000 },
    outputSchema: { clicked: true, mutated: true, element: 'Submit' },
  },
  {
    id: 'input_text',
    name: 'Input text',
    category: 'Forms',
    icon: 'file-text',
    description: 'Focus input element and type text with proper input & change DOM event dispatching.',
    inputSchema: { index: 4, text: 'Search query', clear_first: true },
    outputSchema: { typed: true, value_length: 12 },
  },
  {
    id: 'upload_file',
    name: 'Upload file',
    category: 'Forms & Files',
    icon: 'upload',
    description: 'Inject files into file input fields via synthetic DataTransfer and nearest input resolver.',
    inputSchema: { index: 7, file_name: 'document.pdf', base64: '[FILE_DATA]' },
    outputSchema: { uploaded: true, files_count: 1 },
  },
  {
    id: 'navigate',
    name: 'Navigate to URL',
    category: 'Navigation',
    icon: 'globe',
    description: 'Navigate the active tab to an authoritative target URL and wait for DOM stabilization.',
    inputSchema: { url: 'https://example.com', wait_until: 'domcontentloaded' },
    outputSchema: { url: 'https://example.com', title: 'Example Page', status: 200 },
  },
  {
    id: 'scroll_page',
    name: 'Scroll page',
    category: 'Navigation',
    icon: 'globe',
    description: 'Scroll window up/down or to a specific coordinate or element into view.',
    inputSchema: { direction: 'down', amount_px: 500 },
    outputSchema: { scroll_y: 500, max_y: 2400 },
  },
  {
    id: 'screenshot',
    name: 'Capture screenshot',
    category: 'Capture',
    icon: 'camera',
    description: 'Capture active viewport or full-page screenshot via Chrome CDP Page.captureScreenshot.',
    inputSchema: { full_page: false, quality: 80 },
    outputSchema: { format: 'png', width: 1280, height: 800, dataUrl: 'data:image/png;base64,...' },
  },
  {
    id: 'highlight_sections',
    name: 'Highlight sections',
    category: 'Visual & Overlay',
    icon: 'layers',
    description: 'Inject visual overlay highlights and numeric index badges onto interactive DOM elements.',
    inputSchema: { enabled: true, color: 'blue' },
    outputSchema: { elements_labeled: 34 },
  },
  {
    id: 'execute_skill',
    name: 'Execute skill',
    category: 'Automations',
    icon: 'workflow',
    description: 'Run custom autonomous local-first browser skills (PDDIKTI lookup, GitHub repo, etc.).',
    inputSchema: { skill_id: 'pddikti_search', params: { query: 'Informatika' } },
    outputSchema: { success: true, result: '...' },
  },
  {
    id: 'manage_tabs',
    name: 'Manage tabs',
    category: 'Tabs',
    icon: 'layers',
    description: 'Switch active tab, open new background tabs, or close completed tabs cleanly.',
    inputSchema: { action: 'switch', tab_id: 104 },
    outputSchema: { active_tab_id: 104, title: 'Target Tab' },
  },
];

const DEFAULT_PROMPTS = [
  {
    id: 'p1',
    name: 'Bandingkan Harga & Spesifikasi',
    category: 'Research',
    text: 'Buka dan bandingkan 3 halaman web yang relevan, kumpulkan informasi harga, batasan, dan fitur utama lalu rangkum ke dalam tabel komparasi.',
  },
  {
    id: 'p2',
    name: 'Audit Form & Validasi DOM',
    category: 'Browser',
    text: 'Jelajahi alur halaman aktif, identifikasi input form penting, cek apakah tombol submit memerlukan konfirmasi, lalu buat checklist verifikasi.',
  },
  {
    id: 'p3',
    name: 'Rangkum Halaman Web Aktif',
    category: 'Summarization',
    text: 'Baca seluruh konten halaman aktif saat ini, ekstrak poin-poin penting, klaim utama, dan angka statistik yang relevan ke dalam format terstruktur.',
  },
  {
    id: 'p4',
    name: 'Ekstraksi Data Terstruktur',
    category: 'Data',
    text: 'Temukan tabel atau list data pada halaman ini dan ekstrak semua barisnya menjadi format data JSON/CSV yang rapi.',
  },
];

export const ToolsView: React.FC<ToolsViewProps> = ({ onUsePrompt }) => {
  const [tab, setTab] = useState<'catalog' | 'prompts' | 'presets'>('catalog');
  const [toolSearch, setToolSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [inspectTool, setInspectTool] = useState<ToolDef | null>(null);

  const categories = ['all', ...Array.from(new Set(REGISTERED_TOOLS.map((t) => t.category)))];

  const filteredTools = REGISTERED_TOOLS
    .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
    .filter((t) => !toolSearch || `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(toolSearch.toLowerCase()));

  const renderToolIcon = (icon: string) => {
    switch (icon) {
      case 'mouse-pointer-2': return <MousePointer2 size={15} />;
      case 'file-text': return <FileText size={15} />;
      case 'upload': return <Upload size={15} />;
      case 'globe': return <Globe size={15} />;
      case 'camera': return <Camera size={15} />;
      case 'layers': return <Layers size={15} />;
      case 'workflow': return <Workflow size={15} />;
      default: return <Bot size={15} />;
    }
  };

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">Capabilities</div>
          <h1>Tools &amp; Library</h1>
          <p className="page-subtitle">
            Inspect available browser actions, curate reusable prompts, and manage execution presets.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="nav-tabs">
        <button
          className={`nav-tab ${tab === 'catalog' ? 'active' : ''}`}
          onClick={() => setTab('catalog')}
        >
          Tool catalog
        </button>
        <button
          className={`nav-tab ${tab === 'prompts' ? 'active' : ''}`}
          onClick={() => setTab('prompts')}
        >
          Saved prompts <span className="nav-count">{DEFAULT_PROMPTS.length}</span>
        </button>
        <button
          className={`nav-tab ${tab === 'presets' ? 'active' : ''}`}
          onClick={() => setTab('presets')}
        >
          Agent presets <span className="nav-count">{PRESET_OPTIONS.length}</span>
        </button>
      </div>

      {/* Tab 1: Tool Catalog */}
      {tab === 'catalog' && (
        <>
          <div className="toolbar" style={{ marginBottom: '14px' }}>
            <div className="searchbox">
              <Search size={14} />
              <input
                className="input"
                placeholder="Search tools…"
                value={toolSearch}
                onChange={(e) => setToolSearch(e.target.value)}
              />
            </div>
            <select
              className="select"
              style={{ width: '170px' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All categories' : c}
                </option>
              ))}
            </select>
            <span className="muted tiny" style={{ marginLeft: 'auto' }}>
              {filteredTools.length} active CDP tools
            </span>
          </div>

          <div className="tool-grid">
            {filteredTools.map((t) => (
              <div key={t.id} className="tool-card">
                <div className="tool-card-top">
                  <div className="tool-symbol">{renderToolIcon(t.icon)}</div>
                  <span className="status success">Available</span>
                </div>
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <div className="tool-card-foot">
                  <span>{t.category}</span>
                  <button
                    className="btn ghost small"
                    onClick={() => setInspectTool(t)}
                  >
                    Inspect <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="callout" style={{ marginTop: '18px' }}>
            <ShieldCheck size={15} />
            <span>
              All browser actions execute locally in your Edge session via Chrome DevTools Protocol (CDP). No cloud sandbox lock-in.
            </span>
          </div>
        </>
      )}

      {/* Tab 2: Saved Prompts */}
      {tab === 'prompts' && (
        <div className="surface">
          <div className="surface-head">
            <div>
              <div className="surface-title">Reusable prompt library</div>
              <div className="surface-note">Instant prompt templates for common browser workflows.</div>
            </div>
          </div>

          {DEFAULT_PROMPTS.map((p) => (
            <div key={p.id} className="list-row">
              <div className="list-icon">
                <BookOpen size={15} />
              </div>
              <div className="list-row-main">
                <strong>{p.name}</strong>
                <p>{p.text}</p>
                <div className="session-meta">
                  <span>{p.category}</span>
                  <span>·</span>
                  <span>{p.text.length} characters</span>
                </div>
              </div>
              <button
                className="btn small primary"
                onClick={() => onUsePrompt(p.text)}
              >
                Use in Chat
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Agent Presets */}
      {tab === 'presets' && (
        <div className="split-grid">
          <div className="surface">
            <div className="surface-head">
              <div>
                <div className="surface-title">Agent Presets</div>
                <div className="surface-note">Configured behavior and tool permissions.</div>
              </div>
            </div>
            {PRESET_OPTIONS.map((pr) => (
              <div key={pr.id} className="list-row">
                <div className="list-icon">
                  <Bot size={15} />
                </div>
                <div className="list-row-main">
                  <strong>{pr.name}</strong>
                  <p>Preset template: {pr.id}</p>
                </div>
                <span className="pill">{pr.id}</span>
              </div>
            ))}
          </div>

          <div className="surface">
            <div className="surface-head">
              <div className="surface-title">Execution Mode Reference</div>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <strong style={{ fontSize: '11px', color: 'var(--ink)' }}>Agent Decide (Default)</strong>
                <p className="surface-note" style={{ lineHeight: 1.6 }}>
                  Agent evaluates action risk dynamically and confirms sensitive mutations.
                </p>
              </div>
              <div style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <strong style={{ fontSize: '11px', color: 'var(--ink)' }}>Always Proceed (Auto)</strong>
                <p className="surface-note" style={{ lineHeight: 1.6 }}>
                  Continuous execution without manual prompt interruptions.
                </p>
              </div>
              <div style={{ padding: '10px 0' }}>
                <strong style={{ fontSize: '11px', color: 'var(--ink)' }}>Request Review (HITL)</strong>
                <p className="surface-note" style={{ lineHeight: 1.6 }}>
                  Strict human approval required before each browser action dispatch.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tool Inspector Modal / Drawer */}
      {inspectTool && (
        <div className="modal-backdrop" onClick={() => setInspectTool(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">TOOL INSPECTOR · {inspectTool.category.toUpperCase()}</div>
                <div className="modal-title">{inspectTool.name}</div>
                <div className="modal-sub">{inspectTool.description}</div>
              </div>
              <button className="close-btn" onClick={() => setInspectTool(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body">
              <div className="section-head">
                <h2>Input Schema (Parameters)</h2>
              </div>
              <pre className="mono" style={{ fontSize: '10px', background: 'var(--panel)', border: '1px solid var(--line)', padding: '12px', borderRadius: '7px', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(inspectTool.inputSchema, null, 2)}
              </pre>

              <div className="section-head">
                <h2>Output Schema (Evidence)</h2>
              </div>
              <pre className="mono" style={{ fontSize: '10px', background: 'var(--panel)', border: '1px solid var(--line)', padding: '12px', borderRadius: '7px', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(inspectTool.outputSchema, null, 2)}
              </pre>
            </div>
            <div className="modal-foot">
              <span className="muted tiny">CDP direct binding</span>
              <button className="btn primary" onClick={() => setInspectTool(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
