import { useState } from 'react';
import { ExamSessionList } from '@/components/exams/ExamSessionList';
import { ExamSessionDetail } from '@/components/exams/ExamSessionDetail';
import { ExamSession } from '@/types/exam-management';

export function ExamManagementModuleV2() {
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);

  if (selectedSession) {
    return (
      <ExamSessionDetail
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  return <ExamSessionList onSelectSession={setSelectedSession} />;
}
