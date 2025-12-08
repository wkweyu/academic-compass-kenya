import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { examManagementService, ExamType } from '@/services/examManagementService';
import { cn } from '@/lib/utils';

const examSchema = z.object({
  name: z.string().min(1, 'Exam name is required'),
  subject_id: z.string().min(1, 'Subject is required'),
  class_id: z.string().min(1, 'Class is required'),
  stream_id: z.string().optional(),
  exam_type_id: z.string().min(1, 'Exam type is required'),
  term_id: z.string().min(1, 'Term is required'),
  academic_year: z.number().min(2020).max(2030),
  exam_date: z.date(),
  max_marks: z.number().min(1).max(1000),
  duration_minutes: z.number().min(15).max(300),
  instructions: z.string().optional(),
});

type ExamFormData = z.infer<typeof examSchema>;

interface ExamRegistrationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ExamRegistrationForm({ onSuccess, onCancel }: ExamRegistrationFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      academic_year: new Date().getFullYear(),
      max_marks: 100,
      duration_minutes: 60,
    },
  });

  useEffect(() => {
    loadFormData();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadStreamsAndSubjects(parseInt(selectedClassId));
    }
  }, [selectedClassId]);

  const loadFormData = async () => {
    try {
      setIsLoading(true);
      // Get user's school ID first
      const { data: schoolId, error: schoolError } = await supabase.rpc('get_user_school_id');
      
      if (schoolError || !schoolId) {
        console.error('No school associated with user:', schoolError);
        toast({
          title: 'Configuration Error',
          description: 'No school associated with your account. Please configure your school profile first.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      
      const [classesRes, examTypesRes, termsRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
        examManagementService.getExamTypes(),
        supabase.from('settings_termsetting').select('id, term, year').eq('school_id', schoolId).order('year', { ascending: false }).order('term'),
      ]);

      setClasses(classesRes.data || []);
      setExamTypes(examTypesRes);
      setTerms(termsRes.data || []);
    } catch (error) {
      console.error('Error loading form data:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to load form data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStreamsAndSubjects = async (classId: number) => {
    try {
      // Get user's school ID first
      const { data: schoolId, error: schoolError } = await supabase.rpc('get_user_school_id');
      
      if (schoolError || !schoolId) {
        console.error('No school associated with user:', schoolError);
        return;
      }

      const [streamsRes, subjectsRes] = await Promise.all([
        supabase.from('streams').select('id, name').eq('school_id', schoolId).eq('class_assigned_id', classId).order('name'),
        supabase
          .from('class_subjects')
          .select('subject:subjects(id, name, code)')
          .eq('class_id', classId)
          .eq('school_id', schoolId)
          .eq('is_examinable', true)
          .eq('is_active', true),
      ]);

      setStreams(streamsRes.data || []);
      
      // Extract unique subjects
      const uniqueSubjects = (subjectsRes.data || [])
        .map((cs: any) => cs.subject)
        .filter((s: any) => s !== null);
      setSubjects(uniqueSubjects);
    } catch (error) {
      console.error('Error loading streams/subjects:', error);
    }
  };

  const onSubmit = async (data: ExamFormData) => {
    setIsSubmitting(true);
    try {
      await examManagementService.createExam({
        name: data.name,
        subject_id: parseInt(data.subject_id),
        class_id: parseInt(data.class_id),
        stream_id: data.stream_id ? parseInt(data.stream_id) : undefined,
        exam_type_id: parseInt(data.exam_type_id),
        term_id: parseInt(data.term_id),
        academic_year: data.academic_year,
        exam_date: format(data.exam_date, 'yyyy-MM-dd'),
        max_marks: data.max_marks,
        duration_minutes: data.duration_minutes,
        instructions: data.instructions,
      });

      toast({
        title: 'Exam created successfully',
        description: `${data.name} has been registered`,
      });
      
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error creating exam',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading form data...</span>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Exam Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Mathematics CAT 1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="exam_type_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Exam Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exam type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {examTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="class_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedClassId(value);
                  }} 
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stream_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stream (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="All streams" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">All Streams</SelectItem>
                    {streams.map((stream) => (
                      <SelectItem key={stream.id} value={stream.id.toString()}>
                        {stream.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="subject_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!selectedClassId}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedClassId ? "Select subject" : "Select a class first"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id.toString()}>
                      {subject.name} ({subject.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="term_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Term</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {terms.map((term) => (
                      <SelectItem key={term.id} value={term.id.toString()}>
                        Term {term.term} ({term.year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="academic_year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Academic Year</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="exam_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Exam Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="max_marks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum Marks</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="duration_minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructions (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Special instructions for the exam..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Creating...' : 'Create Exam'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
