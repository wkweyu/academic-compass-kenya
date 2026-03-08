import { useState, useRef } from 'react';
import { escapeHtml } from '@/utils/escapeHtml';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Download, User, GraduationCap, Award } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ExamSession, CBC_GRADES } from '@/types/exam-management';
import { toast } from 'sonner';

interface StudentReportCardProps {
  session: ExamSession;
}

interface StudentResult {
  student_id: number;
  admission_number: string;
  full_name: string;
  class_name: string;
  stream_name: string | null;
  total_marks: number;
  total_possible: number;
  average_percentage: number;
  total_points: number;
  average_points: number;
  overall_grade: string;
  subjects_count: number;
  class_position: number | null;
  stream_position: number | null;
}

interface SubjectMark {
  subject_name: string;
  subject_code: string;
  marks: number;
  max_marks: number;
  grade: string;
  points: number;
  teacher_name?: string;
}

export function StudentReportCard({ session }: StudentReportCardProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch students with results
  const { data: students = [] } = useQuery({
    queryKey: ['session-students', session.id],
    queryFn: async () => {
      const { data: results, error } = await supabase
        .from('student_exam_results')
        .select(`
          student_id,
          total_marks,
          total_possible,
          average_percentage,
          total_points,
          average_points,
          overall_grade,
          subjects_count,
          class_position,
          stream_position
        `)
        .eq('exam_session_id', session.id)
        .order('class_position', { ascending: true });

      if (error) throw error;

      // Fetch student details
      const studentIds = results?.map(r => r.student_id) || [];
      if (studentIds.length === 0) return [];

      const { data: studentData } = await supabase
        .from('students')
        .select(`
          id,
          admission_number,
          full_name,
          current_class_id,
          current_stream_id
        `)
        .in('id', studentIds);

      // Get class and stream names
      const classIds = [...new Set(studentData?.map(s => s.current_class_id).filter(Boolean))];
      const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .in('id', classIds);

      const streamIds = [...new Set(studentData?.map(s => s.current_stream_id).filter(Boolean))];
      const { data: streams } = streamIds.length > 0 ? await supabase
        .from('streams')
        .select('id, name')
        .in('id', streamIds) : { data: [] };

      return results?.map(r => {
        const student = studentData?.find(s => s.id === r.student_id);
        const className = classes?.find(c => c.id === student?.current_class_id)?.name || '';
        const streamName = streams?.find(s => s.id === student?.current_stream_id)?.name || null;
        return {
          ...r,
          admission_number: student?.admission_number || '',
          full_name: student?.full_name || '',
          class_name: className,
          stream_name: streamName,
        };
      }) as StudentResult[];
    },
  });

  // Fetch selected student's subject marks
  const { data: subjectMarks = [] } = useQuery({
    queryKey: ['student-marks', session.id, selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return [];

      const { data: marks, error } = await supabase
        .from('exam_marks')
        .select(`
          marks,
          grade,
          points,
          exam_paper_id
        `)
        .eq('student_id', selectedStudentId)
        .eq('is_submitted', true);

      if (error) throw error;

      // Get paper details
      const paperIds = marks?.map(m => m.exam_paper_id) || [];
      const { data: papers } = await supabase
        .from('exam_papers')
        .select('id, subject_id, max_marks')
        .eq('exam_session_id', session.id)
        .in('id', paperIds);

      const subjectIds = [...new Set(papers?.map(p => p.subject_id))];
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name, code')
        .in('id', subjectIds);

      return marks?.map(m => {
        const paper = papers?.find(p => p.id === m.exam_paper_id);
        const subject = subjects?.find(s => s.id === paper?.subject_id);
        return {
          subject_name: subject?.name || '',
          subject_code: subject?.code || '',
          marks: m.marks || 0,
          max_marks: paper?.max_marks || 100,
          grade: m.grade || '',
          points: m.points || 0,
        };
      }) as SubjectMark[];
    },
    enabled: !!selectedStudentId,
  });

  // Fetch school info
  const { data: school } = useQuery({
    queryKey: ['school'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_or_create_school_profile');
      return data?.[0];
    },
  });

  const selectedStudent = students.find(s => s.student_id === selectedStudentId);
  const gradeInfo = selectedStudent ? CBC_GRADES[selectedStudent.overall_grade as keyof typeof CBC_GRADES] : null;

  const handlePrint = () => {
    if (printRef.current) {
      const printContents = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Report Card - ${selectedStudent?.full_name}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; }
                .header { text-align: center; margin-bottom: 20px; }
                .student-info { margin: 20px 0; }
                .grade-badge { 
                  display: inline-block; 
                  padding: 4px 12px; 
                  border-radius: 4px; 
                  font-weight: bold;
                }
                .summary { margin-top: 20px; display: flex; gap: 20px; }
                .summary-item { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
                @media print {
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
              </style>
            </head>
            <body>${printContents}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Student Report Cards</h3>
          <p className="text-sm text-muted-foreground">
            Generate and print individual student report cards
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Student</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedStudentId?.toString()}
            onValueChange={(value) => setSelectedStudentId(Number(value))}
          >
            <SelectTrigger className="w-full md:w-96">
              <SelectValue placeholder="Select a student to view report card" />
            </SelectTrigger>
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.student_id} value={student.student_id.toString()}>
                  {student.admission_number} - {student.full_name} ({student.class_name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedStudent && (
        <>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print Report Card
            </Button>
          </div>

          <div ref={printRef}>
            <Card>
              <CardContent className="p-6">
                {/* School Header */}
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">{school?.name || 'School Name'}</h2>
                  <p className="text-muted-foreground">{school?.motto}</p>
                  <p className="text-sm">{school?.address}</p>
                  <Separator className="my-4" />
                  <h3 className="text-lg font-semibold">STUDENT REPORT CARD</h3>
                  <p className="text-muted-foreground">
                    {session.name} - {session.academic_year}
                  </p>
                </div>

                {/* Student Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Admission No.</p>
                    <p className="font-medium">{selectedStudent.admission_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Student Name</p>
                    <p className="font-medium">{selectedStudent.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Class</p>
                    <p className="font-medium">{selectedStudent.class_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stream</p>
                    <p className="font-medium">{selectedStudent.stream_name || 'N/A'}</p>
                  </div>
                </div>

                {/* Subject Marks Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-center">Marks</TableHead>
                      <TableHead className="text-center">Max</TableHead>
                      <TableHead className="text-center">%</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead className="text-center">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjectMarks.map((subject, idx) => {
                      const gradeData = CBC_GRADES[subject.grade as keyof typeof CBC_GRADES];
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {subject.subject_name}
                          </TableCell>
                          <TableCell className="text-center">{subject.marks}</TableCell>
                          <TableCell className="text-center">{subject.max_marks}</TableCell>
                          <TableCell className="text-center">
                            {((subject.marks / subject.max_marks) * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={gradeData?.color}>
                              {subject.grade}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{subject.points}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                  <Card className="bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <Award className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">Total Marks</p>
                      <p className="text-xl font-bold">
                        {selectedStudent.total_marks}/{selectedStudent.total_possible}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <GraduationCap className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">Average</p>
                      <p className="text-xl font-bold">
                        {selectedStudent.average_percentage?.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={gradeInfo?.bgColor}>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Overall Grade</p>
                      <p className={`text-2xl font-bold ${gradeInfo?.color}`}>
                        {selectedStudent.overall_grade}
                      </p>
                      <p className="text-xs text-muted-foreground">{gradeInfo?.label}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <User className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">Class Position</p>
                      <p className="text-xl font-bold">{selectedStudent.class_position || '-'}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Stream Position</p>
                      <p className="text-xl font-bold">{selectedStudent.stream_position || '-'}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Grade Scale Legend */}
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-2">Grading Scale (CBC)</h4>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(CBC_GRADES).map(([grade, info]) => (
                      <div key={grade} className="flex items-center gap-2">
                        <Badge variant="outline" className={info.color}>{grade}</Badge>
                        <span className="text-sm">{info.label} ({info.points} pts)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comments Section */}
                <div className="mt-6 space-y-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm font-semibold mb-2">Class Teacher's Remarks:</p>
                    <div className="h-12 border-b border-dashed"></div>
                    <p className="text-sm mt-2">Signature: _________________ Date: _________</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm font-semibold mb-2">Head Teacher's Remarks:</p>
                    <div className="h-12 border-b border-dashed"></div>
                    <p className="text-sm mt-2">Signature: _________________ Date: _________</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {students.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No student results computed yet.</p>
            <p className="text-sm">Submit marks and compute results first.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
