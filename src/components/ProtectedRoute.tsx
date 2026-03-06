import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptionCheck } from '@/hooks/useSubscriptionCheck';
import { Loader2, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, signOut } = useAuth();
  const { subscription, loading: subLoading, isExpired, isNearExpiry } = useSubscriptionCheck();

  if (loading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Block access for expired subscriptions
  if (isExpired && subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardHeader className="text-center space-y-2">
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <CardTitle className="text-xl">Subscription Expired</CardTitle>
            <CardDescription>
              Your school's {subscription.plan} plan has expired.
              Contact your administrator or the platform support team to renew.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              School: <span className="font-semibold text-foreground">{subscription.school_name}</span>
            </p>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Near-expiry warning banner */}
      {isNearExpiry && subscription && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
            Your subscription expires in {subscription.days_remaining} day{subscription.days_remaining !== 1 ? 's' : ''}. 
            Contact your administrator to renew.
          </AlertDescription>
        </Alert>
      )}
      {children}
    </>
  );
};

export default ProtectedRoute;
