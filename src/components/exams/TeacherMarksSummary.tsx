import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Clock, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ExamSession } from '@/types/exam-management';

interface TeacherMarksSummaryProps {
  session: ExamSession;
}

interface PaperProgress {
  paper_id: number;
  paper_name: string;
  subject_name: string;
  class_name: string;
  stream_name: string | null;
  total_students: number;
  marks_entered: number;
  marks_submitted: number;
  completion_percentage: number;
  teacher_name: string | null;
}

export function TeacherMarksSummary({ session }: TeacherMarksSummaryProps) {
  const { data: paperProgress = [], isLoading } = useQuery({
    queryKey: ['marks-progress', session.id],
    queryFn: async () => {
      // Get all papers for this session
      const { data: papers, error: papersError } = await supabase
        .from('exam_papers')
        .select('id, paper_name, class_id, stream_id, subject_id')
        .eq('exam_session_id', session.id);

      if (papersError) throw papersError;
      if (!papers?.length) return [];

      // Get class names
      const classIds = [...new Set(papers.map(p => p.class_id))];
      const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .in('id', classIds);

      // Get subject names
      const subjectIds = [...new Set(papers.map(p => p.subject_id))];
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);

      // Get stream names
      const streamIds = papers.map(p => p.stream_id).filter(Boolean) as number[];
      const { data: streams } = streamIds.length > 0 ? await supabase
        .from('streams')
        .select('id, name')
        .in('id', streamIds) : { data: [] };

      // Get marks for each paper
      const { data: allMarks } = await supabase
        .from('exam_marks')
        .select('exam_paper_id, is_submitted')
        .in('exam_paper_id', papers.map(p => p.id));

      // Get student counts per class/stream
      const results: PaperProgress[] = [];
      
      for (const paper of papers) {
        // Count students in this class/stream
        let studentQuery = supabase
          .from('students')
          .select('id', { count: 'exact' })
          .eq('current_class_id', paper.class_id)
          .eq('is_active', true);

        if (paper.stream_id) {
          studentQuery = studentQuery.eq('current_stream_id', paper.stream_id);
        }

        const { count: totalStudents } = await studentQuery;

        // Count marks for this paper
        const paperMarks = allMarks?.filter(m => m.exam_paper_id === paper.id) || [];
        const marksEntered = paperMarks.length;
        const marksSubmitted = paperMarks.filter(m => m.is_submitted).length;

        // Get teacher assignment (from class_subjects)
        const { data: classSubject } = await supabase
          .from('class_subjects')
          .select('teacher_id')
          .eq('class_id', paper.class_id)
          .eq('subject_id', paper.subject_id)
          .single();

        let teacherName = null;
        if (classSubject?.teacher_id) {
          const { data: teacher } = await supabase
            .from('teachers')
            .select('first_name, last_name')
            .eq('id', classSubject.teacher_id)
            .single();
          if (teacher) {
            teacherName = `${teacher.first_name} ${teacher.last_name}`;
          }
        }

        results.push({
          paper_id: paper.id,
          paper_name: paper.paper_name,
          subject_name: subjects?.find(s => s.id === paper.subject_id)?.name || '',
          class_name: classes?.find(c => c.id === paper.class_id)?.name || '',
          stream_name: streams?.find(s => s.id === paper.stream_id)?.name || null,
          total_students: totalStudents || 0,
          marks_entered: marksEntered,
          marks_submitted: marksSubmitted,
          completion_percentage: totalStudents ? Math.round((marksSubmitted / totalStudents) * 100) : 0,
          teacher_name: teacherName,
        });
      }

      return results.sort((a, b) => a.completion_percentage - b.completion_percentage);
    },
  });

  const totalPapers = paperProgress.length;
  const completedPapers = paperProgress.filter(p => p.completion_percentage === 100).length;
  const inProgressPapers = paperProgress.filter(p => p.completion_percentage > 0 && p.completion_percentage < 100).length;
  const notStartedPapers = paperProgress.filter(p => p.completion_percentage === 0).length;

  const missingMarks = paperProgress.filter(p => p.completion_percentage < 100);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          Loading marks progress...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Marks Entry Summary</h3>
          <p className="text-sm text-muted-foreground">
            Track teacher marks entry progress for all papers
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPapers}</p>
                <p className="text-sm text-muted-foreground">Total Papers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{completedPapers}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{inProgressPapers}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{notStartedPapers}</p>
                <p className="text-sm text-muted-foreground">Not Started</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Missing Marks Warning */}
      {missingMarks.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{missingMarks.length} paper(s)</strong> have incomplete marks entry. 
            Report cards cannot be generated until all marks are submitted.
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paper-wise Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paper</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Assigned Teacher</TableHead>
                <TableHead className="text-center">Entered</TableHead>
                <TableHead className="text-center">Submitted</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paperProgress.map((paper) => (
                <TableRow key={paper.paper_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{paper.paper_name}</p>
                      <p className="text-sm text-muted-foreground">{paper.subject_name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {paper.class_name}
                    {paper.stream_name && (
                      <span className="text-muted-foreground"> - {paper.stream_name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {paper.teacher_name ? (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {paper.teacher_name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not assigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {paper.marks_entered}/{paper.total_students}
                  </TableCell>
                  <TableCell className="text-center">
                    {paper.marks_submitted}/{paper.total_students}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={paper.completion_percentage} className="w-24" />
                      <span className="text-sm">{paper.completion_percentage}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {paper.completion_percentage === 100 ? (
                      <Badge className="bg-green-100 text-green-800">Complete</Badge>
                    ) : paper.completion_percentage > 0 ? (
                      <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>
                    ) : (
                      <Badge variant="destructive">Not Started</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {paperProgress.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No exam papers found for this session.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
