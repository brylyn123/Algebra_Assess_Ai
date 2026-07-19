import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchSession, isRoleAllowed } from './auth';

const loadingStyles = 'min-h-screen grid place-items-center bg-slate-50 text-slate-700';

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
    return <div className={loadingStyles}>Checking your session…</div>;
  }

  return children;
};

export default RequireAuth;
