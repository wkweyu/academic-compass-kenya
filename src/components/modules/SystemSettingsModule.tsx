import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TermSettingsTab } from './TermSettingsTab';
import { SchoolProfileTab } from './SchoolProfileTab';
import { AcademicYearTab } from './AcademicYearTab';
import { GeneralSettingsTab } from './GeneralSettingsTab';
import { GradingSystemTab } from './GradingSystemTab';
import { StreamNamingTab } from './StreamNamingTab';
import { PredefinedClassesTab } from './PredefinedClassesTab';
import { BiometricIntegration } from '@/pages/Attendance/BiometricIntegration';
import { SmsIntegration } from '@/pages/Attendance/SmsIntegration';

export function SystemSettingsModule() {
  const [activeTab, setActiveTab] = useState('school-profile');

  return (
    <div className="space-y-6">
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