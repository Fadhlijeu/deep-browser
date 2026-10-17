import React from 'react';
import { ArrowRight } from 'lucide-react';

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  const suggestions = [
    {
      code: '01 / NAVIGATE',
      title: 'Buka Portal & Ekstrak Data',
      desc: 'Buka portal web target, cari entitas spesifik, dan kumpulkan informasi.',
      prompt: 'Buka portal web resmi yang relevan, cari informasi target dan kumpulkan data lengkapnya',
    },
    {
      code: '02 / EXTRACT',
      title: 'Rangkum Halaman',
      desc: 'Ekstrak poin penting dan struktur informasi halaman aktif.',
      prompt: 'Jelajahi halaman aktif ini dan rangkum poin-poin pentingnya secara terstruktur',
    },
    {
      code: '03 / RESEARCH',
      title: 'Riset Multi-Tab AI',
      desc: 'Jelajahi beberapa sumber web secara simultan.',
      prompt: 'Buka 3 tab secara paralel untuk meriset perkembangan AI reasoning terkini',
    },
  ];

  return (
    <div className="empty-state">
      <div className="empty-header">
        <h1 className="empty-headline">Deep Browser Copilot</h1>
        <p className="empty-subtext">
          Otonom menjelajah, menganalisis data, dan mengeksekusi instruksi terverifikasi langsung pada browser Anda.
        </p>
      </div>

      <div className="empty-cards-grid">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            className="empty-card"
            onClick={() => onSelectPrompt(s.prompt)}
          >
            <div className="empty-card-top">
              <span className="empty-card-code">{s.code}</span>
              <ArrowRight size={12} className="empty-card-arrow" />
            </div>
            <div className="empty-card-title">{s.title}</div>
            <div className="empty-card-desc">{s.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
