import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import { MainLayout } from "./components/layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ExamsPage from "./pages/ExamsPage";
import StudentsPage from "./pages/StudentsPage";
import StudentProfilePage from "./pages/StudentProfilePage";
import ClassesPage from "./pages/ClassesPage";
import TeachersPage from "./pages/TeachersPage";
import SubjectsPage from "./pages/SubjectsPage";
import ScoresPage from "./pages/ScoresPage";
import AttendancePage from "./pages/AttendancePage";
import AttendanceReportsPage from "./pages/AttendanceReportsPage";
import { BiometricIntegration } from "./pages/Attendance/BiometricIntegration";
import { SmsIntegration } from "./pages/Attendance/SmsIntegration";
import ResultsPage from "./pages/ResultsPage";
import FeesPage from "./pages/FeesPage";
import PromotionsPage from "./pages/PromotionsPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import SettingsPage from "./pages/SettingsPage";
import StaffProfilePage from "./pages/StaffProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/exams" element={<ExamsPage />} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/students/:id" element={<StudentProfilePage />} />
                <Route path="/classes" element={<ClassesPage />} />
                <Route path="/teachers" element={<TeachersPage />} />
                <Route path="/teachers/assignments" element={<TeachersPage />} />
                <Route path="/teachers/availability" element={<TeachersPage />} />
                <Route path="/teachers/workload" element={<TeachersPage />} />
                <Route path="/teachers/attendance" element={<TeachersPage />} />
                <Route path="/teachers/leave" element={<TeachersPage />} />
                <Route path="/teachers/performance" element={<TeachersPage />} />
                <Route path="/teachers/reports" element={<TeachersPage />} />
                <Route path="/teachers/:id" element={<StaffProfilePage />} />
                <Route path="/subjects" element={<SubjectsPage />} />
                <Route path="/subjects/categories" element={<SubjectsPage />} />
                <Route path="/subjects/allocations" element={<SubjectsPage />} />
                <Route path="/scores" element={<ScoresPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/promotions" element={<PromotionsPage />} />
                <Route path="/fees" element={<FeesPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/attendance/reports" element={<AttendanceReportsPage />} />
                <Route path="/attendance/biometric" element={<BiometricIntegration />} />
                <Route path="/attendance/sms" element={<SmsIntegration />} />
                <Route path="/grading" element={<ComingSoonPage title="Grading" />} />
                <Route path="/transport" element={<ComingSoonPage title="Transport" />} />
                <Route path="/procurement" element={<ComingSoonPage title="Procurement" />} />
                <Route path="/payroll" element={<ComingSoonPage title="Payroll Management" />} />
                <Route path="/accounting" element={<ComingSoonPage title="Accounting" />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
