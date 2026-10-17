import React, { useState, useEffect, useMemo } from 'react';
import {
  Workflow,
  Play,
  Sparkles,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Search,
  X,
  AlertCircle,
  Check,
  Globe,
  Sliders,
} from 'lucide-react';

export interface LocalSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultPrompt: string;
  parameters?: { name: string; type: string; description: string; defaultVal: string }[];
  preconditionUrl?: string;
  stepsCount: number;
  isCustom?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

interface SkillsViewProps {
  onRunSkill: (taskPrompt: string) => void;
}

const STORAGE_KEY = 'deep_browser_custom_skills';

const BUILTIN_SKILLS: LocalSkill[] = [
  {
    id: 'pddikti_search',
    name: 'PDDIKTI University & Student Lookup',
    description: 'Buka portal resmi pddikti.kemdikbud.go.id, cari data prodi/mahasiswa, dan ekstrak status akreditasi.',
    category: 'Education & Govt',
    defaultPrompt: 'Buka portal resmi pddikti.kemdikbud.go.id lalu cari data akreditasi dan verifikasi status aktif perguruan tinggi target.',
    preconditionUrl: 'pddikti.kemdikbud.go.id',
    stepsCount: 4,
    isCustom: false,
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
    isCustom: false,
    parameters: [
      { name: 'repo_url', type: 'string', description: 'URL repository GitHub', defaultVal: 'https://github.com/browser-use/browser-use' }
    ]
  },
  {
    id: 'deep_web_researcher',
    name: 'Multi-Source Deep Web Researcher',
    description: 'Buka 3 sumber web paralel, sintesis informasi kunci, dan susun laporan komprehensif dengan sitasi link.',
    category: 'Research',
    defaultPrompt: 'Lakukan riset komprehensif pada 3 portal teknologi dan rangkum terobosan AI terbaru minggu ini dengan sitasi link.',
    stepsCount: 5,
    isCustom: false,
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
    isCustom: false,
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
    isCustom: false,
  }
];

const CATEGORIES = [
  'All',
  'Custom',
  'Productivity',
  'Developer',
  'Research',
  'Commerce',
  'Education & Govt',
];

