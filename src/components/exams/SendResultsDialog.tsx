import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Loader2, CheckCircle2, XCircle, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ExamSession } from '@/types/exam-management';

interface SendResultsDialogProps {
  session: ExamSession;
  isOpen: boolean;
  onClose: () => void;
}

interface StudentResult {
  student_id: number;
  full_name: string;
  admission_number: string;
  guardian_email: string | null;
  average_percentage: number;
  overall_grade: string;
  class_position: number;
}

interface SendResult {
  studentId: number;
  success: boolean;
  email?: string;
  error?: string;
}

export function SendResultsDialog({ session, isOpen, onClose }: SendResultsDialogProps) {
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);

  // Fetch session classes
  const { data: sessionClasses = [] } = useQuery({
    queryKey: ['session-classes-for-email', session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_session_classes')
        .select(`
          class_id,
          classes:class_id (id, name)
        `)
        .eq('exam_session_id', session.id);
      
      if (error) throw error;
      return data?.map(d => ({
        id: (d.classes as any)?.id,
        name: (d.classes as any)?.name
      })) || [];
    },
    enabled: isOpen,
  });

  // Fetch students with results
  const { data: studentsWithResults = [], isLoading } = useQuery({
    queryKey: ['students-results-for-email', session.id, selectedClass],
    queryFn: async () => {
      let query = supabase
        .from('student_exam_results')
        .select(`
          student_id,
          average_percentage,
          overall_grade,
          class_position,
          students:student_id (
            id,
            full_name,
            admission_number,
            guardian_email,
            current_class_id
          )
        `)
        .eq('exam_session_id', session.id);
      
      if (selectedClass !== 'all') {
        query = query.eq('class_id', parseInt(selectedClass));
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data?.map(r => ({
        student_id: r.student_id,
        full_name: (r.students as any)?.full_name || '',
        admission_number: (r.students as any)?.admission_number || '',
        guardian_email: (r.students as any)?.guardian_email || null,
        average_percentage: r.average_percentage,
        overall_grade: r.overall_grade,
        class_position: r.class_position || 0,
      })) as StudentResult[] || [];
    },
    enabled: isOpen,
  });

  // Fetch school info
  const { data: schoolInfo } = useQuery({
    queryKey: ['school-info-for-email'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_or_create_school_profile');
      return data?.[0];
    },
    enabled: isOpen,
  });

  // Fetch term info
  const { data: termInfo } = useQuery({
    queryKey: ['term-info-for-email', session.term_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_termsetting')
        .select('term, year')
        .eq('id', session.term_id)
        .single();
      
      if (error) throw error;
      return `Term ${data.term}`;
    },
    enabled: isOpen && !!session.term_id,
  });

  const studentsWithEmail = studentsWithResults.filter(s => s.guardian_email);
  const studentsWithoutEmail = studentsWithResults.filter(s => !s.guardian_email);

  const handleStudentToggle = (studentId: number) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleAllWithEmail = () => {
    if (selectedStudents.length === studentsWithEmail.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(studentsWithEmail.map(s => s.student_id));
    }
  };

  const handleSendEmails = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student');
      return;
    }

    setIsSending(true);
    setSendResults(null);

    try {
      const response = await supabase.functions.invoke('send-results-email', {
        body: {
          studentIds: selectedStudents,
          examSessionId: session.id,
          examSessionName: session.name,
          schoolName: schoolInfo?.name || 'School',
          schoolEmail: schoolInfo?.email,
          termInfo: termInfo || 'Term',
          academicYear: session.academic_year,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      setSendResults(data.results);

      if (data.totalSent > 0) {
        toast.success(`Successfully sent ${data.totalSent} email(s)`);
      }
      if (data.totalFailed > 0) {
        toast.warning(`Failed to send ${data.totalFailed} email(s)`);
      }
    } catch (error: any) {
      console.error('Error sending emails:', error);
      toast.error(`Failed to send emails: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      EE: 'bg-emerald-500',
      ME: 'bg-blue-500',
      AE: 'bg-amber-500',
      BE: 'bg-red-500',
    };
    return colors[grade] || 'bg-muted';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Exam Results via Email
          </DialogTitle>
          <DialogDescription>
            Send exam results to parents/guardians via email. Only students with guardian email addresses can receive notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {sessionClasses.map(c => (
                  <SelectItem key={c.id} value={c.id?.toString() || ''}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {studentsWithEmail.length} with email
              </Badge>
              {studentsWithoutEmail.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {studentsWithoutEmail.length} without email
                </Badge>
              )}
            </div>
          </div>

          {/* Student List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : studentsWithEmail.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No students with guardian email addresses found for this exam session.
                Please update student profiles with guardian email addresses to send notifications.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={toggleAllWithEmail}>
                  {selectedStudents.length === studentsWithEmail.length ? 'Deselect All' : 'Select All'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedStudents.length} selected
                </span>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-4 space-y-2">
                  {studentsWithEmail.map(student => {
                    const sendResult = sendResults?.find(r => r.studentId === student.student_id);
                    
                    return (
                      <div
                        key={student.student_id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          selectedStudents.includes(student.student_id)
                            ? 'bg-primary/5 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={selectedStudents.includes(student.student_id)}
                          onCheckedChange={() => handleStudentToggle(student.student_id)}
                          disabled={isSending}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{student.full_name}</span>
                            <Badge variant="secondary" className="text-xs">{student.admission_number}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {student.guardian_email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getGradeColor(student.overall_grade)} text-white`}>
                            {student.overall_grade}
                          </Badge>
                          <span className="text-sm">{student.average_percentage.toFixed(1)}%</span>
                          {sendResult && (
                            sendResult.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Send Results Summary */}
          {sendResults && (
            <Alert className={sendResults.every(r => r.success) ? 'border-green-500' : 'border-amber-500'}>
              <AlertDescription>
                {sendResults.filter(r => r.success).length} email(s) sent successfully.
                {sendResults.filter(r => !r.success).length > 0 && (
                  <> {sendResults.filter(r => !r.success).length} failed.</>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Close
          </Button>
          <Button
            onClick={handleSendEmails}
            disabled={isSending || selectedStudents.length === 0}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send to {selectedStudents.length} Parent(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
