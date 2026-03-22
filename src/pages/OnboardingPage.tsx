import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SystemSettingsModule } from '@/components/modules/SystemSettingsModule';
import { settingsService } from '@/services/settingsService';

const OnboardingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if setup is complete and redirect if so
    const checkSetup = async () => {
      try {
        const status = await settingsService.getSchoolSetupStatus();
        if (status.complete) {
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        // If we can't check status, stay on onboarding
        console.error('Error checking setup status:', error);
      }
    };

    checkSetup();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">School Setup</h1>
          <p className="text-lg text-muted-foreground mb-4">
            Complete your school configuration to get started
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Settings Module */}
        <SystemSettingsModule />
      </div>
    </div>
  );
};

export default OnboardingPage;
