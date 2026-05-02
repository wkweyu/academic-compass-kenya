import { useLocation } from 'react-router-dom';
import { SubjectManagementModule } from '@/components/modules/SubjectManagementModule';

const SubjectsPage = () => {
  const location = useLocation();
  
  // Map route to tab
  const getDefaultTab = () => {
    const path = location.pathname;
    if (path.includes('/categories')) return 'categories';
    if (path.includes('/allocations')) return 'allocations';
    return 'subjects';
  };

  return <SubjectManagementModule defaultTab={getDefaultTab()} />;
};

export default SubjectsPage;
