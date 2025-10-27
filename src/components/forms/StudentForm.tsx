import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Student } from '@/types/student';
import { Class, Stream } from '@/types/class';
import { useQuery } from '@tanstack/react-query';
import { classService } from '@/services/classService';
import { settingsService } from '@/services/settingsService';
import { TermManager } from '@/utils/termManager';
import { getSiblings, findPotentialSiblings, findExistingGuardian } from '@/services/guardianService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AdmissionFormPrint from '@/components/AdmissionFormPrint';
import { useState, useEffect } from 'react';
import { Printer, Users, CheckCircle, X } from 'lucide-react';
import { Guardian } from '@/types/guardian';
import { toast } from 'sonner';

const studentFormSchema = z.object({
  full_name: z.string().min(3, 'Full name must be at least 3 characters'),
  date_of_birth: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  gender: z.enum(['M', 'F']),
  upi_number: z.string().optional(),
  guardian_name: z.string().min(3, 'Guardian name is required'),
  guardian_phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  guardian_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  guardian_relationship: z.string().min(2, 'Guardian relationship is required'),
  level: z.string().min(1, 'Level is required'),
  academic_year: z.coerce.number().min(2020, 'Academic year must be valid'),
  enrollment_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  status: z.enum(['active', 'inactive', 'graduated', 'transferred', 'suspended']),
  current_class: z.union([z.string(), z.number()]).nullable(),
  current_stream: z.union([z.string(), z.number()]).nullable(),
  current_class_name: z.string().min(1, 'Class name is required'),
  current_stream_name: z.string().optional().or(z.literal('')), // Make stream optional
  current_class_stream: z.string().optional(),
  admission_year: z.coerce.number().min(2020, 'Admission year must be valid'),
  term: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  is_on_transport: z.boolean().default(false),
  transport_route: z.string().optional(),
  transport_type: z.string().optional(),
  is_active: z.boolean().default(true),
  photo: z.any().optional(),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

interface StudentFormProps {
  initialData?: Student;
  onSubmit: (values: Omit<Student, 'id' | 'admission_number' | 'created_at' | 'updated_at'>) => void;
  onSuccess?: () => void; // Callback for successful save
  isSubmitting: boolean;
}

export function StudentForm({ initialData, onSubmit, onSuccess, isSubmitting }: StudentFormProps) {
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [submittedStudent, setSubmittedStudent] = useState<Omit<Student, 'id' | 'admission_number' | 'created_at' | 'updated_at'> | null>(null);
  const [potentialGuardians, setPotentialGuardians] = useState<Guardian[]>([]);
  const [showSiblingConfirmation, setShowSiblingConfirmation] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);
  const [isCheckingForSiblings, setIsCheckingForSiblings] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classService.getClasses(),
  });

  const { data: streams = [] } = useQuery({
    queryKey: ['streams'],
    queryFn: () => classService.getStreams(),
  });

  // Fetch term settings to auto-populate current term
  const { data: termSettings = [] } = useQuery({
    queryKey: ['termSettings'],
    queryFn: () => settingsService.getTermSettings(),
  });

  // Get current term from settings based on current date
  const getCurrentTermFromSettings = (): 1 | 2 | 3 => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Find active term for current year
    const activeTerm = termSettings.find(term => {
      if (term.year !== currentYear) return false;
      const startDate = new Date(term.start_date);
      const endDate = new Date(term.end_date);
      return now >= startDate && now <= endDate;
    });
    
    if (activeTerm) {
      return activeTerm.term;
    }
    
    // Fallback to TermManager if no settings found
    return TermManager.getCurrentTerm() as 1 | 2 | 3;
  };

  // Detect potential siblings when guardian info changes
  const checkForPotentialSiblings = async (name: string, phone: string) => {
    // Validate inputs before making the call
    if (!name || name.trim().length < 3 || !phone || phone.trim().length < 10) {
      setIsCheckingForSiblings(false);
      setPotentialGuardians([]);
      return;
    }

    setIsCheckingForSiblings(true);
    
    try {
      console.log('Checking for potential siblings...');
      const matches = await findPotentialSiblings(name, phone);
      
      if (matches.length > 0) {
        console.log('Found potential sibling matches:', matches);
        setPotentialGuardians(matches);
        setShowSiblingConfirmation(true);
      } else {
        console.log('No sibling matches found');
        setPotentialGuardians([]);
        setSelectedGuardian(null);
      }
    } catch (error) {
      console.error('Error checking for siblings:', error);
      toast.error('Failed to check for existing guardians. Please try again.');
    } finally {
      setIsCheckingForSiblings(false);
    }
  };

  const handleGuardianInfoChange = () => {
    const guardianName = form.getValues('guardian_name');
    const guardianPhone = form.getValues('guardian_phone');
    
    if (guardianName && guardianPhone) {
      // Add a small delay to avoid rapid-fire queries
      setTimeout(() => {
        checkForPotentialSiblings(guardianName, guardianPhone);
      }, 500);
    }
  };

  const confirmGuardianSelection = (guardian: Guardian) => {
    setSelectedGuardian(guardian);
    
    // Auto-populate guardian information
    form.setValue('guardian_name', guardian.name);
    form.setValue('guardian_phone', guardian.phone);
    form.setValue('guardian_email', guardian.email || '');
    
    setShowSiblingConfirmation(false);
    setPotentialGuardians([]);
    
    toast.success(`Guardian information loaded! This student will be linked as a sibling to ${guardian.students.length} other student(s).`);
  };

  const rejectGuardianMatch = () => {
    setShowSiblingConfirmation(false);
    setPotentialGuardians([]);
    setSelectedGuardian(null);
  };

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      full_name: initialData?.full_name || '',
      date_of_birth: initialData?.date_of_birth ? new Date(initialData.date_of_birth).toISOString().split('T')[0] : '',
      gender: initialData?.gender || 'M',
      upi_number: initialData?.upi_number || '',
      guardian_name: initialData?.guardian_name || '',
      guardian_phone: initialData?.guardian_phone || '',
      guardian_email: initialData?.guardian_email || '',
      guardian_relationship: initialData?.guardian_relationship || 'Parent',
      level: initialData?.level || 'Primary',
      academic_year: initialData?.academic_year || new Date().getFullYear(),
      enrollment_date: initialData?.enrollment_date ? new Date(initialData.enrollment_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: initialData?.status || 'active',
      current_class: initialData?.current_class || null,
      current_stream: initialData?.current_stream || null,
      current_class_name: initialData?.current_class_name || '',
      current_stream_name: initialData?.current_stream_name || '',
      current_class_stream: initialData?.current_class_stream || 'Grade 1 East',
      admission_year: initialData?.admission_year || new Date().getFullYear(),
      term: (initialData?.term || getCurrentTermFromSettings()) as 1 | 2 | 3,
      is_on_transport: initialData?.is_on_transport || false,
      transport_route: initialData?.transport_route?.toString() || '',
      transport_type: initialData?.transport_type || undefined,
      is_active: initialData?.is_active !== undefined ? initialData.is_active : true,
    },
  });

  // Get selected class ID for filtering streams (must be after form declaration)
  const selectedClassId = form.watch('current_class');
  
  console.log('Selected class ID:', selectedClassId);
  console.log('All streams:', streams);
  
  // Filter streams based on selected class
  const filteredStreams = streams.filter((stream: Stream) => {
    if (!selectedClassId) return false; // Don't show any streams if no class selected
    const match = stream.class_assigned === selectedClassId;
    console.log(`Stream ${stream.name}: class_assigned=${stream.class_assigned}, match=${match}`);
    return match;
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(
        async (data) => {
          console.log('Form submitted with data:', data);
          
          // Transform form data to required Student format
          const studentData = {
           full_name: data.full_name!,
           date_of_birth: data.date_of_birth!,
           gender: data.gender!,
           upi_number: data.upi_number,
           guardian_name: data.guardian_name!,
           guardian_phone: data.guardian_phone!,
           guardian_email: data.guardian_email || undefined,
           guardian_relationship: data.guardian_relationship!,
           level: data.level!,
           academic_year: data.academic_year!,
           enrollment_date: data.enrollment_date!,
           status: data.status!,
           current_class: data.current_class || null,
           current_stream: data.current_stream || null,
           current_class_name: data.current_class_name!,
           current_stream_name: data.current_stream_name!,
           current_class_stream: `${data.current_class_name} ${data.current_stream_name}`,
           admission_year: data.admission_year!,
           term: data.term!,
           is_on_transport: data.is_on_transport!,
           transport_route: data.transport_route ? parseInt(data.transport_route) : undefined,
           transport_type: data.transport_type,
           is_active: data.is_active!,
           stream: data.current_stream_name || 'Main', // Add required stream property
           photo: data.photo || null,
           photo_url: null,
           phone: undefined,
           email: undefined,
           address: undefined,
           medical_conditions: undefined,
           emergency_contact: undefined,
           emergency_phone: undefined,
           previous_school: undefined,
           first_name: data.full_name.split(' ')[0],
           last_name: data.full_name.split(' ').slice(1).join(' ') || data.full_name.split(' ')[0],
         } as Omit<Student, 'id' | 'admission_number' | 'created_at' | 'updated_at'>;
        
          console.log('Transformed student data:', studentData);
          setSubmittedStudent(studentData);
          
          try {
            await onSubmit(studentData);
            console.log('Student created successfully');
          } catch (error) {
            console.error('Error submitting form:', error);
            toast.error('Failed to save student. Please check the console for errors.');
          }
        },
        (errors) => {
          // Log validation errors
          console.error('Form validation errors:', errors);
          const errorMessages = Object.entries(errors)
            .map(([field, error]) => `${field}: ${error.message}`)
            .join(', ');
          toast.error(`Please fix the following errors: ${errorMessages}`);
        }
      )} className="space-y-6">
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
                     <SelectItem value="suspended">Suspended</SelectItem>
                   </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="upi_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UPI Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Government issued UPI number" {...field} />
                </FormControl>
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
                    <Input 
                      placeholder="e.g., Jane Doe" 
                      {...field} 
                      onChange={(e) => {
                        field.onChange(e);
                        handleGuardianInfoChange();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  {isCheckingForSiblings && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                      Checking for existing guardian...
                    </div>
                  )}
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
                    <Input 
                      placeholder="+254712345678" 
                      {...field} 
                      onChange={(e) => {
                        field.onChange(e);
                        handleGuardianInfoChange();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  {selectedGuardian && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <p className="text-sm text-green-700 font-medium">
                          Guardian linked! This student will be a sibling to {selectedGuardian.students.length} other student(s).
                        </p>
                      </div>
                    </div>
                  )}
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
          <FormField
            control={form.control}
            name="guardian_relationship"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guardian Relationship</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Parent">Parent</SelectItem>
                    <SelectItem value="Father">Father</SelectItem>
                    <SelectItem value="Mother">Mother</SelectItem>
                    <SelectItem value="Guardian">Guardian</SelectItem>
                    <SelectItem value="Grandparent">Grandparent</SelectItem>
                    <SelectItem value="Uncle">Uncle</SelectItem>
                    <SelectItem value="Aunt">Aunt</SelectItem>
                    <SelectItem value="Sibling">Sibling</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Level</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Primary">Primary</SelectItem>
                    <SelectItem value="Secondary">Secondary</SelectItem>
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
                  <Input type="number" placeholder="2024" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="current_class_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class Name</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    const selectedClass = classes.find((c: Class) => c.id === value);
                    if (selectedClass) {
                      field.onChange(selectedClass.name);
                      form.setValue('current_class', selectedClass.id);
                      // Reset stream when class changes
                      form.setValue('current_stream', null);
                      form.setValue('current_stream_name', '');
                    }
                  }} 
                  value={classes.find((c: Class) => c.name === field.value)?.id || ''}
                >
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {classes.map((classItem: Class) => (
                      <SelectItem key={classItem.id} value={classItem.id}>
                        {classItem.name}
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
            name="current_stream_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stream Name</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    const selectedStream = filteredStreams.find((s: Stream) => s.id === value);
                    if (selectedStream) {
                      field.onChange(selectedStream.name);
                      form.setValue('current_stream', selectedStream.id);
                    }
                  }} 
                  value={filteredStreams.find((s: Stream) => s.name === field.value)?.id || ''}
                  disabled={!selectedClassId}
                >
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder={!selectedClassId ? "Select class first" : "Select stream"} /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredStreams.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-muted-foreground">No streams available for this class</div>
                    ) : (
                      filteredStreams.map((stream: Stream) => (
                        <SelectItem key={stream.id} value={stream.id}>
                          {stream.name} (Capacity: {stream.capacity})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="admission_year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Admission Year</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="2024" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Transport Information */}
          <FormField
            control={form.control}
            name="is_on_transport"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    School Transport
                  </FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Does this student use school transport?
                  </div>
                </div>
                <FormControl>
                  <Input 
                    type="checkbox" 
                    checked={field.value} 
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          
          {form.watch('is_on_transport') && (
            <>
              <FormField
                control={form.control}
                name="transport_route"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transport Route Number</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 1, 2, 3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="transport_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transport Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select transport type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="one_way">One Way</SelectItem>
                        <SelectItem value="two_way">Two Way</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
          {/* Term is auto-populated from Term Settings - no manual input needed */}
        </div>
        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={async () => {
              console.log('Preview button clicked');
              
              // Trigger validation first
              const isValid = await form.trigger();
              console.log('Form validation result:', isValid);
              console.log('Form errors:', form.formState.errors);
              
              if (isValid) {
                const formData = form.getValues();
                const studentData = {
                  full_name: formData.full_name!,
                  date_of_birth: formData.date_of_birth!,
                  gender: formData.gender!,
                  guardian_name: formData.guardian_name!,
                  guardian_phone: formData.guardian_phone!,
                  guardian_email: formData.guardian_email || undefined,
                  guardian_relationship: formData.guardian_relationship!,
                  level: formData.level!,
                  academic_year: formData.academic_year!,
                  enrollment_date: formData.enrollment_date!,
                  status: formData.status!,
                  current_class: formData.current_class || null,
                  current_stream: formData.current_stream || null,
                  current_class_name: formData.current_class_name!,
                  current_stream_name: formData.current_stream_name!,
                  current_class_stream: `${formData.current_class_name} ${formData.current_stream_name}`,
                  admission_year: formData.admission_year!,
                  term: formData.term!,
                  is_on_transport: formData.is_on_transport!,
                  is_active: formData.is_active!,
                  stream: formData.current_stream_name || 'Main', // Add required stream property
                  photo: formData.photo || null,
                  photo_url: null,
                  phone: undefined,
                  email: undefined,
                  address: undefined,
                  medical_conditions: undefined,
                  emergency_contact: undefined,
                  emergency_phone: undefined,
                  previous_school: undefined,
                  first_name: formData.full_name.split(' ')[0],
                  last_name: formData.full_name.split(' ').slice(1).join(' ') || formData.full_name.split(' ')[0],
                } as Omit<Student, 'id' | 'admission_number' | 'created_at' | 'updated_at'>;
                
                setSubmittedStudent(studentData);
                setShowPrintDialog(true);
              } else {
                toast.error('Please fill all required fields correctly');
              }
            }}
            className="gap-2"
          >
            <Printer size={16} />
            Preview Admission Form
          </Button>
        </div>
      </form>
      
      {/* Print Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Student Admission Form
            </DialogTitle>
            <div className="text-sm text-muted-foreground">
              Review and print the admission form for this student
            </div>
          </DialogHeader>
          {submittedStudent && (
            <div className="space-y-4">
              <div id="admission-form-content">
                <AdmissionFormPrint student={submittedStudent} />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPrintDialog(false)}
                >
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    const printContent = document.getElementById('admission-form-content');
                    if (printContent) {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Admission Form - ${submittedStudent.full_name}</title>
                              <style>
                                body { 
                                  font-family: Arial, sans-serif; 
                                  margin: 0; 
                                  padding: 20px; 
                                  background: white;
                                  color: black;
                                }
                                .print-container { 
                                  max-width: 800px; 
                                  margin: 0 auto; 
                                }
                                @media print { 
                                  body { 
                                    margin: 0; 
                                    padding: 10px; 
                                  } 
                                  .print-container {
                                    max-width: none;
                                  }
                                }
                                h1, h2, h3 { color: black !important; }
                                .bg-gray-100 { background-color: #f3f4f6 !important; }
                                .border-gray-300 { border-color: #d1d5db !important; }
                                .border-gray-800 { border-color: #1f2937 !important; }
                                .text-gray-600 { color: #4b5563 !important; }
                                .text-gray-500 { color: #6b7280 !important; }
                              </style>
                            </head>
                            <body>
                              <div class="print-container">
                                ${printContent.innerHTML}
                              </div>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => {
                          printWindow.print();
                          printWindow.close();
                        }, 250);
                      }
                    }
                  }}
                  className="gap-2"
                >
                  <Printer size={16} />
                  Print Form
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sibling Confirmation Dialog */}
      <Dialog open={showSiblingConfirmation} onOpenChange={setShowSiblingConfirmation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Guardian Match Found
            </DialogTitle>
            <div className="text-sm text-muted-foreground">
              We found existing guardian(s) with matching information. 
              Would you like to link this student as a sibling?
            </div>
          </DialogHeader>
          <div className="space-y-3">
            {potentialGuardians.map((guardian) => (
              <div key={guardian.id} className="p-3 border rounded-lg">
                <div className="font-medium">{guardian.name}</div>
                <div className="text-sm text-muted-foreground">{guardian.phone}</div>
                {guardian.email && (
                  <div className="text-sm text-muted-foreground">{guardian.email}</div>
                )}
                <div className="text-xs text-blue-600 mt-1">
                  Has {guardian.students.length} student(s) registered
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => confirmGuardianSelection(guardian)}
                    className="flex-1"
                  >
                    Link as Sibling
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={rejectGuardianMatch}
              className="w-full flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Use New Guardian Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
