import React, { useState } from 'react';
import { 
  Bot, 
  Shield, 
  Key, 
  Laptop, 
  Plus, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
  RotateCcw, 
  ExternalLink,
  Save,
  Eye,
  Scale,
  Sparkles
} from 'lucide-react';
import { MODE_OPTIONS, PROVIDER_LABELS, sidepanelStore } from '../../state/sidepanelStore';
import { ExecutionMode, ModelDef } from '../../types';
import { ProviderLogo } from '../common/ProviderLogo';

interface SettingsModalProps {
  isOpen: boolean;
  selectedMode: ExecutionMode;
  models: ModelDef[];
  selectedModelId: string;
  apiKeys: Record<string, string>;
  sidepanelEnabled: boolean;
  indexLabelingEnabled: boolean;
  judgeEnabled?: boolean;
  judgeModelId?: string;
  isDetached: boolean;
  onClose: () => void;
}

type SettingsTab = 'models' | 'policy' | 'apikeys' | 'browser';

const TABS: { id: SettingsTab; label: string; icon: any }[] = [
  { id: 'models', label: 'Model AI', icon: Bot },
  { id: 'policy', label: 'Otonomi', icon: Shield },
  { id: 'apikeys', label: 'Kunci API', icon: Key },
  { id: 'browser', label: 'Browser & CDP', icon: Laptop },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  selectedMode,
  models,
  selectedModelId,
  apiKeys,
  sidepanelEnabled,
  indexLabelingEnabled,
  judgeEnabled = false,
  judgeModelId = 'auto',
  isDetached,
  onClose,
}) => {
  const [currentTab, setCurrentTab] = useState<SettingsTab>('models');

  // Model CRUD form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formProvider, setFormProvider] = useState<ModelDef['provider']>('gemini');
  const [formModelId, setFormModelId] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');

  // Auto-fetch models state
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchToast, setFetchToast] = useState<string | null>(null);

  const handleAutoFetch = async () => {
    setIsFetchingModels(true);
    setFetchToast(null);
    try {
      const res = await sidepanelStore.autoFetchModels('gemini');
      if (res.count > 0) {
        setFetchToast(`Berhasil menambahkan ${res.count} model baru!`);
      } else {
        setFetchToast(res.message || 'Semua model sudah mutakhir.');
      }
    } catch (e: any) {
      setFetchToast(`Auto-fetch gagal: ${e?.message || 'Error'}`);
    } finally {
      setIsFetchingModels(false);
      setTimeout(() => setFetchToast(null), 3500);
    }
  };

  // API Keys state
  const [keysInput, setKeysInput] = useState<Record<string, string>>({ ...apiKeys });
  const [keysSaved, setKeysSaved] = useState(false);

  if (!isOpen) return null;

  // Group and sort models by provider, then A to Z
  const groupedModels = models.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {} as Record<string, ModelDef[]>);

  const providerKeys = ['gemini', 'openai', 'anthropic', 'custom_openai', 'ollama'].filter(
    (p) => groupedModels[p] && groupedModels[p].length > 0
  );
  Object.keys(groupedModels).forEach((p) => {
    if (!providerKeys.includes(p)) providerKeys.push(p);
  });
  providerKeys.forEach((p) => {
    groupedModels[p].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  });

  // Model CRUD handlers
  const handleOpenAdd = () => {
    setEditingModelId(null);
    setFormName('');
    setFormProvider('custom_openai');
    setFormModelId('');
    setFormBaseUrl('https://api.deepseek.com/v1');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (m: ModelDef) => {
    setEditingModelId(m.id);
    setFormName(m.name);
    setFormProvider(m.provider);
    setFormModelId(m.modelId);
    setFormBaseUrl(m.baseUrl || '');
    setIsFormOpen(true);
  };

  const handleSaveModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formModelId.trim()) return;

    if (editingModelId) {
      // Update
      sidepanelStore.updateModel(editingModelId, {
        name: formName.trim(),
        provider: formProvider,
        modelId: formModelId.trim(),
        baseUrl: formBaseUrl.trim() || undefined,
      });
    } else {
      // Create
      const newId = `${formProvider}/${formModelId.trim()}`;
      const newModel: ModelDef = {
        id: newId,
        name: formName.trim(),
        icon: formProvider === 'ollama' ? 'terminal' : 'bolt',
        provider: formProvider,
        modelId: formModelId.trim(),
        baseUrl: formBaseUrl.trim() || undefined,
      };
      sidepanelStore.addModel(newModel);
    }
    setIsFormOpen(false);
    setEditingModelId(null);
  };

  const handleDeleteModel = (id: string) => {
    if (models.length <= 1) return;
    sidepanelStore.deleteModel(id);
  };

  const handleSaveKeys = () => {
    Object.entries(keysInput).forEach(([p, val]) => {
      sidepanelStore.setApiKey(p, val);
    });
    setKeysSaved(true);
    setTimeout(() => setKeysSaved(false), 1500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card settings-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Header */}
        <div className="modal-header">
          <div className="modal-header-brand">
            <span className="settings-header-title">Pengaturan Deep Browser</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Tutup">
            <X size={15} />
          </button>
        </div>

        {/* Tab Navigation Strip (Pagination Bar At Top) */}
        <div className="settings-tab-bar" role="tablist">
          {TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                className={`settings-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setCurrentTab(tab.id);
                  setIsFormOpen(false);
                }}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Paginated Body */}
        <div className="modal-body settings-modal-body">
          {/* ══════════════════════════════════════════════════════════
              PAGE 1: MODEL AI (CRUD & PAGINASI MODEL)
             ══════════════════════════════════════════════════════════ */}
          {currentTab === 'models' && (
            <div className="settings-page-content">
              {/* Header with Title & Action Controls */}
              <div className="settings-section-head">
                <div>
                  <h3 className="settings-section-title">Kelola Model AI</h3>
                  <p className="settings-section-desc">
                    Tambah, edit konfigurasi endpoint, atau hapus model. Total {models.length} model terdaftar.
                  </p>
                </div>
                {!isFormOpen && (
                  <div className="settings-head-actions">
                    <button 
                      className="settings-action-pill-btn" 
                      onClick={handleAutoFetch}
                      disabled={isFetchingModels}
                      title="Auto-fetch model terbaru dari endpoint Gemini / Ollama"
                    >
                      <Sparkles size={11} className={isFetchingModels ? 'animate-spin' : ''} style={{ color: '#60a5fa' }} />
                      <span>{isFetchingModels ? 'Memeriksa...' : 'Auto Fetch'}</span>
                    </button>
                    <button 
                      className="settings-action-pill-btn" 
                      onClick={() => sidepanelStore.resetModelsToDefault()}
                      title="Kembalikan daftar model ke default"
                    >
                      <RotateCcw size={11} />
                      <span>Reset</span>
                    </button>
                    <button 
                      className="settings-primary-add-btn" 
                      onClick={handleOpenAdd}
                      title="Tambah Model AI Baru"
                    >
                      <Plus size={12} />
                      <span>Tambah Model</span>
                    </button>
                  </div>
                )}
              </div>

              {fetchToast && (
                <div style={{
                  fontSize: '11px',
                  color: '#93c5fd',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Sparkles size={12} />
                  <span>{fetchToast}</span>
                </div>
              )}

              {/* Inline Add / Edit Form Drawer */}
              {isFormOpen ? (
                <form className="model-crud-form" onSubmit={handleSaveModel}>
                  <div className="model-form-header">
                    <span>{editingModelId ? 'Edit Konfigurasi Model' : 'Tambah Model Baru'}</span>
                    <button 
                      type="button" 
                      className="icon-btn" 
                      onClick={() => setIsFormOpen(false)}
                      title="Batal"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="model-form-grid">
                    <div className="form-field">
                      <label className="form-label">Nama Tampilan</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: DeepSeek R1 (Custom)"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Provider AI</label>
                      <select
                        className="form-select"
                        value={formProvider}
                        onChange={(e) => setFormProvider(e.target.value as any)}
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic Claude</option>
                        <option value="custom_openai">Custom OpenAI-Compatible (DeepSeek, vLLM)</option>
                        <option value="ollama">Ollama (Local Endpoint)</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label className="form-label">Model ID / Slug</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: deepseek-chat, llama3:8b"
                        value={formModelId}
                        onChange={(e) => setFormModelId(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Base URL (Opsional / Custom)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: https://api.deepseek.com/v1 atau http://localhost:11434"
                        value={formBaseUrl}
                        onChange={(e) => setFormBaseUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="model-form-actions">
                    <button 
                      type="button" 
                      className="btn-cancel" 
                      onClick={() => setIsFormOpen(false)}
                    >
                      Batal
                    </button>
                    <button type="submit" className="btn-save">
                      <Save size={12} />
                      <span>{editingModelId ? 'Simpan Perubahan' : 'Buat Model'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Paginated Models List Grouped per Provider and Ordered A-Z */}
                  <div className="model-crud-list-wrapper">
                  {providerKeys.map((provider) => {
                    const pModels = groupedModels[provider];
                    const providerLabel = PROVIDER_LABELS[provider] || provider.toUpperCase();
                    return (
                      <div key={provider} className="provider-model-group">
                        <div className="provider-group-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ProviderLogo provider={provider as any} size={14} />
                            <span className="provider-group-title">{providerLabel}</span>
                          </div>
                          <span className="provider-group-count">{pModels.length} model</span>
                        </div>

                        <div className="model-crud-list">
                          {pModels.map((m) => {
                            const isSelected = selectedModelId === m.id;
                            return (
                              <div 
                                key={m.id} 
                                className={`model-card-item ${isSelected ? 'active' : ''}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0 }}>
                                  <div className="model-avatar-box">
                                    <ProviderLogo provider={m.provider} size={16} />
                                  </div>

                                  <div className="model-card-info">
                                    <div className="model-card-top-row">
                                      <span className="model-card-name truncate" title={m.name}>{m.name}</span>
                                      {isSelected && (
                                        <span className="model-active-tag">
                                          <Check size={9} strokeWidth={2.6} />
                                          <span>Aktif</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="model-card-sub-row">
                                      <span className="model-slug-code">{m.modelId}</span>
                                      {m.baseUrl && (
                                        <span className="model-url-preview truncate" title={m.baseUrl}>
                                          • {m.baseUrl}
                                        </span>
                                      )}
                                    </div>
                                    {(m.rpm || m.tpm || m.rpd) && (
                                      <div className="model-quota-row">
                                        {m.rpm && (
                                          <span className="model-quota-chip">
                                            <span className="chip-label">RPM</span>
                                            <span className="chip-val">{m.rpm}</span>
                                          </span>
                                        )}
                                        {m.tpm && (
                                          <span className="model-quota-chip">
                                            <span className="chip-label">TPM</span>
                                            <span className="chip-val">{m.tpm}</span>
                                          </span>
                                        )}
                                        {m.rpd && (
                                          <span className="model-quota-chip">
                                            <span className="chip-label">RPD</span>
                                            <span className="chip-val">{m.rpd}</span>
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="model-card-actions">
                                  {!isSelected && (
                                    <button
                                      type="button"
                                      className="model-btn-select"
                                      onClick={() => sidepanelStore.setSelectedModel(m.id)}
                                      title="Pilih sebagai model aktif"
                                    >
                                      Pilih
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="model-btn-icon"
                                    onClick={() => handleOpenEdit(m)}
                                    title="Edit Model"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    className="model-btn-icon delete"
                                    onClick={() => handleDeleteModel(m.id)}
                                    disabled={models.length <= 1}
                                    title={models.length <= 1 ? 'Minimal harus ada 1 model' : 'Hapus Model'}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                  {/* AI Judge Evaluation Configuration */}
                  <div style={{
                    marginTop: '12px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Scale size={16} style={{ color: judgeEnabled ? 'var(--accent)' : 'var(--text-tertiary)' }} />
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            AI Judge Evaluation
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
                            Evaluasi mandiri trace, screenshot & hasil akhir sebelum tugas ditutup
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => sidepanelStore.setJudgeEnabled(!judgeEnabled)}
                        style={{
                          width: '38px',
                          height: '22px',
                          borderRadius: '11px',
                          background: judgeEnabled ? 'var(--accent)' : 'var(--bg-subtle)',
                          border: `1px solid ${judgeEnabled ? 'var(--accent)' : 'var(--border-subtle)'}`,
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background 0.2s ease, border-color 0.2s ease',
                          flexShrink: 0,
                        }}
                        title={judgeEnabled ? 'Nonaktifkan AI Judge' : 'Aktifkan AI Judge'}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            position: 'absolute',
                            top: '2px',
                            left: judgeEnabled ? '19px' : '2px',
                            transition: 'left 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                        />
                      </div>
                    </div>

                    {judgeEnabled && (
                      <div style={{
                        marginTop: '4px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}>
                        <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          Model AI Judge (Evaluator):
                        </label>
                        <select
                          className="form-select"
                          value={judgeModelId}
                          onChange={(e) => sidepanelStore.setJudgeModelId(e.target.value)}
                        >
                          <option value="auto">Sama dengan model utama (Otomatis)</option>
                          {models.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.provider})
                            </option>
                          ))}
                        </select>

                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '6px',
                          fontSize: '10px',
                          color: 'var(--text-tertiary)',
                          background: 'var(--bg-base)',
                          padding: '7px 9px',
                          borderRadius: 'var(--radius-sm)',
                          lineHeight: '1.35',
                        }}>
                          <Sparkles size={12} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                          <span>
                            AI Judge mengevaluasi kesesuaian trajektori DOM dan tangkapan layar dengan instruksi awal Anda untuk mencegah halusinasi dan tugas yang belum selesai.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              PAGE 2: OTONOMI & KEBIJAKAN EKSEKUSI
             ══════════════════════════════════════════════════════════ */}
          {currentTab === 'policy' && (
            <div className="settings-page-content">
              <div className="settings-section-head">
                <div>
                  <h3 className="settings-section-title">Mode & Otonomi Eksekusi</h3>
                  <p className="settings-section-desc">
                    Tentukan bagaimana agen meminta konfirmasi saat berinteraksi di browser.
                  </p>
                </div>
              </div>

              <div className="settings-mode-list">
                {MODE_OPTIONS.map((m) => {
                  const isSelected = selectedMode === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => sidepanelStore.setSelectedMode(m.id)}
                      className={`settings-mode-card ${isSelected ? 'active' : ''}`}
                    >
                      <div className="mode-card-radio">
                        <span className={`radio-dot ${isSelected ? 'checked' : ''}`} />
                      </div>
                      <div className="mode-card-text">
                        <div className="mode-card-name">{m.name}</div>
                        <div className="mode-card-desc">{m.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="settings-info-box">
                <span className="info-box-label">Batas Waktu Safe Mode:</span>
                <span className="info-box-val">60 Detik (Auto-Pause jika tanpa interaksi)</span>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              PAGE 3: KUNCI API
             ══════════════════════════════════════════════════════════ */}
          {currentTab === 'apikeys' && (
            <div className="settings-page-content">
              <div className="settings-section-head">
                <div>
                  <h3 className="settings-section-title">Kunci API Provider</h3>
                  <p className="settings-section-desc">
                    Tersimpan lokal di Chrome Storage. Tidak pernah dikirim ke pihak luar.
                  </p>
                </div>
                {keysSaved && (
                  <span className="keys-saved-notice">
                    <Check size={11} />
                    <span>Tersimpan!</span>
                  </span>
                )}
              </div>

              <div className="settings-keys-list">
                {[
                  { id: 'gemini', label: 'Google Gemini API Key', placeholder: 'AIzaSy...' },
                  { id: 'openai', label: 'OpenAI API Key', placeholder: 'sk-proj-...' },
                  { id: 'anthropic', label: 'Anthropic Claude API Key', placeholder: 'sk-ant-api03-...' },
                  { id: 'custom_openai', label: 'Custom / DeepSeek Key', placeholder: 'sk-...' },
                  { id: 'ollama', label: 'Ollama Host Endpoint', placeholder: 'http://localhost:11434' },
                ].map((item) => (
                  <div key={item.id} className="form-field">
                    <label className="form-label">{item.label}</label>
                    <input
                      type={item.id === 'ollama' ? 'text' : 'password'}
                      className="form-input"
                      placeholder={item.placeholder}
                      value={keysInput[item.id] || ''}
                      onChange={(e) => setKeysInput({ ...keysInput, [item.id]: e.target.value })}
                    />
                  </div>
                ))}

                <button 
                  type="button" 
                  className="settings-save-keys-btn" 
                  onClick={handleSaveKeys}
                >
                  <Save size={12} />
                  <span>Simpan Kunci API</span>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              PAGE 4: BROWSER & CDP ENGINE
             ══════════════════════════════════════════════════════════ */}
          {currentTab === 'browser' && (
            <div className="settings-page-content">
              <div className="settings-section-head">
                <div>
                  <h3 className="settings-section-title">Integrasi Browser & CDP</h3>
                  <p className="settings-section-desc">
                    Pengaturan koneksi Chrome DevTools Protocol dan interface panel.
                  </p>
                </div>
              </div>

              <div className="settings-toggle-group">
                {/* Sidepanel auto-integration */}
                <div 
                  className="settings-toggle-card"
                  onClick={() => sidepanelStore.toggleSidepanelEnabled()}
                >
                  <div className="toggle-card-text">
                    <div className="toggle-card-title">Sidepanel Otomatis</div>
                    <div className="toggle-card-desc">Buka ekstensi di sidebar browser kanan secara langsung.</div>
                  </div>
                  <div className={`custom-switch ${sidepanelEnabled ? 'on' : 'off'}`}>
                    <span className="switch-handle" />
                  </div>
                </div>

                {/* Index element labeling */}
                <div 
                  className="settings-toggle-card"
                  onClick={() => sidepanelStore.toggleIndexLabeling()}
                >
                  <div className="toggle-card-text">
                    <div className="toggle-card-title">Label Indeks Elemen Visual</div>
                    <div className="toggle-card-desc">Tampilkan overlay nomor elemen di tab aktif saat agen membaca DOM.</div>
                  </div>
                  <div className={`custom-switch ${indexLabelingEnabled ? 'on' : 'off'}`}>
                    <span className="switch-handle" />
                  </div>
                </div>

                {/* Pop-out detached window */}
                <div 
                  className="settings-toggle-card"
                  onClick={() => sidepanelStore.toggleDetach()}
                >
                  <div className="toggle-card-text">
                    <div className="toggle-card-title">Jendela Melayang (Pop-Out)</div>
                    <div className="toggle-card-desc">{isDetached ? 'Kaitkan kembali ke sidepanel' : 'Buka Deep Browser dalam jendela popup terpisah.'}</div>
                  </div>
                  <ExternalLink size={14} className="text-zinc-400" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Clean Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px' }}>
          <button className="btn-secondary" onClick={onClose}>
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
