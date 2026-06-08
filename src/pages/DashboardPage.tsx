import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DashboardModule } from '@/components/modules/DashboardModule';
import { settingsService } from '@/services/settingsService';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkSetup = async () => {
      try {
        const status = await settingsService.getSchoolSetupStatus();

        if (mounted && !status.complete) {
          navigate('/settings', {
            replace: true,
            state: { onboardingRedirect: true },
          });
          return;
        }
      } catch {
        // If setup status cannot be determined, keep dashboard accessible.
      } finally {
        if (mounted) {
          setCheckingSetup(false);
        }
      }
    };

    checkSetup();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (checkingSetup) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <DashboardModule />;
};

export default DashboardPage;
