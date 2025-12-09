import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExamSession, CBC_GRADES } from '@/types/exam-management';
import { ElegantReportCard } from './ElegantReportCard';
import { Printer, Search, Users, User, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface BatchReportCardsProps {
  session: ExamSession;
}

interface StudentResult {
  student_id: number;
  admission_number: string;
  full_name: string;
  class_id: number;
  class_name: string;
  stream_id: number | null;
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

export function BatchReportCards({ session }: BatchReportCardsProps) {
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStream, setSelectedStream] = useState<string>('all');
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [currentPrintStudent, setCurrentPrintStudent] = useState<StudentResult | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch school info
  const { data: school } = useQuery({
    queryKey: ['school-profile'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_or_create_school_profile');
      return data?.[0] || { name: 'School Name' };
    },
  });

  // Fetch classes for this session
  const { data: sessionClasses = [] } = useQuery({
    queryKey: ['session-classes', session.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('exam_session_classes')
        .select('class_id, class:classes(id, name)')
        .eq('exam_session_id', session.id);
      return data?.map((d: any) => ({ id: d.class_id, name: d.class?.name })) || [];
    },
  });

  // Fetch streams for selected class
  const { data: streams = [] } = useQuery({
    queryKey: ['class-streams', selectedClass],
    queryFn: async () => {
      if (selectedClass === 'all') return [];
      const { data } = await supabase
        .from('streams')
        .select('id, name')
        .eq('class_assigned_id', parseInt(selectedClass))
        .order('name');
      return data || [];
    },
    enabled: selectedClass !== 'all',
  });

  // Fetch students with results
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['batch-report-students', session.id, selectedClass, selectedStream],
    queryFn: async () => {
      let query = supabase
        .from('student_exam_results')
        .select(`
          student_id,
          class_id,
          stream_id,
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
        .order('class_position');

      if (selectedClass !== 'all') {
        query = query.eq('class_id', parseInt(selectedClass));
      }
      if (selectedStream !== 'all') {
        query = query.eq('stream_id', parseInt(selectedStream));
      }

      const { data: results, error } = await query;
      if (error) throw error;

      // Get student details
      const studentIds = results?.map(r => r.student_id) || [];
      if (studentIds.length === 0) return [];

      const { data: studentData } = await supabase
        .from('students')
        .select('id, admission_number, full_name, current_class_id, current_stream_id')
        .in('id', studentIds);

      // Get class and stream names
      const { data: classes } = await supabase.from('classes').select('id, name');
      const { data: streamsData } = await supabase.from('streams').select('id, name');

      return results?.map(r => {
        const student = studentData?.find(s => s.id === r.student_id);
        return {
          ...r,
          admission_number: student?.admission_number || '',
          full_name: student?.full_name || '',
          class_name: classes?.find(c => c.id === r.class_id)?.name || '',
          stream_name: streamsData?.find(s => s.id === r.stream_id)?.name || null,
        };
      }) as StudentResult[];
    },
  });

  // Filter students by search
  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.admission_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleStudent = (studentId: number) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const toggleAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.student_id)));
    }
  };

  // Fetch marks for a student
  const fetchStudentMarks = async (studentId: number) => {
    const { data: marks } = await supabase
      .from('exam_marks')
      .select(`
        marks,
        grade,
        points,
        exam_paper_id,
        exam_papers!inner(
          exam_session_id,
          subject_id,
          max_marks,
          subjects(name, code)
        )
      `)
      .eq('student_id', studentId)
      .eq('exam_papers.exam_session_id', session.id)
      .eq('is_submitted', true);

    return marks?.map((m: any) => ({
      subject_name: m.exam_papers?.subjects?.name || '',
      subject_code: m.exam_papers?.subjects?.code || '',
      marks: m.marks || 0,
      max_marks: m.exam_papers?.max_marks || 100,
      grade: m.grade || '',
      points: m.points || 0,
    })) || [];
  };

  const handlePrintSelected = async () => {
    if (selectedStudents.size === 0) {
      toast.error('Please select at least one student');
      return;
    }

    setIsPrinting(true);
    const selectedList = students.filter(s => selectedStudents.has(s.student_id));
    
    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print report cards');
      setIsPrinting(false);
      return;
    }

    let printContent = '';
    
    for (const student of selectedList) {
      const marks = await fetchStudentMarks(student.student_id);
      
      printContent += `
        <div class="report-card" style="page-break-after: always;">
          <div class="header">
            <h1>${school?.name || 'School Name'}</h1>
            ${school?.motto ? `<p class="motto">"${school.motto}"</p>` : ''}
            ${school?.address ? `<p class="address">${school.address}</p>` : ''}
          </div>
          
          <div class="title">
            <h2>ACADEMIC REPORT CARD</h2>
            <p>${session.name} • ${session.academic_year}</p>
          </div>
          
          <div class="student-info">
            <div><strong>Adm No:</strong> ${student.admission_number}</div>
            <div><strong>Name:</strong> ${student.full_name}</div>
            <div><strong>Class:</strong> ${student.class_name}${student.stream_name ? ` (${student.stream_name})` : ''}</div>
          </div>
          
          <div class="summary-cards">
            <div class="card"><span class="value">${student.class_position || '-'}</span><span class="label">Class Rank</span></div>
            <div class="card"><span class="value">${student.stream_position || '-'}</span><span class="label">Stream Rank</span></div>
            <div class="card"><span class="value">${student.average_percentage.toFixed(1)}%</span><span class="label">Average</span></div>
            <div class="card"><span class="value">${student.average_points.toFixed(2)}</span><span class="label">Points</span></div>
            <div class="card grade-${student.overall_grade.toLowerCase()}"><span class="value">${student.overall_grade}</span><span class="label">Grade</span></div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Marks</th>
                <th>Max</th>
                <th>%</th>
                <th>Grade</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              ${marks.map(m => `
                <tr>
                  <td>${m.subject_name} (${m.subject_code})</td>
                  <td class="center">${m.marks}</td>
                  <td class="center">${m.max_marks}</td>
                  <td class="center">${((m.marks / m.max_marks) * 100).toFixed(0)}%</td>
                  <td class="center grade-${m.grade.toLowerCase()}">${m.grade}</td>
                  <td class="center">${m.points}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>TOTAL (${student.subjects_count} subjects)</strong></td>
                <td class="center"><strong>${student.total_marks}</strong></td>
                <td class="center"><strong>${student.total_possible}</strong></td>
                <td class="center"><strong>${student.average_percentage.toFixed(1)}%</strong></td>
                <td class="center"><strong>${student.overall_grade}</strong></td>
                <td class="center"><strong>${student.total_points}</strong></td>
              </tr>
            </tfoot>
          </table>
          
          <div class="comments">
            <div class="comment-box">
              <p><strong>Class Teacher's Remarks:</strong></p>
              <div class="line"></div>
              <div class="signature">Signature: _____________ Date: _______</div>
            </div>
            <div class="comment-box">
              <p><strong>Head Teacher's Remarks:</strong></p>
              <div class="line"></div>
              <div class="signature">Signature: _____________ Date: _______</div>
            </div>
          </div>
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Report Cards - ${session.name}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.4; }
            .report-card { padding: 20px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 15px; margin-bottom: 15px; }
            .header h1 { font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
            .header .motto { font-style: italic; color: #666; margin-top: 5px; }
            .header .address { font-size: 11px; color: #666; }
            .title { text-align: center; background: linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0); padding: 10px; margin-bottom: 15px; border-radius: 5px; }
            .title h2 { font-size: 16px; letter-spacing: 3px; }
            .title p { color: #666; font-size: 12px; }
            .student-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #f8f8f8; padding: 12px; border-radius: 8px; margin-bottom: 15px; }
            .summary-cards { display: flex; gap: 10px; justify-content: center; margin-bottom: 15px; }
            .card { flex: 1; text-align: center; padding: 10px; border-radius: 8px; border: 1px solid #ddd; }
            .card .value { display: block; font-size: 20px; font-weight: bold; }
            .card .label { display: block; font-size: 10px; color: #666; text-transform: uppercase; }
            .grade-ee { background: #d4edda; color: #155724; }
            .grade-me { background: #cce5ff; color: #004085; }
            .grade-ae { background: #fff3cd; color: #856404; }
            .grade-be { background: #f8d7da; color: #721c24; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f0f0f0; font-weight: 600; }
            .center { text-align: center; }
            tfoot { background: #f8f8f8; }
            .comments { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .comment-box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
            .comment-box .line { border-bottom: 1px dashed #999; height: 40px; margin: 10px 0; }
            .comment-box .signature { font-size: 10px; color: #666; }
            @media print {
              .report-card { page-break-after: always; }
              .report-card:last-child { page-break-after: avoid; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      setIsPrinting(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Batch Report Cards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedStream('all'); setSelectedStudents(new Set()); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {sessionClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStream} onValueChange={(v) => { setSelectedStream(v); setSelectedStudents(new Set()); }} disabled={selectedClass === 'all'}>
              <SelectTrigger>
                <SelectValue placeholder="Select stream" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Streams</SelectItem>
                {streams.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search students..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Button 
              onClick={handlePrintSelected} 
              disabled={selectedStudents.size === 0 || isPrinting}
              className="w-full"
            >
              {isPrinting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              Print {selectedStudents.size > 0 ? `(${selectedStudents.size})` : ''} Cards
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {filteredStudents.length} Students
            </CardTitle>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedStudents.size === filteredStudents.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No students found with computed results</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredStudents.map((student) => {
                  const gradeInfo = CBC_GRADES[student.overall_grade as keyof typeof CBC_GRADES];
                  const isSelected = selectedStudents.has(student.student_id);
                  
                  return (
                    <div
                      key={student.student_id}
                      className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleStudent(student.student_id)}
                    >
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleStudent(student.student_id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{student.full_name}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{student.admission_number}</span>
                          <span>•</span>
                          <span>{student.class_name}</span>
                          {student.stream_name && (
                            <>
                              <span>•</span>
                              <span>{student.stream_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="text-right hidden sm:block">
                          <div className="font-medium">{student.average_percentage.toFixed(1)}%</div>
                          <div className="text-muted-foreground">Pos: {student.class_position || '-'}</div>
                        </div>
                        <Badge className={`${gradeInfo?.bgColor} ${gradeInfo?.color}`}>
                          {student.overall_grade}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
