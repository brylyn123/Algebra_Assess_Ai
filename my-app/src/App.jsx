import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageTransition from './PageTransition';
import './App.css';
import Landing from './landing';
import Login from './login';
import Signup from './signup';
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
import TeacherFeedback from './TeacherFeedback';
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

const withTransition = (element) => <PageTransition>{element}</PageTransition>;

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div className="page-stage">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={withTransition(<Landing />)} />
          <Route path="/login" element={withTransition(<Login />)} />
          <Route path="/signup" element={withTransition(<Signup />)} />
          <Route path="/reset-password" element={withTransition(<ResetPassword />)} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth allowedRoles={['teacher', 'admin']}>
                <Dashboard />
              </RequireAuth>
            }
          >
            <Route index element={withTransition(<DashboardHome />)} />
            <Route path="subjects" element={withTransition(<ManageSubjects />)} />
            <Route path="catalog" element={withTransition(<AdminCatalog />)} />
            <Route path="subjects/:id" element={<SubjectDetails />} />
            <Route path="profile" element={withTransition(<TeacherProfile />)} />
            <Route path="settings" element={withTransition(<TeacherSettings />)} />
          </Route>
          <Route
            path="/teacher"
            element={
              <RequireAuth allowedRoles={['teacher']}>
                <TeacherDashboard />
              </RequireAuth>
            }
          >
            <Route index element={withTransition(<TeacherOverview />)} />
            <Route path="subjects" element={withTransition(<ManageSubjects />)} />
            <Route path="subjects/:id" element={<SubjectDetails />} />
            <Route path="assessments">
              <Route index element={withTransition(<ManageAssessments />)} />
              <Route path="view" element={withTransition(<ViewAssessmentsPage />)} />
              <Route path="new" element={withTransition(<NewAssessment />)} />
              <Route path="edit/:id" element={withTransition(<NewAssessment />)} />
              <Route path="edit-questions" element={withTransition(<QuestionEditor />)} />
              <Route path="new-rubric" element={withTransition(<NewRubric />)} />
            </Route>
            <Route path="grade-submissions" element={withTransition(<GradeSubmissions />)} />
            <Route path="feedback" element={withTransition(<TeacherFeedback />)} />
            <Route path="reports" element={withTransition(<TeacherReports />)} />
            <Route path="profile" element={withTransition(<TeacherProfile />)} />
            <Route path="settings" element={withTransition(<TeacherSettings />)} />
          </Route>
          <Route
            path="/student"
            element={
              <RequireAuth allowedRoles={['student']}>
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
      </AnimatePresence>
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
          <ProgressBar />
          <AnimatedRoutes />
        </ErrorBoundary>
      </ToastProvider>
    </Router>
  );
}

export default App;
