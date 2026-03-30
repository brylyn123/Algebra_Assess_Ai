import React, { useEffect, useReducer, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import axios from './axiosClient';

import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';



const SYMBOL_OPTIONS = [

  'x',

  'y',

  'z',

  '2',

  '3',

  '±',

  '√',

  'Σ',

  '∫',

  'Δ',

  'π',

  '+',

  '-',

  '÷',

  '×',

  '=',

  '<',

  '>',

  '≤',

  '≥',

];



const QUESTION_TYPE_OPTIONS = [

  { value: 'handwritten_algebra', label: 'Equation / Symbol' },

  { value: 'multiple_choice', label: 'Multiple choice' },

];

const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];

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
    idealSolution: '',
  },
  testItems: [],
  itemEntry: '',
  questionType: 'handwritten_algebra',
  mcOptions: [],
  mcOptionEntry: '',
  mcCorrectAnswer: '',
  equationCorrectAnswer: '',
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
        itemEntry: '',
        previewValue: '',
        mcOptions: [],
        mcCorrectAnswer: '',
        equationCorrectAnswer: '',
        selectedRubric: '',
        rubricError: '',
      };
    case 'SET_ITEM_ENTRY':
      return { ...state, itemEntry: action.payload };
    case 'SET_QUESTION_TYPE':
      return {
        ...state,
        questionType: action.payload,
        mcOptions: [],
        mcCorrectAnswer: '',
        equationCorrectAnswer: '',
        previewValue: '',
      };
    case 'ADD_MC_OPTION':
      return {
        ...state,
        mcOptions: [...state.mcOptions, action.payload],
        mcOptionEntry: '',
        mcCorrectAnswer: action.payload,
      };
    case 'REMOVE_MC_OPTION':
      const optionToRemove = state.mcOptions[action.payload];
      return {
        ...state,
        mcOptions: state.mcOptions.filter((_, i) => i !== action.payload),
        mcCorrectAnswer: state.mcCorrectAnswer === optionToRemove ? '' : state.mcCorrectAnswer,
      };
    case 'SET_MC_OPTION_ENTRY':
      return { ...state, mcOptionEntry: action.payload };
    case 'SET_MC_CORRECT_ANSWER':
      return { ...state, mcCorrectAnswer: action.payload };
    case 'RESET_MC_OPTIONS':
      return { ...state, mcOptions: [], mcCorrectAnswer: '' };
    case 'SET_EQUATION_CORRECT_ANSWER':
      return { ...state, equationCorrectAnswer: action.payload };
    case 'SET_MATHLIVE_READY':
      return { ...state, mathLiveReady: action.payload };
    case 'SET_PREVIEW_VALUE':
      return { ...state, previewValue: action.payload };
    case 'ADD_TEST_ITEM':
      return {
        ...state,
        testItems: [...state.testItems, action.payload],
        itemEntry: '',
        mcOptionEntry: '',
        mcCorrectAnswer: '',
        mcOptions: [],
        equationCorrectAnswer: '',
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
  const [showSymbolPanel, setShowSymbolPanel] = useState(false);

  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    teacherId,
    subjects,
    newAssessment,
    testItems,
    itemEntry,
    questionType,
    mcOptions,
    mcOptionEntry,
    mcCorrectAnswer,
    equationCorrectAnswer,
    mathLiveReady,
    previewValue,
    rubrics,
    rubricLoading,
    rubricError,
    selectedRubric,
  } = state;

  const itemInputRef = useRef(null);

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

  });



  const handleAssessmentChange = (e) => {

    const { name, value } = e.target;

    dispatch({ type: 'UPDATE_ASSESSMENT_FIELD', field: name, value });

  };



  const handleQuestionTypeChange = (value) => {

    dispatch({ type: 'SET_QUESTION_TYPE', payload: value });
    if (value !== 'handwritten_algebra') {
      setMathExpression('');
      hideMathKeyboard();
    }

  };



  const handleAddOption = () => {

    const optionValue = mcOptionEntry.trim();

    if (!optionValue) return;

    dispatch({ type: 'ADD_MC_OPTION', payload: optionValue });

  };



  const handleRemoveOption = (index) => {

    dispatch({ type: 'REMOVE_MC_OPTION', payload: index });

  };



  const handleSymbolInsert = (symbol) => {

    const mathfield = mathfieldRef.current;

    if (questionType === 'handwritten_algebra' && mathfield) {

      if (typeof mathfield.insert === 'function') {

        mathfield.insert(symbol);

      } else if (typeof mathfield.executeCommand === 'function') {

        mathfield.executeCommand('insert', symbol);

      }

      mathfield.focus();
      const updated = mathfield.getValue?.() ?? '';
      setMathExpression(updated);
      return;

    }

    const input = itemInputRef.current;

    const prev = itemEntry;
    let nextValue;
    if (!input) {
      nextValue = prev + symbol;
    } else {
      const start = input.selectionStart ?? prev.length;
      const end = input.selectionEnd ?? start;
      nextValue = prev.slice(0, start) + symbol + prev.slice(end);
      const caretPosition = start + symbol.length;
      setTimeout(() => {
        if (input.setSelectionRange) {

          input.setSelectionRange(caretPosition, caretPosition);

        }

        input.focus();

      }, 0);
    }
    dispatch({ type: 'SET_ITEM_ENTRY', payload: nextValue });
  };

  const handleMathExpressionChange = (event) => {
    const value = event.target.value;
    setMathExpression(value);
    if (mathfieldRef.current?.setValue) {
      mathfieldRef.current.setValue(value);
    }
  };

  const syncMathExpression = () => {
    const value = mathfieldRef.current?.getValue?.() ?? '';
    setMathExpression(value);
  };

  const handleMathfieldFocus = () => {
    showMathKeyboard();
  };

  const handlePreview = () => {
    let previewText = '';
    if (questionType === 'handwritten_algebra') {
      const mathValue = mathExpression.trim();
      if (!mathValue) {
        alert('Enter an equation before previewing.');
        return;
      }
      previewText = mathValue;
    } else {
      if (!itemEntry.trim()) {
        alert('Add a question description before previewing.');
        return;
      }
      previewText = itemEntry.trim();
    }
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

  useEffect(() => {
    if (!teacherId) {
      dispatch({ type: 'SET_RUBRICS', payload: [] });
      dispatch({ type: 'SET_SELECTED_RUBRIC', payload: '' });
      dispatch({ type: 'SET_RUBRIC_ERROR', payload: '' });
      dispatch({ type: 'SET_RUBRIC_LOADING', payload: false });
      return;
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
  }, [teacherId]);



  const handleItemEntryChange = (e) => {

    dispatch({ type: 'SET_ITEM_ENTRY', payload: e.target.value });

  };



  const handleAddItem = () => {

    if (questionType === 'multiple_choice') {

      if (!itemEntry.trim()) {

        alert('Please enter a question for this multiple-choice item.');

        return;

      }

      if (mcOptions.length < 2) {

        alert('Please add at least two options.');

        return;

      }

      if (!mcCorrectAnswer) {

        alert('Select the correct answer.');

        return;

      }

      dispatch({
        type: 'ADD_TEST_ITEM', payload: {
          item_no: testItems.length + 1,

          question_type: 'multiple_choice',

          question_content: itemEntry.trim(),

          options: JSON.stringify(mcOptions),

          correct_answer: mcCorrectAnswer,
        }
      });

      return;

    }



    const mathfield = mathfieldRef.current;

    const mathValue = mathExpression.trim();

    if (!mathValue) {

      alert('Please type an equation before adding.');

      return;

    }

    if (!equationCorrectAnswer.trim()) {

      alert('Please provide the correct answer for this equation.');

      return;

    }

    dispatch({
      type: 'ADD_TEST_ITEM', payload: {
        item_no: testItems.length + 1,

        question_type: 'handwritten_algebra',

        question_content: mathValue,

        options: '',

        correct_answer: equationCorrectAnswer.trim(),
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

        ideal_solution: newAssessment.idealSolution,

        items: testItems.map((item, index) => ({

          item_no: index + 1,

          question_type: item.question_type,

          question_content: item.question_content,

          score_per_item: 0,

          max_score_per_item: 0,

          options: item.options,

          correct_answer: item.correct_answer,

          rubrics: [],

        })),

      };

      await axios.post('http://localhost/Algebra_Assess_Ai/algebra-api/create_assessment.php', payload);

      alert('Assessment created successfully!');

      dispatch({ type: 'RESET_ASSESSMENT_FORM' });

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



  return (

    <div className="pb-16">
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

      <div className="mb-8">

        <button

          onClick={() => navigate('/teacher/assessments')}

          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-lg transition hover:bg-blue-700"

        >

          &larr; Back to Assessments

        </button>

      </div>

      <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 space-y-6 max-w-3xl mx-auto">

        <h2 className="text-2xl font-bold text-slate-900">Create a New Assessment</h2>

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
            {rubricLoading ? (
              <p className="text-xs text-slate-400 mt-1">Loading rubrics...</p>
            ) : rubricError ? (
              <p className="text-xs text-red-600 mt-1">{rubricError}</p>
            ) : rubrics.length === 0 ? (
              <p className="text-xs text-slate-400 mt-1">Create a rubric first, then attach it to this assessment.</p>
            ) : selectedRubric ? (
              <p className="text-xs text-slate-400 mt-1">
                {rubrics.find((rubric) => String(rubric.rubric_set_id) === selectedRubric)?.ai_instructions || 'This rubric will be saved with the assessment.'}
              </p>
            ) : null}
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

              <span>{questionType === 'multiple_choice' ? 'Multiple choice' : 'Equation / Symbol'}</span>

            </div>

            <div className="flex items-center gap-2">

              {QUESTION_TYPE_OPTIONS.map((option) => (

                <button

                  key={option.value}

                  type="button"

                  onClick={() => handleQuestionTypeChange(option.value)}

                  className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.2em] transition ${questionType === option.value

                      ? 'border-blue-600 bg-blue-600 text-white'

                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'

                    }`}

                >

                  {option.label}

                </button>

              ))}

            </div>

          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            {questionType === 'handwritten_algebra' ? (

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
                      <p>Describe the equation or symbol if needed before hitting “Add Item.”</p>
                    </div>

                    <div className="mt-4 space-y-1">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.3em]">
                        Correct Answer
                      </label>
                      <input
                        type="text"
                        value={equationCorrectAnswer}
                        onChange={(e) => dispatch({ type: 'SET_EQUATION_CORRECT_ANSWER', payload: e.target.value })}
                        placeholder="Enter the exact answer or expression"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none transition"
                      />
                    </div>
                  </>

                ) : (

                  <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">

                    Loading math editor… please wait before entering equations.

                  </p>

                )}

              </div>

            ) : (

              <div className="space-y-3">

                <input

                  ref={itemInputRef}

                  type="text"

                  value={itemEntry}

                  onChange={handleItemEntryChange}

                  placeholder="Describe a multiple-choice question"

                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"

                />

                <div className="flex gap-2 flex-wrap">

                  <input

                    type="text"

                    value={mcOptionEntry}

                    onChange={(e) => dispatch({ type: 'SET_MC_OPTION_ENTRY', payload: e.target.value })}

                    placeholder="Option text"

                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700"

                  />

                  <button

                    type="button"

                    onClick={handleAddOption}

                    className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200 transition"

                  >

                    + Add option

                  </button>

                </div>

                {mcOptions.length > 0 && (

                  <div className="flex flex-wrap gap-2">

                    {mcOptions.map((option, index) => (

                      <span

                        key={`${option}-${index}`}

                        className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"

                      >

                        {option}

                        <button

                          type="button"

                          onClick={() => handleRemoveOption(index)}

                          className="text-red-500 hover:text-red-700"

                        >

                          ×

                        </button>

                      </span>

                    ))}

                  </div>

                )}

                {mcOptions.length > 0 && (

                  <button

                    type="button"

                    onClick={() => dispatch({ type: 'RESET_MC_OPTIONS' })}

                    className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-slate-900 self-start"

                  >

                    Reset options

                  </button>

                )}
                {mcOptions.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.3em]">
                      Correct Answer
                    </label>
                    <select
                      value={mcCorrectAnswer}
                      onChange={(e) => dispatch({ type: 'SET_MC_CORRECT_ANSWER', payload: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none transition"
                    >
                      <option value="" disabled hidden>Select the correct answer</option>
                      {mcOptions.map((option, index) => (
                        <option key={`${option}-${index}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              </div>

            )}

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

                questionType === 'handwritten_algebra' ? (

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

                  <p className="text-slate-900">{previewValue}</p>

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

                        {item.question_type === 'multiple_choice' ? 'Multiple choice' : 'Equation'}

                      </span>

                    </div>

                    {item.correct_answer && (

                      <p className="text-[11px] text-slate-500">Correct Answer: {item.correct_answer}</p>

                    )}

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

  );

};



export default NewAssessment;
