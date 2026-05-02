import React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Staff, EMPLOYMENT_TYPES, STAFF_STATUS_OPTIONS, STAFF_CATEGORIES, DEPARTMENTS, JOB_TITLES, SALARY_SCALES } from '@/types/teacher';
import { Badge } from '@/components/ui/badge';
import { Briefcase, CreditCard, Shield, Wallet } from 'lucide-react';

const staffFormSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  gender: z.enum(['Male', 'Female']),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  address: z.string().min(1, 'Address is required'),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  employee_no: z.string().min(1, 'Employee number is required'),
  staff_category: z.string().min(1, 'Staff category is required'),
  department: z.string().min(1, 'Department is required'),
  job_title: z.string().min(1, 'Job title is required'),
  designation: z.string().min(1, 'Designation is required'),
  employment_type: z.string().min(1, 'Employment type is required'),
  hire_date: z.string().min(1, 'Hire date is required'),
  tsc_number: z.string().optional(),
  national_id: z.string().optional(),
  passport_no: z.string().optional(),
  kra_pin: z.string().optional(),
  nhif_number: z.string().optional(),
  nssf_number: z.string().optional(),
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  account_number: z.string().optional(),
  basic_salary: z.number().min(0, 'Basic salary must be positive'),
  house_allowance: z.number().min(0, 'House allowance must be positive').default(0),
  transport_allowance: z.number().min(0, 'Transport allowance must be positive').default(0),
  responsibility_allowance: z.number().min(0, 'Responsibility allowance must be positive').default(0),
  other_allowances: z.number().min(0, 'Other allowances must be positive').default(0),
  salary_scale: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
});

type StaffFormValues = z.infer<typeof staffFormSchema>;

interface StaffFormProps {
  onSubmit: (data: Omit<Staff, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'years_of_service' | 'gross_salary'>) => void;
  onCancel: () => void;
  initialData?: Partial<Staff>;
  isLoading?: boolean;
}

