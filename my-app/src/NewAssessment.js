import React, { useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import axios from 'axios';

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



const NewAssessment = () => {

  const navigate = useNavigate();

  const [teacherId, setTeacherId] = useState(null);

  const [subjects, setSubjects] = useState([]);

  const [newAssessment, setNewAssessment] = useState({

    title: '',

    subjectId: '',

    topic: '',

    description: '',

  });

  const [testItems, setTestItems] = useState([]);

  const [itemEntry, setItemEntry] = useState('');

  const [questionType, setQuestionType] = useState('handwritten_algebra');

  const [mcOptions, setMcOptions] = useState([]);

  const [mcOptionEntry, setMcOptionEntry] = useState('');

  const [mcCorrectAnswer, setMcCorrectAnswer] = useState('');

  const [mathLiveReady, setMathLiveReady] = useState(

    typeof window !== 'undefined' && !!window.MathfieldElement

  );

  const itemInputRef = useRef(null);

  const mathfieldRef = useRef(null);

  const [rubricCriteria, setRubricCriteria] = useState('');

  const [rubricPoints, setRubricPoints] = useState('');

  const [rubricDescription, setRubricDescription] = useState('');

  const [rubricsList, setRubricsList] = useState([]);



  const normalizeSubjectRecord = (raw) => ({

    id: raw.subject_id ?? raw.id ?? null,

    name: raw.subject_name ?? raw.name ?? 'Untitled Subject',

    course: raw.course ?? '',

    year: raw.year ?? '',

    section: raw.section ?? '',

  });



  const handleAssessmentChange = (e) => {

    const { name, value } = e.target;

    setNewAssessment((prevState) => ({

      ...prevState,

      [name]: value,

    }));

  };



  const handleQuestionTypeChange = (value) => {

    setQuestionType(value);

    if (value !== 'multiple_choice') {

      setMcOptions([]);

      setMcCorrectAnswer('');

    }

  };



  const handleAddOption = () => {

    const optionValue = mcOptionEntry.trim();

    if (!optionValue) return;

    setMcOptions((prev) => [...prev, optionValue]);

    setMcOptionEntry('');

    setMcCorrectAnswer(optionValue);

  };



  const handleRemoveOption = (index) => {

    setMcOptions((prev) => {

      const updated = prev.filter((_, i) => i !== index);

      if (prev[index] === mcCorrectAnswer) {

        setMcCorrectAnswer('');

      }

      return updated;

    });

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

      return;

    }

    const input = itemInputRef.current;

    setItemEntry((prev) => {

      if (!input) {

        return prev + symbol;

      }

      const start = input.selectionStart ?? prev.length;

      const end = input.selectionEnd ?? start;

      const nextValue = prev.slice(0, start) + symbol + prev.slice(end);

      const caretPosition = start + symbol.length;

      setTimeout(() => {

        if (input.setSelectionRange) {

          input.setSelectionRange(caretPosition, caretPosition);

        }

        input.focus();

      }, 0);

      return nextValue;

    });

  };



  const handleAddRubric = () => {

    const criteria = rubricCriteria.trim();

    if (!criteria) {

      alert('Enter a rubric criterion before saving.');

      return;

    }

    const pointsValue = parseFloat(rubricPoints);

    const normalizedPoints = Number.isNaN(pointsValue) ? 0 : pointsValue;

    setRubricsList((prev) => [

      ...prev,

      {

        criteria_name: criteria,

        points: normalizedPoints,

        description: rubricDescription.trim(),

      },

    ]);

    setRubricCriteria('');

    setRubricPoints('');

    setRubricDescription('');

  };



  const handleRemoveRubric = (index) => {

    setRubricsList((prev) => prev.filter((_, idx) => idx !== index));

  };



  useEffect(() => {

    const email = getCurrentLocalUserEmail();

    if (!email) return;

    const storedTeacher = findLocalUser(email);

    const id = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id ?? null;

    setTeacherId(id);

  }, []);



  useEffect(() => {

    if (mathLiveReady || typeof window === 'undefined') return;

    if (window.MathfieldElement) {

      setMathLiveReady(true);

      return;

    }

    if (!document.getElementById('mathlive-script')) {

      const script = document.createElement('script');

      script.id = 'mathlive-script';

      script.src = 'https://unpkg.com/mathlive/dist/mathlive.min.js';

      script.defer = true;

      script.onload = () => setMathLiveReady(true);

      document.head.appendChild(script);

      const style = document.createElement('link');

      style.id = 'mathlive-css';

      style.rel = 'stylesheet';

      style.href = 'https://unpkg.com/mathlive/dist/mathlive.css';

      document.head.appendChild(style);

    } else {

      const existing = document.getElementById('mathlive-script');

      if (existing && typeof window.MathfieldElement !== 'undefined') {

        setMathLiveReady(true);

      } else {

        existing?.addEventListener('load', () => setMathLiveReady(true), { once: true });

      }

    }

  }, [mathLiveReady]);



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

        setSubjects(subjectsArray.map(normalizeSubjectRecord).filter((subject) => subject.id));

      })

      .catch((error) => {

        console.error('Failed to load subjects for assessments', error);

      });

  }, [teacherId]);



  const handleItemEntryChange = (e) => {

    setItemEntry(e.target.value);

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

      setTestItems((prev) => [

        ...prev,

        {

          item_no: prev.length + 1,

          question_type: 'multiple_choice',

          question_content: itemEntry.trim(),

          options: JSON.stringify(mcOptions),

          correct_answer: mcCorrectAnswer,

          rubrics: rubricsList,

        },

      ]);

      setItemEntry('');

      setMcOptionEntry('');

      setMcCorrectAnswer('');

      setMcOptions([]);

      setRubricsList([]);

      setRubricCriteria('');

      setRubricPoints('');

      setRubricDescription('');

      return;

    }



    const mathfield = mathfieldRef.current;

    const mathValue = mathfield?.getValue?.() ?? '';

    if (!mathValue.trim()) {

      alert('Please type an equation before adding.');

      return;

    }

    setTestItems((prev) => [

      ...prev,

      {

        item_no: prev.length + 1,

        question_type: 'handwritten_algebra',

        question_content: mathValue,

        options: '',

        correct_answer: '',

        rubrics: rubricsList,

      },

    ]);

    if (mathfield?.setValue) {

      mathfield.setValue('');

    }

    setRubricsList([]);

    setRubricCriteria('');

    setRubricPoints('');

    setRubricDescription('');

  };



  const handleRemoveItem = (index) => {

    setTestItems((prevItems) => prevItems.filter((_, i) => i !== index));

  };



  const handleAddAssessment = async (e) => {

    e.preventDefault();

    if (!newAssessment.title || !newAssessment.subjectId || !newAssessment.topic) {

      alert('Please fill out all assessment fields.');

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

        title: newAssessment.title,

        topic: newAssessment.topic,

        description: newAssessment.description,

        items: testItems.map((item, index) => ({

          item_no: index + 1,

          question_type: item.question_type,

          question_content: item.question_content,

          score_per_item: 0,

          max_score_per_item: 0,

          options: item.options,

          correct_answer: item.correct_answer,

          rubrics: item.rubrics || [],

        })),

      };

      await axios.post('http://localhost/Algebra_Assess_Ai/algebra-api/create_assessment.php', payload);

      alert('Assessment created successfully!');

      setNewAssessment({ title: '', subjectId: '', topic: '', description: '' });

      setTestItems([]);

      setItemEntry('');

      if (mathfieldRef.current?.setValue) {

        mathfieldRef.current.setValue('');

      }

      navigate('/teacher/assessments');

    } catch (error) {

      console.error('Failed to create assessment', error);

      alert('We could not save the assessment. Please try again.');

    }

  };



  return (

    <div className="pb-16">

      <div className="mb-8">

        <button

          onClick={() => navigate('/teacher/assessments')}

          className="text-sm font-semibold text-blue-600 hover:underline"

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

              <option value="">Select a subject</option>

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

                  className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.2em] transition ${

                    questionType === option.value

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

                      <math-field

                        ref={mathfieldRef}

                        className="w-full text-lg"

                        virtual-keyboard-mode="manual"

                        smart-mode="auto"

                        style={{ minHeight: '3rem' }}

                      ></math-field>

                      <div className="mt-3 flex flex-wrap gap-2">

                        {SYMBOL_OPTIONS.slice(0, 12).map((symbol) => (

                          <button

                            key={symbol}

                            type="button"

                            onClick={() => handleSymbolInsert(symbol)}

                            className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600 transition"

                          >

                            {symbol}

                          </button>

                        ))}

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

                    onChange={(e) => setMcOptionEntry(e.target.value)}

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

                  <div className="flex flex-col gap-2">

                    <select

                      value={mcCorrectAnswer}

                      onChange={(e) => setMcCorrectAnswer(e.target.value)}

                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700"

                    >

                      <option value="">Select the correct answer</option>

                      {mcOptions.map((option, index) => (

                        <option key={`${option}-${index}`} value={option}>

                          {option}

                        </option>

                      ))}

                    </select>

                    <button

                      type="button"

                      onClick={() => {

                        setMcOptions([]);

                        setMcCorrectAnswer('');

                      }}

                      className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-slate-900 self-start"

                    >

                      Reset options

                    </button>

                  </div>

                )}

              </div>

            )}

          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">

            <div className="flex items-center justify-between">

              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Rubrics</p>

              <span className="text-xs text-slate-500">{rubricsList.length} added</span>

            </div>

            <div className="grid gap-3 md:grid-cols-3">

              <input

                type="text"

                value={rubricCriteria}

                onChange={(e) => setRubricCriteria(e.target.value)}

                placeholder="Criteria name"

                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700"

              />

              <input

                type="number"

                min="0"

                step="0.1"

                value={rubricPoints}

                onChange={(e) => setRubricPoints(e.target.value)}

                placeholder="Points"

                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700"

              />

              <input

                type="text"

                value={rubricDescription}

                onChange={(e) => setRubricDescription(e.target.value)}

                placeholder="Description (optional)"

                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700"

              />

            </div>

            <div className="flex justify-end">

              <button

                type="button"

                onClick={handleAddRubric}

                className="rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-semibold tracking-[0.3em] uppercase hover:bg-slate-800 transition"

              >

                + Add rubric

              </button>

            </div>

            {rubricsList.length > 0 && (

              <div className="space-y-2">

                {rubricsList.map((rubric, index) => (

                  <div

                    key={`${rubric.criteria_name}-${index}`}

                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700"

                  >

                    <div>

                      <p className="font-semibold text-slate-900">{rubric.criteria_name}</p>

                      <p className="text-xs text-slate-500">{rubric.points.toFixed(1)} pts - {rubric.description || 'No description'}</p>

                    </div>

                    <button

                      type="button"

                      onClick={() => handleRemoveRubric(index)}

                      className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 hover:text-rose-700"

                    >

                      Remove

                    </button>

                  </div>

                ))}

              </div>

            )}

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

                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-slate-400">

                      <span>

                        {item.question_type === 'multiple_choice' ? 'Multiple choice' : 'Equation'}

                      </span>

                      <button

                        type="button"

                        onClick={() => handleRemoveItem(index)}

                        className="text-red-600 font-semibold hover:text-red-800"

                      >

                        Remove

                      </button>

                    </div>

                    <p className="text-sm font-semibold text-slate-900">{item.question_content}</p>

                    {item.question_type === 'multiple_choice' && (

                      <p className="text-xs text-slate-500">Correct Answer: {item.correct_answer}</p>

                    )}

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