import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  ClipboardList,
  Users,
  TrendingUp,
  Calendar,
  Target,
} from "lucide-react";

import { useQuery } from "@tanstack/react-query"; // Add this import
import { dashboardService } from "@/services/dashboardService";

export function DashboardModule() {
  const {
    data: dashboardData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: dashboardService.getDashboardData,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    console.error("Dashboard error:", error);
    return <div>Error loading dashboard: {error.message}</div>;
  }

  if (!dashboardData) {
    return <div>No dashboard data available</div>;
  }

  const { stats, recentExams = [], performanceData = [] } = dashboardData;

  // Add this safety check for the stats object with proper typing
  const safeStats = {
    totalExams: stats?.totalExams || 0,
    activeExams: stats?.activeExams || 0,
    totalStudents: stats?.totalStudents || 0,
    totalSubjects: stats?.totalSubjects || 0,
    completedScores: stats?.completedScores || 0,
    pendingResults: stats?.pendingResults || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of CBC Exam Management System - Term 2, 2024
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeStats.totalExams || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {safeStats.activeExams || 0} active this term
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeStats.totalStudents || 0}
            </div>
            <p className="text-xs text-muted-foreground">Across all grades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subjects</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeStats.totalSubjects || 0}
            </div>
            <p className="text-xs text-muted-foreground">CBC curriculum</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score Entry</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeStats.completedScores || 0}%
            </div>
            <Progress value={safeStats.completedScores || 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Exams */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Exams</CardTitle>
            <CardDescription>
              Latest exam activities and status updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentExams.length > 0 ? (
                recentExams.map((exam, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {exam.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {exam.class} {exam.stream} • {exam.date}
                      </p>
                    </div>
                    <Badge
                      variant={
                        exam.status === "Active"
                          ? "default"
                          : exam.status === "Completed"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {exam.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent exams found
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Overview */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>
              Average scores by subject this term
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {performanceData.length > 0 ? (
                performanceData.map((subject, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{subject.subject}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{subject.average}%</span>
                        <Badge variant="outline" className="text-xs">
                          {subject.grade}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={subject.average} className="h-2" />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No performance data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Common tasks and shortcuts for exam management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border p-3 text-center hover:bg-muted/50 cursor-pointer transition-colors">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Create New Exam</p>
              <p className="text-xs text-muted-foreground">
                Set up exam for any class
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center hover:bg-muted/50 cursor-pointer transition-colors">
              <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Enter Scores</p>
              <p className="text-xs text-muted-foreground">
                Record student marks
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center hover:bg-muted/50 cursor-pointer transition-colors">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Generate Reports</p>
              <p className="text-xs text-muted-foreground">
                View performance analytics
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
