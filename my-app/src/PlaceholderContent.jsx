import React from 'react';

const PlaceholderContent = ({ title, description }) => {
    return (
        <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 space-y-4">
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            <p className="text-slate-500">{description}</p>
            <div className="border-t border-slate-200 pt-4 mt-4">
                <p className="text-center text-slate-400">Functionality for this section will be implemented here.</p>
            </div>
        </div>
    );
};

export default PlaceholderContent;