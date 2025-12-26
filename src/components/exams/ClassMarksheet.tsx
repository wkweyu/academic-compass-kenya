import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Printer, Download, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ClassMarksheetProps {
  sessionId: number;
  sessionName: string;
  classes: { class_id: number; class_name: string }[];
}

interface StudentMark {
  student_id: number;
  admission_number: string;
  full_name: string;
  stream_name: string | null;
  subjects: {
    subject_id: number;
    subject_name: string;
    marks: number | null;
    max_marks: number;
    grade: string | null;
  }[];
  total_marks: number;
  average_percentage: number;
  overall_grade: string;
  class_position: number | null;
}

export function ClassMarksheet({ sessionId, sessionName, classes }: ClassMarksheetProps) {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStream, setSelectedStream] = useState<string>('all');
  const [showMarks, setShowMarks] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch streams for selected class
  const { data: streams = [] } = useQuery({
    queryKey: ['streams-for-marksheet', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data, error } = await supabase
        .from('streams')
        .select('id, name')
        .eq('class_id', parseInt(selectedClass))
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClass,
  });

  // Fetch school info
  const { data: school } = useQuery({
    queryKey: ['school-for-marksheet'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_or_create_school_profile');
      return data?.[0] || { name: 'School Name', address: '', phone: '', email: '', motto: '' };
    },
  });

  // Fetch marksheet data
  const { data: marksheetData, isLoading } = useQuery({
    queryKey: ['marksheet-data', sessionId, selectedClass, selectedStream],
    queryFn: async () => {
      if (!selectedClass) return null;

      // Get papers for this class
      const { data: papers, error: papersError } = await supabase
        .from('exam_papers')
        .select('id, subject_id, max_marks, subjects:subject_id(name)')
        .eq('exam_session_id', sessionId)
        .eq('class_id', parseInt(selectedClass));
      
      if (papersError) throw papersError;

      // Get students
      let studentsQuery = supabase
        .from('students')
        .select('id, admission_number, full_name, current_stream_id, streams:current_stream_id(name)')
        .eq('current_class_id', parseInt(selectedClass))
        .eq('is_active', true)
        .order('full_name');
      
      if (selectedStream !== 'all') {
        studentsQuery = studentsQuery.eq('current_stream_id', parseInt(selectedStream));
      }
      
      const { data: students, error: studentsError } = await studentsQuery;
      if (studentsError) throw studentsError;

      // Get all marks
      const paperIds = papers?.map(p => p.id) || [];
      const studentIds = students?.map(s => s.id) || [];
      
      const { data: marks, error: marksError } = await supabase
        .from('exam_marks')
        .select('student_id, exam_paper_id, marks, grade')
        .in('exam_paper_id', paperIds)
        .in('student_id', studentIds);
      
      if (marksError) throw marksError;

      // Get student results for positions
      const { data: results } = await supabase
        .from('student_exam_results')
        .select('student_id, class_position, average_percentage, overall_grade, total_marks')
        .eq('exam_session_id', sessionId)
        .eq('class_id', parseInt(selectedClass));

      // Build marksheet
      const subjects = papers?.map(p => ({
        id: p.subject_id,
        name: (p.subjects as any)?.name || 'Unknown',
        max_marks: p.max_marks,
        paper_id: p.id,
      })) || [];

      const studentMarks: StudentMark[] = (students || []).map(student => {
        const studentResult = results?.find(r => r.student_id === student.id);
        const studentSubjects = subjects.map(subject => {
          const mark = marks?.find(m => m.student_id === student.id && m.exam_paper_id === subject.paper_id);
          return {
            subject_id: subject.id,
            subject_name: subject.name,
            marks: mark?.marks ?? null,
            max_marks: subject.max_marks,
            grade: mark?.grade ?? null,
          };
        });

        return {
          student_id: student.id,
          admission_number: student.admission_number,
          full_name: student.full_name,
          stream_name: (student.streams as any)?.name || null,
          subjects: studentSubjects,
          total_marks: studentResult?.total_marks || 0,
          average_percentage: studentResult?.average_percentage || 0,
          overall_grade: studentResult?.overall_grade || '-',
          class_position: studentResult?.class_position || null,
        };
      });

      // Sort by position
      studentMarks.sort((a, b) => (a.class_position || 999) - (b.class_position || 999));

      return { subjects, students: studentMarks };
    },
    enabled: !!selectedClass,
  });

  const className = classes.find(c => c.class_id.toString() === selectedClass)?.class_name || '';
  const streamName = selectedStream === 'all' ? '' : streams.find(s => s.id.toString() === selectedStream)?.name || '';

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Marksheet - ${className}${streamName ? ` (${streamName})` : ''}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; font-size: 11px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e40af; padding-bottom: 15px; }
            .school-name { font-size: 20px; font-weight: 700; color: #1e40af; text-transform: uppercase; }
            .school-details { color: #6b7280; font-size: 10px; margin-top: 5px; }
            .title { font-size: 14px; font-weight: 600; margin-top: 10px; }
            .subtitle { color: #6b7280; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #1e40af; color: white; padding: 8px 4px; font-size: 9px; text-transform: uppercase; }
            td { padding: 6px 4px; border: 1px solid #e5e7eb; text-align: center; }
            tr:nth-child(even) { background: #f9fafb; }
            .student-name { text-align: left; font-weight: 500; }
            .total { font-weight: 700; background: #dbeafe !important; }
            .footer { margin-top: 20px; text-align: center; color: #9ca3af; font-size: 9px; }
            @media print {
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="school-name">${school?.name || 'School Name'}</div>
            <div class="school-details">
              ${school?.address || ''} | Tel: ${school?.phone || ''} | Email: ${school?.email || ''}
            </div>
            <div class="title">${showMarks ? 'MARKSHEET' : 'BLANK MARKSHEET'}</div>
            <div class="subtitle">${sessionName} - ${className}${streamName ? ` (${streamName})` : ''}</div>
          </div>
          ${printContent.innerHTML}
          <div class="footer">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleExportCSV = () => {
    if (!marksheetData) return;

    const headers = ['#', 'Adm No', 'Name', 'Stream', ...marksheetData.subjects.map(s => s.name), 'Total', 'Avg %', 'Grade', 'Pos'];
    const rows = marksheetData.students.map((student, idx) => [
      idx + 1,
      student.admission_number,
      student.full_name,
      student.stream_name || '-',
      ...student.subjects.map(s => showMarks ? (s.marks ?? '-') : ''),
      showMarks ? student.total_marks : '',
      showMarks ? student.average_percentage.toFixed(1) : '',
      showMarks ? student.overall_grade : '',
      showMarks ? (student.class_position || '-') : '',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `marksheet_${className}_${showMarks ? 'with_marks' : 'blank'}.csv`;
    link.click();
    toast.success('CSV exported successfully');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Class Marksheet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="mb-2 block">Class</Label>
            <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedStream('all'); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.class_id} value={c.class_id.toString()}>
                    {c.class_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Stream</Label>
            <Select value={selectedStream} onValueChange={setSelectedStream}>
              <SelectTrigger>
                <SelectValue placeholder="All streams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Streams</SelectItem>
                {streams.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch
              id="show-marks"
              checked={showMarks}
              onCheckedChange={setShowMarks}
            />
            <Label htmlFor="show-marks">Show Marks</Label>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!marksheetData}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!marksheetData}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {marksheetData && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {marksheetData.students.length} students | {marksheetData.subjects.length} subjects
            </div>

            <div ref={printRef} className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-24">Adm No</TableHead>
                    <TableHead className="min-w-[150px]">Name</TableHead>
                    <TableHead className="w-20">Stream</TableHead>
                    {marksheetData.subjects.map(s => (
                      <TableHead key={s.id} className="text-center w-16">
                        <div className="text-xs">
                          <div>{s.name.slice(0, 4)}</div>
                          <div className="text-muted-foreground">({s.max_marks})</div>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center w-16">Total</TableHead>
                    <TableHead className="text-center w-16">Avg%</TableHead>
                    <TableHead className="text-center w-12">Grd</TableHead>
                    <TableHead className="text-center w-12">Pos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marksheetData.students.map((student, idx) => (
                    <TableRow key={student.student_id}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{student.admission_number}</TableCell>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{student.stream_name || '-'}</TableCell>
                      {student.subjects.map(s => (
                        <TableCell key={s.subject_id} className="text-center">
                          {showMarks ? (s.marks ?? '-') : ''}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold">
                        {showMarks ? student.total_marks : ''}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {showMarks ? student.average_percentage.toFixed(1) : ''}
                      </TableCell>
                      <TableCell className="text-center">
                        {showMarks && <Badge variant="outline">{student.overall_grade}</Badge>}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {showMarks ? (student.class_position || '-') : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {!selectedClass && (
          <div className="text-center py-8 text-muted-foreground">
            Select a class to view the marksheet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
