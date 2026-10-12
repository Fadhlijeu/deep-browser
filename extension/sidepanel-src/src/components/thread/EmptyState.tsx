import React from 'react';

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  const suggestions = [
    { label: 'Cari data mahasiswa di PDDIKTI', prompt: 'Cari website pddikti yang benar lalu cari data mahasiswa dan ambil informasinya' },
    { label: 'Rangkum konten halaman aktif', prompt: 'Jelajahi halaman aktif ini dan rangkum poin-poin pentingnya secara terstruktur' },
    { label: 'Riset multi-tab perkembangan AI', prompt: 'Buka 3 tab secara paralel untuk meriset perkembangan AI reasoning terkini' },
  ];

  return (
    <div className="empty-state">
      <div className="empty-icon-wrap">
        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>explore</span>
      </div>
      <div>
        <h2 className="empty-title">Deep Browser Copilot</h2>
        <p className="empty-desc">
          Otonom menjelajah, menganalisis data, dan mengeksekusi aksi terverifikasi pada Microsoft Edge & Chrome.
        </p>
      </div>

      <div className="prompt-suggestions">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            className="suggestion-btn"
            onClick={() => onSelectPrompt(s.prompt)}
          >
            <span>{s.label}</span>
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
          </button>
        ))}
      </div>
    </div>
  );
};
