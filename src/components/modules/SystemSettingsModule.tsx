import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hasManagedClassGroupConfiguration } from '@/utils/schoolClassGroups';
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
import { streamSettingsService } from '@/services/streamSettingsService';
import { CheckCircle2, Circle, Loader2, RefreshCcw, School, Sparkles, CalendarDays } from 'lucide-react';

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
      const [profile, terms, classes, streamNames] = await Promise.all([
        settingsService.getSchoolProfile(),
        settingsService.getTermSettings(),
        classService.getClasses(),
        streamSettingsService.getStreamNames(),
      ]);

      setSetupStatus({
        profileReady: Boolean(profile?.name && profile?.address && profile?.phone && profile?.email && hasManagedClassGroupConfiguration(profile)),
        termsReady: terms.length > 0,
        classesReady: classes.length > 0,
        streamsReady: streamNames.length > 0,
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
      description: 'Review the onboarding details, select the managed class groups, add the motto or website, and confirm contact details.',
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
      description: 'Generate the standard classes for the managed class groups so admissions and teaching can begin.',
      tab: 'predefined-classes',
    },
    {
      key: 'streamsReady',
      title: 'Configure stream names',
      description: 'Set up the stream names your school uses so classes can be organized consistently during stream creation.',
      tab: 'stream-naming',
    },
  ] as const;

  const completedSteps = setupSteps.filter((step) => setupStatus[step.key]).length;
  const setupComplete = completedSteps === setupSteps.length;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-border/70 bg-background/70 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Guided setup
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-3 py-1 font-medium text-muted-foreground">
                <School className="h-3.5 w-3.5" /> School settings
              </span>
            </div>
            <CardTitle className="text-2xl">School Setup Guide</CardTitle>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
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
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Completion</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{completedSteps}/{setupSteps.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">Core setup steps completed.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{setupComplete ? 'Ready' : 'In Progress'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Keep profile, terms, classes, and streams aligned.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Priority</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{setupSteps.find((step) => !setupStatus[step.key])?.title || 'All set'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Focus on the next incomplete setup area.</p>
            </div>
          </div>
          {setupSteps.map((step, index) => {
            const done = setupStatus[step.key];

            return (
              <div key={step.key} className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm">
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

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>System Settings</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">Configure school profile, academic dates, class defaults, and operational integrations from one workspace.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Setup and profile configuration
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border border-border/70 bg-muted/40 p-2">
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