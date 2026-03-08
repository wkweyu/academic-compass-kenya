import { useState, useRef } from 'react';
import { escapeHtml } from '@/utils/escapeHtml';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CBC_GRADES } from '@/types/exam-management';
import { FileText, Printer, Calculator, AlertCircle, Users, User, GraduationCap, Award, TrendingUp, CheckCircle2 } from 'lucide-react';
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

interface SubjectResult {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  exams: {
    session_id: number;
    session_name: string;
    marks: number;
    max_marks: number;
    percentage: number;
    grade: string;
  }[];
  combined_percentage: number;
  combined_grade: string;
  combined_points: number;
}

interface CombinedResult {
  student_id: number;
  admission_number: string;
  full_name: string;
  stream_name: string | null;
  stream_id: number | null;
  subjects: SubjectResult[];
  exams: {
    session_id: number;
    session_name: string;
    average_percentage: number;
    overall_grade: string;
  }[];
  combined_average: number;
  combined_grade: string;
  combined_points: number;
  class_position: number;
  stream_position: number | null;
  total_subjects: number;
}

interface SchoolInfo {
  name: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
  logo: string | null;
}

export function TermReportCard({ classId, termId, academicYear }: TermReportCardProps) {
  const [selectedClass, setSelectedClass] = useState<string>(classId?.toString() || '');
  const [selectedStream, setSelectedStream] = useState<string>('all');
  const [selectedTerm, setSelectedTerm] = useState<string>(termId?.toString() || '');
  const [selectedYear, setSelectedYear] = useState<string>(academicYear?.toString() || new Date().getFullYear().toString());
  const [selectedExams, setSelectedExams] = useState<number[]>([]);
  const [combinedResults, setCombinedResults] = useState<CombinedResult[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'individual'>('summary');
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch school info
  const { data: schoolInfo } = useQuery({
    queryKey: ['school-info-term-report'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_or_create_school_profile');
      return data?.[0] as SchoolInfo | undefined;
    },
  });

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

  // Fetch streams for selected class
  const { data: streams = [] } = useQuery({
    queryKey: ['streams-for-class', selectedClass],
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

  // Fetch terms
  const { data: terms = [] } = useQuery({
    queryKey: ['terms-for-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_termsetting')
        .select('id, term, year')
        .order('year', { ascending: false })
        .order('term');
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
        .in('status', ['completed', 'active'])
        .order('start_date');

      if (error) throw error;

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
    setSelectedStudents([]);
  };

  const handleStudentToggle = (studentId: number) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleAllStudents = () => {
    const filteredResults = getFilteredResults();
    if (selectedStudents.length === filteredResults.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredResults.map(r => r.student_id));
    }
  };

  const getFilteredResults = () => {
    if (selectedStream === 'all') return combinedResults;
    return combinedResults.filter(r => r.stream_id?.toString() === selectedStream);
  };

  const calculateCombinedResults = async () => {
    if (selectedExams.length < 2) {
      toast.error('Please select at least 2 exams to combine');
      return;
    }

    setIsCalculating(true);
    try {
      // Get all student results with subject details
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
            current_stream_id,
            streams:current_stream_id (name)
          )
        `)
        .in('exam_session_id', selectedExams)
        .eq('class_id', parseInt(selectedClass));

      if (error) throw error;

      // Get subject-level marks for each student
      const { data: marksData, error: marksError } = await supabase
        .from('exam_marks')
        .select(`
          student_id,
          marks,
          grade,
          points,
          exam_papers:exam_paper_id (
            id,
            exam_session_id,
            max_marks,
            subjects:subject_id (id, name, code)
          )
        `)
        .in('exam_paper_id', 
          await supabase
            .from('exam_papers')
            .select('id')
            .in('exam_session_id', selectedExams)
            .eq('class_id', parseInt(selectedClass))
            .then(r => r.data?.map(p => p.id) || [])
        );

      if (marksError) throw marksError;

      // Build subject results per student
      const studentSubjectsMap = new Map<number, Map<number, SubjectResult>>();
      
      for (const mark of marksData || []) {
        const paper = mark.exam_papers as any;
        if (!paper || !paper.subjects) continue;
        
        const studentId = mark.student_id;
        const subjectId = paper.subjects.id;
        const sessionId = paper.exam_session_id;
        const sessionInfo = examSessions.find(s => s.id === sessionId);
        
        if (!studentSubjectsMap.has(studentId)) {
          studentSubjectsMap.set(studentId, new Map());
        }
        
        const subjectsMap = studentSubjectsMap.get(studentId)!;
        
        if (!subjectsMap.has(subjectId)) {
          subjectsMap.set(subjectId, {
            subject_id: subjectId,
            subject_name: paper.subjects.name,
            subject_code: paper.subjects.code || '',
            exams: [],
            combined_percentage: 0,
            combined_grade: '',
            combined_points: 0,
          });
        }
        
        const subjectResult = subjectsMap.get(subjectId)!;
        const percentage = paper.max_marks > 0 ? (mark.marks / paper.max_marks) * 100 : 0;
        
        subjectResult.exams.push({
          session_id: sessionId,
          session_name: sessionInfo?.name || '',
          marks: mark.marks || 0,
          max_marks: paper.max_marks,
          percentage,
          grade: mark.grade || 'BE',
        });
      }

      // Calculate combined subject results
      studentSubjectsMap.forEach((subjectsMap) => {
        subjectsMap.forEach((subject) => {
          if (subject.exams.length > 0) {
            const avgPercentage = subject.exams.reduce((sum, e) => sum + e.percentage, 0) / subject.exams.length;
            let grade = 'BE', points = 1;
            if (avgPercentage >= 75) { grade = 'EE'; points = 4; }
            else if (avgPercentage >= 50) { grade = 'ME'; points = 3; }
            else if (avgPercentage >= 25) { grade = 'AE'; points = 2; }
            
            subject.combined_percentage = avgPercentage;
            subject.combined_grade = grade;
            subject.combined_points = points;
          }
        });
      });

      // Group by student and calculate combined average
      const studentMap = new Map<number, CombinedResult>();

      for (const result of results || []) {
        const student = result.students as any;
        if (!student) continue;

        const sessionInfo = examSessions.find(s => s.id === result.exam_session_id);

        if (!studentMap.has(result.student_id)) {
          const subjectsMap = studentSubjectsMap.get(result.student_id);
          studentMap.set(result.student_id, {
            student_id: result.student_id,
            admission_number: student.admission_number,
            full_name: student.full_name,
            stream_name: student.streams?.name || null,
            stream_id: student.current_stream_id,
            subjects: subjectsMap ? Array.from(subjectsMap.values()) : [],
            exams: [],
            combined_average: 0,
            combined_grade: '',
            combined_points: 0,
            class_position: 0,
            stream_position: null,
            total_subjects: 0,
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

      // Calculate combined averages and positions
      const combined: CombinedResult[] = [];
      studentMap.forEach(student => {
        if (student.exams.length === selectedExams.length) {
          const avgPercentage = student.exams.reduce((sum, e) => sum + e.average_percentage, 0) / student.exams.length;
          
          let grade = 'BE', points = 1;
          if (avgPercentage >= 75) { grade = 'EE'; points = 4; }
          else if (avgPercentage >= 50) { grade = 'ME'; points = 3; }
          else if (avgPercentage >= 25) { grade = 'AE'; points = 2; }

          student.combined_average = avgPercentage;
          student.combined_grade = grade;
          student.combined_points = points;
          student.total_subjects = student.subjects.length;
          combined.push(student);
        }
      });

      // Sort and assign positions
      combined.sort((a, b) => b.combined_average - a.combined_average);
      combined.forEach((student, index) => {
        student.class_position = index + 1;
      });

      // Calculate stream positions
      const streamGroups = new Map<number, CombinedResult[]>();
      combined.forEach(student => {
        if (student.stream_id) {
          if (!streamGroups.has(student.stream_id)) {
            streamGroups.set(student.stream_id, []);
          }
          streamGroups.get(student.stream_id)!.push(student);
        }
      });

      streamGroups.forEach(streamStudents => {
        streamStudents.sort((a, b) => b.combined_average - a.combined_average);
        streamStudents.forEach((student, index) => {
          student.stream_position = index + 1;
        });
      });

      setCombinedResults(combined);
      setSelectedStudents(combined.map(r => r.student_id));
      toast.success('Combined results calculated successfully');
    } catch (error) {
      console.error('Error calculating combined results:', error);
      toast.error('Failed to calculate combined results');
    } finally {
      setIsCalculating(false);
    }
  };

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      EE: 'bg-emerald-500 text-white',
      ME: 'bg-blue-500 text-white',
      AE: 'bg-amber-500 text-white',
      BE: 'bg-red-500 text-white',
    };
    return colors[grade] || 'bg-muted text-muted-foreground';
  };

  const printReportCards = () => {
    const studentsToPrint = combinedResults.filter(r => selectedStudents.includes(r.student_id));
    if (studentsToPrint.length === 0) {
      toast.error('Please select at least one student');
      return;
    }

    const selectedClassName = classes.find(c => c.id.toString() === selectedClass)?.name || '';
    const selectedTermInfo = terms.find(t => t.id.toString() === selectedTerm);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportCardsHTML = studentsToPrint.map((student, idx) => `
      <div class="report-card ${idx > 0 ? 'page-break' : ''}">
        <div class="header">
          <div class="school-logo">
            ${schoolInfo?.logo ? `<img src="${schoolInfo.logo}" alt="School Logo" />` : '<div class="logo-placeholder">🎓</div>'}
          </div>
          <div class="school-info">
            <h1>${escapeHtml(schoolInfo?.name || 'School Name')}</h1>
            <p class="motto">${escapeHtml(schoolInfo?.motto || '')}</p>
            <p>${escapeHtml(schoolInfo?.address || '')}</p>
            <p>${escapeHtml(schoolInfo?.phone || '')} | ${escapeHtml(schoolInfo?.email || '')}</p>
          </div>
        </div>
        
        <div class="title-bar">
          <h2>COMBINED TERM REPORT CARD</h2>
          <p>Term ${escapeHtml(selectedTermInfo?.term || '')} - ${escapeHtml(selectedYear)}</p>
        </div>

        <div class="student-info">
          <div class="info-row">
            <div class="info-item"><span class="label">Name:</span> <span class="value">${escapeHtml(student.full_name)}</span></div>
            <div class="info-item"><span class="label">Adm No:</span> <span class="value">${escapeHtml(student.admission_number)}</span></div>
          </div>
          <div class="info-row">
            <div class="info-item"><span class="label">Class:</span> <span class="value">${escapeHtml(selectedClassName)}</span></div>
            <div class="info-item"><span class="label">Stream:</span> <span class="value">${escapeHtml(student.stream_name || '-')}</span></div>
          </div>
        </div>

        <div class="exams-combined">
          <h3>Exams Combined</h3>
          <div class="exam-list">
            ${student.exams.map(e => `
              <div class="exam-item">
                <span class="exam-name">${escapeHtml(e.session_name)}</span>
                <span class="exam-score">${e.average_percentage.toFixed(1)}% (${e.overall_grade})</span>
              </div>
            `).join('')}
          </div>
        </div>

        <table class="subjects-table">
          <thead>
            <tr>
              <th>Subject</th>
              ${student.exams.map(e => `<th>${escapeHtml(e.session_name)}</th>`).join('')}
              <th>Average</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            ${student.subjects.map(subject => `
              <tr>
                <td>${escapeHtml(subject.subject_name)}</td>
                ${student.exams.map(exam => {
                  const subjectExam = subject.exams.find(se => se.session_id === exam.session_id);
                  return `<td class="center">${subjectExam ? `${subjectExam.percentage.toFixed(0)}%` : '-'}</td>`;
                }).join('')}
                <td class="center bold">${subject.combined_percentage.toFixed(1)}%</td>
                <td class="center"><span class="grade-badge grade-${subject.combined_grade}">${subject.combined_grade}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary-section">
          <div class="summary-box">
            <div class="summary-item">
              <span class="label">Combined Average</span>
              <span class="value large">${student.combined_average.toFixed(1)}%</span>
            </div>
            <div class="summary-item">
              <span class="label">Overall Grade</span>
              <span class="value grade-badge grade-${student.combined_grade}">${student.combined_grade}</span>
            </div>
            <div class="summary-item">
              <span class="label">Class Position</span>
              <span class="value">${student.class_position} / ${combinedResults.length}</span>
            </div>
            ${student.stream_position ? `
              <div class="summary-item">
                <span class="label">Stream Position</span>
                <span class="value">${student.stream_position}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="grading-key">
          <h4>Grading Key</h4>
          <div class="grades-list">
            <span><span class="grade-badge grade-EE">EE</span> Exceeding Expectations (75-100%)</span>
            <span><span class="grade-badge grade-ME">ME</span> Meeting Expectations (50-74%)</span>
            <span><span class="grade-badge grade-AE">AE</span> Approaching Expectations (25-49%)</span>
            <span><span class="grade-badge grade-BE">BE</span> Below Expectations (0-24%)</span>
          </div>
        </div>

        <div class="comments-section">
          <div class="comment-box">
            <p class="comment-label">Class Teacher's Comment:</p>
            <div class="comment-line"></div>
            <div class="signature-line">
              <span>Signature: _______________</span>
              <span>Date: _______________</span>
            </div>
          </div>
          <div class="comment-box">
            <p class="comment-label">Head Teacher's Comment:</p>
            <div class="comment-line"></div>
            <div class="signature-line">
              <span>Signature: _______________</span>
              <span>Date: _______________</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Term Report Cards - ${selectedClassName}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; line-height: 1.4; color: #1a1a1a; }
            .page-break { page-break-before: always; }
            .report-card { max-width: 800px; margin: 0 auto; padding: 20px; }
            
            .header { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 15px; }
            .school-logo img, .logo-placeholder { width: 80px; height: 80px; object-fit: contain; }
            .logo-placeholder { display: flex; align-items: center; justify-content: center; font-size: 40px; background: #f0f9ff; border-radius: 50%; }
            .school-info { flex: 1; }
            .school-info h1 { font-size: 22px; color: #1e40af; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; }
            .school-info .motto { font-style: italic; color: #4b5563; margin-bottom: 3px; }
            .school-info p { font-size: 10px; color: #6b7280; }
            
            .title-bar { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 12px 20px; text-align: center; margin-bottom: 15px; border-radius: 6px; }
            .title-bar h2 { font-size: 16px; letter-spacing: 2px; margin-bottom: 3px; }
            .title-bar p { font-size: 12px; opacity: 0.9; }
            
            .student-info { background: #f8fafc; padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #3b82f6; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .info-row:last-child { margin-bottom: 0; }
            .info-item { display: flex; gap: 8px; }
            .info-item .label { color: #6b7280; font-weight: 500; }
            .info-item .value { font-weight: 600; color: #1e40af; }
            
            .exams-combined { margin-bottom: 15px; }
            .exams-combined h3 { font-size: 12px; color: #4b5563; margin-bottom: 8px; }
            .exam-list { display: flex; gap: 15px; flex-wrap: wrap; }
            .exam-item { background: #eff6ff; padding: 8px 12px; border-radius: 4px; display: flex; flex-direction: column; }
            .exam-name { font-weight: 600; color: #1e40af; font-size: 10px; }
            .exam-score { font-size: 12px; font-weight: 700; }
            
            .subjects-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .subjects-table th { background: #1e40af; color: white; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
            .subjects-table td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
            .subjects-table tr:nth-child(even) { background: #f9fafb; }
            .subjects-table .center { text-align: center; }
            .subjects-table .bold { font-weight: 700; }
            
            .grade-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; }
            .grade-EE { background: #10b981; color: white; }
            .grade-ME { background: #3b82f6; color: white; }
            .grade-AE { background: #f59e0b; color: white; }
            .grade-BE { background: #ef4444; color: white; }
            
            .summary-section { margin-bottom: 15px; }
            .summary-box { display: flex; justify-content: space-around; background: linear-gradient(135deg, #eff6ff, #dbeafe); padding: 20px; border-radius: 8px; border: 1px solid #bfdbfe; }
            .summary-item { text-align: center; }
            .summary-item .label { display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
            .summary-item .value { font-size: 18px; font-weight: 700; color: #1e40af; }
            .summary-item .value.large { font-size: 24px; }
            
            .grading-key { background: #f9fafb; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
            .grading-key h4 { font-size: 10px; color: #4b5563; margin-bottom: 8px; text-transform: uppercase; }
            .grades-list { display: flex; flex-wrap: wrap; gap: 15px; font-size: 9px; }
            .grades-list span { display: flex; align-items: center; gap: 5px; }
            
            .comments-section { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
            .comment-box { border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px; }
            .comment-label { font-weight: 600; margin-bottom: 8px; color: #4b5563; }
            .comment-line { border-bottom: 1px solid #d1d5db; height: 40px; margin-bottom: 10px; }
            .signature-line { display: flex; justify-content: space-between; font-size: 10px; color: #6b7280; }
            
            .footer { text-align: center; color: #9ca3af; font-size: 9px; padding-top: 10px; border-top: 1px solid #e5e7eb; }
            
            @media print {
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .report-card { padding: 15px; }
            }
          </style>
        </head>
        <body>${reportCardsHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const filteredResults = getFilteredResults();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Term Report Card Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Class</label>
              <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedStream('all'); setSelectedExams([]); setCombinedResults([]); }}>
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
              <label className="text-sm font-medium mb-1 block">Stream</label>
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
            <div>
              <label className="text-sm font-medium mb-1 block">Term</label>
              <Select value={selectedTerm} onValueChange={v => { setSelectedTerm(v); setSelectedExams([]); setCombinedResults([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      Term {t.term} - {t.year}
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
              <label className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Select Exams to Combine (2-3)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {examSessions.map(session => (
                  <div
                    key={session.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedExams.includes(session.id) 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                        : 'hover:bg-muted/50 hover:border-muted-foreground/30'
                    }`}
                    onClick={() => handleExamToggle(session.id)}
                  >
                    <Checkbox
                      checked={selectedExams.includes(session.id)}
                      onCheckedChange={() => handleExamToggle(session.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{session.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.start_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {session.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {examSessions.length === 0 && selectedClass && selectedTerm && (
            <div className="flex items-center gap-2 text-muted-foreground py-4 bg-muted/30 rounded-lg px-4">
              <AlertCircle className="h-4 w-4" />
              <span>No completed exams found for this class and term</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={calculateCombinedResults}
              disabled={selectedExams.length < 2 || isCalculating}
            >
              <Calculator className="h-4 w-4 mr-2" />
              {isCalculating ? 'Calculating...' : 'Calculate Combined Results'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {combinedResults.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Combined Term Results
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {filteredResults.length} students
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {selectedStudents.length} selected
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'summary' | 'individual')}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <TabsList>
                  <TabsTrigger value="summary" className="gap-1">
                    <Users className="h-4 w-4" />
                    Summary
                  </TabsTrigger>
                  <TabsTrigger value="individual" className="gap-1">
                    <User className="h-4 w-4" />
                    Individual
                  </TabsTrigger>
                </TabsList>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={toggleAllStudents}>
                    {selectedStudents.length === filteredResults.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button onClick={printReportCards} disabled={selectedStudents.length === 0}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print Selected ({selectedStudents.length})
                  </Button>
                </div>
              </div>

              <TabsContent value="summary" className="mt-4">
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedStudents.length === filteredResults.length && filteredResults.length > 0}
                            onCheckedChange={toggleAllStudents}
                          />
                        </TableHead>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Adm No.</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Stream</TableHead>
                        {selectedExams.map(examId => {
                          const session = examSessions.find(s => s.id === examId);
                          return (
                            <TableHead key={examId} className="text-center whitespace-nowrap">
                              {session?.name || 'Exam'}
                            </TableHead>
                          );
                        })}
                        <TableHead className="text-center">Average</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead className="text-center">Pos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((result, index) => (
                        <TableRow key={result.student_id} className={selectedStudents.includes(result.student_id) ? 'bg-primary/5' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedStudents.includes(result.student_id)}
                              onCheckedChange={() => handleStudentToggle(result.student_id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-mono text-sm">{result.admission_number}</TableCell>
                          <TableCell className="font-medium">{result.full_name}</TableCell>
                          <TableCell>{result.stream_name || '-'}</TableCell>
                          {selectedExams.map(examId => {
                            const exam = result.exams.find(e => e.session_id === examId);
                            return (
                              <TableCell key={examId} className="text-center">
                                {exam ? (
                                  <span className="font-medium">{exam.average_percentage.toFixed(1)}%</span>
                                ) : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                            <span className="font-bold text-primary">{result.combined_average.toFixed(1)}%</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={getGradeColor(result.combined_grade)}>
                              {result.combined_grade}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {result.class_position <= 3 && <Award className="h-4 w-4 text-amber-500" />}
                              <span className="font-semibold">{result.class_position}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="individual" className="mt-4">
                {filteredResults.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Select 
                        value={currentStudentIndex.toString()} 
                        onValueChange={(v) => setCurrentStudentIndex(parseInt(v))}
                      >
                        <SelectTrigger className="w-[300px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredResults.map((r, idx) => (
                            <SelectItem key={r.student_id} value={idx.toString()}>
                              {r.admission_number} - {r.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setCurrentStudentIndex(Math.max(0, currentStudentIndex - 1))}
                          disabled={currentStudentIndex === 0}
                        >
                          Previous
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setCurrentStudentIndex(Math.min(filteredResults.length - 1, currentStudentIndex + 1))}
                          disabled={currentStudentIndex === filteredResults.length - 1}
                        >
                          Next
                        </Button>
                      </div>
                    </div>

                    {filteredResults[currentStudentIndex] && (
                      <div className="border rounded-lg p-6 bg-gradient-to-br from-background to-muted/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div className="space-y-2">
                            <h3 className="text-xl font-bold">{filteredResults[currentStudentIndex].full_name}</h3>
                            <p className="text-muted-foreground">{filteredResults[currentStudentIndex].admission_number}</p>
                            <p className="text-sm">
                              {classes.find(c => c.id.toString() === selectedClass)?.name} 
                              {filteredResults[currentStudentIndex].stream_name && ` - ${filteredResults[currentStudentIndex].stream_name}`}
                            </p>
                          </div>
                          <div className="flex gap-4 justify-end">
                            <div className="text-center p-4 bg-primary/10 rounded-lg">
                              <p className="text-3xl font-bold text-primary">{filteredResults[currentStudentIndex].combined_average.toFixed(1)}%</p>
                              <p className="text-sm text-muted-foreground">Combined Average</p>
                            </div>
                            <div className="text-center p-4 bg-primary/10 rounded-lg">
                              <Badge className={`${getGradeColor(filteredResults[currentStudentIndex].combined_grade)} text-lg px-4 py-2`}>
                                {filteredResults[currentStudentIndex].combined_grade}
                              </Badge>
                              <p className="text-sm text-muted-foreground mt-2">Grade</p>
                            </div>
                            <div className="text-center p-4 bg-primary/10 rounded-lg">
                              <p className="text-3xl font-bold text-primary flex items-center gap-1">
                                {filteredResults[currentStudentIndex].class_position <= 3 && <Award className="h-6 w-6 text-amber-500" />}
                                {filteredResults[currentStudentIndex].class_position}
                              </p>
                              <p className="text-sm text-muted-foreground">Position</p>
                            </div>
                          </div>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Subject</TableHead>
                              {filteredResults[currentStudentIndex].exams.map(e => (
                                <TableHead key={e.session_id} className="text-center">{e.session_name}</TableHead>
                              ))}
                              <TableHead className="text-center">Average</TableHead>
                              <TableHead className="text-center">Grade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredResults[currentStudentIndex].subjects.map(subject => (
                              <TableRow key={subject.subject_id}>
                                <TableCell className="font-medium">{subject.subject_name}</TableCell>
                                {filteredResults[currentStudentIndex].exams.map(exam => {
                                  const subjectExam = subject.exams.find(se => se.session_id === exam.session_id);
                                  return (
                                    <TableCell key={exam.session_id} className="text-center">
                                      {subjectExam ? `${subjectExam.percentage.toFixed(0)}%` : '-'}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center font-bold">{subject.combined_percentage.toFixed(1)}%</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={getGradeColor(subject.combined_grade)}>{subject.combined_grade}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
