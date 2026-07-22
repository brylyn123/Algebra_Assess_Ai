import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from './axiosClient';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import { useToast } from './components/Toast';
import Select from './components/Select';

const NEW_RUBRIC_STORAGE_KEY = 'teacher:new-rubric-created';

const buildDefaultLevelDefinitions = () => [
    { label: 'Exceeds Expectations', points: 5 },
    { label: 'Meets Expectations', points: 3 },
    { label: 'Below Expectations', points: 1 },
];

const normalizeLevelDefinitions = (input) => {
    if (!Array.isArray(input)) {
        return buildDefaultLevelDefinitions();
    }
    const normalized = input
        .map((entry) => ({
            label: String(entry?.label ?? '').trim(),
            points: Number(entry?.points ?? 0),
        }))
        .filter((entry) => entry.label && Number.isFinite(entry.points));
    return normalized.length ? normalized : buildDefaultLevelDefinitions();
};

const RUBRIC_STEPS = [
    { id: 'name', label: 'Name', description: 'Template & title' },
    { id: 'style', label: 'Grading Style', description: 'AI instructions' },
    { id: 'levels', label: 'Point Levels', description: 'Mastery tiers' },
    { id: 'criteria', label: 'Criteria', description: 'Criterion list + scoring' },
];

const MATH_TEMPLATE_CRITERIA = 'Correct Setup, Accurate Computation, Final Answer Format';
const MATH_TEMPLATE_AI = 'Prioritize algebraic setup, accurate computation, and a tidy final answer format.';
const MATH_TEMPLATE_ITEMS = [
    { id: 'math-setup', description: 'Correct Setup', points: 4 },
    { id: 'math-computation', description: 'Accurate Computation', points: 4 },
    { id: 'math-final', description: 'Final Answer Format', points: 2 },
];

