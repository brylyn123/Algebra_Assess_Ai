import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useNavigate } from 'react-router-dom';

import axios from './axiosClient';

import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import { useToast } from './components/Toast';
import Select from './components/Select';
import MathText from './MathText';






const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];
const NEW_RUBRIC_STORAGE_KEY = 'teacher:new-rubric-created';
const ASSESSMENT_DRAFT_STORAGE_KEY = 'teacher:new-assessment-draft';
const EDITOR_ITEMS_KEY = 'teacher:question-editor-items';

const ASSESSMENT_STEPS = [
    { id: 'details', label: 'Details', description: 'Title & subject' },
    { id: 'config', label: 'Config', description: 'Topic & settings' },
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
    topic: '',
    description: '',
    difficulty: 'Medium',
    dueDate: '',
  },
  testItems: [],
  mathLiveReady: typeof window !== 'undefined' && !!window.MathfieldElement,
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
    case 'SET_MATHLIVE_READY':
      return { ...state, mathLiveReady: action.payload };
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
    key: 'correctness',
    title: 'Correctness',
    icon: '✓',
    description: 'Does the student arrive at the correct answer? Are the mathematical steps valid?',
  },
  {
    key: 'process',
    title: 'Process',
    icon: '→',
    description: 'Does the student show clear, logical work? Are algebraic steps properly sequenced?',
  },
  {
    key: 'completeness',
    title: 'Completeness',
    icon: '■',
    description: 'Are all parts of the question answered? Are all steps shown?',
  },
  {
    key: 'notation',
    title: 'Notation',
    icon: '∑',
    description: 'Does the student use proper mathematical notation and symbols?',
  },
  {
    key: 'effort',
    title: 'Effort',
    icon: '★',
    description: 'Did the student attempt the problem? Even if wrong, give partial credit for showing work or demonstrating understanding.',
  },
];

