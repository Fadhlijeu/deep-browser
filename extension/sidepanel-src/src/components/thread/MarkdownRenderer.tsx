import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { normalizeMathDelimiters } from '@assistant-ui/react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  // Preprocess math delimiters (\(...\) -> $...$, \[...\] -> $$...$$) to ensure robust KaTeX parsing
  const processedContent = useMemo(() => {
    if (!content) return '';
    let text = content;
    try {
      if (typeof normalizeMathDelimiters === 'function') {
        text = normalizeMathDelimiters(text);
      }
    } catch (_) {}

    // Fallback regex normalization for common LaTeX brackets emitted by LLMs
    return text
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n\n$$\n${math.trim()}\n$$\n\n`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);
  }, [content]);

  return (
    <div className={`markdown-rendered-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isMultiLine = codeString.includes('\n') || Boolean(match && match[1]);

            if (!inline && isMultiLine) {
              return <CodeBlock language={match ? match[1] : ''} code={codeString} />;
            }
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="table-responsive-wrapper">
                <table className="markdown-table">{children}</table>
              </div>
            );
          },
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="markdown-link"
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText?.(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-lang-tag">{language || 'code'}</span>
        <button className="code-copy-btn" onClick={handleCopy} title="Salin kode">
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
            {copied ? 'check' : 'content_copy'}
          </span>
          <span>{copied ? 'Tersalin' : 'Salin'}</span>
        </button>
      </div>
      <pre className="code-block-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
};
