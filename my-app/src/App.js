import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageTransition from './PageTransition';
import Landing from './landing';
import Login from './login';
import Signup from './signup';
import Dashboard from './dashboard';
import DashboardHome from './DashboardHome';
import PlaceholderContent from './PlaceholderContent';
import ManageSubjects from './ManageSubjects';
import ManageAssessments from './ManageAssessments';
import NewAssessment from './NewAssessment';
import NewRubric from './NewRubric';
import ViewAssessmentsPage from './ViewAssessmentsPage';
import TeacherProfile from './TeacherProfile';
import TeacherSettings from './TeacherSettings';
import StudentDashboard, { StudentOverview } from './StudentDashboard';
import StudentReports from './StudentReports';
import StudentProfile from './StudentProfile';
import SubmitAssessment from './SubmitAssessment';
import GradeSubmissions from './GradeSubmissions';
import SubjectDetails from './SubjectDetails';
import 'mathlive';

const TeacherDashboard = Dashboard;
const TeacherOverview = DashboardHome;

const withTransition = (element) => <PageTransition>{element}</PageTransition>;

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={withTransition(<Landing />)} />
        <Route path="/login" element={withTransition(<Login />)} />
        <Route path="/signup" element={withTransition(<Signup />)} />
        <Route path="/dashboard" element={withTransition(<Dashboard />)}>
          <Route index element={withTransition(<DashboardHome />)} />
          <Route path="subjects" element={withTransition(<ManageSubjects />)} />
          <Route path="subjects/:id" element={<SubjectDetails />} />
          <Route path="profile" element={withTransition(<TeacherProfile />)} />
          <Route path="settings" element={withTransition(<TeacherSettings />)} />
        </Route>
        <Route path="/teacher" element={withTransition(<TeacherDashboard />)}>
          <Route index element={withTransition(<TeacherOverview />)} />
          <Route path="assessments">
            <Route index element={withTransition(<ManageAssessments />)} />
            <Route path="view" element={withTransition(<ViewAssessmentsPage />)} />
            <Route path="new" element={withTransition(<NewAssessment />)} />
            <Route path="new-rubric" element={withTransition(<NewRubric />)} />
          </Route>
          <Route path="grade-submissions" element={withTransition(<GradeSubmissions />)} />
          <Route
            path="feedback"
            element={withTransition(
              <PlaceholderContent title="Results & Feedback" description="View and provide feedback on graded submissions." />
            )}
          />
          <Route
            path="reports"
            element={withTransition(
              <PlaceholderContent title="View Reports" description="Analyze student and class performance." />
            )}
          />
          <Route path="profile" element={withTransition(<TeacherProfile />)} />
          <Route path="settings" element={withTransition(<TeacherSettings />)} />
        </Route>
        <Route path="/student" element={withTransition(<StudentDashboard />)}>
          <Route index element={withTransition(<StudentOverview />)} />
          <Route path="submit" element={withTransition(<SubmitAssessment />)} />
          <Route path="reports" element={withTransition(<StudentReports />)} />
          <Route path="profile" element={withTransition(<StudentProfile />)} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router future={{ v7_relativeSplatPath: true }}>
      <AnimatedRoutes />
    </Router>
  );
}

export default App;
