import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import axios from './axiosClient';

import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import { useToast } from './components/Toast';
import Select from './components/Select';
import MathText from './MathText';
import MathEditor from './MathEditor';

const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

function hasLatexPatterns(text) {
  return /\\[a-zA-Z]|[_^{}]|[$]/.test(text);
}

const MATH_SYMBOLS = [
  { label: ' Fraction', insert: '\\frac{a}{b}' },
  { label: ' √', insert: '\\sqrt{x}' },
  { label: ' x²', insert: 'x^{n}' },
  { label: ' xₙ', insert: 'x_{n}' },
  { label: ' α', insert: '\\alpha' },
  { label: ' β', insert: '\\beta' },
  { label: ' γ', insert: '\\gamma' },
  { label: ' π', insert: '\\pi' },
  { label: ' θ', insert: '\\theta' },
  { label: ' Σ', insert: '\\sum_{i=1}^{n}' },
  { label: ' ∫', insert: '\\int_{a}^{b}' },
  { label: ' ±', insert: '\\pm' },
  { label: ' ×', insert: '\\times' },
  { label: ' ÷', insert: '\\div' },
  { label: ' ≠', insert: '\\neq' },
  { label: ' ≤', insert: '\\leq' },
  { label: ' ≥', insert: '\\geq' },
  { label: ' ∞', insert: '\\infty' },
];



const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];
const NEW_RUBRIC_STORAGE_KEY = 'teacher:new-rubric-created';
const ASSESSMENT_DRAFT_STORAGE_KEY = 'teacher:new-assessment-draft';
const EDITOR_ITEMS_KEY = 'teacher:question-editor-items';

const ASSESSMENT_STEPS = [
    { id: 'details', label: 'Details', description: 'Title, subject & settings' },
    { id: 'items', label: 'Questions', description: 'Add items' },
];

const initialState = {
  teacherId: null,
  subjects: [],
  rubrics: [],
  rubricLoading: false,
  rubricError: '',
  selectedRubric: '',
  newAssessment: {
    title: '',
    subjectId: '',
    subjectIds: [],
    topic: '',
    description: '',
    difficulty: 'Medium',
    dueDate: '',
  },
  testItems: [],
  previewValue: '',
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TEACHER_ID':
      return { ...state, teacherId: action.payload };
    case 'SET_SUBJECTS':
      return { ...state, subjects: action.payload };
    case 'SET_RUBRICS':
      return { ...state, rubrics: action.payload };
    case 'SET_RUBRIC_LOADING':
      return { ...state, rubricLoading: action.payload };
    case 'SET_RUBRIC_ERROR':
      return { ...state, rubricError: action.payload };
    case 'SET_SELECTED_RUBRIC':
      return { ...state, selectedRubric: action.payload };
    case 'UPDATE_ASSESSMENT_FIELD':
      return {
        ...state,
        newAssessment: { ...state.newAssessment, [action.field]: action.value },
      };
    case 'RESET_ASSESSMENT_FORM':
      return {
        ...state,
        newAssessment: initialState.newAssessment,
        testItems: [],
        previewValue: '',
        selectedRubric: '',
        rubricError: '',
      };
    case 'SET_PREVIEW_VALUE':
      return { ...state, previewValue: action.payload };
    case 'ADD_TEST_ITEM':
      return {
        ...state,
        testItems: [...state.testItems, action.payload],
        previewValue: '',
      };
    case 'REMOVE_TEST_ITEM':
      return {
        ...state,
        testItems: state.testItems.filter((_, i) => i !== action.payload),
      };
    case 'SET_TEST_ITEMS':
      return {
        ...state,
        testItems: action.payload,
      };
    default:
      return state;
  }
}

const DEFAULT_GRADING_CRITERIA = [
  {
    key: 'understanding',
    title: 'Problem Understanding & Attempt',
    weight: 25,
    icon: '★',
    description: 'Visible effort, identification of given information, variable setup.',
  },
  {
    key: 'method',
    title: 'Algebraic Method & Setup',
    weight: 25,
    icon: '→',
    description: 'Appropriate equation, formula, or method selected and applied.',
  },
  {
    key: 'process',
    title: 'Process & Logical Reasoning',
    weight: 25,
    icon: '■',
    description: 'Complete, sequential steps with clear mathematical reasoning.',
  },
  {
    key: 'accuracy',
    title: 'Final Answer & Accuracy',
    weight: 25,
    icon: '✓',
    description: 'Correct final answer with proper form.',
  },
];

