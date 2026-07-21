import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Simple, smooth fade page transition. Uses a short fade to avoid overlap and dizziness.
// This removes overlay complexity and relies on AnimatePresence mode="wait" to avoid
// overlapping mounts/unmounts.
const PageTransition = ({ children }) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <div>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: 'easeInOut' }}
      onAnimationComplete={() => window.dispatchEvent(new Event('route-change-end'))}
      style={{ position: 'relative', minHeight: '100vh', willChange: 'opacity' }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
