import { ClassManagementModule } from '@/components/modules/ClassManagementModule';
import { AuthDebug } from '@/components/debug/AuthDebug';

const ClassesPage = () => {
  return (
    <div className="space-y-6">
      {/* Temporary debug component */}
      <AuthDebug />
      <ClassManagementModule />
    </div>
  );
};

export default ClassesPage;