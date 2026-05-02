// Debug component to check authentication status
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '@/services/authService';
import { toast } from 'sonner';

export const AuthDebug = () => {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAuth = async () => {
    setLoading(true);
    try {
      const result = await authService.testAuth();
      setAuthStatus(result);
      if (result.success) {
        toast.success('Authentication successful!');
      } else {
        toast.error(`Auth failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Auth test error:', error);
      toast.error('Auth test failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testAuth();
  }, []);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Authentication Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <strong>Token:</strong> 
          <p className="text-sm text-muted-foreground">
            {authService.getToken() ? 'Present' : 'Missing'}
          </p>
        </div>
        
        <div>
          <strong>Auth Status:</strong>
          <pre className="text-xs bg-muted p-2 rounded mt-1">
            {JSON.stringify(authStatus, null, 2)}
          </pre>
        </div>

        <Button onClick={testAuth} disabled={loading}>
          {loading ? 'Testing...' : 'Test Authentication'}
        </Button>
      </CardContent>
    </Card>
  );
};