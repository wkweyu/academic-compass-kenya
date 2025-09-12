import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TermSettingsTab } from './TermSettingsTab';
import { SchoolProfileTab } from './SchoolProfileTab';
import { AcademicYearTab } from './AcademicYearTab';
import { GeneralSettingsTab } from './GeneralSettingsTab';
import { GradingSystemTab } from './GradingSystemTab';

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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="school-profile">School Profile</TabsTrigger>
              <TabsTrigger value="academic-year">Academic Years</TabsTrigger>
              <TabsTrigger value="terms">Term Settings</TabsTrigger>
              <TabsTrigger value="grading">Grading System</TabsTrigger>
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

            <TabsContent value="grading" className="mt-6">
              <GradingSystemTab />
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