export function StaffForm({ onSubmit, onCancel, initialData, isLoading = false }: StaffFormProps) {
  const [activeTab, setActiveTab] = useState('personal');
  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      first_name: initialData?.first_name || '',
      last_name: initialData?.last_name || '',
      gender: initialData?.gender || 'Male',
      date_of_birth: initialData?.date_of_birth || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      address: initialData?.address || '',
      emergency_contact_name: initialData?.emergency_contact_name || '',
      emergency_contact_phone: initialData?.emergency_contact_phone || '',
      employee_no: initialData?.employee_no || '',
      staff_category: initialData?.staff_category || '',
      department: initialData?.department || '',
      job_title: initialData?.job_title || '',
      designation: initialData?.designation || '',
      employment_type: initialData?.employment_type || '',
      hire_date: initialData?.hire_date || '',
      tsc_number: initialData?.tsc_number || '',
      national_id: initialData?.national_id || '',
      passport_no: initialData?.passport_no || '',
      kra_pin: initialData?.kra_pin || '',
      nhif_number: initialData?.nhif_number || '',
      nssf_number: initialData?.nssf_number || '',
      bank_name: initialData?.bank_name || '',
      bank_branch: initialData?.bank_branch || '',
      account_number: initialData?.account_number || '',
      basic_salary: initialData?.basic_salary || 0,
      house_allowance: initialData?.house_allowance || 0,
      transport_allowance: initialData?.transport_allowance || 0,
      responsibility_allowance: initialData?.responsibility_allowance || 0,
      other_allowances: initialData?.other_allowances || 0,
      salary_scale: initialData?.salary_scale || '',
      status: initialData?.status || 'Active',
    },
  });

  const handleSubmit = (values: StaffFormValues) => {
    console.log('Form submitted with values:', values);
    onSubmit(values as any);
  };

  const handleInvalidSubmit = (errors: any) => {
    console.error('Form validation errors:', errors);
    
    // Check which tab has errors
    const personalErrors = ['first_name', 'last_name', 'gender', 'date_of_birth', 'phone', 'email', 'address'];
    const employmentErrors = ['employee_no', 'staff_category', 'department', 'job_title', 'designation', 'employment_type', 'hire_date', 'tsc_number'];
    const financialErrors = ['national_id', 'kra_pin', 'nhif_number', 'nssf_number', 'bank_name', 'bank_branch', 'account_number'];
    const salaryErrors = ['basic_salary', 'house_allowance', 'transport_allowance', 'responsibility_allowance', 'other_allowances', 'salary_scale', 'status'];
    
    const errorFields = Object.keys(errors);
    let errorTab = 'personal';
    
    if (errorFields.some(field => personalErrors.includes(field))) {
      errorTab = 'personal';
    } else if (errorFields.some(field => employmentErrors.includes(field))) {
      errorTab = 'employment';
    } else if (errorFields.some(field => financialErrors.includes(field))) {
      errorTab = 'financial';
    } else if (errorFields.some(field => salaryErrors.includes(field))) {
      errorTab = 'salary';
    }

    setActiveTab(errorTab);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)} className="flex h-full min-h-0 flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Required fields marked in each section</Badge>
            <Badge variant="secondary">Personal, employment, finance, and salary</Badge>
          </div>
          <TabsList className="grid w-full grid-cols-4 rounded-2xl border border-border/70 bg-muted/40 p-1">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="salary">Salary</TabsTrigger>
          </TabsList>

          <div className="erp-modal-body mt-4">
          <TabsContent value="personal" className="mt-0 space-y-4">
            <section className="erp-form-section">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Shield className="h-4 w-4 text-primary" /> Personal Details
              </div>
            <div className="erp-form-grid">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employee_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter employee number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passport_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passport Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter passport number (optional)" {...field} />
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="national_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>National ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter National ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </section>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter full address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <section className="erp-form-section">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Briefcase className="h-4 w-4 text-primary" /> Emergency Contact
              </div>
            <div className="erp-form-grid">
              <FormField
                control={form.control}
                name="emergency_contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter emergency contact name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergency_contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter emergency contact phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </section>
          </TabsContent>

          <TabsContent value="employment" className="mt-0 space-y-4">
            <section className="erp-form-section">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Briefcase className="h-4 w-4 text-primary" /> Employment Information
              </div>
            <div className="erp-form-grid">
              <FormField
                control={form.control}
                name="staff_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STAFF_CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
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
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept.value} value={dept.value}>
                            {dept.label}
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
                name="job_title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job title" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {JOB_TITLES.map((title) => (
                          <SelectItem key={title.value} value={title.value}>
                            {title.label}
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
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter designation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employment_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employment type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EMPLOYMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
                name="hire_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hire Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tsc_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TSC Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter TSC number (optional)" {...field} />
                    </FormControl>
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STAFF_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </section>
          </TabsContent>

          <TabsContent value="financial" className="mt-0 space-y-4">
            <section className="erp-form-section">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CreditCard className="h-4 w-4 text-primary" /> Statutory and Banking Details
              </div>
            <div className="erp-form-grid">
              <FormField
                control={form.control}
                name="kra_pin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KRA PIN</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter KRA PIN (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nhif_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NHIF Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter NHIF number (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nssf_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NSSF Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter NSSF number (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter bank name (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bank_branch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Branch</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter bank branch (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="account_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter account number (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </section>
          </TabsContent>

          <TabsContent value="salary" className="mt-0 space-y-4">
            <section className="erp-form-section">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wallet className="h-4 w-4 text-primary" /> Salary Configuration
              </div>
            <div className="erp-form-grid">
              <FormField
                control={form.control}
                name="basic_salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Basic Salary</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter basic salary" 
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="house_allowance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>House Allowance</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter house allowance" 
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transport_allowance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transport Allowance</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter transport allowance" 
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsibility_allowance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsibility Allowance</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter responsibility allowance" 
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="other_allowances"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other Allowances</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter other allowances" 
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salary_scale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary Scale</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select salary scale" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SALARY_SCALES.map((scale) => (
                          <SelectItem key={scale.value} value={scale.value}>
                            {scale.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </section>
          </TabsContent>
          </div>
        </Tabs>

        <div className="mt-auto flex flex-col-reverse gap-2 border-t border-border/70 bg-background/95 px-1 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : initialData ? 'Save Staff Member' : 'Add Staff Member'}
          </Button>
        </div>
      </form>
    </Form>
  );
}