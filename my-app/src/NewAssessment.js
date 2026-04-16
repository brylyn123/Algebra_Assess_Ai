import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useNavigate } from 'react-router-dom';

import axios from './axiosClient';

import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';






const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];
const NEW_RUBRIC_STORAGE_KEY = 'teacher:new-rubric-created';
const ASSESSMENT_DRAFT_STORAGE_KEY = 'teacher:new-assessment-draft';

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
    default:
      return state;
  }
}

const NewAssessment = () => {

  const navigate = useNavigate();

  const [mathExpression, setMathExpression] = useState('');

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
      alert('Enter an equation before previewing.');
      return;
    }
    const previewText = mathValue;
    dispatch({ type: 'SET_PREVIEW_VALUE', payload: previewText });
  };



  useEffect(() => {

    const email = getCurrentLocalUserEmail();

    if (!email) return;

    const storedTeacher = findLocalUser(email);

    const id = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id ?? null;

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

      .get(`http://localhost/Algebra_Assess_Ai/algebra-api/get_subjects.php?teacher_id=${teacherId}`)

      .then((response) => {

        const payload = response.data || [];

        const subjectsArray = Array.isArray(payload.subjects)

          ? payload.subjects

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
      return () => {};
    }

    let isMounted = true;
    const controller = new AbortController();

    dispatch({ type: 'SET_RUBRIC_LOADING', payload: true });
    dispatch({ type: 'SET_RUBRIC_ERROR', payload: '' });

    axios
      .get(`http://localhost/Algebra_Assess_Ai/algebra-api/get_rubric_sets.php?teacher_id=${teacherId}`, {
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

      alert('Please type an equation before adding.');

      return;

    }

    dispatch({
      type: 'ADD_TEST_ITEM', payload: {
        item_no: testItems.length + 1,

        question_type: 'handwritten_algebra',

        question_content: mathValue,
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

      alert('Please fill out all assessment fields.');

      return;

    }

    if (!selectedRubric) {

      alert('Please choose a rubric for this assessment.');

      return;

    }

    if (testItems.length === 0) {

      alert('Please add at least one item for the assessment.');

      return;

    }

    try {

      const payload = {

        teacher_id: teacherId,

        subject_id: Number(newAssessment.subjectId),
        rubric_set_id: Number(selectedRubric),

        title: newAssessment.title,

        topic: newAssessment.topic,

        description: newAssessment.description,
        difficulty: newAssessment.difficulty,

        items: testItems.map((item, index) => ({

          item_no: index + 1,

          question_type: item.question_type,

          question_content: item.question_content,

          score_per_item: 0,

          max_score_per_item: 0,

          rubrics: [],

        })),

      };

      await axios.post('http://localhost/Algebra_Assess_Ai/algebra-api/create_assessment.php', payload);

      alert('Assessment created successfully!');

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

      alert('We could not save the assessment. Please try again.');

    }

  };



  const modalRoot = typeof document !== 'undefined' ? document.body : null;

  if (!modalRoot) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden bg-slate-950/55 px-4 py-6 backdrop-blur-md md:px-6 md:py-8">
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
      `}</style>

      <div className="teacher-float-card mx-auto overflow-hidden rounded-[2.25rem] border-white/70 bg-white/95 shadow-[0_30px_90px_rgba(59,130,246,0.2)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 md:px-8">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Create</p>
            <h2 className="text-2xl font-bold text-slate-900">Create a New Assessment</h2>
            <p className="text-sm text-slate-500">Build the assessment here, then save it without leaving the page.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem(ASSESSMENT_DRAFT_STORAGE_KEY);
              }
              navigate('/teacher/assessments');
            }}
            className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
        <div className="teacher-scrollbar max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-6 md:px-8 md:py-8">
          <form onSubmit={handleAddAssessment} className="space-y-4">

          <div>

            <label className="block text-sm font-medium text-slate-600 mb-1">Assessment Title</label>

            <input

              type="text"

              name="title"

              value={newAssessment.title}

              onChange={handleAssessmentChange}

              placeholder="e.g., Chapter 5 Quiz"

              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"

            />

          </div>

          <div>

            <label className="block text-sm font-medium text-slate-600 mb-1">Subject</label>

            <select

              name="subjectId"

              value={newAssessment.subjectId}

              onChange={handleAssessmentChange}

              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"

            >

              <option value="" disabled hidden>Select a subject</option>

              {subjects.map((subject) => (

                <option key={subject.id} value={subject.id}>

                  {subject.name} ({subject.course} {subject.year})

                </option>

              ))}

            </select>

            <p className="text-xs text-slate-400 mt-1">

              Subjects are pulled from Manage Subjects and refresh automatically when you visit this form.

            </p>

          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Rubric</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <select
                value={selectedRubric}
                onChange={(e) => dispatch({ type: 'SET_SELECTED_RUBRIC', payload: e.target.value })}
                disabled={rubricLoading || rubrics.length === 0}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="" disabled hidden>Select a rubric</option>
                {rubrics.map((rubric) => (
                  <option key={rubric.rubric_set_id} value={rubric.rubric_set_id}>
                    {rubric.rubric_name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={handleOpenRubricBuilder}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                >
                  Add Rubric
                </button>
                <button
                  type="button"
                  onClick={() => loadRubrics()}
                  disabled={rubricLoading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Refresh
                </button>
              </div>
            </div>
            {rubricLoading ? (
              <p className="text-xs text-slate-400 mt-1">Loading rubrics...</p>
            ) : rubricError ? (
              <p className="text-xs text-red-600 mt-1">{rubricError}</p>
            ) : rubrics.length === 0 ? (
              <p className="text-xs text-slate-400 mt-1">No rubric yet. Click Add Rubric, save one in the new tab, then press Refresh here.</p>
            ) : selectedRubric ? (
              <p className="text-xs text-slate-400 mt-1">
                {rubrics.find((rubric) => String(rubric.rubric_set_id) === selectedRubric)?.ai_instructions || 'This rubric will be saved with the assessment.'}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">Rubrics stay reusable. Add one in a new tab and keep this assessment draft open.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            <div>

              <label className="block text-sm font-medium text-slate-600 mb-1">Assessment Topic</label>

              <input

                type="text"

                name="topic"

                value={newAssessment.topic}

                onChange={handleAssessmentChange}

                placeholder="e.g., Functions"

                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"

              />

            </div>

            <div>

              <label className="block text-sm font-medium text-slate-600 mb-1">Difficulty Level</label>

              <select

                name="difficulty"

                value={newAssessment.difficulty}

                onChange={handleAssessmentChange}

                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"

              >

                {DIFFICULTY_LEVELS.map((level) => (

                  <option key={level} value={level}>

                    {level}

                  </option>

                ))}

              </select>

              <p className="text-xs text-slate-400 mt-1">

                Difficulty tags help your AI analytics highlight questions that were easy, medium, or hard.

              </p>

            </div>

          </div>

          <div>

            <label className="block text-sm font-medium text-slate-600 mb-1">Description</label>

            <textarea

              name="description"

              value={newAssessment.description}

              onChange={handleAssessmentChange}

              placeholder="Provide a short description for this assessment."

              rows={3}

              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"

            />

          </div>

          <div className="space-y-3">

            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">

              <span>Question #{testItems.length + 1}</span>

              <span className="h-0.5 w-8 bg-slate-200 inline-block"></span>

              <span>Equation / Symbol</span>

            </div>

          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div>

              {mathLiveReady ? (

                <>
                  <div
                    className="rounded-2xl border border-slate-200 bg-white p-3 shadow-inner transition focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100"
                    onClick={handleMathfieldFocus}
                  >
                  <math-field
                    ref={mathfieldRef}
                    onInput={syncMathExpression}
                    onFocus={handleMathfieldFocus}
                    onClick={handleMathfieldFocus}
                    virtual-keyboard-mode="manual"
                    smart-mode="auto"
                    placeholder="Type your equation here..."
                    className="block w-full max-w-full cursor-text rounded-xl bg-transparent px-4 py-4 text-lg font-medium transition"
                    style={{ minHeight: '4.5rem' }}
                  ></math-field>
                  </div>

                  <div className="mt-2 flex flex-col gap-3 px-1 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <p>Click the equation field to open MathLive and use the virtual keyboard for symbols.</p>
                    <button
                      type="button"
                      onClick={toggleMathKeyboard}
                      className="inline-flex items-center justify-center self-start rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                    >
                      Toggle Keyboard
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400 px-1">
                    <p>Describe the equation or symbol if needed before hitting Add Item.</p>
                  </div>

                </>

              ) : (

                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">

                  Loading math editor... please wait before entering equations.

                </p>

              )}

            </div>

          </div>

          <div className="space-y-3 pt-2">

            <div className="flex items-center justify-between">

              <p className="text-sm font-semibold text-slate-700">Preview</p>

              <button

                type="button"

                onClick={handlePreview}

                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-800 transition"

              >

                Preview

              </button>

            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">

              {previewValue ? (

                mathLiveReady ? (

                  <math-field

                    value={previewValue}

                    read-only
                    className="block w-full max-w-full text-lg bg-slate-50 rounded-xl px-4 py-3 border-none overflow-x-auto"
                    virtual-keyboard-mode="manual"

                    smart-mode="auto"

                    style={{ minHeight: '3rem' }}

                  />

                ) : (

                  <p className="text-xs text-slate-500">Math editor is still loading. Preview will appear once ready.</p>

                )

              ) : (

                <p className="text-xs text-slate-400">

                  Tap Preview to see how this question will look for students.

                </p>

              )}

            </div>

          </div>

          <div className="flex justify-end">

            <button

              type="button"

              onClick={handleAddItem}

              className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition"

            >

              + Add Item

            </button>

          </div>

          <div>

            {testItems.length === 0 ? (

              <p className="text-sm text-slate-500">

                Add an item to describe what students will complete on this test.

              </p>

            ) : (

              <ul className="space-y-2">

                {testItems.map((item, index) => (

                  <li

                    key={`${item.question_content}-${index}`}

                    className="flex flex-col gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700"

                  >

                    <div className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.3em] text-slate-400">

                      <div className="flex items-center justify-between">

                        <span>Question #{index + 1}</span>

                        <button

                          type="button"

                          onClick={() => handleRemoveItem(index)}

                          className="text-red-600 font-semibold hover:text-red-800"

                        >

                          Remove

                        </button>

                      </div>

                      <span className="text-[10px] tracking-[0.4em] text-slate-500">

                        Equation

                      </span>

                    </div>

                    <p className="text-sm font-semibold text-slate-900">{item.question_content}</p>

                  </li>

                ))}

              </ul>

            )}

          </div>

          <button

            type="submit"

            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition duration-300"

          >

            Create Assessment

          </button>

          </form>
        </div>
      </div>
      </div>
    </div>,
    modalRoot
  );

};



export default NewAssessment;
