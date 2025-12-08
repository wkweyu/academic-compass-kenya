import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Lazy load components to prevent chunking issues
const ExamManagementModule = lazy(() => import('@/components/modules/ExamManagementModule').then(m => ({ default: m.ExamManagementModule })));
const ExamTypesManagement = lazy(() => import('@/components/modules/ExamTypesManagement').then(m => ({ default: m.ExamTypesManagement })));
const ExamRegistrationForm = lazy(() => import('@/components/modules/ExamRegistrationForm').then(m => ({ default: m.ExamRegistrationForm })));
const CBCMarksEntryModule = lazy(() => import('@/components/modules/CBCMarksEntryModule').then(m => ({ default: m.CBCMarksEntryModule })));
const ClassMeritListModule = lazy(() => import('@/components/modules/ClassMeritListModule').then(m => ({ default: m.ClassMeritListModule })));
const SubjectAnalysisModule = lazy(() => import('@/components/modules/SubjectAnalysisModule').then(m => ({ default: m.SubjectAnalysisModule })));
const StudentReportCardModule = lazy(() => import('@/components/modules/StudentReportCardModule').then(m => ({ default: m.StudentReportCardModule })));

const LoadingFallback = () => (
  <Card>
    <CardContent className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="ml-2 text-muted-foreground">Loading...</span>
    </CardContent>
  </Card>
);

const ExamsPage = () => {
  const location = useLocation();
  const path = location.pathname;

  const renderContent = () => {
    if (path === '/exams/types') {
      return <ExamTypesManagement />;
    }
    if (path === '/exams/register') {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Register New Exam</h1>
            <p className="text-muted-foreground">Create a new exam for assessment</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <ExamRegistrationForm onSuccess={() => window.history.back()} onCancel={() => window.history.back()} />
            </CardContent>
          </Card>
        </div>
      );
    }
    if (path === '/exams/marks') {
      return <CBCMarksEntryModule />;
    }
    if (path === '/exams/merit') {
      return <ClassMeritListModule />;
    }
    if (path === '/exams/analysis') {
      return <SubjectAnalysisModule />;
    }
    if (path === '/exams/reports') {
      return <StudentReportCardModule />;
    }
    return <ExamManagementModule />;
  };

  return (
    <Suspense fallback={<LoadingFallback />}>
      {renderContent()}
    </Suspense>
  );
};

export default ExamsPage;