const NewAssessment = () => {

  const navigate = useNavigate();
  const { toast } = useToast();

  const [mathExpression, setMathExpression] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [showDefaultRubricModal, setShowDefaultRubricModal] = useState(false);

  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    teacherId,
    subjects,
    newAssessment,
    testItems,
    mathLiveReady,
    previewValue,
    rubrics,
    rubricLoading,
    rubricError,
    selectedRubric,
  } = state;
  const mathfieldRef = useRef(null);

  const showMathKeyboard = () => {
    const mathfield = mathfieldRef.current;

    mathfield?.focus?.();

    if (typeof mathfield?.executeCommand === 'function') {
      mathfield.executeCommand('showVirtualKeyboard');
    }

    if (typeof window !== 'undefined' && window.mathVirtualKeyboard) {
      if (typeof window.mathVirtualKeyboard.show === 'function') {
        window.mathVirtualKeyboard.show();
      }
      window.mathVirtualKeyboard.visible = true;
    }
  };

  const toggleMathKeyboard = () => {
    if (typeof window === 'undefined' || !window.mathVirtualKeyboard) {
      showMathKeyboard();
      return;
    }

    const isVisible = !!window.mathVirtualKeyboard.visible;

    if (isVisible) {
      if (typeof window.mathVirtualKeyboard.hide === 'function') {
        window.mathVirtualKeyboard.hide();
      }
      window.mathVirtualKeyboard.visible = false;
      return;
    }

    showMathKeyboard();
  };

  const hideMathKeyboard = () => {
    if (typeof window === 'undefined' || !window.mathVirtualKeyboard) {
      return;
    }

    if (typeof window.mathVirtualKeyboard.hide === 'function') {
      window.mathVirtualKeyboard.hide();
    }
    window.mathVirtualKeyboard.visible = false;
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

  const handleOpenRubricBuilder = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        ASSESSMENT_DRAFT_STORAGE_KEY,
        JSON.stringify({
          newAssessment,
          testItems,
          selectedRubric,
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

  const handleOpenQuestionEditor = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        ASSESSMENT_DRAFT_STORAGE_KEY,
        JSON.stringify({
          newAssessment,
          testItems,
          selectedRubric,
          mathExpression,
          previewValue,
          savedAt: new Date().toISOString(),
        })
      );
      window.sessionStorage.setItem(EDITOR_ITEMS_KEY, JSON.stringify(testItems));
    }
    navigate('/teacher/assessments/edit-questions');
  };


  const syncMathExpression = () => {
    const value = mathfieldRef.current?.getValue?.() ?? '';
    setMathExpression(value);
  };

  const handleMathfieldFocus = () => {
    showMathKeyboard();
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



  useEffect(() => {

    if (mathLiveReady || typeof window === 'undefined') return;

    if (window.MathfieldElement) {

      dispatch({ type: 'SET_MATHLIVE_READY', payload: true });

      return;

    }

    if (!document.getElementById('mathlive-script')) {

      const script = document.createElement('script');

      script.id = 'mathlive-script';

      script.src = 'https://unpkg.com/mathlive/dist/mathlive.min.js';

      script.defer = true;

      script.onload = () => dispatch({ type: 'SET_MATHLIVE_READY', payload: true });

      document.head.appendChild(script);

      const style = document.createElement('link');

      style.id = 'mathlive-css';

      style.rel = 'stylesheet';

      style.href = 'https://unpkg.com/mathlive/dist/mathlive.css';

      document.head.appendChild(style);

    } else {

      const existing = document.getElementById('mathlive-script');

      if (existing && typeof window.MathfieldElement !== 'undefined') {

        dispatch({ type: 'SET_MATHLIVE_READY', payload: true });

      } else {

        existing?.addEventListener('load', () => dispatch({ type: 'SET_MATHLIVE_READY', payload: true }), { once: true });

      }

    }

  }, [mathLiveReady]);

  useEffect(() => {
    if (!mathLiveReady || typeof window === 'undefined' || !window.mathVirtualKeyboard) {
      return;
    }

    window.mathVirtualKeyboard.visible = false;
  }, [mathLiveReady]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const body = document.body;
    const previousKeyboardZIndex = body.style.getPropertyValue('--keyboard-zindex');

    body.style.setProperty('--keyboard-zindex', '3000');

    return () => {
      if (previousKeyboardZIndex) {
        body.style.setProperty('--keyboard-zindex', previousKeyboardZIndex);
      } else {
        body.style.removeProperty('--keyboard-zindex');
      }
    };
  }, []);

  useEffect(() => () => {
    hideMathKeyboard();
  }, []);



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
    const mathfield = mathfieldRef.current;

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

    if (mathfield?.setValue) {
      mathfield.setValue('');
    }
    setMathExpression('');


  };



  const handleRemoveItem = (index) => {

    dispatch({ type: 'REMOVE_TEST_ITEM', payload: index });

  };



  const handleAddAssessment = async (e) => {

    e.preventDefault();

    if (!newAssessment.title || !newAssessment.subjectId || !newAssessment.topic) {

      toast.warning('Please fill out all assessment fields.');

      return;

    }

    if (newAssessment.title.length > 255) {
      toast.warning('Title must be under 255 characters.');
      return;
    }

    if (newAssessment.description && newAssessment.description.length > 2000) {
      toast.warning('Description must be under 2000 characters.');
      return;
    }

    if (testItems.length === 0) {

      toast.warning('Please add at least one item for the assessment.');

      return;

    }

    const hasInvalidScore = testItems.some(
      (item) => !item.max_score || item.max_score <= 0 || item.max_score > 100
    );
    if (hasInvalidScore) {
      toast.warning('Each item score must be between 0 and 100.');
      return;
    }

    const hasEmptyContent = testItems.some(
      (item) => !item.question_content || item.question_content.trim() === ''
    );
    if (hasEmptyContent) {
      toast.warning('Each item must include question content.');
      return;
    }

    try {

      const payload = {

        teacher_id: teacherId,

        subject_id: Number(newAssessment.subjectId),
        rubric_set_id: selectedRubric ? Number(selectedRubric) : null,

        title: newAssessment.title,

        topic: newAssessment.topic,

        description: newAssessment.description,
        difficulty: newAssessment.difficulty,
        due_date: newAssessment.dueDate || null,

        items: testItems.map((item, index) => ({

          item_no: index + 1,

          question_type: item.question_type,

          question_content: item.question_content,

          model_solution: item.model_solution || '',

          max_score: item.max_score || 1.0,

        })),

      };

      await axios.post('/create_assessment.php', payload);

      toast.success('Assessment created successfully!');

      dispatch({ type: 'RESET_ASSESSMENT_FORM' });
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(ASSESSMENT_DRAFT_STORAGE_KEY);
      }

      if (mathfieldRef.current?.setValue) {

        mathfieldRef.current.setValue('');

      }

      setMathExpression('');

      navigate('/teacher/assessments');

    } catch (error) {

      console.error('Failed to create assessment', error);

      toast.error('We could not save the assessment. Please try again.');

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
        math-field {
          border: none;
          outline: none;
          box-shadow: none;
          background: transparent;
        }

        math-field::part(virtual-keyboard-toggle),
        math-field::part(menu-toggle) {
          display: none;
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
                    <h2 className="text-xl font-bold text-white">Create Assessment</h2>
                    <p className="text-sm text-blue-100/80">Build quizzes, homework, or exams with a guided flow.</p>
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
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-3 md:px-8">
            <div className="flex gap-2">
              {ASSESSMENT_STEPS.map((step, index) => {
                const active = index === currentStep;
                const completed = index < currentStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-left transition ${active ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${active ? 'bg-blue-600 text-white' : completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {completed ? '✓' : index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</p>
                        <p className="text-[9px] text-slate-400 hidden sm:block">{step.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto px-6 py-6 md:px-8 md:py-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
            <form onSubmit={handleAddAssessment} className="space-y-5">
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
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Subject</label>
                        <select
                          name="subjectId"
                          value={newAssessment.subjectId}
                          onChange={handleAssessmentChange}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-medium text-slate-700 shadow-sm outline-none transition duration-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        >
                          <option value="" disabled hidden>Select a subject</option>
                          {subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name} ({subject.course} {subject.year})
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10px] text-slate-400">Pulls from your Manage Subjects page.</p>
                      </div>
                    </div>
                  </div>

                  {/* Rubric selection */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Rubric (Optional)</p>
                    <div className="flex gap-2">
                      <Select
                        value={selectedRubric}
                        onChange={(e) => dispatch({ type: 'SET_SELECTED_RUBRIC', payload: e.target.value })}
                        disabled={rubricLoading}
                        className="flex-1"
                      >
                        <option value="">No rubric (AI uses default)</option>
                        {rubrics.map((rubric) => (
                          <option key={rubric.rubric_set_id} value={rubric.rubric_set_id}>
                            {rubric.rubric_name}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        onClick={handleOpenRubricBuilder}
                        className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                      >
                        + New
                      </button>
                    </div>
                    {rubricLoading ? (
                      <p className="mt-1 text-[10px] text-slate-400">Loading rubrics...</p>
                    ) : rubricError ? (
                      <p className="mt-1 text-[10px] text-red-500">{rubricError}</p>
                    ) : null}

                    {/* Default rubric preview when no rubric is selected */}
                    {!selectedRubric && !rubricLoading && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-amber-600">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-amber-800">Default AI Grading Criteria</p>
                            <p className="mt-0.5 text-[11px] text-amber-700/80">
                              When no rubric is provided, the AI evaluates submissions using 5 built-in criteria:
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {DEFAULT_GRADING_CRITERIA.map((c) => (
                                <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200/60">
                                  <span className="text-amber-500">{c.icon}</span> {c.title}
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowDefaultRubricModal(true)}
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 underline decoration-amber-300 underline-offset-2 transition hover:text-amber-900 hover:decoration-amber-500"
                            >
                              View Details
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Config */}
              {currentStep === 1 && (
                <div className="space-y-4">
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

              {/* Step 3: Items — Summary & link to Question Editor */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Questions</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {testItems.length > 0
                            ? `${testItems.length} question${testItems.length !== 1 ? 's' : ''} · ${testItems.reduce((s, it) => s + (it.max_score || 0), 0).toFixed(1)} total pts`
                            : 'No questions yet'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenQuestionEditor}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-200/60 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          {testItems.length > 0 ? (
                            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                          ) : (
                            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                          )}
                        </svg>
                        {testItems.length > 0 ? 'Edit Questions' : 'Create Questions'}
                      </button>
                    </div>

                    {testItems.length > 0 ? (
                      <div className="space-y-2">
                        {testItems.map((item, index) => (
                          <div
                            key={`${item.question_content}-${index}`}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:shadow-sm"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[10px] font-bold text-blue-700">
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              {item.question_label && (
                                <p className="mb-0.5 text-[10px] font-medium text-slate-400">{item.question_label}</p>
                              )}
                              <p className="truncate text-sm font-medium text-slate-700"><MathText text={item.question_content} /></p>
                              <p className="text-[10px] text-slate-400">{item.max_score} pts</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-8 text-center">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-blue-500">
                            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-600">Compose your algebra questions</p>
                        <p className="mt-1 text-xs text-slate-400">Click "Create Questions" to open the full question editor.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                {currentStep > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    ← Back
                  </button>
                ) : (
                  <span />
                )}
                {currentStep < ASSESSMENT_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => Math.min(ASSESSMENT_STEPS.length - 1, prev + 1))}
                    className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 hover:shadow-lg active:scale-[0.97]"
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-200/60 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.97]"
                  >
                    Create Assessment
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  )}
      <DefaultRubricModal isOpen={showDefaultRubricModal} onClose={() => setShowDefaultRubricModal(false)} />
        </>
      );

};

const DefaultRubricModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const modalRoot = typeof document !== 'undefined' ? document.body : null;
  if (!modalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-950/60 px-4 py-6 backdrop-blur-md">
      <div className="relative w-full max-w-lg max-h-[85vh]">
        <div className="mx-auto flex max-h-[85vh] flex-col rounded-2xl border border-white/60 bg-white shadow-2xl">
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
            <p className="text-sm text-slate-600 leading-relaxed">
              When you create an assessment <strong>without a rubric</strong>, the AI automatically grades student submissions using these 5 built-in criteria:
            </p>

            <div className="space-y-3">
              {DEFAULT_GRADING_CRITERIA.map((c, i) => (
                <div key={c.key} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-xs font-bold text-white shadow-sm">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{c.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <p className="text-xs font-semibold text-blue-800">How scoring works</p>
              <p className="mt-1 text-xs text-blue-700/80 leading-relaxed">
                For each question, the AI evaluates all 5 criteria and assigns a score <strong>proportional to the max points</strong> set for that item. The overall score is calculated as a percentage (0–100%).
              </p>
              <p className="mt-2 text-xs text-blue-700/80 leading-relaxed">
                <strong>Effort credit:</strong> Students who submit work receive a <strong>minimum of 10%</strong> of the item's max score, even if all answers are incorrect. This encourages students to attempt every problem rather than leave answers blank.
              </p>
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

export default NewAssessment;
