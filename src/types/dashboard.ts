export interface DashboardData {
  stats: {
    totalExams: number;
    activeExams: number;
    totalStudents: number;
    totalSubjects: number;
    completedScores: number;
    pendingResults: number;
  };
  recentExams: {
    name: string;
    class: string;
    stream: string;
    date: string;
    status: string;
  }[];
  performanceData: {
    subject: string;
    average: number;
    grade: string;
  }[];
}
