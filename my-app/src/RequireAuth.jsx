import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchSession, isRoleAllowed } from './auth';
import { motion } from 'framer-motion';

const RequireAuth = ({ allowedRoles = ['teacher', 'student', 'admin'], children }) => {
  const [status, setStatus] = useState('loading');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      try {
        const user = await fetchSession();
        if (!isRoleAllowed(user.role, allowedRoles)) {
          throw new Error('You are not authorized to view this page.');
        }

        if (active) {
          setStatus('authenticated');
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus('unauthenticated');
        navigate('/login', {
          replace: true,
          state: {
            from: location,
            message: error instanceof Error ? error.message : 'Please log in to continue.',
          },
        });
      }
    };

    verifySession();
    return () => {
      active = false;
    };
  }, [allowedRoles, location, navigate]);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center backdrop-blur-md"
        style={{ backgroundColor: 'rgba(214, 232, 255, 0.7)' }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          <div className="relative mb-4">
            <div className="h-10 w-10 rounded-full border-[3px] border-blue-200 border-t-blue-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-3.5 w-3.5 rounded-full bg-blue-500 animate-pulse" />
            </div>
          </div>
          <p className="text-[11px] font-semibold text-blue-500/80 tracking-wide">Verifying session...</p>
        </motion.div>
      </div>
    );
  }

  return children;
};

export default RequireAuth;
