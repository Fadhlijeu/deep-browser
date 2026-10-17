import React, { useState, useEffect } from 'react';
import {
  Workflow,
  Play,
  Sparkles,
  ChevronRight,
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
  const [skillsList, setSkillsList] = useState<LocalSkill[]>(BUILTIN_SKILLS);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

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

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">BROWSER MACROS</div>
          <h1>Installed Skills</h1>
          <p className="page-subtitle">
            Autonomous browser automation skills ready to execute on the active browser tab.
          </p>
        </div>
      </div>

      <div className="surface" style={{ marginTop: '16px' }}>
        <div className="surface-head">
          <div>
            <div className="surface-title">Available Skills ({skillsList.length})</div>
            <div className="surface-note">Click Run Now to execute a skill in the active tab.</div>
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
            You can save any verified browser workflow from chat as a reusable skill using the <strong>Save as Skill</strong> button.
          </span>
        </div>
      </div>
    </div>
  );
};
