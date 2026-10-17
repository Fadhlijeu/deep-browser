import React from 'react';

interface ProviderLogoProps {
  provider: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({
  provider,
  size = 16,
  className = '',
  style = {},
}) => {
  const norm = (provider || '').toLowerCase();

  if (norm.includes('gemini') || norm === 'google') {
    // Official Google Gemini 4-Point Sparkle Gradient SVG
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ flexShrink: 0, ...style }}
      >
        <defs>
          <linearGradient id="geminiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4E97FF" />
            <stop offset="50%" stopColor="#8E75FF" />
            <stop offset="100%" stopColor="#FF7A85" />
          </linearGradient>
        </defs>
        <path
          d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
          fill="url(#geminiGrad)"
        />
      </svg>
    );
  }

  if (norm.includes('openai') && !norm.includes('custom')) {
    // OpenAI Emblem SVG
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#10b981"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ flexShrink: 0, ...style }}
      >
        <circle cx="12" cy="12" r="10" stroke="#10b981" fill="rgba(16, 185, 129, 0.12)" />
        <path d="M12 6v12M6 12h12M7.75 7.75l8.5 8.5M16.25 7.75l-8.5 8.5" />
      </svg>
    );
  }

  if (norm.includes('anthropic') || norm.includes('claude')) {
    // Claude Terracotta Starburst
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ flexShrink: 0, ...style }}
      >
        <rect width="24" height="24" rx="5" fill="#D97757" fillOpacity="0.2" />
        <path
          d="M12 4L14.2 9.8L20 12L14.2 14.2L12 20L9.8 14.2L4 12L9.8 9.8L12 4Z"
          fill="#D97757"
        />
      </svg>
    );
  }

  if (norm.includes('ollama')) {
    // Ollama Terminal / Local Icon
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ flexShrink: 0, ...style }}
      >
        <rect x="3" y="4" width="18" height="16" rx="3" fill="rgba(245, 158, 11, 0.15)" />
        <polyline points="7 9 10 12 7 15" />
        <line x1="12" y1="15" x2="16" y2="15" />
      </svg>
    );
  }

  // Custom OpenAI / DeepSeek / Other
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#a855f7"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <circle cx="12" cy="12" r="3" fill="#a855f7" />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
};
