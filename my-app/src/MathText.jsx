import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function hasLatexPatterns(text) {
  return /\\[a-zA-Z]|[_^{}]|[$]/.test(text);
}

function stripDelimiters(text) {
  let s = text.trim();
  if (s.startsWith('$$') && s.endsWith('$$')) {
    return { latex: s.slice(2, -2).trim(), displayMode: true };
  }
  if (s.startsWith('$') && s.endsWith('$') && !s.startsWith('$$')) {
    return { latex: s.slice(1, -1).trim(), displayMode: false };
  }
  if (s.startsWith('\\[') && s.endsWith('\\]')) {
    return { latex: s.slice(2, -2).trim(), displayMode: true };
  }
  if (s.startsWith('\\(') && s.endsWith('\\)')) {
    return { latex: s.slice(2, -2).trim(), displayMode: false };
  }
  return { latex: s, displayMode: false };
}

function renderContent(text) {
  if (!text || typeof text !== 'string') return <span>{text ?? ''}</span>;

  const trimmed = text.trim();
  if (!trimmed) return <span />;

  if (!hasLatexPatterns(trimmed)) {
    return <span>{trimmed}</span>;
  }

  const { latex, displayMode: dmFromDelimiters } = stripDelimiters(trimmed);
  const displayMode = dmFromDelimiters || /\\begin\{/.test(latex);

  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      trust: true,
      strict: false,
    });

    if (html) {
      return (
        <span
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
  } catch {
    // fall through
  }

  return <span>{text}</span>;
}

export default function MathText({ text }) {
  return useMemo(() => renderContent(text), [text]);
}
