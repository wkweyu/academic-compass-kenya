import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Save, Send } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { examSessionService } from '@/services/examSessionService';
import { ExamPaper, ExamMark, CBC_GRADES, calculateCBCGrade } from '@/types/exam-management';

interface MarksEntrySheetProps {
  paper: ExamPaper;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MarksEntrySheet({ paper, isOpen, onClose, onSuccess }: MarksEntrySheetProps) {
  const { toast } = useToast();
  const [marks, setMarks] = useState<ExamMark[]>([]);

  const { isLoading } = useQuery({
    queryKey: ['paper-students', paper.id],
    queryFn: async () => {
      const data = await examSessionService.getStudentsForPaper(paper.id);
      setMarks(data);
      return data;
    },
    enabled: isOpen,
  });

  const saveMutation = useMutation({
    mutationFn: () => examSessionService.saveMarks(paper.id, marks, paper.max_marks),
    onSuccess: () => {
      toast({ title: 'Marks saved as draft' });
      onSuccess();
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await examSessionService.saveMarks(paper.id, marks, paper.max_marks);
      await examSessionService.submitMarks(paper.id);
    },
    onSuccess: () => {
      toast({ title: 'Marks submitted successfully' });
      onSuccess();
      onClose();
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateMark = (studentId: number, field: keyof ExamMark, value: any) => {
    setMarks(prev => prev.map(m => {
      if (m.student_id !== studentId) return m;
      const updated = { ...m, [field]: value };
      if (field === 'marks' && value !== null) {
        const grade = calculateCBCGrade(value, paper.max_marks);
        updated.grade = grade.grade;
        updated.points = grade.points;
      }
      if (field === 'is_absent' && value) {
        updated.marks = null;
        updated.grade = null;
        updated.points = null;
      }
      return updated;
    }));
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{paper.subject_name} - {paper.paper_name}</SheetTitle>
          <p className="text-sm text-muted-foreground">{paper.class_name} • Max Marks: {paper.max_marks}</p>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="mt-6 space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="w-20">Marks</TableHead>
                  <TableHead className="w-16">Grade</TableHead>
                  <TableHead className="w-16">Absent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marks.map((mark) => {
                  const gradeInfo = mark.grade ? CBC_GRADES[mark.grade as keyof typeof CBC_GRADES] : null;
                  return (
                    <TableRow key={mark.student_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{mark.full_name}</p>
                          <p className="text-sm text-muted-foreground">{mark.admission_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={paper.max_marks}
                          value={mark.marks ?? ''}
                          disabled={mark.is_absent || paper.status === 'locked'}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : Math.min(parseInt(e.target.value), paper.max_marks);
                            updateMark(mark.student_id, 'marks', val);
                          }}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        {gradeInfo && (
                          <Badge className={gradeInfo.bgColor + ' ' + gradeInfo.color}>{mark.grade}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={mark.is_absent}
                          disabled={paper.status === 'locked'}
                          onCheckedChange={(checked) => updateMark(mark.student_id, 'is_absent', !!checked)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || paper.status === 'locked'}>
                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Draft
              </Button>
              <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || paper.status === 'locked'}>
                {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit Marks
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
