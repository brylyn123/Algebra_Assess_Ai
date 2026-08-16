import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const PageTransition = ({ children }) => {
  const prefersReducedMotion = useReducedMotion();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const onStart = () => setIsNavigating(true);
    const onEnd = () => setIsNavigating(false);

    window.addEventListener('route-change-start', onStart);
    window.addEventListener('route-change-end', onEnd);
    return () => {
      window.removeEventListener('route-change-start', onStart);
      window.removeEventListener('route-change-end', onEnd);
    };
  }, []);

  if (prefersReducedMotion) return <div>{children}</div>;

  return (
    <>
      <AnimatePresence>
        {isNavigating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[9998] flex flex-col items-center justify-center backdrop-blur-md"
            style={{ backgroundColor: 'rgba(241, 245, 249, 0.7)' }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-4">
                <div className="h-10 w-10 rounded-full border-[3px] border-blue-200 border-t-blue-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-3.5 w-3.5 rounded-full bg-blue-500 animate-pulse" />
                </div>
              </div>
              <p className="text-[11px] font-semibold text-blue-500/80 tracking-wide">Loading...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        onAnimationComplete={() => window.dispatchEvent(new Event('route-change-end'))}
        style={{ position: 'relative', willChange: 'opacity' }}
      >
        {children}
      </motion.div>
    </>
  );
};

export default PageTransition;
