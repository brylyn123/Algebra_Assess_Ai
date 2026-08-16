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
    title: 'Mathematical Correctness',
    weight: 30,
    icon: '✓',
    description: 'Accuracy of operations, intermediate results, and final answer.',
  },
  {
    key: 'process',
    title: 'Solution Process',
    weight: 25,
    icon: '→',
    description: 'Appropriate method, logical flow, and correct sequencing.',
  },
  {
    key: 'completeness',
    title: 'Completeness',
    weight: 20,
    icon: '■',
    description: 'Required parts and essential solution steps are included.',
  },
  {
    key: 'effort',
    title: 'Mathematical Understanding and Relevant Attempt',
    weight: 15,
    icon: '★',
    description: 'Observable understanding or meaningful algebraic attempt.',
  },
  {
    key: 'notation',
    title: 'Mathematical Notation',
    weight: 10,
    icon: '∑',
    description: 'Correct use of symbols, variables, equations, and notation.',
  },
];

const NewAssessment = () => {

  const navigate = useNavigate();
  const { toast } = useToast();

  const [mathExpression, setMathExpression] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [showDefaultRubricModal, setShowDefaultRubricModal] = useState(false);
  const [questionLabel, setQuestionLabel] = useState('');
  const [questionScore, setQuestionScore] = useState('1.0');
  const [editingIndex, setEditingIndex] = useState(null);
  const [questionRubricId, setQuestionRubricId] = useState('');
  const [customizeDefault, setCustomizeDefault] = useState(false);
  const [enabledCriteria, setEnabledCriteria] = useState(
    DEFAULT_GRADING_CRITERIA.map((c) => ({ ...c, enabled: true }))
  );
  const [customCriteria, setCustomCriteria] = useState([]);
  const [newCriterionName, setNewCriterionName] = useState('');
  const [newCriterionDesc, setNewCriterionDesc] = useState('');

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
      question_label: questionLabel.trim(),
      max_score: score,
      rubric_id: questionRubricId ? Number(questionRubricId) : null,
    };
    if (editingIndex !== null) {
      dispatch({ type: 'SET_TEST_ITEMS', payload: testItems.map((it, i) => i === editingIndex ? newItem : it) });
      setEditingIndex(null);
    } else {
      dispatch({ type: 'ADD_TEST_ITEM', payload: newItem });
    }
    setMathExpression('');
    setQuestionLabel('');
    setQuestionScore('1.0');
    setQuestionRubricId('');
    if (mathfieldRef.current?.setValue) mathfieldRef.current.setValue('');
  };

  const handleEditQuestion = (index) => {
    const item = testItems[index];
    setEditingIndex(index);
    setQuestionLabel(item.question_label || '');
    setQuestionScore(String(item.max_score || 1.0));
    setQuestionRubricId(item.rubric_id ? String(item.rubric_id) : '');
    setMathExpression(item.question_content || '');
    if (mathfieldRef.current?.setValue) mathfieldRef.current.setValue(item.question_content || '');
  };

  // Subject multi-select helpers
  const toggleSubject = (subjectId) => {
    const current = newAssessment.subjectIds || [];
    const updated = current.includes(subjectId)
      ? current.filter((id) => id !== subjectId)
      : [...current, subjectId];
    dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'subjectIds', value: updated });
    dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: 'subjectId', value: updated[0] || '' });
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
    const allActive = [...activeDefaults, ...customCriteria];
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
      setQuestionLabel('');
      setQuestionScore('1.0');
      setQuestionRubricId('');
      if (mathfieldRef.current?.setValue) mathfieldRef.current.setValue('');
    }
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

    if (!newAssessment.title || !newAssessment.topic || !(newAssessment.subjectIds?.length > 0)) {

      toast.warning('Please fill out all assessment fields and select at least one subject.');

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

          model_solution: item.model_solution || '',

          max_score: item.max_score || 1.0,

          rubric_set_id: item.rubric_id || null,

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
          <div className="border-b border-slate-100 bg-slate-50/50 px-3 py-2 sm:px-6 sm:py-3 md:px-8">
            <div className="flex gap-1.5 sm:gap-2">
              {ASSESSMENT_STEPS.map((step, index) => {
                const active = index === currentStep;
                const completed = index < currentStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setCurrentStep(index)}
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
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Subjects</label>
                        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-slate-400">
                              {(newAssessment.subjectIds?.length || 0)} selected
                            </span>
                            <button
                              type="button"
                              onClick={selectAllSameLevel}
                              className="text-[10px] font-semibold text-blue-600 hover:underline"
                            >
                              Select All Same Level
                            </button>
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1.5" style={{ scrollbarWidth: 'thin' }}>
                            {subjects.map((subject) => {
                              const isChecked = newAssessment.subjectIds?.includes(subject.id);
                              const meta = [subject.course, subject.year].filter(Boolean).join(' · ');
                              return (
                                <label
                                  key={subject.id}
                                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition cursor-pointer ${
                                    isChecked
                                      ? 'border-blue-200 bg-blue-50'
                                      : 'border-slate-100 bg-white hover:border-slate-200'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleSubject(subject.id)}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-slate-700 truncate">{subject.name}</p>
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
                  {/* Inline question editor */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                        {editingIndex !== null ? `Editing Question #${editingIndex + 1}` : `Question #${testItems.length + 1}`}
                      </p>
                      {editingIndex !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingIndex(null);
                            setMathExpression('');
                            setQuestionLabel('');
                            setQuestionScore('1.0');
                            if (mathfieldRef.current?.setValue) mathfieldRef.current.setValue('');
                          }}
                          className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                    <textarea
                      value={mathExpression}
                      onChange={(e) => setMathExpression(e.target.value)}
                      placeholder="Type your question here... Use LaTeX for math (e.g. \frac{x}{2} or $x^2$)"
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      rows={3}
                      style={{ minHeight: '4.5rem' }}
                    />
                    {mathExpression.trim() && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">Preview</p>
                        <div className="text-sm text-slate-800">
                          <MathText text={mathExpression} />
                        </div>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr,100px]">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Label (optional)</label>
                        <input
                          type="text"
                          value={questionLabel}
                          onChange={(e) => setQuestionLabel(e.target.value)}
                          placeholder="e.g. Solve for x"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Points</label>
                        <input
                          type="number"
                          min="0.5"
                          max="100"
                          step="0.5"
                          value={questionScore}
                          onChange={(e) => setQuestionScore(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-slate-400">
                        <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                      </svg>
                      <Select
                        value={questionRubricId}
                        onChange={(e) => setQuestionRubricId(e.target.value)}
                        className="flex-1 text-[11px]"
                      >
                        <option value="">No rubric (AI default)</option>
                        {rubrics.map((rubric) => (
                          <option key={rubric.rubric_set_id} value={rubric.rubric_set_id}>
                            {rubric.rubric_name}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        onClick={handleOpenRubricBuilder}
                        className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                      >
                        + New
                      </button>
                    </div>
                    {!questionRubricId && !customizeDefault && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">AI Default Grading</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowDefaultRubricModal(true)}
                              className="text-[10px] font-semibold text-blue-600 hover:underline"
                            >
                              View Details
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomizeDefault(true)}
                              className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100"
                            >
                              + Add Criteria
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {DEFAULT_GRADING_CRITERIA.map((c) => (
                            <span key={c.key} className="text-[10px] text-amber-700/80">
                              {c.icon} {c.title} <span className="font-semibold">{c.weight}%</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {!questionRubricId && customizeDefault && (
                      <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Default Criteria + Custom</p>
                          <button
                            type="button"
                            onClick={() => setCustomizeDefault(false)}
                            className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                          >
                            Done
                          </button>
                        </div>

                        {/* Default criteria with checkboxes and editable weights */}
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
                                onChange={() => toggleDefaultCriterion(c.key)}
                                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs text-slate-700 flex-1">{c.icon} {c.title}</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="5"
                                value={c.weight}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                  setEnabledCriteria(enabledCriteria.map((x) =>
                                    x.key === c.key ? { ...x, weight: val } : x
                                  ));
                                }}
                                className="w-14 rounded-lg border border-slate-200 px-1.5 py-0.5 text-center text-[10px] font-bold text-blue-600 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                              />
                              <span className="text-[10px] text-slate-400">%</span>
                            </div>
                          ))}
                        </div>

                        {/* Custom criteria list */}
                        {customCriteria.length > 0 && (
                          <div className="space-y-1.5">
                            {customCriteria.map((c) => (
                              <div key={c.key} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                                <span className="text-xs text-emerald-700 flex-1">+ {c.title}</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={c.weight}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                    setCustomCriteria(customCriteria.map((x) =>
                                      x.key === c.key ? { ...x, weight: val } : x
                                    ));
                                  }}
                                  className="w-14 rounded-lg border border-emerald-200 bg-white px-1.5 py-0.5 text-center text-[10px] font-bold text-emerald-600 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
                                />
                                <span className="text-[10px] text-emerald-400">%</span>
                                <button
                                  type="button"
                                  onClick={() => removeCustomCriterion(c.key)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add new criterion */}
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
                            onClick={addCustomCriterion}
                            disabled={!newCriterionName.trim()}
                            className="flex items-center justify-center gap-1 w-full rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                            Confirm
                          </button>
                        </div>

                        {/* Total weight */}
                        <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500">
                            {enabledCriteria.filter(c => c.enabled).length + customCriteria.length} criteria active
                          </span>
                          <span className={`text-[10px] font-bold ${
                            enabledCriteria.filter(c => c.enabled).reduce((s, c) => s + c.weight, 0) + customCriteria.reduce((s, c) => s + c.weight, 0) === 100
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          }`}>
                            Total: {enabledCriteria.filter(c => c.enabled).reduce((s, c) => s + c.weight, 0) + customCriteria.reduce((s, c) => s + c.weight, 0)}%
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddQuestion}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-700 hover:shadow-lg active:scale-[0.97]"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                        </svg>
                        {editingIndex !== null ? 'Update Question' : 'Add Question'}
                      </button>
                    </div>
                  </div>

                  {/* Questions list */}
                  {testItems.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white">
                      <p className="border-b border-slate-100 px-4 sm:px-5 py-2.5 sm:py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                        Questions ({testItems.length}) · {testItems.reduce((s, it) => s + (it.max_score || 0), 0).toFixed(1)} total pts
                      </p>
                      <div className="p-3 sm:p-4 space-y-2.5">
                        {testItems.map((item, index) => (
                          <div
                            key={`${item.question_content}-${index}`}
                            className="group rounded-xl border border-slate-200 bg-white p-3 sm:p-4 transition hover:border-slate-300 hover:shadow-sm"
                          >
                            <div className="flex items-start gap-2.5 sm:gap-3">
                              <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[10px] font-bold text-blue-700">
                                {index + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                {item.question_label && (
                                  <p className="mb-0.5 text-[10px] font-medium text-slate-400">{item.question_label}</p>
                                )}
                                <div className="text-xs sm:text-sm text-slate-800 overflow-hidden break-words">
                                  <MathText text={item.question_content} />
                                </div>
                                <p className="mt-0.5 text-[10px] text-slate-400">{item.max_score} pts</p>
                              </div>
                              <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                                <button type="button" onClick={() => handleEditQuestion(index)} className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-blue-500 transition hover:bg-blue-50 hover:text-blue-700">Edit</button>
                                <button type="button" onClick={() => handleRemoveQuestion(index)} className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-700">Remove</button>
                              </div>
                            </div>
                            {item.rubric_id && (
                              <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
                                Rubric: {rubrics.find(r => r.rubric_set_id === item.rubric_id)?.rubric_name || 'Custom'}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
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
      <DefaultRubricModal 
        isOpen={showDefaultRubricModal} 
        onClose={() => setShowDefaultRubricModal(false)} 
        totalScore={testItems.reduce((s, it) => s + (it.max_score || 0), 0)}
      />
        </>
      );

};

const CRITERIA_DETAILS = [
  {
    key: 'correctness',
    title: 'Mathematical Correctness',
    weight: 30,
    icon: '✓',
    description: 'Accuracy of operations, intermediate results, and final answer.',
    whatAiLooksFor: [
      'Correct final answer',
      'Accurate intermediate calculations',
      'No arithmetic or algebraic errors',
      'Proper application of mathematical rules',
    ],
    scoringGuide: [
      { label: 'Full marks', range: '100%', detail: 'All answers correct, no errors in any step.' },
      { label: 'Mostly correct', range: '60–90%', detail: 'Minor calculation error but method is sound.' },
      { label: 'Partial', range: '30–50%', detail: 'Some correct steps but final answer is wrong.' },
      { label: 'Incorrect', range: '0–20%', detail: 'Major errors throughout or no meaningful attempt.' },
    ],
    example: (total) => {
      const pts = Math.round((30 / 100) * total * 10) / 10;
      return `If a student solves 2 out of 3 items correctly, the AI awards up to ${pts} points (30% of ${total}).`;
    },
  },
  {
    key: 'process',
    title: 'Solution Process',
    weight: 25,
    icon: '→',
    description: 'Appropriate method, logical flow, and correct sequencing.',
    whatAiLooksFor: [
      'Correct method or formula chosen',
      'Logical step-by-step progression',
      'Proper sequencing of operations',
      'Clear justification of steps',
    ],
    scoringGuide: [
      { label: 'Full marks', range: '100%', detail: 'Method is correct, steps are logical and complete.' },
      { label: 'Mostly correct', range: '60–90%', detail: 'Right method but minor sequencing issues.' },
      { label: 'Partial', range: '30–50%', detail: 'Some correct steps but missing key parts.' },
      { label: 'Incorrect', range: '0–20%', detail: 'Wrong method or no logical flow.' },
    ],
    example: (total) => {
      const pts = Math.round((25 / 100) * total * 10) / 10;
      return `If the student shows a correct approach with clear steps, the AI awards up to ${pts} points (25% of ${total}).`;
    },
  },
  {
    key: 'completeness',
    title: 'Completeness',
    weight: 20,
    icon: '■',
    description: 'Required parts and essential solution steps are included.',
    whatAiLooksFor: [
      'All required parts are answered',
      'Essential steps are shown',
      'No missing components',
      'All sub-problems addressed',
    ],
    scoringGuide: [
      { label: 'Full marks', range: '100%', detail: 'All parts answered, nothing missing.' },
      { label: 'Mostly complete', range: '60–90%', detail: 'One minor part missing or incomplete.' },
      { label: 'Partial', range: '30–50%', detail: 'Several parts missing or incomplete.' },
      { label: 'Incomplete', range: '0–20%', detail: 'Most parts missing or unanswered.' },
    ],
    example: (total) => {
      const pts = Math.round((20 / 100) * total * 10) / 10;
      return `If the student answers all required parts, the AI awards up to ${pts} points (20% of ${total}).`;
    },
  },
  {
    key: 'effort',
    title: 'Mathematical Understanding & Attempt',
    weight: 15,
    icon: '★',
    description: 'Observable understanding or meaningful algebraic attempt.',
    whatAiLooksFor: [
      'Evidence of understanding the problem',
      'Meaningful attempt at solving',
      'Use of relevant mathematical concepts',
      'Shows reasoning even if incorrect',
    ],
    scoringGuide: [
      { label: 'Full marks', range: '100%', detail: 'Clear understanding and strong attempt.' },
      { label: 'Good attempt', range: '60–90%', detail: 'Shows understanding but with gaps.' },
      { label: 'Basic attempt', range: '30–50%', detail: 'Some evidence of understanding.' },
      { label: 'Minimal', range: '10–20%', detail: 'Submitted work but little evidence of understanding.' },
    ],
    example: (total) => {
      const pts = Math.round((15 / 100) * total * 10) / 10;
      const minPts = Math.round(total * 0.10 * 10) / 10;
      return `If the student shows understanding, the AI awards up to ${pts} points (15% of ${total}). Minimum ${minPts} pts for any attempt.`;
    },
  },
  {
    key: 'notation',
    title: 'Mathematical Notation',
    weight: 10,
    icon: '∑',
    description: 'Correct use of symbols, variables, equations, and notation.',
    whatAiLooksFor: [
      'Proper use of mathematical symbols',
      'Correct variable naming',
      'Standard equation formatting',
      'Appropriate use of notation',
    ],
    scoringGuide: [
      { label: 'Full marks', range: '100%', detail: 'Perfect notation throughout.' },
      { label: 'Mostly correct', range: '60–90%', detail: 'Minor notation errors.' },
      { label: 'Partial', range: '30–50%', detail: 'Some correct notation but several errors.' },
      { label: 'Poor', range: '0–20%', detail: 'Notation is unclear or incorrect.' },
    ],
    example: (total) => {
      const pts = Math.round((10 / 100) * total * 10) / 10;
      return `If the student uses proper notation, the AI awards up to ${pts} points (10% of ${total}).`;
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
                When you create an assessment <strong>without a rubric</strong>, the AI automatically grades student submissions using these 5 built-in criteria. 
                Each criterion has a fixed percentage weight that determines its maximum points.
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
                  <p className="text-xs text-blue-700/80"><strong>Evaluate Each Criterion:</strong> AI scores the work against each of the 5 criteria.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">3</span>
                  <p className="text-xs text-blue-700/80"><strong>Award Points:</strong> Each criterion earns points (0 to max) based on quality.</p>
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
                  <p className="text-xs font-semibold text-emerald-800">Effort Minimum Guarantee</p>
                  <p className="mt-1 text-xs text-emerald-700/80 leading-relaxed">
                    Students who submit work receive a <strong>minimum of 10% of the item's max score</strong>, even if all answers are incorrect. 
                    This encourages students to attempt every problem rather than leave answers blank.
                  </p>
                  <p className="mt-1 text-xs text-emerald-700/80">
                    <strong>Example:</strong> If an item is worth 20 points, the student earns at least 2 points for attempting it.
                  </p>
                </div>
              </div>
            </div>

            {/* Final Score Calculation */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-800 mb-2">Final Score Formula</p>
              <div className="rounded-lg bg-white border border-slate-200 px-4 py-3 font-mono text-sm text-slate-700 text-center">
                Final Score = Criterion 1 + Criterion 2 + Criterion 3 + Criterion 4 + Criterion 5
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Example with 20 points:</p>
                {DEFAULT_GRADING_CRITERIA.map((c) => {
                  const pts = Math.round((c.weight / 100) * 20 * 10) / 10;
                  return (
                    <div key={c.key} className="flex items-center justify-between text-xs px-2">
                      <span className="text-slate-600">{c.title} ({c.weight}%)</span>
                      <span className="font-mono text-slate-700">0 to {pts} pts</span>
                    </div>
                  );
                })}
                <div className="border-t border-slate-200 mt-2 pt-2 flex items-center justify-between text-xs font-bold px-2">
                  <span className="text-slate-700">Maximum Total</span>
                  <span className="font-mono text-blue-600">20 pts</span>
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

export default NewAssessment;
