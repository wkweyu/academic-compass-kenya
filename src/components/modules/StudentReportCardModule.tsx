import { useState, useEffect, useRef } from 'react';
import { Search, Download, Printer, FileText, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { examManagementService } from '@/services/examManagementService';
import { getGradeColorClasses, CBC_GRADES } from '@/utils/cbcGrading';

interface StudentOption {
  id: number;
  admission_number: string;
  full_name: string;
  class_name: string;
  stream_name: string;
}

export function StudentReportCardModule() {
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<number>(new Date().getFullYear());
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [schoolProfile, setSchoolProfile] = useState<any>(null);

  useEffect(() => {
    loadFormData();
  }, []);

  useEffect(() => {
    if (selectedStudentId && selectedTermId) {
      loadReportCard();
    }
  }, [selectedStudentId, selectedTermId, academicYear]);

  const loadFormData = async () => {
    try {
      const [studentsRes, termsRes, schoolRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, admission_number, full_name, class:classes(name), stream:streams(name)')
          .eq('is_active', true)
          .order('full_name'),
        supabase.from('settings_termsetting').select('id, term, year').order('year', { ascending: false }).order('term'),
        supabase.rpc('get_or_create_school_profile'),
      ]);

      setStudents((studentsRes.data || []).map((s: any) => ({
        id: s.id,
        admission_number: s.admission_number,
        full_name: s.full_name,
        class_name: s.class?.name || '',
        stream_name: s.stream?.name || '',
      })));
      setTerms(termsRes.data || []);
      if (schoolRes.data && schoolRes.data.length > 0) {
        setSchoolProfile(schoolRes.data[0]);
      }
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  };

  const loadReportCard = async () => {
    if (!selectedStudentId || !selectedTermId) return;
    
    setLoading(true);
    try {
      const data = await examManagementService.getStudentReportCard(
        parseInt(selectedStudentId),
        parseInt(selectedTermId),
        academicYear
      );
      setReportData(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load report card',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (reportRef.current) {
      const printContent = reportRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Report Card - ${reportData?.student?.full_name}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; }
                .header { text-align: center; margin-bottom: 20px; }
                .summary { margin-top: 20px; padding: 15px; background: #f9f9f9; }
                .grade-legend { display: flex; gap: 20px; justify-content: center; margin-top: 10px; }
              </style>
            </head>
            <body>${printContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedTerm = terms.find(t => t.id.toString() === selectedTermId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Report Card</h1>
          <p className="text-muted-foreground">
            Generate and view individual student report cards
          </p>
        </div>
        
        {reportData && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Select Student & Term</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudents.map((student) => (
                    <SelectItem key={student.id} value={student.id.toString()}>
                      {student.full_name} ({student.admission_number}) - {student.class_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
              <SelectTrigger>
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id.toString()}>
                    Term {term.term} ({term.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Year"
              value={academicYear}
              onChange={(e) => setAcademicYear(parseInt(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Report Card */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Loading report card...</p>
        </div>
      )}

      {reportData && !loading && (
        <Card>
          <CardContent className="p-6" ref={reportRef}>
            {/* School Header */}
            <div className="text-center mb-6">
              {schoolProfile?.logo && (
                <img src={schoolProfile.logo} alt="School Logo" className="h-16 mx-auto mb-2" />
              )}
              <h2 className="text-2xl font-bold">{schoolProfile?.name || 'School Name'}</h2>
              {schoolProfile?.motto && <p className="text-muted-foreground italic">"{schoolProfile.motto}"</p>}
              <p className="text-sm text-muted-foreground">{schoolProfile?.address}</p>
              <Separator className="my-4" />
              <h3 className="text-xl font-semibold">STUDENT PROGRESS REPORT</h3>
              <p className="text-muted-foreground">
                Term {selectedTerm?.term} - Academic Year {academicYear}
              </p>
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{reportData.student.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admission No.</p>
                <p className="font-medium">{reportData.student.admission_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Class</p>
                <p className="font-medium">{reportData.student.class_name} {reportData.student.stream_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="font-medium">{reportData.student.gender === 'M' ? 'Male' : 'Female'}</p>
              </div>
            </div>

            {/* Subject Results */}
            <div className="mb-6">
              <h4 className="font-semibold mb-3">Academic Performance</h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Subject</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead className="text-center">Marks</TableHead>
                      <TableHead className="text-center">%</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead className="text-center">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.subjects.map((subject: any, idx: number) => (
                      subject.exams.map((exam: any, examIdx: number) => {
                        const gradeColors = getGradeColorClasses(exam.grade);
                        return (
                          <TableRow key={`${idx}-${examIdx}`}>
                            {examIdx === 0 && (
                              <TableCell rowSpan={subject.exams.length} className="font-medium border-r">
                                {subject.subject_name}
                                <br />
                                <span className="text-xs text-muted-foreground">{subject.subject_code}</span>
                              </TableCell>
                            )}
                            <TableCell>{exam.exam_type}</TableCell>
                            <TableCell className="text-center">{exam.marks}/{exam.max_marks}</TableCell>
                            <TableCell className="text-center">{exam.percentage}%</TableCell>
                            <TableCell className="text-center">
                              <Badge className={`${gradeColors.bgColor} ${gradeColors.color}`}>
                                {exam.grade}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">{exam.points}</TableCell>
                          </TableRow>
                        );
                      })
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Summary */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-3">Performance Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Subjects:</span>
                    <span className="font-medium">{reportData.summary.total_subjects}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Exams:</span>
                    <span className="font-medium">{reportData.summary.total_exams}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Marks:</span>
                    <span className="font-medium">{reportData.summary.total_marks}/{reportData.summary.total_possible}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overall Percentage:</span>
                    <span className="font-bold text-lg">{reportData.summary.overall_percentage}%</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span>Average Points:</span>
                    <span className="font-bold text-xl">{reportData.summary.average_points}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Overall Grade:</span>
                    <Badge className={`${getGradeColorClasses(reportData.summary.overall_grade).bgColor} ${getGradeColorClasses(reportData.summary.overall_grade).color} text-lg px-4 py-1`}>
                      {reportData.summary.overall_grade}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-3">CBC Grading Key</h4>
                <div className="space-y-2">
                  {CBC_GRADES.map(grade => (
                    <div key={grade.grade} className="flex items-center gap-2">
                      <Badge className={`${grade.bgColor} ${grade.color}`}>{grade.grade}</Badge>
                      <span className="text-sm">{grade.points} points - {grade.description}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="text-sm text-muted-foreground">
                  <p><strong>EE:</strong> 75-100% | <strong>ME:</strong> 50-74%</p>
                  <p><strong>AE:</strong> 25-49% | <strong>BE:</strong> 0-24%</p>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-8 mt-8 pt-4 border-t">
              <div className="text-center">
                <div className="border-b border-dashed h-8 mb-2"></div>
                <p className="text-sm text-muted-foreground">Class Teacher's Signature</p>
              </div>
              <div className="text-center">
                <div className="border-b border-dashed h-8 mb-2"></div>
                <p className="text-sm text-muted-foreground">Principal's Signature</p>
              </div>
              <div className="text-center">
                <div className="border-b border-dashed h-8 mb-2"></div>
                <p className="text-sm text-muted-foreground">Date</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(!selectedStudentId || !selectedTermId) && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select Student & Term</h3>
            <p className="text-muted-foreground text-center">
              Choose a student and term to generate their report card.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedStudentId && selectedTermId && !reportData && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Results Found</h3>
            <p className="text-muted-foreground text-center">
              No exam results found for this student in the selected term.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
