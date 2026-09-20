import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const PageTransition = ({ children }) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return <div>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
