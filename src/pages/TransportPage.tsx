import { PageHeader } from '@/components/layout/PageHeader';
import TransportModule from '@/components/modules/TransportModule';

const TransportPage = () => {
  return (
    <div className="space-y-6">
      <PageHeader title="Transport Management" />
      <TransportModule />
    </div>
  );
};

export default TransportPage;
