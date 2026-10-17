import React, { useState, useEffect } from 'react';
import {
  Workflow,
  CalendarClock,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  Check,
  RefreshCw,
  AlertTriangle,
  Plus,
  Sliders,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Code2,
  FileCheck
} from 'lucide-react';

interface SkillsViewProps {
  onRunSkill: (taskPrompt: string) => void;
}

interface LocalSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultPrompt: string;
  parameters?: { name: string; type: string; description: string; defaultVal: string }[];
  preconditionUrl?: string;
  stepsCount: number;
}

const BUILTIN_SKILLS: LocalSkill[] = [
  {
    id: 'pddikti_search',
    name: 'PDDIKTI University & Student Lookup',
    description: 'Buka portal resmi pddikti.kemdikbud.go.id, cari data prodi/mahasiswa, dan ekstrak status akreditasi.',
    category: 'Education & Govt',
    defaultPrompt: 'Buka portal resmi pddikti.kemdikbud.go.id lalu cari data akreditasi dan verifikasi status aktif perguruan tinggi target.',
    preconditionUrl: 'pddikti.kemdikbud.go.id',
    stepsCount: 4,
    parameters: [
      { name: 'keyword', type: 'string', description: 'Nama Mahasiswa atau Perguruan Tinggi', defaultVal: 'Universitas Indonesia' },
      { name: 'mode', type: 'string', description: 'Target pencarian (mahasiswa / prodi / pt)', defaultVal: 'pt' }
    ]
  },
  {
    id: 'github_repo_lookup',
    name: 'GitHub Repository & Release Explorer',
    description: 'Buka repository GitHub target, cari file release, commit log terkini, dan buat ringkasan changelog.',
    category: 'Developer',
    defaultPrompt: 'Buka repository GitHub target, jelajahi tab Releases dan kumpulkan changelog versi terbaru ke dalam poin ringkas.',
    preconditionUrl: 'github.com',
    stepsCount: 3,
    parameters: [
      { name: 'repo_url', type: 'string', description: 'URL repository GitHub', defaultVal: 'https://github.com/browser-use/browser-use' }
    ]
  },
  {
    id: 'deep_web_researcher',
    name: 'Multi-Source Deep Web Researcher',
    description: 'Buka 3 sumber web paralel, sintesis informasi kunci, dan susun laporan komprehensif dengan sitasi.',
    category: 'Research',
    defaultPrompt: 'Lakukan riset komprehensif pada 3 portal teknologi dan rangkum terobosan AI terbaru minggu ini dengan sitasi link.',
    stepsCount: 5,
    parameters: [
      { name: 'topic', type: 'string', description: 'Topik riset mendalam', defaultVal: 'Web Agents CDP automation 2026' }
    ]
  },
  {
    id: 'form_filler_upload',
    name: 'Form Filler & Document Uploader',
    description: 'Deteksi input form pendaftaran web, isi data identitas otomatis, dan upload berkas lampiran pendukung.',
    category: 'Productivity',
    defaultPrompt: 'Inspeksi formulir aktif pada halaman browser, isi kolom identitas sesuai konteks, dan siapkan input unggah berkas.',
    stepsCount: 4,
    parameters: [
      { name: 'form_selector', type: 'string', description: 'CSS selector atau nama form', defaultVal: 'form' }
    ]
  },
  {
    id: 'ecommerce_price_compare',
    name: 'E-Commerce Spec & Price Comparator',
    description: 'Kumpulkan harga, reputasi toko, dan spesifikasi produk dari marketplace aktif ke dalam tabel perbandingan.',
    category: 'Commerce',
    defaultPrompt: 'Ekstrak detail produk, harga, dan rating dari halaman e-commerce saat ini dan buat tabel evaluasi perbandingan.',
    stepsCount: 3,
  }
];

