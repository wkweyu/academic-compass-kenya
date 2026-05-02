// @ts-nocheck
import { useState, useEffect } from 'react';
import { Search, Save, FileText, Calculator, Users, BookOpen, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { scoreService } from '@/services/scoreService';

interface Student {
  id: string; // Change to string to match service type
  admission_number: string;
  full_name: string;
  current_class: number; // Change to number to match service type
  stream: string;
}

interface Score {
  id?: number;
  student_id: number;
  exam_id: number;
  marks: number;
  marks_obtained: number; // Add missing property
  grade: string;
  remarks?: string;
}

interface Exam {
  id: number;
  name: string;
  subject_name: string;
  subject_code: string;
  class_name?: string; // Make optional to match service type
  stream?: string;
  max_marks: number;
  term?: number;
  academic_year?: number;
}

export const ScoreEntryModule = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<{ [key: number]: Score }>({});
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      loadStudentsAndScores();
    }
  }, [selectedExam]);

  const loadExams = async () => {
    try {
      const examData = await scoreService.getExams();
      setExams(examData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load exams",
        variant: "destructive",
      });
    }
  };

  const loadStudentsAndScores = async () => {
    if (!selectedExam) return;
    
    setLoading(true);
    try {
      const [studentsData, scoresData] = await Promise.all([
        scoreService.getStudentsForExam(selectedExam),
        scoreService.getScores(selectedExam)
      ]);
      
      setStudents(studentsData);
      
      // Convert scores array to object for easier lookup
      const scoresMap = scoresData.reduce((acc, score) => {
        acc[parseInt(score.student_id.toString())] = score; // Handle potential string conversion
        return acc;
      }, {} as { [key: number]: Score });
      
      setScores(scoresMap);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load student data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (studentId: number, marks: string) => {
    const marksNum = marks === '' ? 0 : parseInt(marks);
    const exam = exams.find(e => e.id === selectedExam);
    if (!exam) return;

    // Calculate grade based on CBC grading system
    const grade = calculateGrade(marksNum, exam.max_marks);
    
    setScores(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        exam_id: selectedExam,
        marks: marksNum,
        grade: grade
      }
    }));
  };

  const calculateGrade = (marks: number, maxMarks: number): string => {
    const percentage = (marks / maxMarks) * 100;
    
    if (percentage >= 90) return 'E'; // Exceeds Expectations
    if (percentage >= 80) return 'M'; // Meets Expectations  
    if (percentage >= 70) return 'A'; // Approaches Expectations
    if (percentage >= 60) return 'B'; // Below Expectations
    return 'P'; // Poor
  };

  const handleSaveScores = async () => {
    if (!selectedExam) return;
    
    setSaving(true);
    try {
      const scoresToSave = Object.values(scores).filter(score => score.marks > 0);
      await scoreService.saveScores(scoresToSave);
      
      toast({
        title: "Success",
        description: `Saved ${scoresToSave.length} scores successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save scores",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportScores = async () => {
    if (!selectedExam) return;
    
    try {
      const blob = await scoreService.exportScores(selectedExam);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const exam = exams.find(e => e.id === selectedExam);
      a.download = `scores-${exam?.name.replace(/\s+/g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Scores exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export scores",
        variant: "destructive",
      });
    }
  };

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedExamDetails = exams.find(e => e.id === selectedExam);
  const completedScores = Object.values(scores).filter(score => score.marks > 0).length;
  const completionPercentage = students.length > 0 ? Math.round((completedScores / students.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Score Entry</h1>
          <p className="text-muted-foreground">
            Enter and manage student exam scores
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportScores} disabled={!selectedExam}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={handleSaveScores} disabled={!selectedExam || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

      {/* Exam Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Exam</CardTitle>
          <CardDescription>Choose an exam to enter scores for</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Select
                value={selectedExam.toString()}
                onValueChange={(value) => setSelectedExam(parseInt(value))}
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
            </div>
            
            {selectedExamDetails && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {selectedExamDetails.subject_code}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {selectedExamDetails.class_name} {selectedExamDetails.stream}
                </div>
                <div className="flex items-center gap-1">
                  <Calculator className="h-4 w-4" />
                  Max: {selectedExamDetails.max_marks}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Stats */}
      {selectedExam && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scores Entered</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedScores}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completionPercentage}%</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Max Marks</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedExamDetails?.max_marks || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Score Entry */}
      {selectedExam && selectedExamDetails && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedExamDetails.name} - {selectedExamDetails.subject_name}
            </CardTitle>
            <CardDescription>
              Enter marks for {selectedExamDetails.class_name} {selectedExamDetails.stream} - 
              Term {selectedExamDetails.term}, {selectedExamDetails.academic_year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading students...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const score = scores[student.id];
                    const marks = score?.marks || 0;
                    
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.admission_number}
                        </TableCell>
                        <TableCell>{student.full_name}</TableCell>
                        <TableCell>{student.current_class} {student.stream}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={selectedExamDetails.max_marks}
                            value={marks || ''}
                            onChange={(e) => handleScoreChange(parseInt(student.id), e.target.value)}
                            className="w-20"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          {score?.grade && (
                            <Badge 
                              className={
                                score.grade === 'E' ? 'bg-green-100 text-green-800' :
                                score.grade === 'M' ? 'bg-blue-100 text-blue-800' :
                                score.grade === 'A' ? 'bg-yellow-100 text-yellow-800' :
                                score.grade === 'B' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }
                            >
                              {score.grade}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {marks > 0 ? (
                            <Badge className="bg-green-100 text-green-800">Entered</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedExam && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select an Exam</h3>
            <p className="text-muted-foreground text-center">
              Choose an exam from the dropdown above to start entering scores.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};