import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const quickActions = [
  { label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { label: 'Manage Subjects', icon: '📚', path: '/dashboard/subjects' },
  { label: 'Manage Assessments', icon: '🗂️', path: '/teacher/assessments' },
  { label: 'Grade Submissions', icon: '✏️', path: '/teacher/grade-submissions' },
  { label: 'Results & Feedback', icon: '💬', path: '/teacher/feedback' },
  { label: 'View Reports', icon: '📈', path: '/teacher/reports' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State to hold teacher data from the signup/login
  const [teacherName, setTeacherName] = useState('Teacher');

  useEffect(() => {
    // Retrieve the user data stored during registration/login
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      // Use the firstName field from your database
      setTeacherName(parsedUser.firstName || 'Teacher');
    }
  }, []);

  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const performLogout = () => {
    localStorage.removeItem('user');
    setLogoutConfirm(false);
    navigate('/login');
  };

  const handleLogout = () => {
    setLogoutConfirm(true);
  };

  return (
    <>
      {logoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-[1.5rem] bg-white p-6 text-center shadow-[0_25px_60px_rgba(15,23,42,0.35)] space-y-4">
            <p className="text-lg font-semibold text-slate-900">Are you sure you want to logout?</p>
            <p className="text-sm text-slate-500">You can always login again to pick up where you left off.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={performLogout}
                className="px-6 py-2 rounded-2xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 transition"
              >
                Proceed
              </button>
              <button
                onClick={() => setLogoutConfirm(false)}
                className="px-6 py-2 rounded-2xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        className="min-h-screen bg-slate-50"
      style={{
        backgroundImage:
          'linear-gradient(#cbd7ed 1px, transparent 1px), linear-gradient(90deg, #cbd7ed 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        backgroundColor: '#e0edff',
      }}
    >
      {/* Header Section */}
      <header className="bg-blue-600 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">A</div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/80">AlgebraAssess</p>
              <p className="text-lg font-bold">Teacher Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-full border border-white/30 px-4 py-2 bg-white/5">
              <div className="w-9 h-9 rounded-full bg-white text-blue-600 font-bold flex items-center justify-center">
                {teacherName.charAt(0)}
              </div>
              <div className="text-sm">
                <p className="font-semibold text-white leading-none">{teacherName}</p>
                <p className="text-xs text-white/70">Online</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-red-500 hover:border-red-500 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-10 px-6">
        <div className="flex gap-8 relative">
          
          {/* Fixed Sidebar */}
          <aside className="hidden lg:block w-[260px] shrink-0">
            <div className="bg-white rounded-[2rem] p-6 shadow-lg border border-slate-100 space-y-6 sticky top-28 h-[calc(100vh-160px)] overflow-y-auto">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-4 ml-2">Quick Actions</p>
                <nav className="space-y-1">
                  {quickActions.map((action) => {
                    const isActive =
                      location.pathname === action.path ||
                      (action.path !== '/dashboard' && location.pathname.startsWith(`${action.path}/`)) ||
                      (action.path === '/dashboard' && location.pathname === '/dashboard');
                    return (
                      <button
                        key={action.label}
                        onClick={() => navigate(action.path)}
                        className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                        }`}
                      >
                        <span className="text-lg">{action.icon}</span>
                        <span>{action.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-4 ml-2">Account Settings</p>
                <div className="space-y-1">
                  {(() => {
                    const isTeacherZone = location.pathname.startsWith('/teacher');
                    const profilePath = isTeacherZone ? '/teacher/profile' : '/dashboard/profile';
                    const settingsPath = isTeacherZone ? '/teacher/settings' : '/dashboard/settings';
                    return (
                      <>
                        <button
                          onClick={() => navigate(profilePath)}
                          className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
                            location.pathname === profilePath ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <span>👤</span> Profile
                        </button>
                        <button
                          onClick={() => navigate(settingsPath)}
                          className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
                            location.pathname === settingsPath ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <span>⚙️</span> Settings
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <section className="flex-1 min-w-0">
            <div className="bg-transparent rounded-3xl min-h-[600px]">
               <Outlet context={{ teacherName }} />
            </div>
          </section>

        </div>
      </main>
    </div>
    </>
  );
};

export default Dashboard;
