import { useState } from 'react';
import { CBCLayout } from '@/components/layout/CBCLayout';
import { DashboardModule } from '@/components/modules/DashboardModule';
import { ExamManagementModule } from '@/components/modules/ExamManagementModule';
import { Toaster } from '@/components/ui/toaster';

const Index = () => {
  const [activeModule, setActiveModule] = useState('dashboard');

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule />;
      case 'exams':
        return <ExamManagementModule />;
      case 'subjects':
        return <div className="p-8 text-center text-muted-foreground">Subject Management - Coming Soon</div>;
      case 'scores':
        return <div className="p-8 text-center text-muted-foreground">Score Entry - Coming Soon</div>;
      case 'results':
        return <div className="p-8 text-center text-muted-foreground">Student Results - Coming Soon</div>;
      case 'students':
        return <div className="p-8 text-center text-muted-foreground">Student Management - Coming Soon</div>;
      case 'settings':
        return <div className="p-8 text-center text-muted-foreground">Settings - Coming Soon</div>;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <>
      <CBCLayout 
        activeModule={activeModule} 
        onModuleChange={setActiveModule}
      >
        {renderModule()}
      </CBCLayout>
      <Toaster />
    </>
  );
};

export default Index;
