import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, duration, remaining: duration, paused: false }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pauseToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, paused: true } : t)));
  }, []);

  const resumeToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, paused: false } : t)));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <ToastContainer
        toasts={toasts}
        removeToast={removeToast}
        pauseToast={pauseToast}
        resumeToast={resumeToast}
        setToasts={setToasts}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const icons = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
    </svg>
  ),
};

const accents = {
  success: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', icon: 'text-emerald-500', bar: 'bg-emerald-500' },
  error:   { border: 'border-l-rose-500',    bg: 'bg-rose-50',    icon: 'text-rose-500',    bar: 'bg-rose-500' },
  warning: { border: 'border-l-amber-500',   bg: 'bg-amber-50',   icon: 'text-amber-500',   bar: 'bg-amber-500' },
  info:    { border: 'border-l-blue-500',    bg: 'bg-blue-50',    icon: 'text-blue-500',    bar: 'bg-blue-500' },
};

function ToastItem({ t, removeToast, pauseToast, resumeToast, setToasts }) {
  const accent = accents[t.type] || accents.info;
  const timerRef = useRef(null);
  const remainingRef = useRef(t.remaining);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (t.paused || t.remaining <= 0) return;

    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      setToasts((prev) => prev.filter((p) => p.id !== t.id));
    }, t.remaining);

    return () => {
      clearTimeout(timerRef.current);
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
        setToasts((prev) =>
          prev.map((p) => (p.id === t.id ? { ...p, remaining: remainingRef.current } : p))
        );
      }
    };
  }, [t.id, t.paused]);

  const handleMouseEnter = () => {
    clearTimeout(timerRef.current);
    const elapsed = Date.now() - (startTimeRef.current || Date.now());
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    pauseToast(t.id);
  };

  const handleMouseLeave = () => {
    resumeToast(t.id);
  };

  const progress = t.duration > 0 ? (t.remaining / t.duration) * 100 : 100;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', damping: 22, stiffness: 300 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200/60 border-l-4 ${accent.border} ${accent.bg} px-4 py-3 shadow-lg backdrop-blur-xl`}
    >
      <div className={`mt-0.5 flex-shrink-0 ${accent.icon}`}>
        {icons[t.type] || icons.info}
      </div>
      <p className="flex-1 text-sm font-medium text-slate-700">{t.message}</p>
      <button
        type="button"
        onClick={() => removeToast(t.id)}
        className="flex-shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-600"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
      {t.duration > 0 && (
        <div className="absolute bottom-0 left-4 right-4 h-0.5 overflow-hidden rounded-full bg-slate-200/50">
          <motion.div
            className={`h-full rounded-full ${accent.bar}`}
            initial={{ width: '100%' }}
            animate={t.paused ? undefined : { width: '0%' }}
            transition={t.paused ? { duration: 0 } : { duration: t.remaining / 1000, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
}

function ToastContainer({ toasts, removeToast, pauseToast, resumeToast, setToasts }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[99999] flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            t={t}
            removeToast={removeToast}
            pauseToast={pauseToast}
            resumeToast={resumeToast}
            setToasts={setToasts}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