export const SkillsView: React.FC<SkillsViewProps> = ({ onRunSkill }) => {
  const [skillsList, setSkillsList] = useState<LocalSkill[]>(BUILTIN_SKILLS);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<LocalSkill | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Productivity');
  const [formDescription, setFormDescription] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formPreconditionUrl, setFormPreconditionUrl] = useState('');
  const [formStepsCount, setFormStepsCount] = useState<number>(3);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deleteConfirmSkill, setDeleteConfirmSkill] = useState<LocalSkill | null>(null);

  // Load custom skills on mount
  useEffect(() => {
    const loadSkills = async () => {
      let customSkills: LocalSkill[] = [];
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        try {
          const res = await chrome.storage.local.get(STORAGE_KEY);
          if (res && Array.isArray(res[STORAGE_KEY])) {
            customSkills = res[STORAGE_KEY];
          }
        } catch (_) {}
      }
      if (customSkills.length === 0) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              customSkills = parsed;
            }
          }
        } catch (_) {}
      }

      setSkillsList([
        ...BUILTIN_SKILLS,
        ...customSkills.map((s) => ({ ...s, isCustom: true })),
      ]);
    };

    loadSkills();
  }, []);

  // Persist custom skills helper
  const saveCustomSkills = (updatedList: LocalSkill[]) => {
    const customOnly = updatedList.filter((s) => s.isCustom);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
    } catch (_) {}
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: customOnly });
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingSkill(null);
    setFormName('');
    setFormCategory('Productivity');
    setFormDescription('');
    setFormPrompt('');
    setFormPreconditionUrl('');
    setFormStepsCount(3);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (skill: LocalSkill) => {
    setEditingSkill(skill);
    setFormName(skill.name);
    setFormCategory(skill.category);
    setFormDescription(skill.description);
    setFormPrompt(skill.defaultPrompt);
    setFormPreconditionUrl(skill.preconditionUrl || '');
    setFormStepsCount(skill.stepsCount || 3);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Clone / Duplicate Skill
  const handleDuplicateSkill = (skill: LocalSkill) => {
    const newSkill: LocalSkill = {
      ...skill,
      id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${skill.name} (Copy)`,
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newSkill, ...skillsList];
    setSkillsList(updated);
    saveCustomSkills(updated);
  };

  // Save (Create or Update)
  const handleSaveSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Nama skill wajib diisi.');
      return;
    }
    if (!formDescription.trim()) {
      setFormError('Deskripsi skill wajib diisi.');
      return;
    }
    if (!formPrompt.trim()) {
      setFormError('Automation Prompt / Instruksi browser wajib diisi.');
      return;
    }

    if (editingSkill) {
      // Update existing
      const updated = skillsList.map((s) => {
        if (s.id === editingSkill.id) {
          return {
            ...s,
            name: formName.trim(),
            category: formCategory.trim() || 'Custom',
            description: formDescription.trim(),
            defaultPrompt: formPrompt.trim(),
            preconditionUrl: formPreconditionUrl.trim() || undefined,
            stepsCount: Math.max(1, formStepsCount),
            isCustom: true, // If user modifies built-in, promote to custom
            updatedAt: Date.now(),
          };
        }
        return s;
      });
      setSkillsList(updated);
      saveCustomSkills(updated);
    } else {
      // Create new
      const newSkill: LocalSkill = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: formName.trim(),
        category: formCategory.trim() || 'Custom',
        description: formDescription.trim(),
        defaultPrompt: formPrompt.trim(),
        preconditionUrl: formPreconditionUrl.trim() || undefined,
        stepsCount: Math.max(1, formStepsCount),
        isCustom: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const updated = [newSkill, ...skillsList];
      setSkillsList(updated);
      saveCustomSkills(updated);
    }

    setIsModalOpen(false);
  };

  // Delete Skill
  const handleConfirmDelete = () => {
    if (!deleteConfirmSkill) return;
    const updated = skillsList.filter((s) => s.id !== deleteConfirmSkill.id);
    setSkillsList(updated);
    saveCustomSkills(updated);
    setDeleteConfirmSkill(null);
  };

  // Filter skills
  const filteredSkills = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return skillsList.filter((s) => {
      // Category filter
      if (activeCategory === 'Custom' && !s.isCustom) return false;
      if (activeCategory !== 'All' && activeCategory !== 'Custom' && s.category !== activeCategory) {
        return false;
      }
      // Query filter
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.preconditionUrl && s.preconditionUrl.toLowerCase().includes(q)) ||
        s.defaultPrompt.toLowerCase().includes(q)
      );
    });
  }, [skillsList, searchQuery, activeCategory]);

  return (
    <div className="page" style={{ padding: '16px' }}>
      {/* Top Title & Create Action */}
      <div className="skills-header-row">
        <div>
          <div className="eyebrow">BROWSER MACROS &amp; ACTIONS</div>
          <h1 style={{ margin: '4px 0 6px', fontSize: '18px', fontWeight: 700 }}>Installed Skills</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Autonomous browser automation skills ready to execute on the active browser tab.
          </p>
        </div>
        <button
          className="btn small primary"
          onClick={handleOpenCreateModal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <Plus size={13} /> Create Skill
        </button>
      </div>

      {/* Toolbar: Search + Categories */}
      <div className="skills-toolbar">
        <div className="searchbox" style={{ maxWidth: 'none', width: '100%' }}>
          <Search size={14} />
          <input
            className="input"
            placeholder="Search skills, prompts, domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="skills-category-tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`skill-chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
              {cat === 'Custom' && ` (${skillsList.filter((s) => s.isCustom).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Skills Surface Card */}
      <div className="surface" style={{ marginTop: '8px' }}>
        <div className="surface-head">
          <div>
            <div className="surface-title">
              Available Skills ({filteredSkills.length})
            </div>
            <div className="surface-note">Click "Run now" to execute a skill in the active tab.</div>
          </div>
        </div>

        <div className="skill-cards-grid">
          {filteredSkills.length === 0 ? (
            <div className="blank">
              <div className="blank-icon">
                <Workflow size={20} />
              </div>
              <strong>No skills found</strong>
              <p>Try searching with another keyword or create a new custom skill.</p>
              <button className="btn small primary" onClick={handleOpenCreateModal}>
                <Plus size={12} /> Create Custom Skill
              </button>
            </div>
          ) : (
            filteredSkills.map((sk) => {
              const isExpanded = expandedSkillId === sk.id;
              return (
                <div key={sk.id} className={`skill-card ${sk.isCustom ? 'is-custom' : ''}`}>
                  {/* Left Icon */}
                  <div className="skill-card-icon">
                    <Workflow size={16} />
                  </div>

                  {/* Main Content */}
                  <div className="skill-card-main">
                    <div className="skill-card-header">
                      <span className="skill-card-title">{sk.name}</span>
                      <span className="pill">{sk.category}</span>
                      {sk.isCustom && <span className="skill-badge-custom">Custom</span>}
                      {sk.preconditionUrl && (
                        <span className="pill" title={`Target domain: ${sk.preconditionUrl}`}>
                          <Globe size={10} style={{ marginRight: 2 }} />
                          {sk.preconditionUrl}
                        </span>
                      )}
                      <span className="tiny muted">{sk.stepsCount} steps</span>
                    </div>

                    <p className="skill-card-desc">{sk.description}</p>

                    {/* Expand Details Trigger */}
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
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      <ChevronRight
                        size={11}
                        style={{
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s',
                        }}
                      />
                      <span>{isExpanded ? 'Hide automation prompt' : 'View automation prompt & details'}</span>
                    </button>

                    {/* Expanded Drawer */}
                    {isExpanded && (
                      <div className="skill-prompt-preview">
                        <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--ink)' }}>
                          Task Execution Prompt:
                        </div>
                        <div style={{ fontStyle: 'italic', marginBottom: '8px' }}>"{sk.defaultPrompt}"</div>

                        {sk.parameters && sk.parameters.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px' }}>
                            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Parameters:</div>
                            {sk.parameters.map((p) => (
                              <div key={p.name} className="skill-param-row">
                                <span className="mono" style={{ color: 'var(--accent)' }}>{p.name}</span>
                                <span className="muted">({p.type}):</span>
                                <span>{p.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="skill-card-actions">
                    <button
                      className="btn small primary"
                      onClick={() => onRunSkill(sk.defaultPrompt)}
                      title="Execute skill in active browser tab"
                    >
                      <Play size={11} /> Run now
                    </button>

                    <button
                      className="icon-btn"
                      style={{ width: '26px', height: '26px' }}
                      onClick={() => handleOpenEditModal(sk)}
                      title="Edit skill"
                    >
                      <Pencil size={12} />
                    </button>

                    <button
                      className="icon-btn"
                      style={{ width: '26px', height: '26px' }}
                      onClick={() => handleDuplicateSkill(sk)}
                      title="Clone / Duplicate skill"
                    >
                      <Copy size={12} />
                    </button>

                    {sk.isCustom && (
                      <button
                        className="icon-btn"
                        style={{ width: '26px', height: '26px', color: 'var(--red)' }}
                        onClick={() => setDeleteConfirmSkill(sk)}
                        title="Delete custom skill"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="callout" style={{ margin: '14px' }}>
          <Sparkles size={15} />
          <span>
            Create custom browser automation skills with your own prompts and preconditions, or edit existing skills to match your workflow.
          </span>
        </div>
      </div>

      {/* ─── Modal: Create / Edit Skill ─── */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  {editingSkill ? 'Edit Skill' : 'Create New Skill'}
                </div>
                <div className="modal-sub">
                  Configure an autonomous browser workflow ready to execute with 1-click.
                </div>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)} aria-label="Close">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveSkill}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'var(--red-soft)',
                      color: 'var(--red)',
                      border: '1px solid #e8c4bd',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Skill Name */}
                <div className="field">
                  <label>Skill Name *</label>
                  <input
                    className="input"
                    placeholder="e.g. YouTube Transcript Extractor"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Category & Steps Count */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="field">
                    <label>Category</label>
                    <select
                      className="select"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    >
                      <option value="Productivity">Productivity</option>
                      <option value="Developer">Developer</option>
                      <option value="Research">Research</option>
                      <option value="Commerce">Commerce</option>
                      <option value="Education & Govt">Education &amp; Govt</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Estimated Steps</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="input"
                      value={formStepsCount}
                      onChange={(e) => setFormStepsCount(parseInt(e.target.value, 10) || 3)}
                    />
                  </div>
                </div>

                {/* Precondition URL */}
                <div className="field">
                  <label>Target Domain / URL (Optional)</label>
                  <input
                    className="input"
                    placeholder="e.g. github.com, youtube.com"
                    value={formPreconditionUrl}
                    onChange={(e) => setFormPreconditionUrl(e.target.value)}
                  />
                  <span className="help">Skill will be optimized for tabs matching this domain.</span>
                </div>

                {/* Description */}
                <div className="field">
                  <label>Description *</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder="Short summary of what this automation does..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    style={{ minHeight: '60px' }}
                  />
                </div>

                {/* Execution Prompt */}
                <div className="field">
                  <label>Browser Task Prompt / Instructions *</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Exact instructions sent to Deep-Browser agent, e.g.: Buka YouTube, cari video ..., klik tombol Show Transcript..."
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    style={{ minHeight: '80px' }}
                  />
                  <span className="help">This prompt executes via CDP automation when 'Run now' is clicked.</span>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  <Check size={12} /> {editingSkill ? 'Save Changes' : 'Create Skill'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ─── Modal: Delete Confirmation ─── */}
      {deleteConfirmSkill && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmSkill(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '380px' }}
          >
            <div className="modal-head">
              <div className="modal-title" style={{ color: 'var(--red)' }}>
                Delete Skill
              </div>
              <button className="close-btn" onClick={() => setDeleteConfirmSkill(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '12px', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete custom skill <strong>"{deleteConfirmSkill.name}"</strong>? This action cannot be undone.
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setDeleteConfirmSkill(null)}>
                Cancel
              </button>
              <button type="button" className="btn danger" onClick={handleConfirmDelete}>
                <Trash2 size={12} /> Delete Permanently
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
