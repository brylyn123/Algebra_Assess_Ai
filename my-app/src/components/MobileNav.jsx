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
              className="fixed inset-y-0 left-0 z-[9999] w-[280px] p-6 shadow-2xl lg:hidden"
              style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)' }}
            >
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm font-bold uppercase tracking-widest text-blue-200">{label}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-200 transition hover:bg-white/20 hover:text-white"
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
                          className={`relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        isActive
                          ? 'text-blue-700 shadow-lg shadow-blue-800/30'
                          : 'text-blue-100 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute inset-0 rounded-xl bg-white/90 shadow-sm" />
                      )}
                      <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-lg text-[10px] ${isActive ? 'bg-blue-500 text-white' : 'bg-white/20'}`}>
                        {action.icon}
                      </span>
                      <span className="relative z-10">{action.label}</span>
                    </button>
                  );
                })}
              </nav>

              {accountActions.length > 0 && (
                <div className="mt-6 border-t border-white/20 pt-6">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-blue-200">Account</p>
                  <div className="space-y-1">
                    {accountActions.map((action) => {
                      const isActive = location.pathname === action.path;
                      return (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => handleNav(action.path)}
                      className={`relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                            isActive
                              ? 'text-blue-700 shadow-lg shadow-blue-800/30'
                              : 'text-blue-100 hover:bg-white/15 hover:text-white'
                          }`}
                        >
                          {isActive && (
                            <span className="absolute inset-0 rounded-xl bg-white/90 shadow-sm" />
                          )}
                          <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-lg text-[10px] ${isActive ? 'bg-blue-500 text-white' : 'bg-white/20'}`}>
                            {action.icon}
                          </span>
                          <span className="relative z-10">{action.label}</span>
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