const NewRubric = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const [newRubric, setNewRubric] = useState({ name: '', criteria: '' });
    const [rubricItems, setRubricItems] = useState([]);
    const [itemDescription, setItemDescription] = useState('');
    const [itemPoints, setItemPoints] = useState('');
    const [aiInstructions, setAiInstructions] = useState('');
    const [levelDefinitions, setLevelDefinitions] = useState(() => buildDefaultLevelDefinitions());
    const [levelLabelEntry, setLevelLabelEntry] = useState('');
    const [levelPointsEntry, setLevelPointsEntry] = useState('');
    const [teacherId, setTeacherId] = useState(null);
    const [availableRubrics, setAvailableRubrics] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingRubricId, setEditingRubricId] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);

    const currentEmail = getCurrentLocalUserEmail();
    const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;

    useEffect(() => {
        if (!currentEmail) {
            setTeacherId(null);
            return;
        }
        const id = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id ?? null;
        setTeacherId(id);
    }, [currentEmail, storedTeacher]);

    useEffect(() => {
        if (!teacherId) {
            setAvailableRubrics([]);
            return;
        }
        const controller = new AbortController();
        axios
            .get('/get_rubric_sets.php', {
                params: { teacher_id: teacherId },
                signal: controller.signal,
            })
            .then((response) => {
                if (response.data?.status === 'success') {
                    setAvailableRubrics(response.data.rubrics || []);
                }
            })
            .catch((error) => {
                if (axios.isCancel?.(error) || error.name === 'CanceledError') {
                    return;
                }
                console.error('Unable to load rubric templates', error);
            });
        return () => controller.abort();
    }, [teacherId]);

    const applyRubricSource = (source) => {
        setNewRubric({
            name: source.rubric_name ?? '',
            criteria: source.criteria ?? '',
        });
        setRubricItems(
            Array.isArray(source.items)
                ? source.items.map((item, index) => ({
                    description: item.description ?? '',
                    points: Number(item.points ?? 0),
                    id: `${item.description ?? 'item'}-${index}`,
                }))
                : []
        );
        setAiInstructions(source.ai_instructions ?? '');
        setLevelDefinitions(normalizeLevelDefinitions(source.level_definitions));
    };

    const resetToDefaults = () => {
        setNewRubric({ name: '', criteria: '' });
        setRubricItems([]);
        setItemDescription('');
        setItemPoints('');
        setAiInstructions('');
        setLevelDefinitions(buildDefaultLevelDefinitions());
        setSelectedTemplateId('');
        setLevelLabelEntry('');
        setLevelPointsEntry('');
        setCurrentStep(0);
    };

    useEffect(() => {
        const editingRubric = location.state?.editingRubric;
        if (editingRubric) {
            setIsEditing(true);
            setEditingRubricId(editingRubric.rubric_set_id);
            setSelectedTemplateId('');
            applyRubricSource(editingRubric);
        } else {
            setIsEditing(false);
            setEditingRubricId(null);
            resetToDefaults();
        }
    }, [location.state]);

    const handleRubricChange = (e) => {
        const { name, value } = e.target;
        setNewRubric((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleAddRubricItem = () => {
        const trimmedDescription = itemDescription.trim();
        const numericPoints = Number(itemPoints);
        if (!trimmedDescription) {
            toast.warning('Please add a description for the rubric item.');
            return;
        }
        if (!itemPoints || Number.isNaN(numericPoints) || numericPoints <= 0) {
            toast.warning('Please enter a valid number of max points.');
            return;
        }
        setRubricItems((prevItems) => [
            ...prevItems,
            {
                description: trimmedDescription,
                points: numericPoints,
                id: `${trimmedDescription}-${prevItems.length}`,
            },
        ]);
        setItemDescription('');
        setItemPoints('');
    };

    const handleRemoveRubricItem = (index) => {
        setRubricItems((prevItems) => prevItems.filter((_, i) => i !== index));
    };

    const handleAddLevelDefinition = () => {
        const trimmedLabel = levelLabelEntry.trim();
        const numericPoints = Number(levelPointsEntry);
        if (!trimmedLabel) {
            toast.warning('Provide a label for this level.');
            return;
        }
        if (!levelPointsEntry || Number.isNaN(numericPoints)) {
            toast.warning('Enter a numeric point value for the level.');
            return;
        }
        setLevelDefinitions((prev) => [
            ...prev,
            { label: trimmedLabel, points: numericPoints },
        ]);
        setLevelLabelEntry('');
        setLevelPointsEntry('');
    };

    const handleRemoveLevelDefinition = (index) => {
        setLevelDefinitions((prev) => prev.filter((_, i) => i !== index));
    };

    const handleTemplateChange = (event) => {
        const value = event.target.value;
        setSelectedTemplateId(value);
        if (!value) {
            setIsEditing(false);
            setEditingRubricId(null);
            resetToDefaults();
            return;
        }
        const template = availableRubrics.find(
            (rubric) => String(rubric.rubric_set_id) === value
        );
        if (template) {
            setIsEditing(false);
            setEditingRubricId(null);
            applyRubricSource(template);
        }
    };

    const loadMathTemplate = () => {
        setNewRubric((prev) => ({
            ...prev,
            criteria: MATH_TEMPLATE_CRITERIA,
        }));
        setAiInstructions(MATH_TEMPLATE_AI);
        setRubricItems(
            MATH_TEMPLATE_ITEMS.map((item, index) => ({
                ...item,
                id: `${item.id}-${index}`,
            }))
        );
        setCurrentStep(RUBRIC_STEPS.length - 1);
    };

    const goToNextStep = () => {
        setCurrentStep((prev) => Math.min(prev + 1, RUBRIC_STEPS.length - 1));
    };

    const goToPrevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const totalPoints = useMemo(
        () => rubricItems.reduce((sum, item) => sum + (Number(item.points) || 0), 0),
        [rubricItems]
    );

    const selectedTemplatePreview = useMemo(
        () =>
            availableRubrics.find(
                (rubric) => String(rubric.rubric_set_id) === selectedTemplateId
            ) ?? null,
        [availableRubrics, selectedTemplateId]
    );

    const handleAddRubric = async (e) => {
        e.preventDefault();
        if (!newRubric.name || !newRubric.criteria) {
            toast.warning('Please fill out all rubric fields.');
            return;
        }
        if (newRubric.name.length > 255) {
            toast.warning('Rubric name must be under 255 characters.');
            return;
        }
        if (newRubric.criteria.length > 5000) {
            toast.warning('Criteria must be under 5000 characters.');
            return;
        }
        if (aiInstructions.length > 5000) {
            toast.warning('AI instructions must be under 5000 characters.');
            return;
        }
        if (rubricItems.length === 0) {
            toast.warning('Please add at least one rubric item with max points.');
            return;
        }
        if (levelDefinitions.length === 0) {
            toast.warning('Please configure at least one point level for this rubric.');
            return;
        }
        if (!teacherId) {
            toast.error('Unable to determine the teacher account. Please log in again.');
            return;
        }

        try {
            const payload = {
                teacher_id: teacherId,
                name: newRubric.name.trim(),
                criteria: newRubric.criteria.trim(),
                items: rubricItems,
                ai_instructions: aiInstructions.trim(),
                level_definitions: levelDefinitions,
            };
            let endpoint = 'create_rubric.php';
            let successText = `Rubric stored! Name: ${newRubric.name}\nCriteria: ${newRubric.criteria}`;

            if (isEditing && editingRubricId) {
                endpoint = 'update_rubric_set.php';
                payload.rubric_set_id = editingRubricId;
                successText = `Rubric updated! Name: ${newRubric.name}\nCriteria: ${newRubric.criteria}`;
            }

            const response = await axios.post(`/${endpoint}`, payload, {
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.data?.status !== 'success') {
                throw new Error(response.data?.message || 'Unable to save the rubric.');
            }

            if (!isEditing && typeof window !== 'undefined') {
                window.localStorage.setItem(
                    NEW_RUBRIC_STORAGE_KEY,
                    JSON.stringify({
                        teacherId,
                        rubricSetId: response.data?.rubric_set_id ?? null,
                        savedAt: new Date().toISOString(),
                    })
                );
            }

            toast.success(successText);
            if (isEditing) {
                navigate('/teacher/assessments');
                return;
            }

            if (location.state?.returnToAssessment) {
                navigate('/teacher/assessments/new');
                return;
            }

            resetToDefaults();
        } catch (error) {
            console.error('Failed to save rubric', error);
            toast.error(error.message || 'Failed to save rubric. Please try again.');
        }
    };

    const modalRoot = typeof document !== 'undefined' ? document.body : null;

    if (!modalRoot) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden bg-slate-950/55 px-4 py-6 backdrop-blur-md md:px-6 md:py-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_38%)]" />
            <div className="pointer-events-none absolute inset-0 bg-white/10" />
            <div className="relative w-full max-w-[920px]">
                <div className="mx-auto overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_rgba(16,185,129,0.2)] backdrop-blur-xl">
                    {/* Header with gradient */}
                    <div className="relative bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 px-6 py-5 md:px-8">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                                            <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{isEditing ? 'Edit Rubric' : 'Create Rubric'}</h2>
                                        <p className="text-sm text-emerald-100/80">Build grading criteria with point levels and AI instructions.</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate(location.state?.returnToAssessment ? '/teacher/assessments/new' : '/teacher/assessments')}
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
                            {RUBRIC_STEPS.map((step, index) => {
                                const active = index === currentStep;
                                const completed = index < currentStep;
                                return (
                                    <button
                                        key={step.id}
                                        type="button"
                                        onClick={() => setCurrentStep(index)}
                                        className={`flex-1 rounded-xl border px-3 py-2 text-left transition ${active ? 'border-emerald-600 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${active ? 'bg-emerald-600 text-white' : completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
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
                        <form onSubmit={handleAddRubric} className="space-y-5">
                            {currentStep === 0 && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Templates</p>
                                        <Select
                                            value={selectedTemplateId}
                                            onChange={handleTemplateChange}
                                            placeholder="Start from scratch"
                                        >
                                            {availableRubrics.map((rubric) => (
                                                <option key={rubric.rubric_set_id} value={rubric.rubric_set_id}>
                                                    {rubric.rubric_name}
                                                </option>
                                            ))}
                                        </Select>
                                        <p className="mt-1 text-[10px] text-slate-400">Pick a saved rubric to clone its structure.</p>

                                        {selectedTemplatePreview && (
                                            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Template Preview</p>
                                                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedTemplatePreview.rubric_name}</p>
                                                {selectedTemplatePreview.criteria && (
                                                    <p className="mt-1 text-xs text-slate-600">{selectedTemplatePreview.criteria}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Rubric Name</p>
                                        <input
                                            type="text"
                                            name="name"
                                            value={newRubric.name}
                                            onChange={handleRubricChange}
                                            placeholder="e.g., Standard Quiz Rubric"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 1 && (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Grading Instructions</p>
                                    <textarea
                                        value={aiInstructions}
                                        onChange={(e) => setAiInstructions(e.target.value)}
                                        placeholder="Hints for the AI grader (e.g., be understanding on neatness but strict on sequence of operations)."
                                        rows={4}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                    />
                                    <p className="mt-1 text-[10px] text-slate-400">Your notes guide the AI on how to interpret student work.</p>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Point Levels</p>
                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">{levelDefinitions.length} levels</span>
                                        </div>
                                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                            <table className="min-w-full text-left text-sm text-slate-600">
                                                <thead className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                                                    <tr>
                                                        <th className="px-3 py-2 font-semibold">Level</th>
                                                        <th className="px-3 py-2 font-semibold">Points</th>
                                                        <th className="px-3 py-2 font-semibold text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {levelDefinitions.map((level, index) => (
                                                        <tr key={`${level.label}-${index}`}>
                                                            <td className="px-3 py-2 text-xs font-semibold text-slate-900">{level.label}</td>
                                                            <td className="px-3 py-2 text-xs">{level.points}</td>
                                                            <td className="px-3 py-2 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveLevelDefinition(index)}
                                                                    className="text-[9px] font-semibold uppercase tracking-[0.2em] text-rose-600 hover:text-rose-700"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Add New Level</p>
                                        <div className="grid gap-2 md:grid-cols-[2fr,1fr,auto]">
                                            <input
                                                type="text"
                                                value={levelLabelEntry}
                                                onChange={(event) => setLevelLabelEntry(event.target.value)}
                                                placeholder="Level label (e.g., Exceeds Expectations)"
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                value={levelPointsEntry}
                                                onChange={(event) => setLevelPointsEntry(event.target.value)}
                                                placeholder="Points"
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddLevelDefinition}
                                                className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white shadow hover:bg-emerald-700 transition"
                                            >
                                                + Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Criteria</p>
                                            <button
                                                type="button"
                                                onClick={loadMathTemplate}
                                                className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-600 hover:text-emerald-800"
                                            >
                                                Load Math Template
                                            </button>
                                        </div>
                                        <textarea
                                            name="criteria"
                                            value={newRubric.criteria}
                                            onChange={handleRubricChange}
                                            placeholder="Describe grading criteria here..."
                                            rows={3}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                        />
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Add Criterion</p>
                                        <div className="grid gap-2 md:grid-cols-2">
                                            <input
                                                type="text"
                                                value={itemDescription}
                                                onChange={(e) => setItemDescription(e.target.value)}
                                                placeholder="Criterion description"
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                            />
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={itemPoints}
                                                    onChange={(e) => setItemPoints(e.target.value)}
                                                    placeholder="Max points"
                                                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddRubricItem}
                                                    className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white shadow hover:bg-emerald-700 transition"
                                                >
                                                    + Add
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2">
                                        <span className="text-xs text-slate-600">Total points</span>
                                        <span className="text-sm font-bold text-slate-900">{totalPoints} pts</span>
                                    </div>

                                    {rubricItems.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Added Criteria</p>
                                            {rubricItems.map((item, index) => (
                                                <div
                                                    key={item.id ?? `${item.description}-${index}`}
                                                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:shadow-sm"
                                                >
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[10px] font-bold text-emerald-700">
                                                        {index + 1}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-medium text-slate-700">{item.description}</p>
                                                        <p className="text-[10px] text-slate-400">{item.points} pts</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRubricItem(index)}
                                                        className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-700"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Navigation */}
                            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                                {currentStep > 0 ? (
                                    <button
                                        type="button"
                                        onClick={goToPrevStep}
                                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                                    >
                                        ← Back
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-slate-400">Start with naming the rubric</span>
                                )}
                                {currentStep < RUBRIC_STEPS.length - 1 ? (
                                    <button
                                        type="button"
                                        onClick={goToNextStep}
                                        className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-700 hover:shadow-lg active:scale-[0.97]"
                                    >
                                        Continue →
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.97]"
                                    >
                                        {isEditing ? 'Update Rubric' : 'Create Rubric'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>,
        modalRoot
    );
};

export default NewRubric;
