import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import 'katex/dist/katex.min.css';
import './styles/assistant-theme.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
