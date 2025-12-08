import { useLocation } from 'react-router-dom';
import { ExamManagementModule } from '@/components/modules/ExamManagementModule';
import { ExamTypesManagement } from '@/components/modules/ExamTypesManagement';
import { ExamRegistrationForm } from '@/components/modules/ExamRegistrationForm';
import { CBCMarksEntryModule } from '@/components/modules/CBCMarksEntryModule';
import { ClassMeritListModule } from '@/components/modules/ClassMeritListModule';
import { SubjectAnalysisModule } from '@/components/modules/SubjectAnalysisModule';
import { StudentReportCardModule } from '@/components/modules/StudentReportCardModule';

const ExamsPage = () => {
  const location = useLocation();
  const path = location.pathname;

  const renderContent = () => {
    if (path === '/exams/types') {
      return <ExamTypesManagement />;
    }
    if (path === '/exams/register') {
      return <ExamRegistrationForm onSuccess={() => window.history.back()} onCancel={() => window.history.back()} />;
    }
    if (path === '/exams/marks') {
      return <CBCMarksEntryModule />;
    }
    if (path === '/exams/merit') {
      return <ClassMeritListModule />;
    }
    if (path === '/exams/analysis') {
      return <SubjectAnalysisModule />;
    }
    if (path === '/exams/reports') {
      return <StudentReportCardModule />;
    }
    return <ExamManagementModule />;
  };

  return renderContent();
};

export default ExamsPage;
