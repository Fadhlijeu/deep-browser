import React, { useState } from 'react';
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
  AlertTriangle
} from 'lucide-react';

interface AutomationsViewProps {
  onRunSkill: (taskPrompt: string) => void;
}

interface LocalSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultPrompt: string;
}

const LOCAL_SKILLS: LocalSkill[] = [
  {
    id: 'pddikti_search',
    name: 'PDDIKTI University & Student Lookup',
    description: 'Buka portal resmi pddikti.kemdikbud.go.id, cari data prodi/mahasiswa, dan ekstrak status akreditasi.',
    category: 'Education & Govt',
    defaultPrompt: 'Buka portal pddikti.kemdikbud.go.id lalu cari data akreditasi perguruan tinggi dan tampilkan hasil verifikasinya.',
  },
  {
    id: 'github_repo_lookup',
    name: 'GitHub Repository & Release Explorer',
    description: 'Buka repository GitHub target, cari file release, commit log terkini, dan buat ringkasan changelog.',
    category: 'Developer',
    defaultPrompt: 'Buka repository GitHub terkait, jelajahi tab Releases dan kumpulkan changelog versi terbaru.',
  },
  {
    id: 'deep_web_researcher',
    name: 'Multi-Source Deep Web Researcher',
    description: 'Buka 3 sumber web paralel, sintesis informasi kunci, dan susun laporan komprehensif dengan sitasi.',
    category: 'Research',
    defaultPrompt: 'Lakukan riset komprehensif pada 3 portal berita teknologi dan rangkum terobosan AI terbaru minggu ini.',
  },
];

export const AutomationsView: React.FC<AutomationsViewProps> = ({ onRunSkill }) => {
  const [tab, setTab] = useState<'skills' | 'cron'>('skills');
  const [cronPreset, setCronPreset] = useState('daily');
  const [cronExpression, setCronExpression] = useState('0 8 * * *');
  const [cronTimezone, setCronTimezone] = useState('Asia/Jakarta');

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
          <div className="eyebrow">Workflow engine</div>
          <h1>Automations &amp; Skills</h1>
          <p className="page-subtitle">
            Execute verified local browser skills and plan automated schedules for repetitive web workflows.
          </p>
        </div>
      </div>

      {/* Metric Grid */}
      <div className="metric-grid">
        <div className="metric">
          <div className="metric-top">
            Registered skills <span className="metric-icon"><Workflow size={14} /></span>
          </div>
          <div className="metric-value">{LOCAL_SKILLS.length}</div>
          <div className="metric-foot">Autonomous workflows</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            Local execution <span className="metric-icon"><CheckCircle2 size={14} /></span>
          </div>
          <div className="metric-value">Active</div>
          <div className="metric-foot">Direct CDP attached</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            Schedule engine <span className="metric-icon"><CalendarClock size={14} /></span>
          </div>
          <div className="metric-value">5-Field</div>
          <div className="metric-foot">Standard CRON syntax</div>
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
      <div className="nav-tabs" style={{ marginTop: '23px' }}>
        <button
          className={`nav-tab ${tab === 'skills' ? 'active' : ''}`}
          onClick={() => setTab('skills')}
        >
          Skills execution
        </button>
        <button
          className={`nav-tab ${tab === 'cron' ? 'active' : ''}`}
          onClick={() => setTab('cron')}
        >
          CRON schedule builder
        </button>
      </div>

      {/* Tab 1: Skills Execution */}
      {tab === 'skills' && (
        <div className="surface">
          <div className="surface-head">
            <div>
              <div className="surface-title">Local autonomous skills</div>
              <div className="surface-note">One-click macro execution on active browser tab.</div>
            </div>
          </div>

          {LOCAL_SKILLS.map((sk) => (
            <div key={sk.id} className="list-row">
              <div className="list-icon">
                <Workflow size={15} />
              </div>
              <div className="list-row-main">
                <strong>{sk.name}</strong>
                <p>{sk.description}</p>
                <div className="session-meta">
                  <span className="pill">{sk.category}</span>
                </div>
              </div>
              <button
                className="btn small primary"
                onClick={() => onRunSkill(sk.defaultPrompt)}
              >
                <Play size={12} /> Run now
              </button>
            </div>
          ))}

          <div className="callout" style={{ margin: '16px' }}>
            <Sparkles size={15} />
            <span>
              Skills are executed directly in the connected browser tab with full mutation verification. You can save any completed chat conversation as a reusable skill!
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
                <div className="surface-title">Schedule builder</div>
                <div className="surface-note">Standard 5-field CRON syntax validation.</div>
              </div>
            </div>

            <div style={{ padding: '17px' }}>
              <div className="field">
                <label>Schedule preset</label>
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

              <div style={{ marginTop: '16px' }} className="field">
                <label>CRON expression</label>
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

              <div className="cron-grid" style={{ marginTop: '14px' }}>
                {[
                  ['Minute', '0–59'],
                  ['Hour', '0–23'],
                  ['Day', '1–31'],
                  ['Month', '1–12'],
                  ['Weekday', '0–7'],
                ].map(([name, range], idx) => (
                  <div key={name} className="cron-part">
                    <label>{name}</label>
                    <input
                      className="mono"
                      value={cronParts[idx] || '*'}
                      onChange={(e) => {
                        const next = [...cronParts];
                        next[idx] = e.target.value;
                        setCronExpression(next.join(' '));
                        setCronPreset('custom');
                      }}
                    />
                    <small>{range}</small>
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
                  <option value="Asia/Singapore">Asia/Singapore (SGT · UTC+8)</option>
                  <option value="UTC">UTC (Universal Time)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>

              <div className="toolbar" style={{ marginTop: '16px' }}>
                <span className={`status ${isValidCron ? 'success' : 'failed'}`}>
                  {isValidCron ? 'Valid CRON syntax' : 'Invalid syntax'}
                </span>
                <span className="muted tiny">
                  {cronPreset === 'daily'
                    ? 'Runs every day at 08:00'
                    : cronPreset === 'weekdays'
                    ? 'Runs Monday through Friday at 08:00'
                    : `${cronExpression} (${cronTimezone})`}
                </span>
              </div>
            </div>
          </section>

          <section>
            <div className="surface">
              <div className="surface-head">
                <div>
                  <div className="surface-title">Field reference</div>
                  <div className="surface-note">Expression standards</div>
                </div>
              </div>
              <div style={{ padding: '15px' }}>
                {[
                  ['Minute', '0–59', 'Exact minute of the hour'],
                  ['Hour', '0–23', '24-hour military clock'],
                  ['Day of month', '1–31', 'Calendar day of current month'],
                  ['Month', '1–12', 'January through December'],
                  ['Day of week', '0–7', '0 or 7 = Sunday, 1 = Monday'],
                ].map(([f, range, desc]) => (
                  <div key={f} className="key-value">
                    <span className="key">{f}</span>
                    <span className="value">
                      {range}
                      <div className="table-secondary">{desc}</div>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="callout" style={{ marginTop: '12px' }}>
              <AlertTriangle size={15} />
              <span>
                <strong>Background Automation Safety:</strong> Scheduled workflows respect safe mode human approval rules before submitting data.
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