function SortableQuestion({ id, item, index, rubrics, onEdit, onRemove, onRubricChange }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-xl border bg-white p-3 sm:p-4 transition ${
        isDragging ? 'border-blue-300 shadow-lg ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-2 sm:gap-2.5">
        {/* Drag handle */}
        <button
          type="button"
          className="mt-0.5 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M5.5 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-5 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-5 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
          </svg>
        </button>
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[10px] font-bold text-blue-700">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm text-slate-800 overflow-hidden break-words">
            <MathText text={item.question_content} />
          </div>
          <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{item.max_score} pts</span>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
          <button type="button" onClick={() => onEdit(index)} className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-blue-500 transition hover:bg-blue-50 hover:text-blue-700">Edit</button>
          <button type="button" onClick={() => onRemove(index)} className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-700">Remove</button>
        </div>
      </div>
      <div className="mt-2 border-t border-slate-100 pt-2 flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <select
          value={item.rubric_id || ''}
          onChange={(e) => onRubricChange(index, e.target.value)}
          className="flex-1 appearance-none rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1 text-[10px] font-medium text-slate-600 outline-none transition hover:border-slate-300 hover:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Default (assessment rubric)</option>
          {[...rubrics].sort((a, b) => {
            const order = { procedural_algebra: 0, problem_solving: 1, general: 2 };
            return (order[a.rubric_type] ?? 3) - (order[b.rubric_type] ?? 3);
          }).map((r) => (
            <option key={r.rubric_set_id} value={r.rubric_set_id}>
              {r.rubric_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function DragOverlayQuestion({ item, index, rubrics }) {
  return (
    <div className="rounded-xl border border-blue-300 bg-white p-3 sm:p-4 shadow-2xl ring-2 ring-blue-100" style={{ transform: 'scale(1.02)' }}>
      <div className="flex items-start gap-2 sm:gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg text-slate-300">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M5.5 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-5 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-5 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
          </svg>
        </div>
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[10px] font-bold text-blue-700">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm text-slate-800 overflow-hidden break-words">
            <MathText text={item.question_content} />
          </div>
          <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{item.max_score} pts</span>
        </div>
      </div>
    </div>
  );
}

const NewAssessment = () => {

  const navigate = useNavigate();
  const { id: editId } = useParams();
  const location = useLocation();
  const { toast } = useToast();
  const isEditMode = Boolean(editId);
  const editAssessment = location.state?.assessment || null;

  const [mathExpression, setMathExpression] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [showDefaultRubricModal, setShowDefaultRubricModal] = useState(false);
  const [showRubricDetailModal, setShowRubricDetailModal] = useState(false);
  const [selectedRubricDetail, setSelectedRubricDetail] = useState(null);
  const [questionScore, setQuestionScore] = useState('1.0');
  const [editingIndex, setEditingIndex] = useState(null);
  const [questionRubricId, setQuestionRubricId] = useState('');
  const mathEditorRef = useRef(null);
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const [showModifyCriteriaModal, setShowModifyCriteriaModal] = useState(false);
  const [enabledCriteria, setEnabledCriteria] = useState(
    DEFAULT_GRADING_CRITERIA.map((c) => ({ ...c, enabled: true }))
  );
  const [customCriteria, setCustomCriteria] = useState([]);
  const [newCriterionName, setNewCriterionName] = useState('');
  const [newCriterionDesc, setNewCriterionDesc] = useState('');
  const [effortMinimumGuarantee, setEffortMinimumGuarantee] = useState(1);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);

  // File upload state
  const [uploadFiles, setUploadFiles] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState([]);
  const [extractErrors, setExtractErrors] = useState([]);
  const fileInputRef = useRef(null);

  // Manual question input state
  const [manualQuestionText, setManualQuestionText] = useState('');
  const [manualQuestionScore, setManualQuestionScore] = useState('5.0');

  // Drag-and-drop state
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    teacherId,
    subjects,
    newAssessment,
    testItems,
    previewValue,
    rubrics,
    rubricLoading,
    rubricError,
    selectedRubric,
  } = state;

  const sortableIds = testItems.map((item, i) => item.id || `item-${item.question_content}-${item.max_score}-${i}`);

  const insertSymbol = (symbol) => {
    if (mathEditorRef.current?.insertMath) {
      mathEditorRef.current.insertMath(symbol);
    } else {
      setMathExpression((prev) => prev + symbol);
    }
  };

  // Inline question editor functions
  const handleAddQuestion = () => {
    const value = mathExpression.trim();
    if (!value) {
      toast.warning('Please type a question before adding.');
      return;
    }
    const score = parseFloat(questionScore);
    if (isNaN(score) || score <= 0 || score > 100) {
      toast.warning('Score must be between 0 and 100.');
      return;
    }
    const newItem = {
      item_no: testItems.length + 1,
      question_type: 'handwritten_algebra',
      question_content: value,
      max_score: score,
      rubric_id: questionRubricId ? Number(questionRubricId) : null,
    };
    if (editingIndex !== null) {
      dispatch({ type: 'SET_TEST_ITEMS', payload: testItems.map((it, i) => i === editingIndex ? newItem : it) });
      setEditingIndex(null);
      toast.success(`Question #${editingIndex + 1} updated successfully.`);
    } else {
      dispatch({ type: 'ADD_TEST_ITEM', payload: newItem });
      toast.success(`Item #${newItem.item_no} added successfully.`);
    }
    setMathExpression('');
    setQuestionScore('1.0');
    setQuestionRubricId('');
  };

  const handleEditQuestion = (index) => {
    const item = testItems[index];
    setEditingIndex(index);
    setQuestionScore(String(item.max_score || 1.0));
    setQuestionRubricId(item.rubric_id ? String(item.rubric_id) : '');
    setMathExpression(item.question_content || '');
  };

  const handleAddManualQuestion = () => {
    const text = manualQuestionText.trim();
    if (!text) {
      toast.warning('Please type or paste a question before adding.');
      return;
    }
    const score = parseFloat(manualQuestionScore);
    if (isNaN(score) || score <= 0 || score > 100) {
      toast.warning('Score must be between 0 and 100.');
      return;
    }
    const newItem = {
      item_no: testItems.length + 1,
      question_type: 'problem_solving',
      question_content: text,
      max_score: score,
      rubric_id: null,
    };
    dispatch({ type: 'ADD_TEST_ITEM', payload: newItem });
    toast.success(`Item #${newItem.item_no} added successfully.`);
    setManualQuestionText('');
    setManualQuestionScore('5.0');
  };

  // Subject multi-select helpers
  const toggleSubject = (subjectId) => {
    const current = newAssessment.subjectIds || [];
    const clickedSubject = subjects.find((s) => s.id === subjectId);
    if (!clickedSubject) return;

    const isCurrentlyChecked = current.includes(subjectId);

    if (isCurrentlyChecked) {
      // Unchecking: remove all subjects with the same name
      const updated = current.filter((id) => {
        const s = subjects.find((sub) => sub.id === id);
        return s && s.name !== clickedSubject.name;
      });
      dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'subjectIds', value: updated });
      dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'subjectId', value: updated[0] || '' });
    } else {
      // Checking: select ALL subjects with the same name
      const sameNameIds = subjects
        .filter((s) => s.name === clickedSubject.name)
        .map((s) => s.id);
      const merged = [...new Set([...current, ...sameNameIds])];
      dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'subjectIds', value: merged });
      dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'subjectId', value: merged[0] || '' });
    }
  };

  // Check if a subject should be disabled (different name from selected subjects)
  const isSubjectDisabled = (subject) => {
    const selectedIds = newAssessment.subjectIds || [];
    if (selectedIds.length === 0) return false;
    // Find the name of the first selected subject
    const firstSelected = subjects.find((s) => selectedIds.includes(s.id));
    if (!firstSelected) return false;
    return subject.name !== firstSelected.name;
  };

  const selectAllSameLevel = () => {
    if (subjects.length === 0) return;
    const selectedIds = newAssessment.subjectIds || [];
    const firstSubject = subjects.find((s) => selectedIds.includes(s.id)) || subjects[0];
    if (!firstSubject) return;
    const sameLevelIds = subjects
      .filter((s) => s.year === firstSubject.year)
      .map((s) => s.id);
    dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'subjectIds', value: sameLevelIds });
    dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'subjectId', value: sameLevelIds[0] || '' });
  };

  // Custom criteria helpers
  const redistributeWeights = (criteria) => {
    if (criteria.length === 0) return criteria;
    const baseWeight = Math.floor(100 / criteria.length);
    const remainder = 100 - baseWeight * criteria.length;
    return criteria.map((c, i) => ({
      ...c,
      weight: baseWeight + (i < remainder ? 1 : 0),
    }));
  };

  const toggleDefaultCriterion = (key) => {
    const updated = enabledCriteria.map((c) =>
      c.key === key ? { ...c, enabled: !c.enabled } : c
    );
    const activeDefaults = updated.filter((c) => c.enabled);
    const allActive = [...activeDefaults, ...customCriteria.filter((c) => c.enabled !== false)];
    const redistributed = redistributeWeights(allActive);
    setEnabledCriteria(updated.map((c) => {
      const found = redistributed.find((r) => r.key === c.key);
      return found ? { ...c, weight: found.weight } : c;
    }));
    setCustomCriteria(customCriteria.map((c) => {
      const found = redistributed.find((r) => r.key === c.key);
      return found ? { ...c, weight: found.weight } : c;
    }));
  };

  const toggleCustomCriterion = (key) => {
    const updated = customCriteria.map((c) =>
      c.key === key ? { ...c, enabled: c.enabled === false } : c
    );
    const allActive = [
      ...enabledCriteria.filter((c) => c.enabled),
      ...updated.filter((c) => c.enabled !== false),
    ];
    const redistributed = redistributeWeights(allActive);
    setEnabledCriteria(enabledCriteria.map((c) => {
      const found = redistributed.find((r) => r.key === c.key);
      return found ? { ...c, weight: found.weight } : c;
    }));
    setCustomCriteria(updated.map((c) => {
      const found = redistributed.find((r) => r.key === c.key);
      return found ? { ...c, weight: found.weight } : c;
    }));
  };

  const addCustomCriterion = () => {
    const name = newCriterionName.trim();
    if (!name) {
      toast.warning('Please enter a criterion name.');
      return;
    }
    const newC = {
      key: `custom-${Date.now()}`,
      title: name,
      description: newCriterionDesc.trim() || name,
      weight: 0,
      enabled: true,
    };
    const allActive = [...enabledCriteria.filter((c) => c.enabled), ...customCriteria, newC];
    const redistributed = redistributeWeights(allActive);
    setEnabledCriteria(enabledCriteria.map((c) => {
      const found = redistributed.find((r) => r.key === c.key);
      return found ? { ...c, weight: found.weight } : c;
    }));
    setCustomCriteria(redistributed.filter((c) => c.key !== undefined && enabledCriteria.every((ec) => ec.key !== c.key)));
    setNewCriterionName('');
    setNewCriterionDesc('');
  };

  const removeCustomCriterion = (key) => {
    const allActive = [...enabledCriteria.filter((c) => c.enabled), ...customCriteria.filter((c) => c.key !== key)];
    const redistributed = redistributeWeights(allActive);
    setEnabledCriteria(enabledCriteria.map((c) => {
      const found = redistributed.find((r) => r.key === c.key);
      return found ? { ...c, weight: found.weight } : c;
    }));
    setCustomCriteria(redistributed.filter((c) => enabledCriteria.every((ec) => ec.key !== c.key)));
  };

  const handleRemoveQuestion = (index) => {
    dispatch({ type: 'REMOVE_TEST_ITEM', payload: index });
    if (editingIndex === index) {
      setEditingIndex(null);
      setMathExpression('');
      setQuestionScore('1.0');
      setQuestionRubricId('');
    }
  };

  const handleRubricChange = (index, rubricId) => {
    dispatch({
      type: 'SET_TEST_ITEMS',
      payload: testItems.map((it, i) => i === index ? { ...it, rubric_id: rubricId || null } : it),
    });
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = sortableIds.indexOf(active.id);
    const newIndex = sortableIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(testItems, oldIndex, newIndex).map((item, i) => ({
      ...item,
      item_no: i + 1,
    }));
    dispatch({ type: 'SET_TEST_ITEMS', payload: reordered });
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // File upload handlers
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = [];
    const errors = [];

    for (const file of files) {
      if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Unsupported file type.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_SIZE) {
        errors.push(`${file.name}: Exceeds 10MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length > 0) {
      setExtractErrors(errors);
      toast.warning(errors.join(' '));
    }

    setUploadFiles((prev) => [...prev, ...validFiles].slice(0, 5));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveUploadFile = (index) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExtractItems = async () => {
    if (uploadFiles.length === 0) {
      toast.warning('Please select files to upload.');
      return;
    }

    setIsExtracting(true);
    setExtractErrors([]);
    setExtractedItems([]);

    try {
      const formData = new FormData();
      uploadFiles.forEach((file) => {
        formData.append('files[]', file);
      });

      const response = await axios.post('/extract_assessment_items.php', formData, {
        timeout: 120000,
      });

      if (response.data?.status === 'success') {
        const items = response.data.items || [];
        if (items.length === 0) {
          toast.warning('No questions could be extracted from the uploaded files.');
          const allErrors = ['No questions found in the uploaded files.'];
          if (response.data.warnings?.length > 0) {
            allErrors.push(...response.data.warnings);
          }
          setExtractErrors(allErrors);
        } else {
          setExtractedItems(items);
          toast.success(`Extracted ${items.length} question${items.length !== 1 ? 's' : ''}. Review them below.`);
          if (response.data.warnings?.length > 0) {
            setExtractErrors(response.data.warnings);
          }
        }
      } else {
        throw new Error(response.data?.message || 'Extraction failed.');
      }
    } catch (error) {
      console.error('Extraction failed', error);
      const msg = error?.response?.data?.message || error.message || 'Extraction failed. Please try again.';
      toast.error(msg);
      setExtractErrors([msg]);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractedItemChange = (index, field, value) => {
    setExtractedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveExtractedItem = (index) => {
    setExtractedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAcceptExtractedItems = () => {
    const validItems = extractedItems.filter((item) => item.question_content?.trim());
    if (validItems.length === 0) {
      toast.warning('No valid items to add.');
      return;
    }

    const newItems = validItems.map((item, idx) => ({
      item_no: testItems.length + idx + 1,
      question_type: item.question_type || 'handwritten_algebra',
      question_content: item.question_content,
      max_score: parseFloat(item.max_score) || 1.0,
      rubric_id: item.rubric_id || null,
    }));

    newItems.forEach((item) => {
      dispatch({ type: 'ADD_TEST_ITEM', payload: item });
    });

    setExtractedItems([]);
    setUploadFiles([]);
    toast.success(`Added ${newItems.length} question${newItems.length !== 1 ? 's' : ''} to the assessment.`);
  };



  const normalizeSubjectRecord = (raw) => ({

    id: raw.subject_id ?? raw.id ?? null,

    name: raw.subject_name ?? raw.name ?? 'Untitled Subject',

    course: raw.course ?? '',

    year: raw.year ?? '',

    section: raw.section ?? '',

    subjectMeta: [raw.course ?? '', raw.year ?? '', raw.section ?? '', raw.semester ?? '', raw.school_year ?? '']
      .filter(Boolean)
      .join(' | '),

  });



  const handleAssessmentChange = (e) => {

    const { name, value } = e.target;

    dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: name, value });

  };

  const validateDetailsStep = () => {
    if (!newAssessment.title || !newAssessment.title.trim()) {
      toast.warning('Please enter an assessment title.');
      return false;
    }
    if (newAssessment.title.length > 255) {
      toast.warning('Title must be under 255 characters.');
      return false;
    }
    if (!(newAssessment.subjectIds?.length > 0)) {
      toast.warning('Please select at least one subject.');
      return false;
    }
    if (!newAssessment.topic || !newAssessment.topic.trim()) {
      toast.warning('Please enter a topic.');
      return false;
    }
    if (!newAssessment.description || !newAssessment.description.trim()) {
      toast.warning('Please provide a short description.');
      return false;
    }
    if (newAssessment.description.length > 2000) {
      toast.warning('Description must be under 2000 characters.');
      return false;
    }
    return true;
  };

  const handleOpenRubricBuilder = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        ASSESSMENT_DRAFT_STORAGE_KEY,
        JSON.stringify({
          newAssessment,
          testItems,
          selectedRubric,
          extractedItems,
          currentStep,
          mathExpression,
          previewValue,
          savedAt: new Date().toISOString(),
        })
      );
    }

    navigate('/teacher/assessments/new-rubric', {
      state: { returnToAssessment: true },
    });
  };

  const handleViewRubricDetails = (rubricIdOverride) => {
    const rubricId = rubricIdOverride || selectedRubric || questionRubricId;
    if (!rubricId) return;
    const rubric = rubrics.find(
      (r) => String(r.rubric_set_id) === String(rubricId)
    );
    if (rubric) {
      setSelectedRubricDetail(rubric);
      setShowRubricDetailModal(true);
    }
  };

  const handlePreview = () => {
    const mathValue = mathExpression.trim();
    if (!mathValue) {
      toast.warning('Enter an equation before previewing.');
      return;
    }
    const previewText = mathValue;
    dispatch({ type: 'SET_PREVIEW_VALUE', payload: previewText });
  };



  useEffect(() => {

    const email = getCurrentLocalUserEmail();

    if (!email) return;

    const storedTeacher = findLocalUser(email);

    const id = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id ?? null;

    dispatch({ type: 'SET_TEACHER_ID', payload: id });

  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedDraft = window.sessionStorage.getItem(ASSESSMENT_DRAFT_STORAGE_KEY);
    if (!savedDraft) {
      return;
    }

    try {
      const parsedDraft = JSON.parse(savedDraft);

      if (parsedDraft?.newAssessment && typeof parsedDraft.newAssessment === 'object') {
        Object.entries(parsedDraft.newAssessment).forEach(([field, value]) => {
          dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field, value: value ?? '' });
        });
      }

      if (Array.isArray(parsedDraft?.testItems)) {
        parsedDraft.testItems.forEach((item) => {
          dispatch({ type: 'ADD_TEST_ITEM', payload: item });
        });
      }

      if (parsedDraft?.selectedRubric) {
        dispatch({ type: 'SET_SELECTED_RUBRIC', payload: String(parsedDraft.selectedRubric) });
      }

      if (Array.isArray(parsedDraft?.extractedItems) && parsedDraft.extractedItems.length > 0) {
        setExtractedItems(parsedDraft.extractedItems);
      }

      if (typeof parsedDraft?.currentStep === 'number') {
        setCurrentStep(parsedDraft.currentStep);
      }

      if (parsedDraft?.previewValue) {
        dispatch({ type: 'SET_PREVIEW_VALUE', payload: String(parsedDraft.previewValue) });
      }

      if (parsedDraft?.mathExpression) {
        setMathExpression(String(parsedDraft.mathExpression));
      }
    } catch (error) {
      console.error('Unable to restore saved assessment draft', error);
    } finally {
      window.sessionStorage.removeItem(ASSESSMENT_DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(EDITOR_ITEMS_KEY);
      if (raw) {
        const savedItems = JSON.parse(raw);
        if (Array.isArray(savedItems)) {
          dispatch({ type: 'SET_TEST_ITEMS', payload: savedItems });
        }
        window.sessionStorage.removeItem(EDITOR_ITEMS_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load assessment data in edit mode
  useEffect(() => {
    if (!isEditMode || !editId) return;

    const loadAssessment = async () => {
      try {
        const response = await axios.get(`/get_assessments.php`);
        const assessments = response.data?.assessments || [];
        const assessment = assessments.find(
          (a) => String(a.exercise_id) === String(editId)
        );

        if (!assessment) {
          toast.error('Assessment not found.');
          navigate('/teacher/assessments');
          return;
        }

        // Populate form fields
        dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'title', value: assessment.title || '' });
        dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'description', value: assessment.description || '' });
        dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'topic', value: assessment.topic || '' });
        dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'difficulty', value: assessment.difficulty || 'Medium' });
        dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'dueDate', value: assessment.due_date || '' });

        // Set subject IDs
        const subjectIds = (assessment.subjects || []).map((s) => s.subject_id);
        if (subjectIds.length > 0) {
          dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'subjectIds', value: subjectIds });
          dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'subjectId', value: subjectIds[0] });
        }

        // Set rubric
        if (assessment.rubric_set_id) {
          dispatch({ type: 'SET_SELECTED_RUBRIC', payload: String(assessment.rubric_set_id) });
        }

        // Set items
        const items = (assessment.items || []).map((item, index) => ({
          item_no: index + 1,
          question_type: item.question_type || 'handwritten_algebra',
          question_content: item.question_content || '',
          question_label: item.question_label || '',
          max_score: item.max_score || 1.0,
          rubric_id: item.rubric_set_id || item.rubric_id || null,
        }));
        dispatch({ type: 'SET_TEST_ITEMS', payload: items });

      } catch (error) {
        console.error('Failed to load assessment for editing', error);
        toast.error('Failed to load assessment data.');
        navigate('/teacher/assessments');
      }
    };

    loadAssessment();
  }, [isEditMode, editId]);


  useEffect(() => {

    if (!teacherId) return;

    axios

      .get(`/get_subjects.php?teacher_id=${teacherId}`)

      .then((response) => {

        const payload = response.data || {};

        const subjectsArray = Array.isArray(payload.subjects)
          ? payload.subjects
          : Array.isArray(payload.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];

        dispatch({ type: 'SET_SUBJECTS', payload: subjectsArray.map(normalizeSubjectRecord).filter((subject) => subject.id) });

      })

      .catch((error) => {

        console.error('Failed to load subjects for assessments', error);

      });

  }, [teacherId]);

  const loadRubrics = useCallback((options = {}) => {
    if (!teacherId) {
      dispatch({ type: 'SET_RUBRICS', payload: [] });
      dispatch({ type: 'SET_SELECTED_RUBRIC', payload: '' });
      dispatch({ type: 'SET_RUBRIC_ERROR', payload: '' });
      dispatch({ type: 'SET_RUBRIC_LOADING', payload: false });
      return () => { };
    }

    let isMounted = true;
    const controller = new AbortController();

    dispatch({ type: 'SET_RUBRIC_LOADING', payload: true });
    dispatch({ type: 'SET_RUBRIC_ERROR', payload: '' });

    axios
      .get(`/get_rubric_sets.php?teacher_id=${teacherId}`, {
        signal: controller.signal,
      })
      .then((response) => {
        const payload = response.data || {};
        const rubricList = Array.isArray(payload.rubrics) ? payload.rubrics : [];

        if (!isMounted) return;

        dispatch({ type: 'SET_RUBRICS', payload: rubricList });

        const preservedSelection = options.preferredRubricId ?? selectedRubric;
        const matchingRubric = rubricList.find(
          (rubric) => String(rubric.rubric_set_id) === String(preservedSelection ?? '')
        );

        if (matchingRubric) {
          dispatch({ type: 'SET_SELECTED_RUBRIC', payload: String(matchingRubric.rubric_set_id) });
          return;
        }

        if (options.preferredRubricId) {
          const createdRubric = rubricList.find(
            (rubric) => String(rubric.rubric_set_id) === String(options.preferredRubricId)
          );
          if (createdRubric) {
            dispatch({ type: 'SET_SELECTED_RUBRIC', payload: String(createdRubric.rubric_set_id) });
            return;
          }
        }

        if (rubricList.length === 0) {
          dispatch({ type: 'SET_SELECTED_RUBRIC', payload: '' });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error('Failed to load rubrics for assessment creation', error);

        if (isMounted) {
          dispatch({
            type: 'SET_RUBRIC_ERROR',
            payload: error?.response?.data?.message || error.message || 'Unable to load rubrics.',
          });
          dispatch({ type: 'SET_RUBRICS', payload: [] });
          dispatch({ type: 'SET_SELECTED_RUBRIC', payload: '' });
        }
      })
      .finally(() => {
        if (isMounted) {
          dispatch({ type: 'SET_RUBRIC_LOADING', payload: false });
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [selectedRubric, teacherId]);

  useEffect(() => loadRubrics(), [loadRubrics]);

  useEffect(() => {
    const syncNewRubricSelection = () => {
      if (!teacherId || typeof window === 'undefined') {
        return;
      }

      const raw = window.localStorage.getItem(NEW_RUBRIC_STORAGE_KEY);
      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        if (Number(parsed?.teacherId) !== Number(teacherId) || !parsed?.rubricSetId) {
          return;
        }

        loadRubrics({ preferredRubricId: parsed.rubricSetId });
        dispatch({ type: 'SET_SELECTED_RUBRIC', payload: String(parsed.rubricSetId) });
        window.localStorage.removeItem(NEW_RUBRIC_STORAGE_KEY);
      } catch (error) {
        console.error('Unable to restore newly created rubric selection', error);
      }
    };

    syncNewRubricSelection();
    window.addEventListener('focus', syncNewRubricSelection);

    return () => {
      window.removeEventListener('focus', syncNewRubricSelection);
    };
  }, [loadRubrics, teacherId]);

  const handleAddItem = () => {
    const mathValue = mathExpression.trim();

    if (!mathValue) {

      toast.warning('Please type an equation before adding.');

      return;

    }

    dispatch({
      type: 'ADD_TEST_ITEM', payload: {
        item_no: testItems.length + 1,

        question_type: 'handwritten_algebra',

        question_content: mathValue,

        max_score: 1.0,
      }
    });

    setMathExpression('');

  };



  const handleRemoveItem = (index) => {

    dispatch({ type: 'REMOVE_TEST_ITEM', payload: index });

  };



  const validateAssessment = () => {
    if (!newAssessment.title || !newAssessment.topic || !(newAssessment.subjectIds?.length > 0)) {
      toast.warning('Please fill out all assessment fields and select at least one subject.');
      return false;
    }
    if (newAssessment.title.length > 255) {
      toast.warning('Title must be under 255 characters.');
      return false;
    }
    if (newAssessment.description && newAssessment.description.length > 2000) {
      toast.warning('Description must be under 2000 characters.');
      return false;
    }
    if (testItems.length === 0) {
      toast.warning('Please add at least one item for the assessment.');
      return false;
    }
    const hasInvalidScore = testItems.some(
      (item) => !item.max_score || item.max_score <= 0 || item.max_score > 100
    );
    if (hasInvalidScore) {
      toast.warning('Each item score must be between 0 and 100.');
      return false;
    }
    const hasEmptyContent = testItems.some(
      (item) => !item.question_content || item.question_content.trim() === ''
    );
    if (hasEmptyContent) {
      toast.warning('Each item must include question content.');
      return false;
    }
    return true;
  };

  const handleSubmitClick = (e) => {
    e.preventDefault();
    if (validateAssessment()) {
      setShowCreateConfirm(true);
    }
  };

  const handleAddAssessment = async () => {
    try {
      const payload = {
        teacher_id: teacherId,
        subject_id: Number(newAssessment.subjectIds[0]),
        subject_ids: newAssessment.subjectIds.map(Number),
        title: newAssessment.title,
        topic: newAssessment.topic,
        description: newAssessment.description,
        difficulty: newAssessment.difficulty,
        due_date: newAssessment.dueDate || null,
        items: testItems.map((item, index) => ({
          item_no: index + 1,
          question_type: item.question_type,
          question_content: item.question_content,
          max_score: item.max_score || 1.0,
          rubric_set_id: item.rubric_id || null,
        })),
        effort_minimum_guarantee: effortMinimumGuarantee,
        grading_criteria: enabledCriteria.filter((c) => c.enabled).map((c) => ({
          key: c.key,
          title: c.title,
          weight: c.weight,
        })),
        custom_grading_criteria: customCriteria.filter((c) => c.enabled !== false).map((c) => ({
          key: c.key,
          title: c.title,
          weight: c.weight,
        })),
      };

      if (isEditMode) {
        payload.exercise_id = Number(editId);
        await axios.post('/update_assessment.php', payload);
        toast.success('Assessment updated successfully!');
      } else {
        await axios.post('/create_assessment.php', payload);
        toast.success('Assessment created successfully!');
      }

      dispatch({ type: 'RESET_ASSESSMENT_FORM' });
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(ASSESSMENT_DRAFT_STORAGE_KEY);
      }
      setMathExpression('');
      setShowCreateConfirm(false);
      navigate('/teacher/assessments');
    } catch (error) {
      console.error('Failed to save assessment', error);
      toast.error('We could not save the assessment. Please try again.');
    }
  };

  const handleSaveDraft = async () => {
    if (!newAssessment.title) {
      toast.warning('Please enter a title before saving as draft.');
      return;
    }

    if (!(newAssessment.subjectIds?.length > 0)) {
      toast.warning('Please select at least one subject before saving as draft.');
      return;
    }

    try {
      const payload = {
        exercise_id: isEditMode ? Number(editId) : undefined,
        subject_ids: newAssessment.subjectIds.map(Number),
        title: newAssessment.title,
        topic: newAssessment.topic,
        description: newAssessment.description,
        difficulty: newAssessment.difficulty,
        due_date: newAssessment.dueDate || null,
        rubric_set_id: selectedRubric ? Number(selectedRubric) : null,
        items: testItems.map((item, index) => ({
          item_no: index + 1,
          question_type: item.question_type || 'handwritten_algebra',
          question_content: item.question_content,
          max_score: item.max_score || 1.0,
          rubric_set_id: item.rubric_id || null,
        })),
        effort_minimum_guarantee: effortMinimumGuarantee,
        grading_criteria: enabledCriteria.filter((c) => c.enabled).map((c) => ({
          key: c.key,
          title: c.title,
          weight: c.weight,
        })),
        custom_grading_criteria: customCriteria.filter((c) => c.enabled !== false).map((c) => ({
          key: c.key,
          title: c.title,
          weight: c.weight,
        })),
      };

      await axios.post('/save_draft.php', payload);
      toast.success('Draft saved! You can continue editing later.');

      dispatch({ type: 'RESET_ASSESSMENT_FORM' });
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(ASSESSMENT_DRAFT_STORAGE_KEY);
      }
      setMathExpression('');
      navigate('/teacher/assessments');
    } catch (error) {
      console.error('Failed to save draft', error);
      toast.error('Could not save draft. Please try again.');
    }
  };



      const modalRoot = typeof document !== 'undefined' ? document.body : null;

      if (!modalRoot) {
        return null;
      }

      return (
        <>
      {createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-950/55 px-4 py-6 backdrop-blur-md md:px-6 md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.22),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 bg-white/10" />
      <div className="relative w-full max-w-[920px]">
        <style>{`
        :root {
          --keyboard-zindex: 9999;
        }
      `}        </style>

        <div className="mx-auto rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_rgba(59,130,246,0.2)] backdrop-blur-xl">
          {/* Header with gradient */}
          <div className="relative overflow-hidden rounded-t-[2rem] bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 px-6 py-5 md:px-8">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM9 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{isEditMode ? 'Edit Assessment' : 'Create Assessment'}</h2>
                    <p className="text-sm text-blue-100/80">{isEditMode ? 'Update your assessment details and questions.' : 'Build quizzes, homework, or exams with a guided flow.'}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.sessionStorage.removeItem(ASSESSMENT_DRAFT_STORAGE_KEY);
                  }
                  navigate('/teacher/assessments');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Step indicator */}
          <div className="border-b border-slate-100 bg-slate-50/50 px-3 py-2 sm:px-6 sm:py-3 md:px-8">
            <div className="flex gap-1.5 sm:gap-2">
              {ASSESSMENT_STEPS.map((step, index) => {
                const active = index === currentStep;
                const completed = index < currentStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (index <= currentStep || validateDetailsStep()) {
                        setCurrentStep(index);
                      }
                    }}
                    className={`flex-1 rounded-lg sm:rounded-xl border px-2 py-1.5 sm:px-3 sm:py-2 text-left transition ${active ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-semibold ${active ? 'bg-blue-600 text-white' : completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {completed ? '✓' : index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[11px] sm:text-xs font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</p>
                        <p className="text-[8px] sm:text-[9px] text-slate-400 hidden sm:block">{step.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto px-6 py-6 md:px-8 md:py-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
            <form onSubmit={handleSubmitClick} className="space-y-5">
              {/* Step 1: Details */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Assessment Info</p>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Title</label>
                        <input
                          type="text"
                          name="title"
                          value={newAssessment.title}
                          onChange={handleAssessmentChange}
                          placeholder="e.g., Chapter 5 Quiz"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Subjects</label>
                        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                           <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-slate-400">
                              {(newAssessment.subjectIds?.length || 0)} selected
                            </span>
                            <span className="text-[10px] text-slate-300">
                              Same name auto-selected
                            </span>
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1.5" style={{ scrollbarWidth: 'thin' }}>
                            {subjects.map((subject) => {
                              const isChecked = newAssessment.subjectIds?.includes(subject.id);
                              const disabled = isSubjectDisabled(subject);
                              const meta = [subject.course, subject.year].filter(Boolean).join(' · ');
                              return (
                                <label
                                  key={subject.id}
                                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition ${
                                    disabled
                                      ? 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                                      : isChecked
                                        ? 'border-blue-200 bg-blue-50 cursor-pointer'
                                        : 'border-slate-100 bg-white hover:border-slate-200 cursor-pointer'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={disabled}
                                    onChange={() => toggleSubject(subject.id)}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-xs font-medium truncate ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>{subject.name}</p>
                                    {meta && (
                                      <p className="text-[10px] text-slate-400">{meta}</p>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">Select all subjects that share this assessment.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Configuration</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Topic</label>
                        <input
                          type="text"
                          name="topic"
                          value={newAssessment.topic}
                          onChange={handleAssessmentChange}
                          placeholder="e.g., Functions"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Difficulty</label>
                        <Select
                          name="difficulty"
                          value={newAssessment.difficulty}
                          onChange={handleAssessmentChange}
                        >
                          {DIFFICULTY_LEVELS.map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Schedule & Description</p>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Due Date (Optional)</label>
                        <input
                          type="datetime-local"
                          name="dueDate"
                          value={newAssessment.dueDate}
                          onChange={handleAssessmentChange}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                        <p className="mt-1 text-[10px] text-slate-400">Students will see this deadline.</p>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Description</label>
                        <textarea
                          name="description"
                          value={newAssessment.description}
                          onChange={handleAssessmentChange}
                          placeholder="Provide a short description for this assessment."
                          rows={3}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Questions — Inline Question Editor */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  {/* File Upload Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                          Upload Assessment File
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Upload an image or PDF of your assessment and let AI extract the questions.
                        </p>
                      </div>
                    </div>

                    {/* Upload area */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const files = Array.from(e.dataTransfer.files);
                        if (files.length > 0) {
                          const syntheticEvent = { target: { files } };
                          handleFileSelect(syntheticEvent);
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition cursor-pointer ${
                        isExtracting
                          ? 'border-blue-300 bg-blue-50/50'
                          : 'border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={isExtracting}
                      />
                      {isExtracting ? (
                        <>
                          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                          <p className="text-xs font-medium text-blue-600">AI is extracting questions...</p>
                          <p className="mt-1 text-[10px] text-slate-400">This may take a moment.</p>
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 20 20" fill="currentColor" className="mb-2 h-8 w-8 text-slate-400">
                            <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                          </svg>
                          <p className="text-xs font-medium text-slate-600">Click to upload or drag and drop</p>
                          <p className="mt-1 text-[10px] text-slate-400">JPG, PNG, WebP, or PDF (max 10MB each, up to 5 files)</p>
                        </>
                      )}
                    </div>

                    {/* Uploaded files list */}
                    {uploadFiles.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {uploadFiles.map((file, idx) => {
                          const isPdf = file.type === 'application/pdf';
                          const isImage = file.type.startsWith('image/');
                          const fileColor = isPdf ? 'red' : 'blue';
                          const bgColor = isPdf ? 'bg-red-50' : 'bg-blue-50';
                          const iconColor = isPdf ? 'text-red-500' : 'text-blue-500';
                          const borderColor = isPdf ? 'border-red-200' : 'border-blue-200';
                          const hoverBg = isPdf ? 'hover:bg-red-100' : 'hover:bg-blue-100';
                          return (
                            <div
                              key={`${file.name}-${idx}`}
                              className={`flex items-center gap-2.5 rounded-xl border ${borderColor} ${bgColor} px-3 py-2.5 transition hover:shadow-sm`}
                            >
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isPdf ? 'bg-red-100' : 'bg-blue-100'}`}>
                                {isPdf ? (
                                  <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${iconColor}`}>
                                    <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${iconColor}`}>
                                    <path fillRule="evenodd" d="M1 4a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V4zm9 0v12H3V4h7zM6 8.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 3a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 3a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-slate-700">{file.name}</p>
                                <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveUploadFile(idx)}
                                disabled={isExtracting}
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${hoverBg} text-slate-400 transition hover:text-red-500 disabled:opacity-50`}
                              >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Extract button */}
                    {uploadFiles.length > 0 && extractedItems.length === 0 && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleExtractItems}
                          disabled={isExtracting}
                          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:from-purple-700 hover:to-indigo-700 hover:shadow-lg active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isExtracting ? (
                            <>
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              Extracting...
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.683a1 1 0 01.633.633l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
                              </svg>
                              Extract Questions with AI
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Extraction errors */}
                    {extractErrors.length > 0 && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        {extractErrors.map((err, idx) => (
                          <p key={idx} className="text-[11px] text-amber-700">{err}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Extracted Items Review */}
                  {extractedItems.length > 0 && (
                    <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-4 sm:p-5 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-500">
                            Extracted Questions ({extractedItems.length})
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Review and edit the extracted questions before adding them.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExtractedItems([])}
                          className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {extractedItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-purple-200 bg-white p-3 transition hover:border-purple-300"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-[10px] font-bold text-purple-700">
                                {idx + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <textarea
                                  value={item.question_content}
                                  onChange={(e) => handleExtractedItemChange(idx, 'question_content', e.target.value)}
                                  rows={2}
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                                  placeholder="Question content..."
                                />
                                <div className="mt-1.5 flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400">Score:</span>
                                  <input
                                    type="number"
                                    min="0.5"
                                    max="10"
                                    step="0.5"
                                    defaultValue={item.max_score}
                                    onChange={(e) => handleExtractedItemChange(idx, 'max_score', parseFloat(e.target.value) || 5.0)}
                                    onFocus={(e) => { e.target.dataset.prevValue = e.target.value; e.target.value = ''; }}
                                    onBlur={(e) => { if (e.target.value === '' || parseFloat(e.target.value) <= 0) { const prev = e.target.dataset.prevValue || '5'; e.target.value = prev; handleExtractedItemChange(idx, 'max_score', parseFloat(prev) || 5.0); } else { handleExtractedItemChange(idx, 'max_score', parseFloat(e.target.value) || 5.0); }}}
                                    className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-[11px] font-semibold text-slate-700 outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-100"
                                  />
                                  <span className="text-[10px] text-slate-400">pts</span>
                                </div>
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0 text-slate-400">
                                    <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                                  </svg>
                                  <select
                                    value={item.rubric_id || ''}
                                    onChange={(e) => handleExtractedItemChange(idx, 'rubric_id', e.target.value || null)}
                                    className="min-w-0 flex-1 appearance-none rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1 text-[10px] font-medium text-slate-600 outline-none transition hover:border-slate-300 hover:bg-white focus:border-purple-300 focus:ring-1 focus:ring-purple-100"
                                  >
                                    <option value="">Default Rubric (AI Grading)</option>
                                    {[...rubrics].sort((a, b) => {
                                      const order = { procedural_algebra: 0, problem_solving: 1, general: 2 };
                                      return (order[a.rubric_type] ?? 3) - (order[b.rubric_type] ?? 3);
                                    }).map((r) => (
                                      <option key={r.rubric_set_id} value={r.rubric_set_id}>
                                        {r.rubric_name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={handleOpenRubricBuilder}
                                    className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-1.5 py-1 text-[10px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                  >
                                    + New
                                  </button>
                                  {item.rubric_id ? (
                                    <button
                                      type="button"
                                      onClick={() => handleViewRubricDetails(item.rubric_id)}
                                      className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                    >
                                      Details
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setShowDefaultRubricModal(true)}
                                        className="shrink-0 rounded-lg border border-blue-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-blue-600 transition hover:bg-blue-50"
                                      >
                                        Details
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setShowModifyCriteriaModal(true)}
                                        className="shrink-0 rounded-lg border border-amber-300 bg-white px-1.5 py-1 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100"
                                      >
                                        Modify
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveExtractedItem(idx)}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                              </button>
                            </div>
                            {item.question_content && (
                              <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">Preview</p>
                                <div className="text-xs text-slate-700">
                                  <MathText text={item.question_content} />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleAcceptExtractedItems}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-700 hover:shadow-lg active:scale-[0.97]"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                          Add to Assessment
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Manual Question Input (for problem-solving) */}
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 sm:p-5 shadow-sm">
                    <div className="mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-600">
                        Add Problem-Solving Question
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Type or paste a question directly — great for word problems and open-ended questions.
                      </p>
                    </div>
                    <textarea
                      value={manualQuestionText}
                      onChange={(e) => setManualQuestionText(e.target.value)}
                      rows={3}
                      placeholder="e.g. A farmer has 3 times as many chickens as ducks. If he has 24 chickens, how many ducks does he have? Show your reasoning."
                      className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-500">Score:</span>
                        <input
                          type="number"
                          min="0.5"
                          max="100"
                          step="0.5"
                          value={manualQuestionScore}
                          onFocus={(e) => { e.target.dataset.prevValue = e.target.value; e.target.value = ''; }}
                          onBlur={(e) => { if (e.target.value === '' || parseFloat(e.target.value) <= 0) { const prev = e.target.dataset.prevValue || '5.0'; e.target.value = prev; setManualQuestionScore(prev); } else { setManualQuestionScore(e.target.value); }}}
                          onChange={(e) => setManualQuestionScore(e.target.value)}
                          className="w-16 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-center text-[11px] font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span className="text-[10px] text-slate-400">pts</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddManualQuestion}
                        disabled={!manualQuestionText.trim()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        Add Question
                      </button>
                    </div>
                  </div>

                  {/* Grading Criteria */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Grading Criteria</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-slate-400">
                          <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                        </svg>
                        <Select
                          value={selectedRubric}
                          onChange={(e) => dispatch({ type: 'SET_SELECTED_RUBRIC', payload: e.target.value })}
                          className="flex-1 text-[11px]"
                        >
                          <option value="">Default Rubric (AI Grading)</option>
                          {[...rubrics].sort((a, b) => {
                            const order = { procedural_algebra: 0, problem_solving: 1, general: 2 };
                            return (order[a.rubric_type] ?? 3) - (order[b.rubric_type] ?? 3);
                          }).map((rubric) => (
                            <option key={rubric.rubric_set_id} value={rubric.rubric_set_id}>
                              {rubric.rubric_name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenRubricBuilder}
                        className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                      >
                        + New
                      </button>
                      {selectedRubric ? (
                        <button
                          type="button"
                          onClick={() => handleViewRubricDetails(selectedRubric)}
                          className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                        >
                          View Details
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowDefaultRubricModal(true)}
                          className="shrink-0 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-blue-600 transition hover:bg-blue-50"
                        >
                          View Details
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowModifyCriteriaModal(true)}
                        className="shrink-0 rounded-full border border-amber-300 bg-white px-2 py-1.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100"
                      >
                        Modify Criteria
                      </button>
                    </div>
                    {!selectedRubric && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">AI Default Grading</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {DEFAULT_GRADING_CRITERIA.map((c) => (
                            <span key={c.key} className="text-[10px] text-amber-700/80">
                              {c.icon} {c.title} <span className="font-semibold">{c.weight}%</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                   </div>

                  {/* Questions list */}
                  {testItems.length > 0 ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragCancel={handleDragCancel}
                    >
                      <div className="rounded-2xl border border-slate-200 bg-white">
                        <p className="border-b border-slate-100 px-4 sm:px-5 py-2.5 sm:py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                          Questions ({testItems.length}) · {testItems.reduce((s, it) => s + (it.max_score || 0), 0)} total pts
                          <span className="ml-2 text-slate-300 normal-case tracking-normal">· Drag to reorder</span>
                        </p>
                        <div className="p-3 sm:p-4 space-y-2.5">
                          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                            {testItems.map((item, index) => (
                              <SortableQuestion
                                key={sortableIds[index]}
                                id={sortableIds[index]}
                                item={item}
                                index={index}
                                rubrics={rubrics}
                                onEdit={handleEditQuestion}
                                onRemove={handleRemoveQuestion}
                                onRubricChange={handleRubricChange}
                              />
                            ))}
                          </SortableContext>
                        </div>
                      </div>
                      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                        {activeId !== null ? (
                          <DragOverlayQuestion
                            item={testItems[sortableIds.indexOf(activeId)]}
                            index={sortableIds.indexOf(activeId)}
                            rubrics={rubrics}
                          />
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-8 text-center">
                      <p className="text-sm font-medium text-slate-500">No questions yet</p>
                      <p className="mt-1 text-xs text-slate-400">Type a question above and click "Add Question".</p>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                {currentStep > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:px-4 sm:py-2 sm:text-xs"
                  >
                    ← Back
                  </button>
                ) : (
                  <span />
                )}
                {currentStep < ASSESSMENT_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (validateDetailsStep()) {
                        setCurrentStep((prev) => Math.min(ASSESSMENT_STEPS.length - 1, prev + 1));
                      }
                    }}
                    className="rounded-full bg-blue-600 px-4 py-2 text-[11px] font-semibold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 hover:shadow-lg active:scale-[0.97] sm:px-5 sm:py-2 sm:text-xs"
                  >
                    Continue →
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97] sm:px-4 sm:py-2 sm:text-xs"
                    >
                      Save as Draft
                    </button>
                    <button
                      type="submit"
                      className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-[11px] font-semibold text-white shadow-lg shadow-blue-200/60 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.97] sm:px-6 sm:py-2.5 sm:text-xs"
                    >
                      {isEditMode ? 'Update Assessment' : 'Create Assessment'}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  )}
      <DefaultRubricModal
        isOpen={showDefaultRubricModal}
        onClose={() => setShowDefaultRubricModal(false)}
        totalScore={testItems.reduce((s, it) => s + (it.max_score || 0), 0)}
      />
      <ModifyCriteriaModal
        isOpen={showModifyCriteriaModal}
        onClose={() => setShowModifyCriteriaModal(false)}
        enabledCriteria={enabledCriteria}
        customCriteria={customCriteria}
        onToggleDefault={toggleDefaultCriterion}
        onToggleCustom={toggleCustomCriterion}
        onUpdateDefaultWeight={(key, val) =>
          setEnabledCriteria(enabledCriteria.map((x) =>
            x.key === key ? { ...x, weight: val } : x
          ))
        }
        onUpdateCustomWeight={(key, val) =>
          setCustomCriteria(customCriteria.map((x) =>
            x.key === key ? { ...x, weight: val } : x
          ))
        }
        onRemoveCustom={removeCustomCriterion}
        onAddCustom={addCustomCriterion}
        newCriterionName={newCriterionName}
        setNewCriterionName={setNewCriterionName}
        newCriterionDesc={newCriterionDesc}
        setNewCriterionDesc={setNewCriterionDesc}
        effortMinimumGuarantee={effortMinimumGuarantee}
        setEffortMinimumGuarantee={setEffortMinimumGuarantee}
        rubrics={rubrics}
        selectedRubricObj={rubrics.find((r) => String(r.rubric_set_id) === String(selectedRubric)) || null}
        setEnabledCriteria={setEnabledCriteria}
        setCustomCriteria={setCustomCriteria}
      />
      <RubricDetailModal
        isOpen={showRubricDetailModal}
        onClose={() => { setShowRubricDetailModal(false); setSelectedRubricDetail(null); }}
        rubric={selectedRubricDetail}
        teacherId={teacherId}
        onSaved={() => loadRubrics()}
      />

      {/* Edit Question Floating Card */}
      {editingIndex !== null && createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm" onClick={() => { setEditingIndex(null); setMathExpression(''); setQuestionScore('1.0'); setQuestionRubricId(''); }}>
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.28)]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="relative bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/90">
                      Question {editingIndex + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/25 px-2 py-0.5 text-[9px] font-bold text-amber-100">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                      </svg>
                      Editing
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Edit Question</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingIndex(null); setMathExpression(''); setQuestionScore('1.0'); setQuestionRubricId(''); }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/20 hover:text-white"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {/* Points badge */}
              <div className="mb-4 flex items-center justify-end">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  <input
                    type="number"
                    min="0.5"
                    max="100"
                    step="0.5"
                    value={questionScore}
                    onChange={(e) => setQuestionScore(e.target.value)}
                    className="w-10 bg-transparent text-center text-[11px] font-bold text-slate-600 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  pts
                </span>
              </div>

              {/* Per-item rubric selector */}
              <div className="mb-4">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Rubric for this question</label>
                <div className="flex items-center gap-2">
                  <Select
                    value={questionRubricId}
                    onChange={(e) => setQuestionRubricId(e.target.value)}
                    className="flex-1 text-[11px]"
                  >
                    <option value="">Default (uses assessment rubric)</option>
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
                    onClick={handleOpenRubricBuilder}
                    className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-600 transition hover:bg-blue-100"
                  >
                    + New
                  </button>
                </div>
              </div>

              {/* Editor area */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 shadow-inner transition focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100">
                <MathEditor
                  ref={mathEditorRef}
                  value={mathExpression}
                  onChange={setMathExpression}
                  placeholder="Type a question... e.g. Solve for x: 2x + 3 = 7"
                  style={{ minHeight: '7rem', maxHeight: '14rem', overflowY: 'auto' }}
                  showKeyboard={showMathKeyboard}
                  onToggleKeyboard={() => setShowMathKeyboard((v) => !v)}
                />
                {mathExpression.trim() && hasLatexPatterns(mathExpression) && (
                  <div className="border-t border-slate-200 bg-white px-4 py-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Preview</p>
                    </div>
                    <div className="text-sm leading-6 text-slate-800">
                      <MathText text={mathExpression} />
                    </div>
                  </div>
                )}
              </div>

              {/* Math hints panel */}
              {showMathKeyboard && (
                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-blue-500">Quick Type Hints</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Fraction', example: '\\frac{a}{b}' },
                      { label: 'Square Root', example: '\\sqrt{x}' },
                      { label: 'Power', example: 'x^2' },
                      { label: 'Subscript', example: 'x_1' },
                      { label: 'Greek', example: '\\alpha' },
                      { label: 'Integral', example: '\\int_{a}^{b}' },
                    ].map((hint) => (
                      <button
                        key={hint.label}
                        type="button"
                        onClick={() => { mathEditorRef.current?.insertMath?.(hint.example); }}
                        className="rounded-lg border border-blue-200/60 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        {hint.label}: <span className="font-mono text-[10px] text-slate-400">{hint.example}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3">
              <button
                type="button"
                onClick={() => setShowMathKeyboard((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${showMathKeyboard ? 'rotate-180' : ''}`}>
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
                {showMathKeyboard ? 'Hide Hints' : 'Show Hints'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setEditingIndex(null); setMathExpression(''); setQuestionScore('1.0'); setQuestionRubricId(''); }}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-200/60 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg active:scale-[0.97]"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  Update Question
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Create/Update Assessment Modal */}
      {showCreateConfirm && createPortal(
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm" onClick={() => setShowCreateConfirm(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.35)]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={`bg-gradient-to-br px-6 py-5 ${isEditMode ? 'from-amber-500 via-amber-600 to-orange-600' : 'from-blue-600 via-blue-600 to-indigo-600'}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  {isEditMode ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zM8.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{isEditMode ? 'Update Assessment' : 'Create Assessment'}</h3>
                  <p className="text-sm text-white/70">{isEditMode ? 'Save changes to this assessment?' : 'Ready to publish this assessment?'}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                {isEditMode
                  ? 'This will update the assessment with your latest changes. Students will see the updated version.'
                  : 'This will create and publish the assessment. Students enrolled in the selected subjects will be able to view and attempt it.'}
              </p>

              {/* Summary */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Title</span>
                  <span className="font-semibold text-slate-800 max-w-[200px] truncate">{newAssessment.title}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Questions</span>
                  <span className="font-semibold text-slate-800">{testItems.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Points</span>
                  <span className="font-semibold text-amber-600">{testItems.reduce((s, it) => s + (it.max_score || 0), 0)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Subjects</span>
                  <span className="font-semibold text-slate-800">
                    {subjects.filter((s) => newAssessment.subjectIds?.includes(s.id)).map((s) => s.name).join(', ') || 'None'}
                  </span>
                </div>
                {newAssessment.difficulty && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Difficulty</span>
                    <span className="font-semibold text-slate-800">{newAssessment.difficulty}</span>
                  </div>
                )}
                {newAssessment.dueDate && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Due Date</span>
                    <span className="font-semibold text-slate-800">{new Date(newAssessment.dueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowCreateConfirm(false)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97]"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleAddAssessment}
                className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] ${
                  isEditMode
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-200/60 hover:from-amber-600 hover:to-orange-700'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-200/60 hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                {isEditMode ? 'Yes, Update' : 'Yes, Create'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
        </>
      );

};

const CRITERIA_DETAILS = [
  {
    key: 'understanding',
    title: 'Problem Understanding & Attempt',
    weight: 25,
    icon: '★',
    description: 'Visible effort, identification of given information, variable setup.',
    whatAiLooksFor: [
      'Student identified given information',
      'Variables are defined or attempted',
      'Problem is set up correctly or with reasonable effort',
      'Evidence of understanding the problem',
    ],
    scoringGuide: [
      { label: 'Excellent', range: 'Full marks', detail: 'Clearly identified given info, defined variables, and set up the problem with strong understanding.' },
      { label: 'Satisfactory', range: 'Partial', detail: 'Showed visible effort and reasonable attempt, but setup is incomplete or partially unclear.' },
      { label: 'No Attempt', range: '0 pts', detail: 'Submission is blank or contains no relevant work.' },
    ],
    example: (total) => {
      const pts = Math.round((25 / 100) * total * 10) / 10;
      return `If the student clearly sets up the problem, this criterion contributes up to ${pts} points toward the item's total.`;
    },
  },
  {
    key: 'method',
    title: 'Algebraic Method & Setup',
    weight: 25,
    icon: '→',
    description: 'Appropriate equation, formula, or method selected and applied.',
    whatAiLooksFor: [
      'Correct method or formula chosen',
      'Appropriate to the problem type',
      'Applied correctly with proper setup',
      'No major method selection errors',
    ],
    scoringGuide: [
      { label: 'Excellent', range: 'Full marks', detail: 'Selected and perfectly applied an appropriate equation, formula, or method.' },
      { label: 'Satisfactory', range: 'Partial', detail: 'Chose a reasonable method but applied it with minor errors in setup.' },
      { label: 'Wrong/Missing', range: '0 pts', detail: 'Used an inappropriate method or omitted setup entirely.' },
    ],
    example: (total) => {
      const pts = Math.round((25 / 100) * total * 10) / 10;
      return `If the student uses the correct formula, this criterion contributes up to ${pts} points toward the item's total.`;
    },
  },
  {
    key: 'process',
    title: 'Process & Logical Reasoning',
    weight: 25,
    icon: '■',
    description: 'Complete, sequential steps with clear mathematical reasoning.',
    whatAiLooksFor: [
      'Steps are complete and sequential',
      'Each step logically follows from the previous one',
      'Mathematical reasoning is clear',
      'No missing critical steps',
    ],
    scoringGuide: [
      { label: 'Excellent', range: 'Full marks', detail: 'Steps are complete, sequential, and demonstrate clear mathematical reasoning.' },
      { label: 'Satisfactory', range: 'Partial', detail: 'Most steps are correct, but one or more are missing, unclear, or disorganized.' },
      { label: 'Wrong/Missing', range: '0 pts', detail: 'Steps are mostly incorrect, disorganized, or illegible.' },
    ],
    example: (total) => {
      const pts = Math.round((25 / 100) * total * 10) / 10;
      return `If the student shows clear step-by-step work, this criterion contributes up to ${pts} points toward the item's total.`;
    },
  },
  {
    key: 'accuracy',
    title: 'Final Answer & Accuracy',
    weight: 25,
    icon: '✓',
    description: 'Correct final answer with proper form.',
    whatAiLooksFor: [
      'Final answer is correct',
      'Answer is properly simplified',
      'Correct formatting and form',
      'No arithmetic errors',
    ],
    scoringGuide: [
      { label: 'Excellent', range: 'Full marks', detail: 'Final answer is completely correct with proper form.' },
      { label: 'Satisfactory', range: 'Partial', detail: 'Correct method with a single minor arithmetic error; answer is nearly correct.' },
      { label: 'Wrong/Missing', range: '0 pts', detail: 'Final answer is completely incorrect, unreadable, or missing.' },
    ],
    example: (total) => {
      const pts = Math.round((25 / 100) * total * 10) / 10;
      return `If the final answer is correct, this criterion contributes up to ${pts} points toward the item's total.`;
    },
  },
];

const DefaultRubricModal = ({ isOpen, onClose, totalScore = 0 }) => {
  const [expandedCriterion, setExpandedCriterion] = React.useState(null);

  if (!isOpen) return null;

  const modalRoot = typeof document !== 'undefined' ? document.body : null;
  if (!modalRoot) return null;

  const toggleCriterion = (key) => {
    setExpandedCriterion(expandedCriterion === key ? null : key);
  };

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-950/60 px-4 py-6 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[90vh]">
        <div className="mx-auto flex max-h-[90vh] flex-col rounded-2xl border border-white/60 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Default AI Grading Criteria</h3>
                <p className="text-[11px] text-slate-400">How the AI evaluates submissions without a custom rubric</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Body - scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
            
            {/* Overview */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-xs font-semibold text-amber-800 mb-2">How AI Grading Works</p>
              <p className="text-xs text-amber-700/80 leading-relaxed">
                When you create an assessment <strong>without a rubric</strong>, the AI automatically grades student submissions using these 4 built-in criteria. 
                The AI evaluates each item on your configured max score using the criteria as a guide.
              </p>

              {/* Sample Calculation - Always show */}
              <div className="mt-3 rounded-lg bg-white/80 border border-amber-200/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2">
                  {totalScore > 0 ? `Your Assessment Total: ${totalScore} points` : 'Example: Assessment with 20 points'}
                </p>
                <div className="space-y-1">
                  {DEFAULT_GRADING_CRITERIA.map((c) => {
                    const pts = Math.round((c.weight / 100) * 20 * 10) / 10;
                    return (
                      <div key={c.key} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{c.icon} {c.title}</span>
                        <span className="font-mono font-semibold text-amber-700">{c.weight}% × 20 = <span className="text-blue-600">{pts} pts</span></span>
                      </div>
                    );
                  })}
                  <div className="border-t border-amber-200/60 mt-2 pt-2 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">Total</span>
                    <span className="font-mono text-blue-600">20 pts</span>
                  </div>
                </div>
              </div>

              {/* If teacher has added questions, show their actual breakdown too */}
              {totalScore > 0 && totalScore !== 20 && (
                <div className="mt-2 rounded-lg bg-blue-50/80 border border-blue-200/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-2">Your Assessment: {totalScore} points</p>
                  <div className="space-y-1">
                    {DEFAULT_GRADING_CRITERIA.map((c) => {
                      const pts = Math.round((c.weight / 100) * totalScore * 10) / 10;
                      return (
                        <div key={c.key} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{c.icon} {c.title}</span>
                          <span className="font-mono font-semibold text-blue-700">{c.weight}% × {totalScore} = <span className="text-emerald-600">{pts} pts</span></span>
                        </div>
                      );
                    })}
                    <div className="border-t border-blue-200/60 mt-2 pt-2 flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">Total</span>
                      <span className="font-mono text-emerald-600">{totalScore} pts</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step-by-Step Process */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-semibold text-blue-800 mb-2">Step-by-Step Scoring Process</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">1</span>
                  <p className="text-xs text-blue-700/80"><strong>Read Submission:</strong> AI reads the student's handwritten work using OCR (image → text).</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">2</span>
                  <p className="text-xs text-blue-700/80"><strong>Evaluate Each Criterion:</strong> AI scores the work against each of the 4 criteria as a guide.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">3</span>
                  <p className="text-xs text-blue-700/80"><strong>Award Points:</strong> AI assigns a holistic score from 0 to the item's max score based on quality.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">4</span>
                  <p className="text-xs text-blue-700/80"><strong>Calculate Total:</strong> Sum all earned points → final score for the item.</p>
                </div>
              </div>
            </div>

            {/* Criteria Details */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Criteria Breakdown</p>
              {CRITERIA_DETAILS.map((c, i) => {
                const examplePoints = Math.round((c.weight / 100) * 20 * 10) / 10;
                const calculatedPoints = totalScore > 0 ? Math.round((c.weight / 100) * totalScore * 10) / 10 : examplePoints;
                const isExpanded = expandedCriterion === c.key;
                return (
                  <div key={c.key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    {/* Criterion Header */}
                    <button
                      type="button"
                      onClick={() => toggleCriterion(c.key)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition text-left"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-xs font-bold text-white shadow-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">{c.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-600">{c.weight}%</span>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              {calculatedPoints} pts
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">{c.description}</p>
                      </div>
                      <svg 
                        viewBox="0 0 20 20" 
                        fill="currentColor" 
                        className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 space-y-3">
                        {/* What AI Looks For */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">What the AI Looks For</p>
                          <ul className="space-y-1">
                            {c.whatAiLooksFor.map((item, idx) => (
                              <li key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                                <span className="text-emerald-500">✓</span> {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Scoring Guide */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Scoring Guide</p>
                          <div className="space-y-1.5">
                            {c.scoringGuide.map((guide, idx) => (
                              <div key={idx} className="flex items-start gap-2 rounded-lg bg-white border border-slate-100 px-2.5 py-1.5">
                                <span className="shrink-0 text-[10px] font-bold text-blue-600 w-20">{guide.range}</span>
                                <span className="text-[11px] text-slate-600">{guide.detail}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Example */}
                        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">Example Calculation (20 pts)</p>
                          <p className="text-xs text-blue-700/80 leading-relaxed">{c.example(20)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Effort Minimum Rule */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 text-lg">★</span>
                <div>
                  <p className="text-xs font-semibold text-emerald-800">Baseline Floor Guarantee</p>
                  <p className="mt-1 text-xs text-emerald-700/80 leading-relaxed">
                    Students who submit visible work receive a <strong>minimum of 1 point per item</strong>, even if all criteria are scored as wrong. 
                    This encourages students to attempt every problem rather than leave submissions blank.
                  </p>
                  <p className="mt-1 text-xs text-emerald-700/80">
                    <strong>Partial Credit:</strong> If the final answer has a minor error, points earned in Criteria 1-3 are preserved.
                  </p>
                </div>
              </div>
            </div>

            {/* Final Score Calculation */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-800 mb-2">Final Score Formula</p>
              <div className="rounded-lg bg-white border border-slate-200 px-4 py-3 font-mono text-sm text-slate-700 text-center">
                Item Score = 0 to max_score (based on 4 criteria evaluation)
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Scoring Guide:</p>
                <div className="space-y-1 text-xs px-2">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-600 font-semibold">Excellent</span>
                    <span className="text-slate-600">near full marks — strong on all criteria</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600 font-semibold">Good</span>
                    <span className="text-slate-600">70–89% — minor errors</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-600 font-semibold">Satisfactory</span>
                    <span className="text-slate-600">40–69% — some gaps</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-500 font-semibold">Needs Improvement</span>
                    <span className="text-slate-600">1–39% — minimal correct</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">No Attempt</span>
                    <span className="text-slate-600">0 points</span>
                  </div>
                </div>
                <div className="border-t border-slate-200 mt-2 pt-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Example with 20 points max:</p>
                  {DEFAULT_GRADING_CRITERIA.map((c) => {
                    const pts = Math.round((c.weight / 100) * 20 * 10) / 10;
                    return (
                      <div key={c.key} className="flex items-center justify-between text-xs px-2">
                        <span className="text-slate-600">{c.title}</span>
                        <span className="font-mono text-slate-700">guides evaluation</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-slate-200 mt-2 pt-2 flex items-center justify-between text-xs font-bold px-2">
                    <span className="text-slate-700">Maximum Score</span>
                    <span className="font-mono text-blue-600">20 pts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - fixed */}
          <div className="flex shrink-0 items-center justify-end border-t border-slate-100 px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-800 px-5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 active:scale-[0.97]"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
};

const ModifyCriteriaModal = ({
  isOpen,
  onClose,
  enabledCriteria,
  customCriteria,
  onToggleDefault,
  onToggleCustom,
  onUpdateDefaultWeight,
  onUpdateCustomWeight,
  onRemoveCustom,
  onAddCustom,
  newCriterionName,
  setNewCriterionName,
  newCriterionDesc,
  setNewCriterionDesc,
  effortMinimumGuarantee,
  setEffortMinimumGuarantee,
  selectedRubricObj,
  setEnabledCriteria,
  setCustomCriteria,
}) => {
  if (!isOpen) return null;

  const modalRoot = typeof document !== 'undefined' ? document.body : null;
  if (!modalRoot) return null;

  const isUsingSavedRubric = selectedRubricObj && Array.isArray(selectedRubricObj.items) && selectedRubricObj.items.length > 0;
  const rubricItems = isUsingSavedRubric ? selectedRubricObj.items : [];

  const rubricTotal = rubricItems.reduce((s, it) => s + (it.points || 0), 0);

  const rubricWeights = isUsingSavedRubric ? rubricItems.map((item, idx) => {
    const criterion = enabledCriteria.find((c) => c.key === `rubric-${selectedRubricObj.rubric_set_id}-${idx}`);
    return criterion?.weight ?? (rubricTotal > 0 ? Math.round((item.points / rubricTotal) * 100) : 0);
  }) : [];

  const totalWeight =
    (isUsingSavedRubric
      ? rubricWeights.reduce((s, w) => s + w, 0)
      : enabledCriteria.filter((c) => c.enabled).reduce((s, c) => s + c.weight, 0)) +
    customCriteria.filter((c) => c.enabled !== false).reduce((s, c) => s + c.weight, 0);
  const activeCount =
    (isUsingSavedRubric
      ? rubricItems.length
      : enabledCriteria.filter((c) => c.enabled).length) +
    customCriteria.filter((c) => c.enabled !== false).length;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-950/60 px-4 py-6 backdrop-blur-md">
      <div className="relative w-full max-w-xl">
        <div className="mx-auto flex h-[620px] max-h-[88vh] flex-col rounded-2xl border border-white/60 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-sm">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Modify AI Grading Criteria</h3>
                <p className="text-[11px] text-slate-400">
                  {isUsingSavedRubric
                    ? `Editing: ${selectedRubricObj.rubric_name}`
                    : 'Toggle default criteria, adjust weights, and add your own'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Body - scrollable */}
          <div className="teacher-scrollbar flex-1 overflow-y-auto px-6 py-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#94a3b8 #f1f5f9' }}>

            {/* Saved Rubric Breakdown */}
            {isUsingSavedRubric && (() => {
              return (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {selectedRubricObj.rubric_name} — Breakdown
                  </p>
                  <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {rubricItems.length} criteria
                  </span>
                </div>
                {selectedRubricObj.criteria && (
                  <p className="mb-2 text-[11px] text-slate-500 leading-4">{selectedRubricObj.criteria}</p>
                )}
                {selectedRubricObj.ai_instructions && (
                  <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-2">
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-blue-600">AI Instructions</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{selectedRubricObj.ai_instructions}</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  {rubricItems.map((item, idx) => {
                    const criterion = enabledCriteria.find((c) => c.key === `rubric-${selectedRubricObj.rubric_set_id}-${idx}`);
                    const isEnabled = criterion?.enabled ?? true;
                    const weight = criterion?.weight ?? (rubricTotal > 0 ? Math.round((item.points / rubricTotal) * 100) : 0);
                    return (
                      <div
                        key={item.rubric_item_id || idx}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${
                          isEnabled
                            ? 'border-blue-200 bg-white'
                            : 'border-slate-200 bg-slate-50 opacity-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => onToggleDefault(`rubric-${selectedRubricObj.rubric_set_id}-${idx}`)}
                          className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-slate-700 block truncate">{item.description || `Criterion ${idx + 1}`}</span>
                          {item.min_points > 0 && (
                            <span className="text-[9px] text-amber-600">Min: {item.min_points} pts</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={weight}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              onUpdateDefaultWeight(`rubric-${selectedRubricObj.rubric_set_id}-${idx}`, val);
                            }}
                            className={`w-14 rounded-lg border px-1.5 py-0.5 text-center text-[10px] font-bold outline-none focus:ring-1 ${totalWeight > 100 ? 'border-red-300 text-red-600 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 text-blue-600 focus:border-blue-400 focus:ring-blue-100'}`}
                          />
                          <span className="text-[10px] text-slate-400">%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {/* Default Criteria (shown when no rubric selected) */}
            {!isUsingSavedRubric && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Default Criteria</p>
                <div className="space-y-1.5">
                  {enabledCriteria.map((c) => (
                    <div
                      key={c.key}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${
                        c.enabled
                          ? 'border-blue-200 bg-white'
                          : 'border-slate-200 bg-slate-50 opacity-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={() => onToggleDefault(c.key)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-700 flex-1">{c.icon} {c.title}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="5"
                        value={c.weight}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          onUpdateDefaultWeight(c.key, val);
                        }}
                        className={`w-14 rounded-lg border px-1.5 py-0.5 text-center text-[10px] font-bold outline-none focus:ring-1 ${totalWeight > 100 ? 'border-red-300 text-red-600 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 text-blue-600 focus:border-blue-400 focus:ring-blue-100'}`}
                      />
                      <span className="text-[10px] text-slate-400">%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Effort Minimum Guarantee */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Effort Minimum Guarantee</p>
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
                <p className="text-[11px] text-slate-600 mb-3">
                  Guarantee a minimum score for students who show a meaningful attempt, even if other criteria score low.
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.5"
                      value={effortMinimumGuarantee}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(5, parseFloat(e.target.value) || 0));
                        setEffortMinimumGuarantee(val);
                      }}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm font-bold text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-outer-spin-button]:appearance-auto"
                    />
                    <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">PTS</span>
                  </div>
                  <p className="text-[10px] text-amber-600/80 flex-1">
                    {effortMinimumGuarantee > 0
                      ? `Students with a relevant attempt will receive at least ${effortMinimumGuarantee} point${effortMinimumGuarantee !== 1 ? 's' : ''} regardless of other scores.`
                      : 'No minimum guarantee — scores are based purely on criteria weights.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Custom criteria list */}
            {customCriteria.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Custom Criteria</p>
                <div className="space-y-1.5">
                  {customCriteria.map((c) => {
                    const isEnabled = c.enabled !== false;
                    return (
                      <div
                        key={c.key}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${
                          isEnabled
                            ? 'border-blue-200 bg-white'
                            : 'border-slate-200 bg-slate-50 opacity-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => onToggleCustom(c.key)}
                          className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-700 flex-1">+ {c.title}</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="5"
                          value={c.weight}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                            onUpdateCustomWeight(c.key, val);
                          }}
                          className={`w-14 rounded-lg border px-1.5 py-0.5 text-center text-[10px] font-bold outline-none focus:ring-1 ${totalWeight > 100 ? 'border-red-300 text-red-600 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 text-blue-600 focus:border-blue-400 focus:ring-blue-100'}`}
                        />
                        <span className="text-[10px] text-slate-400">%</span>
                        <button
                          type="button"
                          onClick={() => onRemoveCustom(c.key)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add new criterion */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Add Custom Criterion</p>
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-2.5 space-y-2">
                <input
                  type="text"
                  value={newCriterionName}
                  onChange={(e) => setNewCriterionName(e.target.value)}
                  placeholder="New criterion name"
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <input
                  type="text"
                  value={newCriterionDesc}
                  onChange={(e) => setNewCriterionDesc(e.target.value)}
                  placeholder="What the AI looks for (optional)"
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={onAddCustom}
                  disabled={!newCriterionName.trim()}
                  className="flex items-center justify-center gap-1 w-full rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  Confirm
                </button>
              </div>
            </div>

            {/* Total weight */}
            <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${totalWeight > 100 ? 'border-red-200 bg-red-50' : totalWeight === 100 ? 'border-emerald-200 bg-emerald-50' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-[11px] text-slate-500">
                {activeCount} criteria active
              </span>
              <span className={`text-[11px] font-bold ${totalWeight === 100 ? 'text-emerald-600' : totalWeight > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                Total: {totalWeight}%
              </span>
            </div>
            {totalWeight > 100 && (
              <p className="mt-1.5 text-[11px] font-semibold text-red-500">
                Total cannot exceed 100%. Please adjust the weights.
              </p>
            )}
          </div>

          {/* Footer - fixed */}
          <div className="flex shrink-0 items-center justify-end border-t border-slate-100 px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={totalWeight > 100}
              className="rounded-full bg-slate-800 px-5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
};

const RubricDetailModal = ({ isOpen, onClose, rubric, teacherId, onSaved }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editItems, setEditItems] = React.useState([]);
  const [newItemDesc, setNewItemDesc] = React.useState('');
  const [newItemPts, setNewItemPts] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (rubric && isOpen) {
      const items = Array.isArray(rubric.items) ? rubric.items : [];
      setEditItems(items.map((it) => ({ ...it, enabled: true })));
      setIsEditing(false);
      setNewItemDesc('');
      setNewItemPts('');
    }
  }, [rubric, isOpen]);

  if (!isOpen || !rubric) return null;

  const modalRoot = typeof document !== 'undefined' ? document.body : null;
  if (!modalRoot) return null;

  const levelDefinitions = Array.isArray(rubric.level_definitions)
    ? rubric.level_definitions
    : [];
  const items = isEditing ? editItems : (Array.isArray(rubric.items) ? rubric.items : []);
  const activeItems = isEditing ? editItems.filter((it) => it.enabled) : items;

  const toggleItem = (index) => {
    setEditItems((prev) => prev.map((it, i) => i === index ? { ...it, enabled: !it.enabled } : it));
  };

  const updateItemPoints = (index, points) => {
    setEditItems((prev) => prev.map((it, i) => i === index ? { ...it, points } : it));
  };

  const removeItem = (index) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    const desc = newItemDesc.trim();
    const pts = Number(newItemPts);
    if (!desc) return;
    if (!pts || pts <= 0) return;
    setEditItems((prev) => [...prev, { description: desc, points: pts, enabled: true }]);
    setNewItemDesc('');
    setNewItemPts('');
  };

  const handleSave = async () => {
    const active = editItems.filter((it) => it.enabled);
    if (active.length === 0) {
      toast.warning('At least one criterion must be enabled.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        rubric_set_id: rubric.rubric_set_id,
        teacher_id: teacherId,
        name: rubric.rubric_name,
        criteria: rubric.criteria || '',
        ai_instructions: rubric.ai_instructions || '',
        level_definitions: levelDefinitions,
        items: active.map((it) => ({ description: it.description, points: it.points, min_points: it.min_points ?? 0 })),
      };
      const response = await axios.post('/update_rubric_set.php', payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.data?.status !== 'success') {
        throw new Error(response.data?.message || 'Failed to update rubric.');
      }
      toast.success('Rubric updated!');
      setIsEditing(false);
      onClose();
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to update rubric.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-950/60 px-4 py-6 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[90vh]">
        <div className="mx-auto flex max-h-[90vh] flex-col rounded-2xl border border-white/60 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                  <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">{rubric.rubric_name || 'Untitled Rubric'}</h3>
                <p className="text-[11px] text-slate-400">
                  {isEditing ? 'Edit criteria and scoring' : 'Rubric details and scoring criteria'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Criteria Description */}
            {rubric.criteria && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Grading Criteria</p>
                <p className="text-sm text-slate-700 leading-relaxed">{rubric.criteria}</p>
              </div>
            )}

            {/* AI Instructions */}
            {rubric.ai_instructions && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1.5">AI Instructions</p>
                <p className="text-sm text-slate-700 leading-relaxed">{rubric.ai_instructions}</p>
              </div>
            )}

            {/* Level Definitions */}
            {levelDefinitions.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Point Levels</p>
                <div className="flex flex-wrap gap-2">
                  {levelDefinitions.map((level, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5"
                    >
                      <span className="text-xs font-semibold text-emerald-700">{level.label}</span>
                      <span className="text-[10px] text-emerald-600">{level.points} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Criteria Breakdown */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Criteria Breakdown</p>
                {isEditing && (
                  <span className="text-[10px] text-slate-400">
                    {editItems.filter((it) => it.enabled).length} of {editItems.length} active
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                      isEditing
                        ? item.enabled
                          ? 'border-blue-200 bg-white'
                          : 'border-slate-200 bg-slate-50 opacity-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {isEditing ? (
                      <>
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={() => toggleItem(idx)}
                          className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditItems((prev) => prev.map((it, i) => i === idx ? { ...it, description: val } : it));
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                          />
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={item.points}
                          onChange={(e) => updateItemPoints(idx, Number(e.target.value) || 0)}
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-[10px] font-bold text-blue-600 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                        />
                        <span className="text-[10px] text-slate-400">pts</span>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-700">{item.description}</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {item.points} pts
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add new criterion (edit mode) */}
              {isEditing && (
                <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-2.5 space-y-2">
                  <input
                    type="text"
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    placeholder="New criterion description"
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={newItemPts}
                      onChange={(e) => setNewItemPts(e.target.value)}
                      placeholder="Points"
                      className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={addItem}
                      disabled={!newItemDesc.trim() || !newItemPts || Number(newItemPts) <= 0}
                      className="flex items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Empty state */}
            {!isEditing && activeItems.length === 0 && !rubric.criteria && !rubric.ai_instructions && levelDefinitions.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400">No details available for this rubric.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-6 py-3">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.97]"
                >
                  Edit Rubric
                </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-800 px-5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 active:scale-[0.97]"
            >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export default NewAssessment;
