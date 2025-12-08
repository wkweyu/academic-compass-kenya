import { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Direct imports instead of lazy loading to prevent chunking issues
import { ExamManagementModule } from '@/components/modules/ExamManagementModule';
import { ExamTypesManagement } from '@/components/modules/ExamTypesManagement';
import { ExamRegistrationForm } from '@/components/modules/ExamRegistrationForm';

// Only lazy load the heavy components with Recharts
import { lazy } from 'react';
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
      return (
        <Suspense fallback={<LoadingFallback />}>
          <CBCMarksEntryModule />
        </Suspense>
      );
    }
    if (path === '/exams/merit') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <ClassMeritListModule />
        </Suspense>
      );
    }
    if (path === '/exams/analysis') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <SubjectAnalysisModule />
        </Suspense>
      );
    }
    if (path === '/exams/reports') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <StudentReportCardModule />
        </Suspense>
      );
    }
    return <ExamManagementModule />;
  };

  return renderContent();
};

export default ExamsPage;