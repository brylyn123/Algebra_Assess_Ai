import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const NewRubric = () => {
    const navigate = useNavigate();
    const [newRubric, setNewRubric] = useState({
        name: '',
        criteria: ''
    });
    const [rubricItems, setRubricItems] = useState([]);
    const [itemDescription, setItemDescription] = useState('');
    const [itemPoints, setItemPoints] = useState('');

    const handleRubricChange = (e) => {
        const { name, value } = e.target;
        setNewRubric(prevState => ({
            ...prevState,
            [name]: value
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
        setRubricItems(prevItems => [
            ...prevItems,
            { description: trimmedDescription, points: numericPoints }
        ]);
        setItemDescription('');
        setItemPoints('');
    };

    const handleRemoveRubricItem = (index) => {
        setRubricItems(prevItems => prevItems.filter((_, i) => i !== index));
    };

    const handleAddRubric = (e) => {
        e.preventDefault();
        if (!newRubric.name || !newRubric.criteria) {
            alert('Please fill out all rubric fields.');
            return;
        }
        if (rubricItems.length === 0) {
            alert('Please add at least one rubric item with max points.');
            return;
        }
        const itemSummary = rubricItems
            .map((item, index) => `${index + 1}. ${item.description} (${item.points} pts)`)
            .join('\n');
        alert(
            `New Rubric Created:\nName: ${newRubric.name}\nCriteria: ${newRubric.criteria}\nItems:\n${itemSummary}`
        );
        setNewRubric({ name: '', criteria: '' });
        setRubricItems([]);
        setItemDescription('');
        setItemPoints('');
    };

    return (
        <div>
            <div className="mb-8">
                <button onClick={() => navigate('/teacher/assessments')} className="text-sm font-semibold text-blue-600 hover:underline">
                    &larr; Back to Assessments
                </button>
            </div>
            <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 space-y-6 max-w-2xl mx-auto">
                <h2 className="text-xl font-bold text-slate-900">Create a New Rubric</h2>
                <form onSubmit={handleAddRubric} className="space-y-4">
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
                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-700">Rubric Items (add max points per criterion)</p>
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
                                value={itemPoints}
                                onChange={(e) => setItemPoints(e.target.value)}
                                placeholder="Max points"
                                min="1"
                                className="bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleAddRubricItem}
                            className="px-4 py-2 rounded-2xl bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition"
                        >
                            + Add Criterion
                        </button>
                        {rubricItems.length > 0 && (
                            <ul className="space-y-2">
                                {rubricItems.map((item, index) => (
                                    <li
                                        key={`${item.description}-${index}`}
                                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-900">{item.description}</p>
                                            <p className="text-xs text-slate-500">{item.points} points</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRubricItem(index)}
                                            className="text-xs text-red-600 hover:underline"
                                        >
                                            remove
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
                        Create Rubric
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NewRubric;
