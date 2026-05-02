import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BookOpen,
  ClipboardList,
  Users,
  TrendingUp,
  Calendar,
  Target,
  GraduationCap,
  Receipt,
  UserCheck,
  ArrowRight,
  Clock,
  CalendarCheck,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  School,
  Wallet,
  FileText,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboardService";
import { settingsService } from "@/services/settingsService";
import { TermManager } from "@/utils/termManager";
import { cn } from "@/lib/utils";
import { SchoolCommunicationWidget } from "@/components/communication/SchoolCommunicationWidget";

const getInitials = (value?: string | null) => {
  if (!value) return "SC";
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || "")
    .join("") || "SC";
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'primary',
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  trend?: string;
  color?: 'primary' | 'accent' | 'warning' | 'destructive' | 'success';
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    success: 'bg-success/10 text-success',
  };

  return (
    <Card className="relative overflow-hidden hover:shadow-card-hover transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold font-display tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn('rounded-xl p-2.5', colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1 text-xs text-success">
            <TrendingUp className="h-3 w-3" />
            <span>{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  onClick,
  color = 'primary',
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-0.5"
    >
      <div className="rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

export function DashboardModule() {
  const navigate = useNavigate();
  const currentTerm = TermManager.getCurrentTerm();
  const currentYear = TermManager.getCurrentYear();
  const termProgress = TermManager.getTermProgress(currentTerm, currentYear);

  const { data: schoolProfile } = useQuery({
    queryKey: ["schoolProfile"],
    queryFn: settingsService.getSchoolProfile,
  });

  const {
    data: dashboardData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: dashboardService.getDashboardData,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Error loading dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  const stats = dashboardData?.stats || {
    totalExams: 0,
    activeExams: 0,
    totalStudents: 0,
    totalSubjects: 0,
    completedScores: 0,
    pendingResults: 0,
  };
  const recentExams = dashboardData?.recentExams || [];
  const performanceData = dashboardData?.performanceData || [];

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 rounded-2xl border border-border/80 shadow-sm">
                <AvatarImage src={schoolProfile?.logo} alt={schoolProfile?.name ? `${schoolProfile.name} logo` : "School logo"} className="object-cover" />
                <AvatarFallback className="rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
                  {getInitials(schoolProfile?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 text-primary">School Dashboard</Badge>
                  <Badge variant="secondary" className="rounded-full">Term {currentTerm}, {currentYear}</Badge>
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
                    {schoolProfile?.name || "School Dashboard"}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {schoolProfile?.motto || "School management overview for operations, academics, and daily execution."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {schoolProfile?.code ? <Badge variant="outline">{schoolProfile.code}</Badge> : null}
                  {schoolProfile?.email ? <Badge variant="outline">{schoolProfile.email}</Badge> : null}
                  {schoolProfile?.phone ? <Badge variant="outline">{schoolProfile.phone}</Badge> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Academic Progress</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{Math.round(termProgress)}% through term</p>
              </div>
              <Button onClick={() => navigate('/settings')} className="rounded-2xl px-5">
                Open School Settings
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Term progress bar */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-accent/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Term {currentTerm} Progress</span>
            </div>
            <span className="text-sm font-semibold text-primary">{Math.round(termProgress)}%</span>
          </div>
          <Progress value={termProgress} className="h-2" />
          <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
            <span>{TermManager.getTermInfo(currentTerm)?.startDate.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</span>
            <span>{TermManager.getTermInfo(currentTerm)?.endDate.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          subtitle="Active enrolments"
          icon={Users}
          color="primary"
        />
        <StatCard
          title="Total Exams"
          value={stats.totalExams}
          subtitle={`${stats.activeExams} active this term`}
          icon={ClipboardList}
          color="accent"
        />
        <StatCard
          title="Subjects"
          value={stats.totalSubjects}
          subtitle="CBC curriculum"
          icon={BookOpen}
          color="warning"
        />
        <StatCard
          title="Score Entry"
          value={`${stats.completedScores}%`}
          subtitle={`${stats.pendingResults} pending`}
          icon={Target}
          color="success"
        />
      </div>

      {/* Main content area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Exams — wider */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Recent Exams</CardTitle>
                <CardDescription>Latest exam activities and status updates</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/exams')}>
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentExams.length > 0 ? (
              <div className="space-y-3">
                {recentExams.map((exam, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="rounded-lg bg-accent/10 p-2">
                      <Calendar className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{exam.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {exam.class} {exam.stream !== 'N/A' ? `• ${exam.stream}` : ''} • {exam.date}
                      </p>
                    </div>
                    <Badge
                      variant={exam.status === "Active" ? "default" : "secondary"}
                      className="text-[11px] shrink-0"
                    >
                      {exam.status === "Active" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {exam.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted p-4 mb-3">
                  <ClipboardList className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No recent exams</p>
                <p className="text-xs text-muted-foreground mt-0.5">Create your first exam to get started</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/exams')}>
                  Create Exam
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Performance</CardTitle>
            <CardDescription>Average scores by subject</CardDescription>
          </CardHeader>
          <CardContent>
            {performanceData.length > 0 ? (
              <div className="space-y-4">
                {performanceData.map((subject, index) => (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{subject.subject}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-semibold">{subject.average}%</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {subject.grade}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={subject.average} className="h-1.5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted p-4 mb-3">
                  <BarChart3 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No data yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Enter scores to see performance</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SchoolCommunicationWidget />

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold font-display mb-4">Quick Actions</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            title="New Exam Session"
            description="Set up exams for any class"
            icon={ClipboardList}
            onClick={() => navigate('/exams')}
          />
          <QuickActionCard
            title="Manage Students"
            description="Enrol or update students"
            icon={Users}
            onClick={() => navigate('/students')}
          />
          <QuickActionCard
            title="Fees Collection"
            description="Record fee payments"
            icon={Wallet}
            onClick={() => navigate('/fees')}
          />
          <QuickActionCard
            title="Mark Attendance"
            description="Daily student attendance"
            icon={CalendarCheck}
            onClick={() => navigate('/attendance')}
          />
          <QuickActionCard
            title="Staff Management"
            description="View and manage staff"
            icon={UserCheck}
            onClick={() => navigate('/teachers')}
          />
          <QuickActionCard
            title="Term Reports"
            description="Generate report cards"
            icon={FileText}
            onClick={() => navigate('/term-reports')}
          />
          <QuickActionCard
            title="Accounting"
            description="Financial statements"
            icon={Receipt}
            onClick={() => navigate('/accounting')}
          />
          <QuickActionCard
            title="System Settings"
            description="Configure your school"
            icon={School}
            onClick={() => navigate('/settings')}
          />
        </div>
      </div>
    </div>
  );
}