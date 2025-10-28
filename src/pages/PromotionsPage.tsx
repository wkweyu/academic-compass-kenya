import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import StudentPromotionModule from '@/components/modules/StudentPromotionModule';

const PromotionsPage = () => {
  return (
    <MainLayout>
      <StudentPromotionModule />
    </MainLayout>
  );
};

export default PromotionsPage;
