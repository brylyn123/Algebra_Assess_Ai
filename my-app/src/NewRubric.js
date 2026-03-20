import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

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

const NewRubric = () => {
    const navigate = useNavigate();
    const location = useLocation();
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

    const currentEmail = getCurrentLocalUserEmail();
    const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;

    useEffect(() => {
        if (!currentEmail) {
            setTeacherId(null);
            return;
        }
        const id = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id ?? null;
        setTeacherId(id);
    }, [currentEmail, storedTeacher]);

    useEffect(() => {
        if (!teacherId) {
            setAvailableRubrics([]);
            return;
        }
        const cancelToken = axios.CancelToken.source();
        axios
            .get(`${API_BASE_URL}/get_rubric_sets.php`, {
                params: { teacher_id: teacherId },
                cancelToken: cancelToken.token,
            })
            .then((response) => {
                if (response.data?.status === 'success') {
                    setAvailableRubrics(response.data.rubrics || []);
                }
            })
            .catch((error) => {
                if (!axios.isCancel(error)) {
                    console.error('Unable to load rubric templates', error);
                }
            });
        return () => cancelToken.cancel();
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
                      id: `${item.description ?? ''}-${index}`,
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
            alert('Please add a description for the rubric item.');
            return;
        }
        if (!itemPoints || Number.isNaN(numericPoints) || numericPoints <= 0) {
            alert('Please enter a valid number of max points.');
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
            alert('Provide a label for this level.');
            return;
        }
        if (!levelPointsEntry || Number.isNaN(numericPoints)) {
            alert('Enter a numeric point value for the level.');
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

    const totalPoints = useMemo(
        () => rubricItems.reduce((sum, item) => sum + (Number(item.points) || 0), 0),
        [rubricItems]
    );

    const handleAddRubric = async (e) => {
        e.preventDefault();
        if (!newRubric.name || !newRubric.criteria) {
            alert('Please fill out all rubric fields.');
            return;
        }
        if (rubricItems.length === 0) {
            alert('Please add at least one rubric item with max points.');
            return;
        }
        if (levelDefinitions.length === 0) {
            alert('Please configure at least one point level for this rubric.');
            return;
        }
        if (!teacherId) {
            alert('Unable to determine the teacher account. Please log in again.');
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

            const response = await axios.post(`${API_BASE_URL}/${endpoint}`, payload, {
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.data?.status !== 'success') {
                throw new Error(response.data?.message || 'Unable to save the rubric.');
            }

            alert(successText);
            if (isEditing) {
                navigate('/teacher/assessments');
                return;
            }

            resetToDefaults();
        } catch (error) {
            console.error('Failed to save rubric', error);
            alert(error.message || 'Failed to save rubric. Please try again.');
        }
    };

    return (
        <div>
            <div className="mb-8">
                <button
                    onClick={() => navigate('/teacher/assessments')}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-lg transition hover:bg-blue-700"
                >
                    &larr; Back to Assessments
                </button>
            </div>
            <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 space-y-6 max-w-2xl mx-auto">
                <h2 className="text-xl font-bold text-slate-900">Create a New Rubric</h2>
                <form onSubmit={handleAddRubric} className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Templates</label>
                        <select
                            value={selectedTemplateId}
                            onChange={handleTemplateChange}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                        >
                            <option value="">Start from scratch</option>
                            {availableRubrics.map((rubric) => (
                                <option key={rubric.rubric_set_id} value={rubric.rubric_set_id}>
                                    {rubric.rubric_name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-400">
                            Pick a saved rubric to clone its structure, then tweak the items or instructions.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Rubric Name</label>
                        <input
                            type="text"
                            name="name"
                            value={newRubric.name}
                            onChange={handleRubricChange}
                            placeholder="e.g., Standard Quiz Rubric"
                            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Criteria</label>
                        <textarea
                            name="criteria"
                            value={newRubric.criteria}
                            onChange={handleRubricChange}
                            placeholder="Describe grading criteria here..."
                            rows="5"
                            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Grading Instructions for AI</label>
                        <textarea
                            value={aiInstructions}
                            onChange={(e) => setAiInstructions(e.target.value)}
                            placeholder="Hints for the AI grader (e.g., be lenient on neatness but strict on order of operations)."
                            rows={3}
                            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900">Point Levels (Grid)</p>
                            <span className="text-xs text-slate-500">
                                {levelDefinitions.length} level(s) defined
                            </span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            {levelDefinitions.map((level, index) => (
                                <div
                                    key={`${level.label}-${index}`}
                                    className="rounded-2xl border border-slate-200 bg-white p-3 text-center"
                                >
                                    <p className="text-sm font-semibold text-slate-900">{level.label}</p>
                                    <p className="text-xs text-slate-500 mb-2">{level.points} points</p>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLevelDefinition(index)}
                                        className="text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-600 hover:text-rose-700"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-3 md:grid-cols-[2fr,1fr,auto]">
                            <input
                                type="text"
                                value={levelLabelEntry}
                                onChange={(event) => setLevelLabelEntry(event.target.value)}
                                placeholder="Level label (e.g., Exceeds Expectations)"
                                className="bg-slate-50 border-none rounded-xl px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 transition"
                            />
                            <input
                                type="number"
                                min="0"
                                value={levelPointsEntry}
                                onChange={(event) => setLevelPointsEntry(event.target.value)}
                                placeholder="Points"
                                className="bg-slate-50 border-none rounded-xl px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 transition"
                            />
                            <button
                                type="button"
                                onClick={handleAddLevelDefinition}
                                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow hover:bg-blue-700 transition"
                            >
                                + Add Level
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-700">Rubric Items (max points)</p>
                        <div className="grid gap-3 md:grid-cols-2">
                            <input
                                type="text"
                                value={itemDescription}
                                onChange={(e) => setItemDescription(e.target.value)}
                                placeholder="Criterion description"
                                className="bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                            />
                            <input
                                type="number"
                                min="1"
                                value={itemPoints}
                                onChange={(e) => setItemPoints(e.target.value)}
                                placeholder="Max points"
                                className="bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                            />
                        </div>
                        <div className="text-right">
                            <button
                                type="button"
                                onClick={handleAddRubricItem}
                                className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition"
                            >
                                + Add Criterion
                            </button>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-600">
                            <span>Total points</span>
                            <span className="font-semibold text-slate-900">{totalPoints} pts</span>
                        </div>
                        {rubricItems.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                Add criterion rows so the rubric can capture different skills or competencies.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {rubricItems.map((item, index) => (
                                    <li
                                        key={item.id}
                                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-900">{item.description}</p>
                                            <p className="text-xs text-slate-500">{item.points} points</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRubricItem(index)}
                                            className="text-xs text-rose-600 hover:underline"
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition duration-300"
                    >
                        {isEditing ? 'Update Rubric' : 'Create Rubric'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NewRubric;
