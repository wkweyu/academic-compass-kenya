import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CBC_GRADES } from '@/types/exam-management';
import { FileText, TrendingUp, Award } from 'lucide-react';

interface StudentExamProgressProps {
  studentId: number;
}

interface ExamResult {
  exam_session_id: number;
  session_name: string;
  term_number: number;
  academic_year: number;
  total_marks: number;
  total_possible: number;
  average_percentage: number;
  average_points: number;
  overall_grade: string;
  subjects_count: number;
  class_position: number | null;
  stream_position: number | null;
  computed_at: string;
}

export function StudentExamProgress({ studentId }: StudentExamProgressProps) {
  const { data: examResults = [], isLoading } = useQuery({
    queryKey: ['student-exam-progress', studentId],
    queryFn: async () => {
      // Get all exam results for this student
      const { data: results, error } = await supabase
        .from('student_exam_results')
        .select(`
          exam_session_id,
          total_marks,
          total_possible,
          average_percentage,
          average_points,
          overall_grade,
          subjects_count,
          class_position,
          stream_position,
          computed_at
        `)
        .eq('student_id', studentId)
        .order('computed_at', { ascending: false });

      if (error) throw error;

      // Get session details for each result
      const sessionIds = results?.map(r => r.exam_session_id) || [];
      if (sessionIds.length === 0) return [];

      const { data: sessions, error: sessionsError } = await supabase
        .from('exam_sessions')
        .select(`
          id,
          name,
          academic_year,
          term_id,
          settings_termsetting:term_id (
            term_number
          )
        `)
        .in('id', sessionIds);

      if (sessionsError) throw sessionsError;

      // Combine results with session info
      return results?.map(result => {
        const session = sessions?.find(s => s.id === result.exam_session_id);
        const termSetting = session?.settings_termsetting as any;
        return {
          ...result,
          session_name: session?.name || 'Unknown',
          term_number: termSetting?.term_number || 1,
          academic_year: session?.academic_year || new Date().getFullYear(),
        };
      }) as ExamResult[];
    },
  });

  // Group results by term and year
  const groupedResults = examResults.reduce((acc, result) => {
    const key = `${result.academic_year}-Term ${result.term_number}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(result);
    return acc;
  }, {} as Record<string, ExamResult[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading exam progress...</div>
      </div>
    );
  }

  if (examResults.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText size={48} className="mx-auto mb-4 opacity-50" />
        <p>No exam results available</p>
        <p className="text-sm">Results will appear here after exams are completed</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedResults).map(([termKey, results]) => (
        <div key={termKey} className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Award size={20} className="text-primary" />
            {termKey}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((result) => {
              const gradeInfo = CBC_GRADES[result.overall_grade as keyof typeof CBC_GRADES];
              return (
                <Card key={result.exam_session_id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="truncate">{result.session_name}</span>
                      <Badge className={`${gradeInfo?.bgColor} ${gradeInfo?.color}`}>
                        {result.overall_grade}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Performance</span>
                        <span className="font-medium">{result.average_percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={result.average_percentage} className="h-2" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Marks:</span>
                        <span className="ml-1 font-medium">
                          {result.total_marks}/{result.total_possible}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Points:</span>
                        <span className="ml-1 font-medium">
                          {result.average_points.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Subjects:</span>
                        <span className="ml-1 font-medium">{result.subjects_count}</span>
                      </div>
                      {result.class_position && (
                        <div>
                          <span className="text-muted-foreground">Position:</span>
                          <span className="ml-1 font-medium">#{result.class_position}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      {new Date(result.computed_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
      
      {/* Performance Trend Summary */}
      {examResults.length > 1 && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={18} />
              Performance Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-sm">
                <span className="text-muted-foreground">Average:</span>
                <span className="ml-1 font-semibold">
                  {(examResults.reduce((sum, r) => sum + r.average_percentage, 0) / examResults.length).toFixed(1)}%
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Best:</span>
                <span className="ml-1 font-semibold text-green-600">
                  {Math.max(...examResults.map(r => r.average_percentage)).toFixed(1)}%
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Exams:</span>
                <span className="ml-1 font-semibold">{examResults.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
