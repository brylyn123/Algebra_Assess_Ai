import React from 'react';

const LoadingSpinner = ({ fullScreen = false, message = '' }) => {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #dbeafe 100%)',
        }}
      >
        <div className="relative mb-6">
          <div className="h-14 w-14 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 rounded-full bg-blue-500 animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-blue-600 tracking-wide">AlgebraAssess</p>
          {message && <p className="mt-1 text-xs text-slate-500">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative mb-4">
        <div className="h-10 w-10 rounded-full border-3 border-blue-100 border-t-blue-600 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-4 rounded-full bg-blue-600 animate-pulse" />
        </div>
      </div>
      {message && <p className="text-xs text-slate-500">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
