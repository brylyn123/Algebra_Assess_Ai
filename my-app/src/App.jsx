import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import PageTransition from './PageTransition';
import PublicBackground from './PublicBackground';
import './App.css';
import Landing from './landing';
import AuthPage from './AuthPage';
import Dashboard from './dashboard';
import ProgressBar from './components/ProgressBar';
import DashboardHome from './DashboardHome';
import ManageSubjects from './ManageSubjects';
import ManageAssessments from './ManageAssessments';
import NewAssessment from './NewAssessment';
import QuestionEditor from './QuestionEditor';
import NewRubric from './NewRubric';
import ViewAssessmentsPage from './ViewAssessmentsPage';
import TeacherProfile from './TeacherProfile';
import TeacherSettings from './TeacherSettings';
import TeacherReports from './TeacherReports';
import AdminCatalog from './AdminCatalog';
import StudentDashboard, { StudentOverview, StudentSubjects } from './StudentDashboard';
import StudentReports from './StudentReports';
import StudentProfile from './StudentProfile';
import SubmitAssessment from './SubmitAssessment';
import GradeSubmissions from './GradeSubmissions';
import SubjectDetails from './SubjectDetails';
import RequireAuth from './RequireAuth';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './components/NotFound';
import ResetPassword from './ResetPassword';
import { ToastProvider } from './components/Toast';

const TeacherDashboard = Dashboard;
const TeacherOverview = DashboardHome;

const STAFF_ROLES = ['teacher', 'admin'];
const TEACHER_ROLES = ['teacher'];
const STUDENT_ROLES = ['student'];

function AnimatedRoutes() {
  const location = useLocation();
  const pageKey = location.pathname;
  const withTransition = (element) => <PageTransition key={pageKey}>{element}</PageTransition>;

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('route-change-end'));
    }, 300);
    return () => clearTimeout(timer);
  }, [location.key]);

  return (
    <div className="page-stage">
      <Routes location={location}>
        <Route path="/" element={withTransition(<Landing />)} />
        <Route path="/login" element={withTransition(<AuthPage />)} />
        <Route path="/signup" element={withTransition(<AuthPage />)} />
        <Route path="/reset-password" element={withTransition(<ResetPassword />)} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth allowedRoles={STAFF_ROLES}>
              <Dashboard />
            </RequireAuth>
          }
        >
          <Route index element={withTransition(<DashboardHome />)} />
          <Route path="subjects" element={withTransition(<ManageSubjects />)} />
          <Route path="catalog" element={withTransition(<AdminCatalog />)} />
          <Route path="subjects/:id" element={<SubjectDetails key={pageKey} />} />
          <Route path="profile" element={withTransition(<TeacherProfile />)} />
          <Route path="settings" element={withTransition(<TeacherSettings />)} />
        </Route>
        <Route
          path="/teacher"
          element={
            <RequireAuth allowedRoles={TEACHER_ROLES}>
              <TeacherDashboard />
            </RequireAuth>
          }
        >
          <Route index element={withTransition(<TeacherOverview />)} />
          <Route path="subjects" element={withTransition(<ManageSubjects />)} />
          <Route path="subjects/:id" element={<SubjectDetails key={pageKey} />} />
          <Route path="assessments">
            <Route index element={withTransition(<ManageAssessments />)} />
            <Route path="view" element={withTransition(<ViewAssessmentsPage />)} />
            <Route path="new" element={withTransition(<NewAssessment />)} />
            <Route path="edit/:id" element={withTransition(<NewAssessment />)} />
            <Route path="edit-questions" element={withTransition(<QuestionEditor />)} />
            <Route path="new-rubric" element={withTransition(<NewRubric />)} />
          </Route>
          <Route path="grade-submissions" element={withTransition(<GradeSubmissions />)} />
          <Route path="reports" element={withTransition(<TeacherReports />)} />
          <Route path="profile" element={withTransition(<TeacherProfile />)} />
          <Route path="settings" element={withTransition(<TeacherSettings />)} />
        </Route>
        <Route
          path="/student"
          element={
            <RequireAuth allowedRoles={STUDENT_ROLES}>
              <StudentDashboard />
            </RequireAuth>
          }
        >
          <Route index element={withTransition(<StudentOverview />)} />
          <Route path="subjects" element={withTransition(<StudentSubjects />)} />
          <Route path="subjects/:id" element={withTransition(<StudentSubjects />)} />
          <Route path="submit" element={withTransition(<SubmitAssessment />)} />
          <Route path="reports" element={withTransition(<StudentReports />)} />
          <Route path="profile" element={withTransition(<StudentProfile />)} />
        </Route>
        <Route path="*" element={withTransition(<NotFound />)} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router future={{ v7_relativeSplatPath: true }}>
      <ToastProvider>
        <ErrorBoundary>
          {/* persistent background element to prevent white flashes between route changes */}
          <div className="app-bg" aria-hidden="true" />
          <PublicBackground />
          <ProgressBar />
          <AnimatedRoutes />
        </ErrorBoundary>
      </ToastProvider>
    </Router>
  );
}

export default App;
