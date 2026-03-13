import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TermSettingsTab } from './TermSettingsTab';
import { SchoolProfileTab } from './SchoolProfileTab';
import { AcademicYearTab } from './AcademicYearTab';
import { GeneralSettingsTab } from './GeneralSettingsTab';
import { GradingSystemTab } from './GradingSystemTab';
import { StreamNamingTab } from './StreamNamingTab';
import { PredefinedClassesTab } from './PredefinedClassesTab';
import { BiometricIntegration } from '@/pages/Attendance/BiometricIntegration';
import { SmsIntegration } from '@/pages/Attendance/SmsIntegration';
import { settingsService } from '@/services/settingsService';
import { classService } from '@/services/classService';
import { CheckCircle2, Circle, Loader2, RefreshCcw } from 'lucide-react';

type SetupStatus = {
  profileReady: boolean;
  termsReady: boolean;
  classesReady: boolean;
  streamsReady: boolean;
};

export function SystemSettingsModule() {
  const [activeTab, setActiveTab] = useState('school-profile');
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({
    profileReady: false,
    termsReady: false,
    classesReady: false,
    streamsReady: false,
  });
  const [loadingSetupStatus, setLoadingSetupStatus] = useState(true);

  useEffect(() => {
    loadSetupStatus();
  }, [activeTab]);

  const loadSetupStatus = async () => {
    try {
      setLoadingSetupStatus(true);
      const [profile, terms, classes, streams] = await Promise.all([
        settingsService.getSchoolProfile(),
        settingsService.getTermSettings(),
        classService.getClasses(),
        classService.getStreams(),
      ]);

      setSetupStatus({
        profileReady: Boolean(profile?.name && profile?.address && profile?.phone && profile?.email && profile?.type),
        termsReady: terms.length > 0,
        classesReady: classes.length > 0,
        streamsReady: streams.length > 0,
      });
    } catch (error) {
      setSetupStatus({
        profileReady: false,
        termsReady: false,
        classesReady: false,
        streamsReady: false,
      });
    } finally {
      setLoadingSetupStatus(false);
    }
  };

  const setupSteps = [
    {
      key: 'profileReady',
      title: 'Complete school profile',
      description: 'Review the onboarding details, add your school type, motto, website, and confirm contact details.',
      tab: 'school-profile',
    },
    {
      key: 'termsReady',
      title: 'Set academic terms',
      description: 'Add the current term dates before starting student, fees, and exam operations.',
      tab: 'terms',
    },
    {
      key: 'classesReady',
      title: 'Create classes',
      description: 'Generate the standard classes for your school type so admissions and teaching can begin.',
      tab: 'predefined-classes',
    },
    {
      key: 'streamsReady',
      title: 'Create streams',
      description: 'Set up stream naming and create streams for each class to organize students correctly.',
      tab: 'stream-naming',
    },
  ] as const;

  const completedSteps = setupSteps.filter((step) => setupStatus[step.key]).length;
  const setupComplete = completedSteps === setupSteps.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>School Setup Guide</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Use this checklist to finish the practical setup for a newly onboarded school.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={setupComplete ? 'default' : 'secondary'}>
              {completedSteps}/{setupSteps.length} completed
            </Badge>
            <Button variant="outline" size="sm" onClick={loadSetupStatus} disabled={loadingSetupStatus}>
              {loadingSetupStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {setupSteps.map((step, index) => {
            const done = setupStatus[step.key];

            return (
              <div key={step.key} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Step {index + 1}: {step.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                  </div>
                </div>
                <Button variant={done ? 'outline' : 'default'} size="sm" onClick={() => setActiveTab(step.tab)}>
                  {done ? 'Review' : 'Open'}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-9">
              <TabsTrigger value="school-profile">School Profile</TabsTrigger>
              <TabsTrigger value="academic-year">Academic Years</TabsTrigger>
              <TabsTrigger value="terms">Term Settings</TabsTrigger>
              <TabsTrigger value="predefined-classes">Predefined Classes</TabsTrigger>
              <TabsTrigger value="stream-naming">Stream Naming</TabsTrigger>
              <TabsTrigger value="grading">Grading System</TabsTrigger>
              <TabsTrigger value="biometric">Biometric</TabsTrigger>
              <TabsTrigger value="sms">SMS Gateway</TabsTrigger>
              <TabsTrigger value="general">General</TabsTrigger>
            </TabsList>

            <TabsContent value="school-profile" className="mt-6">
              <SchoolProfileTab />
            </TabsContent>

            <TabsContent value="academic-year" className="mt-6">
              <AcademicYearTab />
            </TabsContent>

            <TabsContent value="terms" className="mt-6">
              <TermSettingsTab />
            </TabsContent>

            <TabsContent value="predefined-classes" className="mt-6">
              <PredefinedClassesTab />
            </TabsContent>

            <TabsContent value="stream-naming" className="mt-6">
              <StreamNamingTab />
            </TabsContent>

            <TabsContent value="grading" className="mt-6">
              <GradingSystemTab />
            </TabsContent>

            <TabsContent value="biometric" className="mt-6">
              <BiometricIntegration />
            </TabsContent>

            <TabsContent value="sms" className="mt-6">
              <SmsIntegration />
            </TabsContent>

            <TabsContent value="general" className="mt-6">
              <GeneralSettingsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}