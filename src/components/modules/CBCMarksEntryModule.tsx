import { useState, useEffect } from 'react';
import { Search, Save, Download, Users, BookOpen, Calculator, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { examManagementService, Exam, StudentScore } from '@/services/examManagementService';
import { calculateCBCGrade, getGradeColorClasses, CBC_GRADES } from '@/utils/cbcGrading';

export function CBCMarksEntryModule() {
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number>(0);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      const exam = exams.find(e => e.id === selectedExamId);
      setSelectedExam(exam || null);
      loadStudents(selectedExamId);
    } else {
      setSelectedExam(null);
      setStudents([]);
    }
  }, [selectedExamId, exams]);

  const loadExams = async () => {
    try {
      const data = await examManagementService.getExams();
      setExams(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load exams',
        variant: 'destructive',
      });
    }
  };

  const loadStudents = async (examId: number) => {
    setLoading(true);
    try {
      const data = await examManagementService.getStudentsForExam(examId);
      setStudents(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load students',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarksChange = (studentId: number, marks: string) => {
    const marksNum = marks === '' ? 0 : parseFloat(marks);
    if (isNaN(marksNum) || !selectedExam) return;
    
    const clampedMarks = Math.min(Math.max(0, marksNum), selectedExam.max_marks);
    const gradeInfo = calculateCBCGrade(clampedMarks, selectedExam.max_marks);
    
    setStudents(prev => prev.map(s => 
      s.student_id === studentId 
        ? { ...s, marks: clampedMarks, grade: gradeInfo.grade, points: gradeInfo.points, is_absent: false }
        : s
    ));
  };

  const handleAbsentToggle = (studentId: number, checked: boolean) => {
    setStudents(prev => prev.map(s =>
      s.student_id === studentId
        ? { ...s, is_absent: checked, marks: checked ? 0 : s.marks, grade: checked ? 'BE' : s.grade }
        : s
    ));
  };

  const handleSaveScores = async () => {
    if (!selectedExam) return;
    
    setSaving(true);
    try {
      await examManagementService.saveScores(selectedExamId, students, selectedExam.max_marks);
      toast({
        title: 'Success',
        description: 'Scores saved successfully',
      });
      loadExams(); // Refresh statistics
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save scores',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportScores = async () => {
    if (!selectedExam) return;
    
    try {
      const headers = ['Admission No.', 'Student Name', 'Marks', 'Grade', 'Points', 'Absent'];
      const rows = filteredStudents.map(s => [
        s.admission_number,
        s.full_name,
        s.marks,
        s.grade,
        s.points,
        s.is_absent ? 'Yes' : 'No'
      ]);
      
      const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedExam.name.replace(/\s+/g, '-')}-scores.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: 'Success', description: 'Scores exported' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export', variant: 'destructive' });
    }
  };

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const scoresEntered = students.filter(s => s.marks > 0 || s.is_absent).length;
  const completionPercentage = students.length > 0 ? Math.round((scoresEntered / students.length) * 100) : 0;
  const classAverage = scoresEntered > 0
    ? students.filter(s => s.marks > 0).reduce((sum, s) => sum + s.marks, 0) / students.filter(s => s.marks > 0).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marks Entry</h1>
          <p className="text-muted-foreground">
            Enter and manage student exam scores with CBC grading
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportScores} disabled={!selectedExamId}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={handleSaveScores} disabled={!selectedExamId || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

      {/* Exam Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Exam</CardTitle>
          <CardDescription>Choose an exam to enter marks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              value={selectedExamId.toString()}
              onValueChange={(value) => setSelectedExamId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an exam" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id.toString()}>
                    {exam.name} - {exam.subject_name} ({exam.class_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedExam && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {selectedExam.subject_code}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {selectedExam.class_name} {selectedExam.stream_name || ''}
                </div>
                <div className="flex items-center gap-1">
                  <Calculator className="h-4 w-4" />
                  Max: {selectedExam.max_marks}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {selectedExam && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Scores Entered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{scoresEntered}</div>
              <Progress value={completionPercentage} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Class Average</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classAverage.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">out of {selectedExam.max_marks}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">CBC Grading</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {CBC_GRADES.map(g => (
                  <Badge key={g.grade} className={`${g.bgColor} ${g.color}`}>
                    {g.grade}: {g.points}pt
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Marks Entry Table */}
      {selectedExam && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedExam.name} - {selectedExam.subject_name}</CardTitle>
            <CardDescription>
              {selectedExam.class_name} {selectedExam.stream_name || ''} | Term {selectedExam.term_number}, {selectedExam.academic_year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">Loading students...</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[120px]">Adm. No.</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="w-[100px]">Marks</TableHead>
                      <TableHead className="w-[80px]">Grade</TableHead>
                      <TableHead className="w-[80px]">Points</TableHead>
                      <TableHead className="w-[80px]">Absent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const gradeColors = getGradeColorClasses(student.grade);
                      
                      return (
                        <TableRow key={student.student_id} className={student.is_absent ? 'bg-red-50' : ''}>
                          <TableCell className="font-medium">{student.admission_number}</TableCell>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={selectedExam.max_marks}
                              value={student.marks || ''}
                              onChange={(e) => handleMarksChange(student.student_id, e.target.value)}
                              className="w-20"
                              disabled={student.is_absent}
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell>
                            {student.grade && (
                              <Badge className={`${gradeColors.bgColor} ${gradeColors.color}`}>
                                {student.grade}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{student.points || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={student.is_absent}
                              onCheckedChange={(checked) => handleAbsentToggle(student.student_id, !!checked)}
                            />
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

      {!selectedExamId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select an Exam</h3>
            <p className="text-muted-foreground text-center">
              Choose an exam from the dropdown above to start entering marks.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
