import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Plus, BookOpen, Users, Calendar, FileSpreadsheet, BarChart3, Loader2, CheckCircle, GraduationCap, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { examSessionService } from '@/services/examSessionService';
import { ExamSession, ExamPaper } from '@/types/exam-management';
import { AddExamPapersForm } from './AddExamPapersForm';
import { MarksEntrySheet } from './MarksEntrySheet';
import { ClassMeritList } from './ClassMeritList';
import { SubjectAnalysisView } from './SubjectAnalysisView';
import { StudentReportCard } from './StudentReportCard';
import { TeacherMarksSummary } from './TeacherMarksSummary';
import { TermReportCard } from './TermReportCard';

const paperStatusConfig = {
  draft: { label: 'Draft', variant: 'outline' as const },
  published: { label: 'Published', variant: 'default' as const },
  completed: { label: 'Completed', variant: 'secondary' as const },
  locked: { label: 'Locked', variant: 'destructive' as const },
};

interface ExamSessionDetailProps {
  session: ExamSession;
  onBack: () => void;
}

export function ExamSessionDetail({ session, onBack }: ExamSessionDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddPapersOpen, setIsAddPapersOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedPaper, setSelectedPaper] = useState<ExamPaper | null>(null);
  const [activeTab, setActiveTab] = useState('papers');

  const { data: sessionClasses = [] } = useQuery({
    queryKey: ['exam-session-classes', session.id],
    queryFn: () => examSessionService.getSessionClasses(session.id),
  });

  const { data: papers = [], isLoading: papersLoading } = useQuery({
    queryKey: ['exam-papers', session.id, selectedClassId],
    queryFn: () => examSessionService.getExamPapers(
      session.id,
      selectedClassId !== 'all' ? parseInt(selectedClassId) : undefined
    ),
  });

  const computeResultsMutation = useMutation({
    mutationFn: (classId: number) => examSessionService.computeClassResults(session.id, classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-merit-list'] });
      toast({ title: 'Results computed successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Group papers by class
  const papersByClass = papers.reduce((acc, paper) => {
    const classId = paper.class_id;
    if (!acc[classId]) {
      acc[classId] = { class_name: paper.class_name || '', papers: [] };
    }
    acc[classId].papers.push(paper);
    return acc;
  }, {} as Record<number, { class_name: string; papers: ExamPaper[] }>);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="self-start">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold truncate">{session.name}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Term {session.term_number} • {session.academic_year} • {format(new Date(session.start_date), 'MMM d')} - {format(new Date(session.end_date), 'MMM d, yyyy')}
          </p>
        </div>
        <Badge variant={session.status === 'active' ? 'default' : 'outline'} className="self-start sm:self-auto">
          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="p-3 sm:pb-2 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Classes</CardDescription>
            <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              {sessionClasses.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:pb-2 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Exam Papers</CardDescription>
            <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              {papers.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:pb-2 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Completion</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{session.completion_percentage || 0}%</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-3 sm:px-6 sm:pb-6">
            <Progress value={session.completion_percentage || 0} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:pb-2 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Status</CardDescription>
            <CardTitle className="text-xl sm:text-2xl capitalize">{session.status}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-auto gap-1 min-w-max">
            <TabsTrigger value="papers" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
              <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Exam</span> Papers
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
              <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="merit" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
              Merit
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
              <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
              <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="term-report" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              Term Report
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Papers Tab */}
        <TabsContent value="papers" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {sessionClasses.map((sc) => (
                  <SelectItem key={sc.class_id} value={sc.class_id.toString()}>
                    {sc.class_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={isAddPapersOpen} onOpenChange={setIsAddPapersOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto" disabled={session.status === 'completed' || session.is_locked}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Papers
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Exam Papers</DialogTitle>
                </DialogHeader>
                <AddExamPapersForm
                  sessionId={session.id}
                  sessionClasses={sessionClasses}
                  onSuccess={() => {
                    setIsAddPapersOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['exam-papers'] });
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          {papersLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : papers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No exam papers</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add exam papers for the selected classes to start entering marks
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {Object.entries(papersByClass).map(([classId, { class_name, papers: classPapers }]) => (
                <Card key={classId}>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <CardTitle className="text-base sm:text-lg">{class_name}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => computeResultsMutation.mutate(parseInt(classId))}
                        disabled={computeResultsMutation.isPending}
                      >
                        {computeResultsMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        Compute Results
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {classPapers.map((paper) => {
                        const statusConfig = paperStatusConfig[paper.status];
                        const completionPercentage = paper.total_students
                          ? Math.round((paper.marks_entered! / paper.total_students) * 100)
                          : 0;

                        return (
                          <div
                            key={paper.id}
                            className="border rounded-lg p-3 sm:p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedPaper(paper)}
                          >
                            <div className="flex items-start justify-between mb-2 gap-2">
                              <div className="min-w-0">
                                <h4 className="font-medium text-sm sm:text-base truncate">{paper.subject_name}</h4>
                                <p className="text-xs sm:text-sm text-muted-foreground truncate">{paper.paper_name}</p>
                              </div>
                              <Badge variant={statusConfig.variant} className="text-xs flex-shrink-0">{statusConfig.label}</Badge>
                            </div>
                            <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Max Marks</span>
                                <span>{paper.max_marks}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Entered</span>
                                <span>{paper.marks_entered}/{paper.total_students}</span>
                              </div>
                              {paper.exam_date && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(paper.exam_date), 'MMM d')}
                                </div>
                              )}
                              <Progress value={completionPercentage} className="h-1" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Marks Progress Tab */}
        <TabsContent value="progress">
          <TeacherMarksSummary session={session} />
        </TabsContent>

        {/* Merit List Tab */}
        <TabsContent value="merit">
          <ClassMeritList sessionId={session.id} classes={sessionClasses} />
        </TabsContent>

        {/* Subject Analysis Tab */}
        <TabsContent value="analysis">
          <SubjectAnalysisView sessionId={session.id} classes={sessionClasses} />
        </TabsContent>

        {/* Report Cards Tab */}
        <TabsContent value="reports">
          <StudentReportCard session={session} />
        </TabsContent>

        {/* Term Report Card Tab */}
        <TabsContent value="term-report">
          <TermReportCard 
            termId={session.term_id} 
            academicYear={session.academic_year} 
          />
        </TabsContent>
      </Tabs>

      {/* Marks Entry Sheet */}
      {selectedPaper && (
        <MarksEntrySheet
          paper={selectedPaper}
          isOpen={!!selectedPaper}
          onClose={() => setSelectedPaper(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['exam-papers'] });
          }}
        />
      )}
    </div>
  );
}
