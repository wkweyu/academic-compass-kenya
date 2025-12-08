import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CBC_GRADES } from '@/types/exam-management';
import { FileText, Printer, Calculator, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TermReportCardProps {
  classId?: number;
  termId?: number;
  academicYear?: number;
}

interface ExamSessionOption {
  id: number;
  name: string;
  start_date: string;
  status: string;
}

interface CombinedResult {
  student_id: number;
  admission_number: string;
  full_name: string;
  stream_name: string | null;
  exams: {
    session_id: number;
    session_name: string;
    average_percentage: number;
    overall_grade: string;
  }[];
  combined_average: number;
  combined_grade: string;
  combined_points: number;
}

export function TermReportCard({ classId, termId, academicYear }: TermReportCardProps) {
  const [selectedClass, setSelectedClass] = useState<string>(classId?.toString() || '');
  const [selectedTerm, setSelectedTerm] = useState<string>(termId?.toString() || '');
  const [selectedYear, setSelectedYear] = useState<string>(academicYear?.toString() || new Date().getFullYear().toString());
  const [selectedExams, setSelectedExams] = useState<number[]>([]);
  const [combinedResults, setCombinedResults] = useState<CombinedResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['classes-for-term-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .order('grade_level');
      if (error) throw error;
      return data;
    },
  });

  // Fetch terms
  const { data: terms = [] } = useQuery({
    queryKey: ['terms-for-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_termsetting')
        .select('id, term_number, year')
        .order('year', { ascending: false })
        .order('term_number');
      if (error) throw error;
      return data;
    },
  });

  // Fetch exam sessions for selected class and term
  const { data: examSessions = [] } = useQuery({
    queryKey: ['exam-sessions-for-term', selectedClass, selectedTerm, selectedYear],
    queryFn: async () => {
      if (!selectedClass || !selectedTerm) return [];

      const { data, error } = await supabase
        .from('exam_sessions')
        .select('id, name, start_date, status')
        .eq('term_id', parseInt(selectedTerm))
        .eq('academic_year', parseInt(selectedYear))
        .eq('status', 'completed')
        .order('start_date');

      if (error) throw error;

      // Filter to sessions that have this class
      const sessionsWithClass: ExamSessionOption[] = [];
      for (const session of data || []) {
        const { data: sessionClass } = await supabase
          .from('exam_session_classes')
          .select('id')
          .eq('exam_session_id', session.id)
          .eq('class_id', parseInt(selectedClass))
          .single();

        if (sessionClass) {
          sessionsWithClass.push(session);
        }
      }

      return sessionsWithClass;
    },
    enabled: !!selectedClass && !!selectedTerm,
  });

  const handleExamToggle = (examId: number) => {
    setSelectedExams(prev => {
      if (prev.includes(examId)) {
        return prev.filter(id => id !== examId);
      }
      if (prev.length >= 3) {
        toast.error('You can select a maximum of 3 exams');
        return prev;
      }
      return [...prev, examId];
    });
    setCombinedResults([]);
  };

  const calculateCombinedResults = async () => {
    if (selectedExams.length < 2) {
      toast.error('Please select at least 2 exams to combine');
      return;
    }

    setIsCalculating(true);
    try {
      // Get all student results for selected exams
      const { data: results, error } = await supabase
        .from('student_exam_results')
        .select(`
          student_id,
          exam_session_id,
          average_percentage,
          overall_grade,
          average_points,
          students:student_id (
            id,
            admission_number,
            full_name,
            streams:current_stream_id (name)
          )
        `)
        .in('exam_session_id', selectedExams)
        .eq('class_id', parseInt(selectedClass));

      if (error) throw error;

      // Group by student and calculate combined average
      const studentMap = new Map<number, CombinedResult>();

      for (const result of results || []) {
        const student = result.students as any;
        if (!student) continue;

        const sessionInfo = examSessions.find(s => s.id === result.exam_session_id);

        if (!studentMap.has(result.student_id)) {
          studentMap.set(result.student_id, {
            student_id: result.student_id,
            admission_number: student.admission_number,
            full_name: student.full_name,
            stream_name: student.streams?.name || null,
            exams: [],
            combined_average: 0,
            combined_grade: '',
            combined_points: 0,
          });
        }

        const studentData = studentMap.get(result.student_id)!;
        studentData.exams.push({
          session_id: result.exam_session_id,
          session_name: sessionInfo?.name || 'Unknown',
          average_percentage: result.average_percentage,
          overall_grade: result.overall_grade,
        });
      }

      // Calculate combined averages
      const combined: CombinedResult[] = [];
      studentMap.forEach(student => {
        // Only include students who have all selected exams
        if (student.exams.length === selectedExams.length) {
          const avgPercentage = student.exams.reduce((sum, e) => sum + e.average_percentage, 0) / student.exams.length;
          
          // Calculate grade based on average
          let grade = 'BE';
          let points = 1;
          if (avgPercentage >= 75) { grade = 'EE'; points = 4; }
          else if (avgPercentage >= 50) { grade = 'ME'; points = 3; }
          else if (avgPercentage >= 25) { grade = 'AE'; points = 2; }

          student.combined_average = avgPercentage;
          student.combined_grade = grade;
          student.combined_points = points;
          combined.push(student);
        }
      });

      // Sort by combined average descending
      combined.sort((a, b) => b.combined_average - a.combined_average);
      setCombinedResults(combined);
      toast.success('Combined results calculated successfully');
    } catch (error) {
      console.error('Error calculating combined results:', error);
      toast.error('Failed to calculate combined results');
    } finally {
      setIsCalculating(false);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('term-report-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const selectedClassName = classes.find(c => c.id.toString() === selectedClass)?.name || '';
    const selectedTermInfo = terms.find(t => t.id.toString() === selectedTerm);

    printWindow.document.write(`
      <html>
        <head>
          <title>Term Report Card - ${selectedClassName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 5px; }
            h2 { text-align: center; color: #666; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .grade { font-weight: bold; }
            .header-info { text-align: center; margin-bottom: 20px; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>Term ${selectedTermInfo?.term_number || ''} Combined Report Card</h1>
          <h2>${selectedClassName} - ${selectedYear}</h2>
          <div class="header-info">
            <p>Exams Combined: ${selectedExams.length}</p>
          </div>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator size={20} />
            Term Report Card Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Class</label>
              <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedExams([]); setCombinedResults([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Term</label>
              <Select value={selectedTerm} onValueChange={v => { setSelectedTerm(v); setSelectedExams([]); setCombinedResults([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      Term {t.term_number} - {t.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Year</label>
              <Select value={selectedYear} onValueChange={v => { setSelectedYear(v); setSelectedExams([]); setCombinedResults([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set(terms.map(t => t.year))].map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Exam Selection */}
          {examSessions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Exams to Combine (2-3)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {examSessions.map(session => (
                  <div
                    key={session.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedExams.includes(session.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleExamToggle(session.id)}
                  >
                    <Checkbox
                      checked={selectedExams.includes(session.id)}
                      onCheckedChange={() => handleExamToggle(session.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{session.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.start_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline">{session.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {examSessions.length === 0 && selectedClass && selectedTerm && (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle size={16} />
              <span>No completed exams found for this class and term</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={calculateCombinedResults}
              disabled={selectedExams.length < 2 || isCalculating}
            >
              <Calculator size={16} className="mr-2" />
              {isCalculating ? 'Calculating...' : 'Calculate Combined Results'}
            </Button>
            {combinedResults.length > 0 && (
              <Button variant="outline" onClick={handlePrint}>
                <Printer size={16} className="mr-2" />
                Print Report
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Combined Results Table */}
      {combinedResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText size={20} />
              Combined Term Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div id="term-report-content" className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Adm No.</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Stream</TableHead>
                    {selectedExams.map(examId => {
                      const session = examSessions.find(s => s.id === examId);
                      return (
                        <TableHead key={examId} className="text-center">
                          {session?.name || 'Exam'}
                        </TableHead>
                      );
                    })}
                    <TableHead className="text-center">Combined Avg</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinedResults.map((result, index) => {
                    const gradeInfo = CBC_GRADES[result.combined_grade as keyof typeof CBC_GRADES];
                    return (
                      <TableRow key={result.student_id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{result.admission_number}</TableCell>
                        <TableCell>{result.full_name}</TableCell>
                        <TableCell>{result.stream_name || '-'}</TableCell>
                        {selectedExams.map(examId => {
                          const exam = result.exams.find(e => e.session_id === examId);
                          return (
                            <TableCell key={examId} className="text-center">
                              {exam ? `${exam.average_percentage.toFixed(1)}%` : '-'}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-semibold">
                          {result.combined_average.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${gradeInfo?.bgColor} ${gradeInfo?.color}`}>
                            {result.combined_grade}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
