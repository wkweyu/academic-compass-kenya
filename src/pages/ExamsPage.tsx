import { Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

// Local error boundary for exam components
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ExamErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Exam module error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="max-w-2xl mx-auto mt-8">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Exam Module</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-4">
                  {this.state.error?.message || 'An unexpected error occurred while loading this module.'}
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => this.setState({ hasError: false, error: undefined })}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.location.href = '/exams'}
                  >
                    Go to Exams List
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

const ExamsPage = () => {
  const location = useLocation();
  const path = location.pathname;

  const renderContent = () => {
    if (path === '/exams/types') {
      return (
        <ExamErrorBoundary>
          <ExamTypesManagement />
        </ExamErrorBoundary>
      );
    }
    if (path === '/exams/register') {
      return (
        <ExamErrorBoundary>
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
        </ExamErrorBoundary>
      );
    }
    if (path === '/exams/marks') {
      return (
        <ExamErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <CBCMarksEntryModule />
          </Suspense>
        </ExamErrorBoundary>
      );
    }
    if (path === '/exams/merit') {
      return (
        <ExamErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <ClassMeritListModule />
          </Suspense>
        </ExamErrorBoundary>
      );
    }
    if (path === '/exams/analysis') {
      return (
        <ExamErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <SubjectAnalysisModule />
          </Suspense>
        </ExamErrorBoundary>
      );
    }
    if (path === '/exams/reports') {
      return (
        <ExamErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <StudentReportCardModule />
          </Suspense>
        </ExamErrorBoundary>
      );
    }
    return (
      <ExamErrorBoundary>
        <ExamManagementModule />
      </ExamErrorBoundary>
    );
  };

  return renderContent();
};

export default ExamsPage;
