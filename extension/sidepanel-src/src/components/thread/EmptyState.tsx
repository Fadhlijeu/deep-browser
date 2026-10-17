import React from 'react';
import { Layers, ScanEye, CalendarClock, ShieldCheck } from 'lucide-react';

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  return (
    <div className="welcome">
      {/* Branded Times New Roman Poster with Geometric Diagrams */}
      <div className="poster">
        <div className="poster-kicker">
          <span className="poster-dot" />
          BROWSER INTELLIGENCE
        </div>

        <div className="poster-title">
          Deep Browser<br />
          <em>Copilot.</em>
        </div>

        <div className="poster-foot">
          <p>A considered workspace for conversation, browser action, and human judgment.</p>
        </div>

        {/* Poster Abstract Visual Artwork */}
        <div className="poster-art" aria-hidden="true">
          <div className="bar" />
          <div className="bar" style={{ width: '76%' }} />
          <div className="art-line" />
          <div className="mini-node">
            <i /> PLAN_READY
          </div>
          <div className="bar" style={{ width: '88%' }} />
          <div className="mini-node">
            <i style={{ background: '#8d8f81' }} /> TOOL_CALL
          </div>
          <div className="bar" style={{ width: '56%' }} />
          <div className="art-line" />
          <div className="mini-node">
            <i /> REVIEW_GATE
          </div>
          <div className="bar" style={{ width: '70%' }} />
        </div>
      </div>

      <div className="welcome-greeting">
        <h2>What shall we work on?</h2>
        <p>Ask a question, outline a workflow, or hand off an autonomous browser task.</p>
      </div>

      {/* Starter Suggestions Chips */}
      <div className="suggestions">
        <button
          className="suggestion"
          onClick={() =>
            onSelectPrompt('Buka portal web resmi yang relevan, cari informasi target dan kumpulkan data lengkapnya ke dalam tabel ringkasan.')
          }
        >
          <span className="s-icon">
            <Layers size={15} />
          </span>
          <span>
            <strong>Compare information</strong>
            <span>Turn multiple pages into one clear brief.</span>
          </span>
        </button>

        <button
          className="suggestion"
          onClick={() =>
            onSelectPrompt('Jelajahi halaman aktif, temukan form & input penting, lalu verifikasi elemen yang dapat diklik.')
          }
        >
          <span className="s-icon">
            <ScanEye size={15} />
          </span>
          <span>
            <strong>Audit active page</strong>
            <span>Inspect element trees, inputs, and verify structure.</span>
          </span>
        </button>

        <button
          className="suggestion"
          onClick={() =>
            onSelectPrompt('Jalankan riset web mendalam tentang topik terkini dan rangkum poin penting dengan referensi sumber.')
          }
        >
          <span className="s-icon">
            <CalendarClock size={15} />
          </span>
          <span>
            <strong>Research &amp; extract</strong>
            <span>Gather insights across multiple sources autonomously.</span>
          </span>
        </button>

        <button
          className="suggestion"
          onClick={() =>
            onSelectPrompt('Verifikasi alur navigasi dan aksi pada browser dengan konfirmasi review sebelum submit data sensitif.')
          }
        >
          <span className="s-icon">
            <ShieldCheck size={15} />
          </span>
          <span>
            <strong>Safe verified execution</strong>
            <span>Deterministic verification on every state mutation.</span>
          </span>
        </button>
      </div>
    </div>
  );
};