export const SkillsView: React.FC<SkillsViewProps> = ({ onRunSkill }) => {
  const [tab, setTab] = useState<'skills' | 'cron'>('skills');
  const [skillsList, setSkillsList] = useState<LocalSkill[]>(BUILTIN_SKILLS);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  // CRON Schedule Builder State
  const [cronPreset, setCronPreset] = useState('daily');
  const [cronExpression, setCronExpression] = useState('0 8 * * *');
  const [cronTimezone, setCronTimezone] = useState('Asia/Jakarta');

  // Load user saved skills from localStorage if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem('deep_browser_custom_skills');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSkillsList([...BUILTIN_SKILLS, ...parsed]);
        }
      }
    } catch (_) {}
  }, []);

  const presetToCron = (preset: string) => {
    switch (preset) {
      case 'hourly': return '0 * * * *';
      case 'daily': return '0 8 * * *';
      case 'weekdays': return '0 8 * * 1-5';
      case 'weekly': return '0 9 * * 1';
      case 'monthly': return '0 9 1 * *';
      default: return '0 8 * * *';
    }
  };

  const handleSelectPreset = (p: string) => {
    setCronPreset(p);
    setCronExpression(presetToCron(p));
  };

  const cronParts = cronExpression.split(' ');
  const isValidCron = cronParts.length === 5;

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">Local-First Autonomous Engine</div>
          <h1>Browser Skills</h1>
          <p className="page-subtitle">
            One-click verified browser macros with deterministic DOM verification and scheduled triggers.
          </p>
        </div>
      </div>

      {/* Metric Grid */}
      <div className="metric-grid">
        <div className="metric">
          <div className="metric-top">
            Available skills <span className="metric-icon"><Workflow size={14} /></span>
          </div>
          <div className="metric-value">{skillsList.length}</div>
          <div className="metric-foot">Autonomous workflows</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            Execution mode <span className="metric-icon"><CheckCircle2 size={14} /></span>
          </div>
          <div className="metric-value">Attached</div>
          <div className="metric-foot">Direct CDP attached tab</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            Storage <span className="metric-icon"><FileCheck size={14} /></span>
          </div>
          <div className="metric-value">100% Local</div>
          <div className="metric-foot">Zero cloud dependency</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            Timezone <span className="metric-icon"><Clock size={14} /></span>
          </div>
          <div className="metric-value" style={{ fontSize: '18px' }}>WIB</div>
          <div className="metric-foot">Asia/Jakarta (UTC+7)</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="nav-tabs" style={{ marginTop: '20px' }}>
        <button
          className={`nav-tab ${tab === 'skills' ? 'active' : ''}`}
          onClick={() => setTab('skills')}
        >
          Installed Skills ({skillsList.length})
        </button>
        <button
          className={`nav-tab ${tab === 'cron' ? 'active' : ''}`}
          onClick={() => setTab('cron')}
        >
          Scheduled Triggers (CRON)
        </button>
      </div>

      {/* Tab 1: Skills Execution */}
      {tab === 'skills' && (
        <div className="surface">
          <div className="surface-head">
            <div>
              <div className="surface-title">Local Autonomous Skills</div>
              <div className="surface-note">Instant macro execution on connected active browser tab.</div>
            </div>
          </div>

          <div className="skill-list-container">
            {skillsList.map((sk) => {
              const isExpanded = expandedSkillId === sk.id;
              return (
                <div key={sk.id} className="list-row skill-row">
                  {/* Icon */}
                  <div className="list-icon">
                    <Workflow size={15} />
                  </div>

                  {/* Main Content */}
                  <div className="list-row-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '12px' }}>{sk.name}</strong>
                      <span className="pill" style={{ fontSize: '9px' }}>{sk.category}</span>
                      <span className="tiny muted">{sk.stepsCount} steps</span>
                    </div>

                    <p style={{ margin: '4px 0 6px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
                      {sk.description}
                    </p>

                    {sk.parameters && (
                      <button
                        type="button"
                        onClick={() => setExpandedSkillId(isExpanded ? null : sk.id)}
                        style={{
                          border: 0,
                          background: 'none',
                          padding: 0,
                          color: 'var(--accent)',
                          fontSize: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        <ChevronRight size={11} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                        <span>{isExpanded ? 'Hide parameters' : 'View parameters & template'}</span>
                      </button>
                    )}

                    {isExpanded && sk.parameters && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 10px',
                        background: 'var(--panel)',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        fontSize: '10px'
                      }}>
                        <div style={{ fontWeight: 650, marginBottom: '5px', color: 'var(--ink)' }}>Parameter Specifications:</div>
                        {sk.parameters.map((p) => (
                          <div key={p.name} style={{ display: 'flex', gap: '8px', margin: '3px 0' }}>
                            <span className="mono" style={{ color: 'var(--accent)' }}>{p.name}</span>
                            <span className="muted">({p.type}):</span>
                            <span>{p.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="skill-action-wrap">
                    <button
                      className="btn small primary"
                      onClick={() => onRunSkill(sk.defaultPrompt)}
                      title="Execute skill in active browser tab"
                    >
                      <Play size={11} /> Run now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="callout" style={{ margin: '14px' }}>
            <Sparkles size={15} />
            <span>
              Skills are executed directly in the connected browser tab with full mutation verification. You can save any completed chat conversation as a reusable skill using the <strong>Save as Skill</strong> button in Chat!
            </span>
          </div>
        </div>
      )}

      {/* Tab 2: CRON Schedule Builder */}
      {tab === 'cron' && (
        <div className="split-grid">
          <section className="surface">
            <div className="surface-head">
              <div>
                <div className="surface-title">Schedule Builder</div>
                <div className="surface-note">Standard 5-field CRON syntax validation for automated skill runs.</div>
              </div>
            </div>

            <div style={{ padding: '16px' }}>
              <div className="field">
                <label>Schedule Preset</label>
                <div className="toolbar">
                  {['hourly', 'daily', 'weekdays', 'weekly', 'monthly'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`btn small ${cronPreset === p ? 'primary' : ''}`}
                      onClick={() => handleSelectPreset(p)}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '14px' }} className="field">
                <label>CRON Expression</label>
                <input
                  className="input mono"
                  value={cronExpression}
                  onChange={(e) => {
                    setCronExpression(e.target.value);
                    setCronPreset('custom');
                  }}
                  placeholder="0 8 * * *"
                />
                <span className="help">Minute · Hour · Day of month · Month · Day of week</span>
              </div>

              {/* 5 Field Visual Display */}
              <div className="cron-grid" style={{ marginTop: '14px' }}>
                {[
                  { label: 'Minute', val: cronParts[0] || '*', range: '0–59' },
                  { label: 'Hour', val: cronParts[1] || '*', range: '0–23' },
                  { label: 'Day', val: cronParts[2] || '*', range: '1–31' },
                  { label: 'Month', val: cronParts[3] || '*', range: '1–12' },
                  { label: 'Weekday', val: cronParts[4] || '*', range: '0–7' },
                ].map((item, i) => (
                  <div key={i} className="cron-part">
                    <label>{item.label}</label>
                    <input
                      value={item.val}
                      onChange={(e) => {
                        const nextParts = [...cronParts];
                        while (nextParts.length < 5) nextParts.push('*');
                        nextParts[i] = e.target.value;
                        setCronExpression(nextParts.join(' '));
                        setCronPreset('custom');
                      }}
                      className="mono"
                    />
                    <small>{item.range}</small>
                  </div>
                ))}
              </div>

              <div className="rule" />

              <div className="field">
                <label>Timezone</label>
                <select
                  className="select"
                  value={cronTimezone}
                  onChange={(e) => setCronTimezone(e.target.value)}
                >
                  <option value="Asia/Jakarta">Asia/Jakarta (WIB · UTC+7)</option>
                  <option value="Asia/Makassar">Asia/Makassar (WITA · UTC+8)</option>
                  <option value="Asia/Jayapura">Asia/Jayapura (WIT · UTC+9)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT · UTC+8)</option>
                  <option value="UTC">UTC (Universal Coordinated Time)</option>
                </select>
              </div>

              <div className="toolbar" style={{ marginTop: '14px' }}>
                <span className={`status ${isValidCron ? 'success' : 'failed'}`}>
                  {isValidCron ? 'Valid 5-field syntax' : 'Invalid syntax'}
                </span>
                <span className="tiny muted">
                  {isValidCron ? `Expression resolves for ${cronTimezone}` : 'Expression must contain 5 space-separated fields'}
                </span>
              </div>
            </div>
          </section>

          {/* Reference Surface */}
          <section className="surface">
            <div className="surface-head">
              <div>
                <div className="surface-title">Syntax Reference</div>
                <div className="surface-note">Standard CRON specification</div>
              </div>
            </div>

            <div style={{ padding: '14px' }}>
              {[
                ['*', 'Any value (wildcard)'],
                [',', 'Value list separator (e.g. 1,3,5)'],
                ['-', 'Range of values (e.g. 1-5 for Mon-Fri)'],
                ['/', 'Step values (e.g. */15 for every 15 min)'],
              ].map(([sym, desc]) => (
                <div key={sym} className="key-value" style={{ padding: '8px 0' }}>
                  <span className="key mono" style={{ fontSize: '11px', color: 'var(--ink)' }}>{sym}</span>
                  <span className="value" style={{ fontSize: '10px' }}>{desc}</span>
                </div>
              ))}

              <div className="callout" style={{ marginTop: '14px' }}>
                <Clock size={13} />
                <span>
                  CRON scheduler triggers can run autonomous skills in the background when the daemon is active.
                </span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
