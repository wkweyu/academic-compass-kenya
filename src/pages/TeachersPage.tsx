import { useLocation } from 'react-router-dom';
import { TeacherManagementModule } from '@/components/modules/TeacherManagementModule';

const TeachersPage = () => {
  const location = useLocation();
  
  // Map route to tab
  const getDefaultTab = () => {
    const path = location.pathname;
    if (path.includes('/assignments')) return 'assignments';
    if (path.includes('/availability')) return 'availability';
    if (path.includes('/workload')) return 'workload';
    if (path.includes('/attendance')) return 'attendance';
    if (path.includes('/leave')) return 'leave';
    if (path.includes('/performance')) return 'performance';
    if (path.includes('/reports')) return 'reports';
    return 'staff';
  };

  return <TeacherManagementModule defaultTab={getDefaultTab()} />;
};

export default TeachersPage;
