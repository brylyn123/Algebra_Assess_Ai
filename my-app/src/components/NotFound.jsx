import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-8 text-center shadow-2xl backdrop-blur-xl"
      >
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
          <span className="text-5xl font-black text-blue-600">404</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Page Not Found</h2>
        <p className="mt-2 text-sm text-slate-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="teacher-secondary-btn"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="teacher-primary-btn"
          >
            Go Home
          </button>
        </div>
      </motion.div>
    </div>
  );
}
