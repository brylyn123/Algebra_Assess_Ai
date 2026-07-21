import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const routeLabels = {
  dashboard: 'Dashboard',
  teacher: 'Teacher',
  student: 'Student',
  subjects: 'Subjects',
  assessments: 'Assessments',
  reports: 'Reports',
  feedback: 'Feedback',
  profile: 'Profile',
  settings: 'Settings',
  catalog: 'Catalog',
  'grade-submissions': 'Grade Submissions',
  new: 'New Assessment',
  'new-rubric': 'New Rubric',
  view: 'View Assessments',
  submit: 'Submit',
  home: 'Home',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length <= 1) return null;

  return (
    <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-400" aria-label="Breadcrumb">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="font-medium transition hover:text-blue-600"
      >
        Home
      </button>
      {pathnames.map((segment, index) => {
        const path = '/' + pathnames.slice(0, index + 1).join('/');
        const isLast = index === pathnames.length - 1;
        const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

        return (
          <React.Fragment key={path}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-slate-300">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
            {isLast ? (
              <span className="font-semibold text-slate-600">{label}</span>
            ) : (
              <button
                type="button"
                onClick={() => navigate(path)}
                className="font-medium transition hover:text-blue-600"
              >
                {label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
