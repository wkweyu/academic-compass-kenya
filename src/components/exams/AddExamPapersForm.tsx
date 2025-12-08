import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { examSessionService } from '@/services/examSessionService';
import { ExamSessionClass } from '@/types/exam-management';

interface AddExamPapersFormProps {
  sessionId: number;
  sessionClasses: ExamSessionClass[];
  onSuccess: () => void;
}

export function AddExamPapersForm({ sessionId, sessionClasses, onSuccess }: AddExamPapersFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Record<number, { selected: boolean; paper_name: string; max_marks: number }>>({});

  useEffect(() => {
    if (selectedClassId) loadSubjects(parseInt(selectedClassId));
  }, [selectedClassId]);

  const loadSubjects = async (classId: number) => {
    setIsLoading(true);
    try {
      const { data: schoolId } = await supabase.rpc('get_user_school_id');
      const { data } = await supabase
        .from('class_subjects')
        .select('subject:subjects(id, name, code)')
        .eq('class_id', classId)
        .eq('school_id', schoolId)
        .eq('is_examinable', true)
        .eq('is_active', true);

      const uniqueSubjects = (data || []).map((cs: any) => cs.subject).filter(Boolean);
      setSubjects(uniqueSubjects);
      
      const initial: Record<number, { selected: boolean; paper_name: string; max_marks: number }> = {};
      uniqueSubjects.forEach((s: any) => {
        initial[s.id] = { selected: false, paper_name: s.name, max_marks: 100 };
      });
      setSelectedSubjects(initial);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    const toCreate = Object.entries(selectedSubjects)
      .filter(([, v]) => v.selected)
      .map(([id, v]) => ({ subject_id: parseInt(id), paper_name: v.paper_name, max_marks: v.max_marks }));

    if (toCreate.length === 0) {
      toast({ title: 'Select at least one subject', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await examSessionService.createBulkExamPapers(sessionId, parseInt(selectedClassId), toCreate);
      toast({ title: 'Exam papers created successfully' });
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>Select Class</Label>
        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
          <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
          <SelectContent>
            {sessionClasses.map((sc) => (
              <SelectItem key={sc.class_id} value={sc.class_id.toString()}>{sc.class_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : subjects.length > 0 && (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {subjects.map((subject) => (
            <div key={subject.id} className="flex items-center gap-4 p-3 border rounded-lg">
              <Checkbox
                checked={selectedSubjects[subject.id]?.selected}
                onCheckedChange={(checked) => setSelectedSubjects(prev => ({
                  ...prev,
                  [subject.id]: { ...prev[subject.id], selected: !!checked }
                }))}
              />
              <div className="flex-1">
                <p className="font-medium">{subject.name}</p>
                <p className="text-sm text-muted-foreground">{subject.code}</p>
              </div>
              <Input
                className="w-24"
                type="number"
                value={selectedSubjects[subject.id]?.max_marks || 100}
                onChange={(e) => setSelectedSubjects(prev => ({
                  ...prev,
                  [subject.id]: { ...prev[subject.id], max_marks: parseInt(e.target.value) || 100 }
                }))}
              />
            </div>
          ))}
        </div>
      )}

      <Button onClick={handleSubmit} disabled={isSubmitting || !selectedClassId} className="w-full">
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Add Papers
      </Button>
    </div>
  );
}
