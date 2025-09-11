import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Student } from '@/types/cbc';

const studentFormSchema = z.object({
  full_name: z.string().min(3, 'Full name must be at least 3 characters'),
  date_of_birth: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  gender: z.enum(['M', 'F', 'O']),
  guardian_name: z.string().min(3, 'Guardian name is required'),
  guardian_phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  guardian_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  enrollment_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  status: z.enum(['active', 'inactive', 'graduated', 'transferred']),
  current_class: z.string(), // We'll pass IDs as strings from the form
  current_stream: z.string(),
  photo: z.any().optional(),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

interface StudentFormProps {
  initialData?: Student;
  onSubmit: (values: StudentFormValues) => void;
  isSubmitting: boolean;
}

export function StudentForm({ initialData, onSubmit, isSubmitting }: StudentFormProps) {
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      full_name: initialData?.full_name || '',
      date_of_birth: initialData?.date_of_birth ? new Date(initialData.date_of_birth).toISOString().split('T')[0] : '',
      gender: initialData?.gender || 'M',
      guardian_name: initialData?.guardian_name || '',
      guardian_phone: initialData?.guardian_phone || '',
      guardian_email: initialData?.guardian_email || '',
      enrollment_date: initialData?.enrollment_date ? new Date(initialData.enrollment_date).toISOString().split('T')[0] : '',
      status: initialData?.status || 'active',
      current_class: initialData?.current_class?.toString() || '',
      current_stream: initialData?.current_stream?.toString() || '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date_of_birth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="O">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="graduated">Graduated</SelectItem>
                    <SelectItem value="transferred">Transferred</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guardian_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guardian Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Jane Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guardian_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guardian Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+254712345678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guardian_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guardian Email (Optional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="guardian@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="enrollment_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Enrollment Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Add fields for class and stream selection here */}
          {/* These would likely be populated from an API */}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </Form>
  );
}
