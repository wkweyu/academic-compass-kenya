import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, BookOpen, TrendingUp, TrendingDown, BarChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { examSessionService } from '@/services/examSessionService';
import { ExamSessionClass, CBC_GRADES } from '@/types/exam-management';

interface EnhancedSubjectAnalysisProps {
  sessionId: number;
  classes: ExamSessionClass[];
}

interface StreamAnalysis {
  stream_id: number;
  stream_name: string;
  average: number;
  highest: number;
  lowest: number;
  students_count: number;
  grade_distribution: Record<string, number>;
}

export function EnhancedSubjectAnalysis({ sessionId, classes }: EnhancedSubjectAnalysisProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('all');
  const [viewLevel, setViewLevel] = useState<'class' | 'stream'>('class');

  // Fetch streams
  const { data: streams = [] } = useQuery({
    queryKey: ['class-streams-analysis', selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return [];
      const { data } = await supabase
        .from('streams')
        .select('id, name')
        .eq('class_assigned_id', parseInt(selectedClassId))
        .order('name');
      return data || [];
    },
    enabled: !!selectedClassId,
  });

  // Fetch class-level analysis
  const { data: classAnalysis = [], isLoading: classLoading } = useQuery({
    queryKey: ['class-subject-analysis', sessionId, selectedClassId],
    queryFn: () => examSessionService.getSubjectAnalysis(sessionId, parseInt(selectedClassId)),
    enabled: !!selectedClassId && viewLevel === 'class',
  });

  // Fetch stream-level analysis
  const { data: streamAnalysis = [], isLoading: streamLoading } = useQuery({
    queryKey: ['stream-subject-analysis', sessionId, selectedClassId, selectedStreamId],
    queryFn: async () => {
      if (!selectedClassId || selectedStreamId === 'all') return [];
      
      // Get papers for this class
      const { data: papers } = await supabase
        .from('exam_papers')
        .select(`
          id, paper_name, max_marks, subject_id,
          subject:subjects(name, code)
        `)
        .eq('exam_session_id', sessionId)
        .eq('class_id', parseInt(selectedClassId));

      if (!papers) return [];

      // Get students in this stream
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('current_class_id', parseInt(selectedClassId))
        .eq('current_stream_id', parseInt(selectedStreamId))
        .eq('is_active', true);

      const studentIds = students?.map(s => s.id) || [];

      // Get marks for each paper filtered by stream students
      const analyses = [];
      for (const paper of papers) {
        const { data: marks } = await supabase
          .from('exam_marks')
          .select('marks, grade, student_id')
          .eq('exam_paper_id', paper.id)
          .in('student_id', studentIds)
          .not('marks', 'is', null);

        const marksValues = marks?.map(m => Number(m.marks)) || [];
        const gradeDistribution: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };

        marks?.forEach(m => {
          if (m.grade && gradeDistribution[m.grade] !== undefined) {
            gradeDistribution[m.grade]++;
          }
        });

        analyses.push({
          subject_id: paper.subject_id,
          subject_name: (paper.subject as any)?.name || '',
          subject_code: (paper.subject as any)?.code || '',
          paper_name: paper.paper_name,
          max_marks: paper.max_marks,
          total_students: studentIds.length,
          marks_entered: marksValues.length,
          class_average: marksValues.length > 0 ? Number((marksValues.reduce((a, b) => a + b, 0) / marksValues.length).toFixed(1)) : 0,
          highest_score: marksValues.length > 0 ? Math.max(...marksValues) : 0,
          lowest_score: marksValues.length > 0 ? Math.min(...marksValues) : 0,
          grade_distribution: gradeDistribution,
        });
      }

      return analyses.sort((a, b) => b.class_average - a.class_average);
    },
    enabled: !!selectedClassId && viewLevel === 'stream' && selectedStreamId !== 'all',
  });

  // Fetch comparative stream analysis
  const { data: streamComparison = [], isLoading: comparisonLoading } = useQuery({
    queryKey: ['stream-comparison', sessionId, selectedClassId],
    queryFn: async () => {
      if (!selectedClassId || streams.length === 0) return [];

      const comparisons: StreamAnalysis[] = [];

      for (const stream of streams) {
        const { data: results } = await supabase
          .from('student_exam_results')
          .select('average_percentage, overall_grade')
          .eq('exam_session_id', sessionId)
          .eq('class_id', parseInt(selectedClassId))
          .eq('stream_id', stream.id);

        if (!results || results.length === 0) continue;

        const percentages = results.map(r => r.average_percentage);
        const gradeDistribution: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
        
        results.forEach(r => {
          if (gradeDistribution[r.overall_grade] !== undefined) {
            gradeDistribution[r.overall_grade]++;
          }
        });

        comparisons.push({
          stream_id: stream.id,
          stream_name: stream.name,
          average: Number((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1)),
          highest: Math.max(...percentages),
          lowest: Math.min(...percentages),
          students_count: results.length,
          grade_distribution: gradeDistribution,
        });
      }

      return comparisons.sort((a, b) => b.average - a.average);
    },
    enabled: !!selectedClassId && streams.length > 0,
  });

  const analysis = viewLevel === 'class' ? classAnalysis : streamAnalysis;
  const isLoading = viewLevel === 'class' ? classLoading : streamLoading;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Subject Performance Analysis
            </CardTitle>
            <Tabs value={viewLevel} onValueChange={(v) => setViewLevel(v as 'class' | 'stream')}>
              <TabsList className="h-8">
                <TabsTrigger value="class" className="text-xs px-3 h-7">Class Level</TabsTrigger>
                <TabsTrigger value="stream" className="text-xs px-3 h-7">Stream Level</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedStreamId('all'); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.class_id} value={c.class_id.toString()}>{c.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {viewLevel === 'stream' && streams.length > 0 && (
              <Select value={selectedStreamId} onValueChange={setSelectedStreamId}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select stream" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Compare Streams</SelectItem>
                  {streams.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stream Comparison */}
      {viewLevel === 'stream' && selectedStreamId === 'all' && selectedClassId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stream Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {comparisonLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : streamComparison.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No stream data available</p>
            ) : (
              <div className="space-y-4">
                {streamComparison.map((stream, idx) => (
                  <div key={stream.stream_id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          idx === 0 ? 'bg-amber-500 text-white' :
                          idx === 1 ? 'bg-slate-400 text-white' :
                          idx === 2 ? 'bg-amber-700 text-white' : 'bg-muted'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold">{stream.stream_name}</p>
                          <p className="text-sm text-muted-foreground">{stream.students_count} students</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{stream.average}%</p>
                        <p className="text-xs text-muted-foreground">Average</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1 text-green-600 text-sm">
                        <TrendingUp className="h-4 w-4" />
                        High: {stream.highest.toFixed(1)}%
                      </div>
                      <div className="flex items-center gap-1 text-red-600 text-sm">
                        <TrendingDown className="h-4 w-4" />
                        Low: {stream.lowest.toFixed(1)}%
                      </div>
                    </div>
                    <Progress value={stream.average} className="h-2 mb-2" />
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(stream.grade_distribution).map(([grade, count]) => {
                        const info = CBC_GRADES[grade as keyof typeof CBC_GRADES];
                        return count > 0 ? (
                          <Badge key={grade} variant="outline" className={info?.color}>
                            {grade}: {count}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subject Analysis Table */}
      {(viewLevel === 'class' || (viewLevel === 'stream' && selectedStreamId !== 'all')) && (
        <Card>
          <CardContent className="p-0">
            {!selectedClassId ? (
              <p className="text-center text-muted-foreground py-12">Select a class to view analysis</p>
            ) : isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : analysis.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No exam papers found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                      <TableHead className="text-right">High</TableHead>
                      <TableHead className="text-right">Low</TableHead>
                      <TableHead className="text-center">Coverage</TableHead>
                      <TableHead>Grade Distribution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.map((item, idx) => {
                      const coverage = item.total_students > 0 
                        ? Math.round((item.marks_entered / item.total_students) * 100) 
                        : 0;
                      return (
                        <TableRow key={item.subject_id}>
                          <TableCell>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-amber-500 text-white' :
                              idx === 1 ? 'bg-slate-400 text-white' :
                              idx === 2 ? 'bg-amber-700 text-white' : 'bg-muted'
                            }`}>
                              {idx + 1}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.subject_name}</p>
                              <p className="text-sm text-muted-foreground">{item.paper_name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-lg">{item.class_average}</span>
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {item.highest_score}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {item.lowest_score}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={coverage} className="h-2 w-16" />
                              <span className="text-xs text-muted-foreground">{coverage}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {Object.entries(item.grade_distribution).map(([grade, count]) => {
                                const info = CBC_GRADES[grade as keyof typeof CBC_GRADES];
                                const countNum = count as number;
                                return countNum > 0 ? (
                                  <Badge key={grade} variant="outline" className={`${info?.color} text-xs`}>
                                    {grade}: {countNum}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
