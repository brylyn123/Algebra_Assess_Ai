import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './components/Toast';
import MathText from './MathText';
import MathEditor from './MathEditor';
import Select from './components/Select';
import axios from './axiosClient';
import { findLocalUser } from './localAuthStore';
import { getQuickTypeHints } from './latexAutoConvert';

const DRAFT_KEY = 'teacher:new-assessment-draft';
const EDITOR_ITEMS_KEY = 'teacher:question-editor-items';

function hasLatexPatterns(text) {
  return /\\[a-zA-Z]|[_^{}]|[$]/.test(text);
}

function loadEditorItems() {
  try {
    const raw = sessionStorage.getItem(EDITOR_ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEditorItems(items) {
  sessionStorage.setItem(EDITOR_ITEMS_KEY, JSON.stringify(items));
}

export default function QuestionEditor() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const mathEditorRef = useRef(null);
  const [mathExpression, setMathExpression] = useState('');
  const [questionScore, setQuestionScore] = useState('1.0');
  const [items, setItems] = useState(loadEditorItems);
  const [editingIndex, setEditingIndex] = useState(null);
  const [rubrics, setRubrics] = useState([]);
  const [rubricLoading, setRubricLoading] = useState(false);
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);

  useEffect(() => {
    saveEditorItems(items);
  }, [items]);

  // Load rubrics
  useEffect(() => {
    const user = findLocalUser();
    if (!user) return;
    setRubricLoading(true);
    axios.get(`/get_rubric_sets.php?teacher_id=${user.id}`)
      .then((res) => {
        const list = Array.isArray(res.data?.rubrics) ? res.data.rubrics : [];
        setRubrics(list);
      })
      .catch(() => setRubrics([]))
      .finally(() => setRubricLoading(false));
  }, []);

  const handleAddItem = () => {
    const mathValue = mathExpression.trim();
    if (!mathValue) {
      toast.warning('Please type a question before adding.');
      return;
    }
    const score = parseFloat(questionScore);
    if (isNaN(score) || score <= 0 || score > 100) {
      toast.warning('Score must be between 0 and 100.');
      return;
    }

    const newItem = {
      item_no: items.length + 1,
      question_type: 'handwritten_algebra',
      question_content: mathValue,
      max_score: score,
    };

    if (editingIndex !== null) {
      setItems((prev) => prev.map((it, i) => i === editingIndex ? newItem : it));
      setEditingIndex(null);
    } else {
      setItems((prev) => [...prev, newItem]);
    }

    setMathExpression('');
    setQuestionScore('1.0');
  };

  const handleEditItem = (index) => {
    const item = items[index];
    setEditingIndex(index);
    setQuestionScore(String(item.max_score || 1.0));
    setMathExpression(item.question_content || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setMathExpression('');
      setQuestionScore('1.0');
    }
  };

  const insertSymbol = (symbol) => {
    if (mathEditorRef.current?.insertMath) {
      mathEditorRef.current.insertMath(symbol);
    } else {
      setMathExpression((prev) => prev + symbol);
    }
  };

  const handleDone = () => {
    saveEditorItems(items);
    navigate('/teacher/assessments/new', { state: { fromQuestionEditor: true } });
  };

  const handleBack = () => {
    saveEditorItems(items);
    navigate('/teacher/assessments/new', { state: { fromQuestionEditor: true } });
  };

  const totalScore = items.reduce((sum, it) => sum + (it.max_score || 0), 0);

  return (
    <div className="space-y-6 px-6 py-6">

      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900">Compose Questions</h1>
            <p className="text-[11px] text-slate-400">{items.length} question{items.length !== 1 ? 's' : ''} · {totalScore.toFixed(1)} total pts</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDone}
          className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-200/60 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
        >
          Done
        </button>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-4xl min-w-0 space-y-6">

          {/* Editor card */}
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                {editingIndex !== null ? `Editing Question #${editingIndex + 1}` : `Question #${items.length + 1}`}
              </p>
              {editingIndex !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingIndex(null);
                    setMathExpression('');
                    setQuestionScore('1.0');
                  }}
                  className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Question textarea with points */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 shadow-inner transition focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100">
                <MathEditor
                  ref={textareaRef}
                  value={mathExpression}
                  onChange={setMathExpression}
                  placeholder="Type naturally... e.g. x^2 + sqrt(x) = 5"
                  style={{ minHeight: '6rem', maxHeight: '20rem', overflowY: 'auto' }}
                  showKeyboard={showMathKeyboard}
                  onToggleKeyboard={() => setShowMathKeyboard((v) => !v)}
                />
                {mathExpression.trim() && hasLatexPatterns(mathExpression) && (
                  <div className="border-t border-slate-200 bg-white px-4 py-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Preview</p>
                    <div className="text-sm text-slate-800">
                      <MathText text={mathExpression} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-[60px]">
                  <input
                    type="number"
                    min="0.5"
                    max="100"
                    step="0.5"
                    value={questionScore}
                    onChange={(e) => setQuestionScore(e.target.value)}
                    placeholder="Pts"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-[11px] font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">pts</span>
              </div>
            </div>

            {/* Math keyboard panel */}
            {showMathKeyboard && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Quick Type Hints</p>
                <div className="flex flex-wrap gap-1.5">
                  {getQuickTypeHints().map((hint) => (
                    <button
                      key={hint.label}
                      type="button"
                      onClick={() => {
                        const textarea = textareaRef.current;
                        if (textarea) textarea.focus();
                        if (textareaRef.current?.insertMath) {
                          textareaRef.current.insertMath(hint.example);
                        }
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      title={`${hint.example} → ${hint.becomes}`}
                    >
                      {hint.label}: {hint.example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add button */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-700 hover:shadow-lg active:scale-[0.97]"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                {editingIndex !== null ? 'Update Question' : 'Add Question'}
              </button>
            </div>
          </div>

          {/* Questions list */}
          {items.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <p className="border-b border-slate-100 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Composed Questions ({items.length})</p>
              <div className="p-4 space-y-3">
              {items.map((item, index) => (
                <div
                  key={`${item.question_content}-${index}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[10px] font-bold text-blue-700">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-800 overflow-hidden break-words">
                        <MathText text={item.question_content} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">{item.max_score} pts</p>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleEditItem(index)}
                        className="rounded-lg px-2 py-1 text-[10px] font-semibold text-blue-500 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="rounded-lg px-2 py-1 text-[10px] font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {/* Per-item rubric selector */}
                  <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-slate-400">
                      <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                    </svg>
                    <Select
                      value={item.rubric_id || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) => prev.map((it, i) => i === index ? { ...it, rubric_id: val ? Number(val) : null } : it));
                      }}
                      className="flex-1 text-[11px]"
                    >
                      <option value="">No rubric (AI default)</option>
                      {[...rubrics].sort((a, b) => {
                        const order = { procedural_algebra: 0, problem_solving: 1, general: 2 };
                        return (order[a.rubric_type] ?? 3) - (order[b.rubric_type] ?? 3);
                      }).map((rubric) => (
                        <option key={rubric.rubric_set_id} value={rubric.rubric_set_id}>
                          {rubric.rubric_name}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      onClick={() => {
                        saveEditorItems(items);
                        navigate('/teacher/assessments/new-rubric', { state: { returnToQuestionEditor: true } });
                      }}
                      className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                    >
                      + New
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-blue-500">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">No questions yet</p>
              <p className="mt-1 text-xs text-slate-400">Type an equation above and click "Add Question" to start composing.</p>
            </div>
          )}
        </div>
    </div>
  );
}
