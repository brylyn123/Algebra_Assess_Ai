import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { MathfieldElement } from 'mathlive';
import { autoConvertToLatex } from './latexAutoConvert';

if (typeof customElements !== 'undefined' && !customElements.get('math-field')) {
  customElements.define('math-field', MathfieldElement);
}

function normalizeStyle(style) {
  if (!style) return {};
  if (typeof style === 'string') {
    const obj = {};
    style.split(';').forEach((decl) => {
      const [prop, val] = decl.split(':').map((s) => s.trim());
      if (prop && val) obj[prop] = val;
    });
    return obj;
  }
  return style;
}

const MathEditor = forwardRef(function MathEditor(
  { value, onChange, placeholder, className = '', style = {}, showKeyboard, onToggleKeyboard },
  ref
) {
  const mfRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const skipNextUpdate = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  const [editorMode, setEditorMode] = useState('quicktype');
  const [rawInput, setRawInput] = useState('');
  const textareaRef = useRef(null);
  const isUpdatingFromProp = useRef(false);

  const containerStyle = { minHeight: '6rem', ...normalizeStyle(style) };

  const convertAndEmit = useCallback((raw) => {
    const converted = autoConvertToLatex(raw);
    if (onChangeRef.current) onChangeRef.current(converted);
  }, []);

  useImperativeHandle(ref, () => ({
    insertMath: (latex) => {
      if (editorMode === 'quicktype') {
        setRawInput((prev) => prev + latex);
        const newRaw = rawInput + latex;
        const converted = autoConvertToLatex(newRaw);
        if (onChangeRef.current) onChangeRef.current(converted);
        return;
      }
      const mf = mfRef.current;
      if (!mf) return;
      mf.focus();
      mf.insert(latex, { format: 'latex' });
    },
    focus: () => {
      if (editorMode === 'quicktype') {
        textareaRef.current?.focus();
      } else {
        mfRef.current?.focus();
      }
    },
    getMathfield: () => mfRef.current,
    setMode: (mode) => setEditorMode(mode),
    getMode: () => editorMode,
  }));

  useEffect(() => {
    if (editorMode !== 'visual') return;
    const mf = mfRef.current;
    if (!mf) return;

    const handleInput = () => {
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false;
        return;
      }
      const latex = mf.getValue('latex');
      if (onChangeRef.current) onChangeRef.current(latex);
    };

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    mf.addEventListener('input', handleInput);
    mf.addEventListener('focus', handleFocus);
    mf.addEventListener('blur', handleBlur);

    return () => {
      mf.removeEventListener('input', handleInput);
      mf.removeEventListener('focus', handleFocus);
      mf.removeEventListener('blur', handleBlur);
    };
  }, [editorMode]);

  useEffect(() => {
    if (editorMode !== 'visual') return;
    const mf = mfRef.current;
    if (!mf) return;
    const currentVal = mf.getValue('latex');
    if ((value || '') !== currentVal) {
      skipNextUpdate.current = true;
      mf.setValue(value || '', { silent: true });
    }
  }, [value, editorMode]);

  useEffect(() => {
    if (editorMode !== 'visual') return;
    const mf = mfRef.current;
    if (!mf) return;
    mf.setOptions({
      virtualKeyboardMode: 'manual',
      virtualKeyboardTheme: 'apple',
      fontsDirectory: null,
      virtualKeyboardLabels: 'english',
      virtualKeyboards: 'numeric functions symbols greek-letters',
    });
  }, [editorMode]);

  useEffect(() => {
    if (editorMode !== 'visual') return;
    const mf = mfRef.current;
    if (!mf) return;
    if (showKeyboard) {
      mf.executeCommand('showVirtualKeyboard');
    } else {
      mf.executeCommand('hideVirtualKeyboard');
    }
  }, [showKeyboard, editorMode]);

  useEffect(() => {
    if (editorMode === 'quicktype' && isUpdatingFromProp.current) {
      isUpdatingFromProp.current = false;
      return;
    }
    if (editorMode === 'quicktype' && value !== undefined) {
      setRawInput(value || '');
    }
  }, [value, editorMode]);

  const handleModeSwitch = (newMode) => {
    if (newMode === editorMode) return;
    if (newMode === 'quicktype') {
      const currentLatex = mfRef.current?.getValue('latex') || value || '';
      setRawInput(currentLatex);
      setEditorMode('quicktype');
    } else {
      setEditorMode('visual');
      isUpdatingFromProp.current = true;
    }
  };

  const handleQuickTypeChange = (e) => {
    const raw = e.target.value;
    setRawInput(raw);
    convertAndEmit(raw);
  };

  return (
    <div className={`math-editor-wrapper ${className}`} style={containerStyle}>
      <style>{`
        .math-editor-mode-toggle {
          display: flex;
          gap: 0;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 0;
        }
        .math-editor-mode-btn {
          flex: 1;
          padding: 6px 12px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          text-align: center;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          background: transparent;
          color: #94a3b8;
        }
        .math-editor-mode-btn:first-child {
          border-right: 1px solid #e2e8f0;
        }
        .math-editor-mode-btn.active {
          color: #2563eb;
          background: #eff6ff;
          border-bottom: 2px solid #2563eb;
        }
        .math-editor-mode-btn:hover:not(.active) {
          color: #64748b;
          background: #f8fafc;
        }
        .quicktype-textarea {
          width: 100%;
          min-height: 4rem;
          resize: vertical;
          border: none;
          outline: none;
          background: transparent;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.5;
          color: #1e293b;
          font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
        }
        .quicktype-textarea::placeholder {
          color: #94a3b8;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .quicktype-hints {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 6px 8px;
          border-top: 1px solid #f1f5f9;
          background: #f8fafc;
        }
        .quicktype-hint {
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 4px;
          background: #e0f2fe;
          color: #0369a1;
          font-weight: 500;
          white-space: nowrap;
        }
        math-field {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          font-size: 1rem;
          width: 100%;
          min-height: 3rem;
          padding: 0.5rem 0.75rem;
        }
        math-field:focus {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .ml-keyboard {
          z-index: 9999 !important;
        }
      `}</style>

      <div className="math-editor-mode-toggle">
        <button
          type="button"
          className={`math-editor-mode-btn ${editorMode === 'quicktype' ? 'active' : ''}`}
          onClick={() => handleModeSwitch('quicktype')}
        >
          Quick Type
        </button>
        <button
          type="button"
          className={`math-editor-mode-btn ${editorMode === 'visual' ? 'active' : ''}`}
          onClick={() => handleModeSwitch('visual')}
        >
          Visual Editor
        </button>
      </div>

      {editorMode === 'quicktype' ? (
        <div>
          <textarea
            ref={textareaRef}
            className="quicktype-textarea"
            value={rawInput}
            onChange={handleQuickTypeChange}
            placeholder={placeholder || 'Type naturally... e.g. x^2 + sqrt(x) = 5, alpha + beta >= 0'}
            rows={3}
          />
          <div className="quicktype-hints">
            <span className="quicktype-hint" title="Type (x+1)/2 to get a fraction">a/b = fraction</span>
            <span className="quicktype-hint" title="Type x^2 for exponents">x^2 = power</span>
            <span className="quicktype-hint" title="Type sqrt(x) for square root">sqrt(x) = root</span>
            <span className="quicktype-hint" title="Type alpha, beta, pi etc.">alpha = Greek</span>
            <span className="quicktype-hint" title="Type >= for inequality">≥ ≤ ≠</span>
          </div>
        </div>
      ) : (
        <math-field
          ref={mfRef}
          style={{
            width: '100%',
            minHeight: '3rem',
          }}
        >
          {value || ''}
        </math-field>
      )}
    </div>
  );
});

export default MathEditor;
