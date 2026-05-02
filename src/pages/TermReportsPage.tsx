import { TermReportCard } from '@/components/exams/TermReportCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';

const TermReportsPage = () => {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl">Term Report Cards</CardTitle>
              <CardDescription>
                Generate combined term reports by selecting completed exam sessions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <TermReportCard />
    </div>
  );
};

export default TermReportsPage;
