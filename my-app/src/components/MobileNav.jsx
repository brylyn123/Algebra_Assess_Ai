import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileNav({ actions = [], accountActions = [], label = 'Navigation' }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 transition hover:bg-white/30 lg:hidden"
        aria-label="Open navigation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-white">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-sm lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="fixed inset-y-0 left-0 z-[9999] w-[280px] bg-white p-6 shadow-2xl lg:hidden"
            >
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>

              <nav className="space-y-1">
                {actions.map((action) => {
                  const isActive =
                    action.path === location.pathname ||
                    (action.path !== '/' && location.pathname.startsWith(action.path + '/'));
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => handleNav(action.path)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                      }`}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-current/10 bg-white/15 text-xs">
                        {action.icon}
                      </span>
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </nav>

              {accountActions.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Account</p>
                  <div className="space-y-1">
                    {accountActions.map((action) => {
                      const isActive = location.pathname === action.path;
                      return (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => handleNav(action.path)}
                          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                          }`}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-current/10 bg-white/15 text-xs">
                            {action.icon}
                          </span>
                          <span>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
