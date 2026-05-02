import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { handleBoundaryError } from '@/utils/errorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Error Boundary Component for ERP System
 * Catches React component errors and displays standardized error UI
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    handleBoundaryError(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="max-w-2xl w-full space-y-6">
            <Alert variant="destructive" className="border-2">
              <AlertCircle className="h-6 w-6" />
              <AlertTitle className="text-xl font-semibold mb-2">
                Application Error
              </AlertTitle>
              <AlertDescription className="space-y-4">
                <p className="text-base">
                  An unexpected error has occurred in the application. This has been logged
                  and our team will investigate the issue.
                </p>
                
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mt-4 p-4 bg-muted rounded-md">
                    <summary className="cursor-pointer font-semibold mb-2">
                      Error Details (Development Only)
                    </summary>
                    <div className="mt-2 space-y-2 text-sm">
                      <div>
                        <strong>Error:</strong>
                        <pre className="mt-1 p-2 bg-background rounded overflow-auto">
                          {this.state.error.toString()}
                        </pre>
                      </div>
                      {this.state.error.stack && (
                        <div>
                          <strong>Stack Trace:</strong>
                          <pre className="mt-1 p-2 bg-background rounded overflow-auto text-xs">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                <div className="flex gap-3 pt-4">
                  <Button onClick={this.handleReset} variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button onClick={this.handleGoHome}>
                    <Home className="mr-2 h-4 w-4" />
                    Go to Home
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <Alert>
              <AlertTitle>What can you do?</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Click "Try Again" to reload this section</li>
                  <li>Return to the home page and navigate back</li>
                  <li>Refresh your browser</li>
                  <li>Clear your browser cache if the issue persists</li>
                  <li>Contact support if you continue to experience issues</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
