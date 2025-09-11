import { MainLayout } from '@/components/layout/MainLayout';
import { TeacherManagementModule } from '@/components/modules/TeacherManagementModule';

const TeachersPage = () => {
  return (
    <MainLayout>
      <TeacherManagementModule />
    </MainLayout>
  );
};

export default TeachersPage;