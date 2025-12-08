import { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// New V2 Exam Management Module
import { ExamManagementModuleV2 } from '@/components/exams/ExamManagementModuleV2';


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
  return (
    <ExamErrorBoundary>
      <ExamManagementModuleV2 />
    </ExamErrorBoundary>
  );
};

export default ExamsPage;
