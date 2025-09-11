import { 
  Teacher, 
  TeacherSubjectAssignment,
  TeacherClassAssignment,
  PayrollTransaction,
  AllowanceDeduction,
  TeacherAttendance,
  TeacherPerformance,
  TeacherFilters,
  TeacherStats 
} from '@/types/teacher';

// Mock data for teachers
const mockTeachers: Teacher[] = [
  {
    id: 1,
    first_name: 'Sarah',
    last_name: 'Johnson',
    national_id: '12345678',
    date_of_birth: '1985-03-15',
    gender: 'Female',
    phone: '+254700123456',
    email: 'sarah.johnson@school.ac.ke',
    address: '123 Teachers Estate, Nairobi',
    emergency_contact_name: 'John Johnson',
    emergency_contact_phone: '+254700654321',
    employee_no: 'EMP001',
    employment_type: 'Permanent',
    hire_date: '2018-01-15',
    job_title: 'Senior Teacher',
    designation: 'Mathematics Teacher',
    department: 'Mathematics',
    tsc_number: 'TSC/123456',
    bank_name: 'KCB Bank',
    bank_branch: 'Nairobi Branch',
    account_number: '1234567890',
    kra_pin: 'A123456789X',
    nhif_number: 'NH123456',
    nssf_number: 'NS123456',
    salary_scale: 'C2',
    basic_salary: 45000,
    house_allowance: 15000,
    transport_allowance: 8000,
    responsibility_allowance: 5000,
    status: 'Active',
    school: 1,
    created_at: '2018-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    full_name: 'Sarah Johnson',
    years_of_service: 6,
    gross_salary: 73000
  },
  {
    id: 2,
    first_name: 'Michael',
    last_name: 'Ochieng',
    national_id: '23456789',
    date_of_birth: '1980-07-22',
    gender: 'Male',
    phone: '+254700234567',
    email: 'michael.ochieng@school.ac.ke',
    address: '456 Staff Quarters, Kisumu',
    emergency_contact_name: 'Grace Ochieng',
    emergency_contact_phone: '+254700765432',
    employee_no: 'EMP002',
    employment_type: 'Permanent',
    hire_date: '2015-09-01',
    job_title: 'Head of Department',
    designation: 'HOD Sciences',
    department: 'Sciences',
    tsc_number: 'TSC/234567',
    bank_name: 'Equity Bank',
    bank_branch: 'Kisumu Branch',
    account_number: '2345678901',
    kra_pin: 'A234567890Y',
    nhif_number: 'NH234567',
    nssf_number: 'NS234567',
    salary_scale: 'C3',
    basic_salary: 55000,
    house_allowance: 18000,
    transport_allowance: 10000,
    responsibility_allowance: 12000,
    status: 'Active',
    school: 1,
    created_at: '2015-09-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    full_name: 'Michael Ochieng',
    years_of_service: 9,
    gross_salary: 95000
  },
  {
    id: 3,
    first_name: 'Grace',
    last_name: 'Wanjiku',
    national_id: '34567890',
    date_of_birth: '1990-11-08',
    gender: 'Female',
    phone: '+254700345678',
    email: 'grace.wanjiku@school.ac.ke',
    address: '789 Nyayo Estate, Nakuru',
    emergency_contact_name: 'Peter Wanjiku',
    emergency_contact_phone: '+254700876543',
    employee_no: 'EMP003',
    employment_type: 'Contract',
    hire_date: '2022-01-10',
    job_title: 'Teacher',
    designation: 'English Teacher',
    department: 'Languages',
    tsc_number: 'TSC/345678',
    bank_name: 'Co-operative Bank',
    bank_branch: 'Nakuru Branch',
    account_number: '3456789012',
    kra_pin: 'A345678901Z',
    nhif_number: 'NH345678',
    nssf_number: 'NS345678',
    salary_scale: 'C1',
    basic_salary: 38000,
    house_allowance: 12000,
    transport_allowance: 6000,
    responsibility_allowance: 0,
    status: 'Active',
    school: 1,
    created_at: '2022-01-10T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    full_name: 'Grace Wanjiku',
    years_of_service: 2,
    gross_salary: 56000
  }
];

// Mock assignments
const mockSubjectAssignments: TeacherSubjectAssignment[] = [
  {
    id: 1,
    teacher_id: 1,
    subject_id: 1,
    subject_name: 'Mathematics',
    class_id: 1,
    class_name: 'Form 1',
    stream_id: 1,
    stream_name: 'A',
    academic_year: 2024,
    term: 1,
    is_class_teacher: true,
    created_at: '2024-01-15T00:00:00Z'
  }
];

// Mock payroll transactions
const mockPayrollTransactions: PayrollTransaction[] = [
  {
    id: 1,
    teacher_id: 1,
    teacher_name: 'Sarah Johnson',
    employee_no: 'EMP001',
    month: 1,
    year: 2024,
    basic_salary: 45000,
    house_allowance: 15000,
    transport_allowance: 8000,
    responsibility_allowance: 5000,
    overtime_allowance: 2000,
    other_allowances: 1000,
    gross_pay: 76000,
    paye_tax: 8500,
    nhif_deduction: 1700,
    nssf_deduction: 2160,
    loan_deductions: 5000,
    sacco_deductions: 3000,
    other_deductions: 500,
    total_deductions: 20860,
    net_pay: 55140,
    generated_on: '2024-01-31T00:00:00Z',
    status: 'Paid',
    payment_date: '2024-02-01T00:00:00Z'
  }
];

// Simulate API delay
const apiDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

export const teacherService = {
  // Teacher CRUD operations
  async getTeachers(filters?: TeacherFilters): Promise<Teacher[]> {
    await apiDelay();
    let teachers = [...mockTeachers];
    
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      teachers = teachers.filter(teacher => 
        teacher.first_name.toLowerCase().includes(search) ||
        teacher.last_name.toLowerCase().includes(search) ||
        teacher.employee_no.toLowerCase().includes(search) ||
        teacher.email.toLowerCase().includes(search)
      );
    }
    
    if (filters?.department) {
      teachers = teachers.filter(teacher => teacher.department === filters.department);
    }
    
    if (filters?.employment_type) {
      teachers = teachers.filter(teacher => teacher.employment_type === filters.employment_type);
    }
    
    if (filters?.status) {
      teachers = teachers.filter(teacher => teacher.status === filters.status);
    }
    
    return teachers;
  },

  async getTeacher(id: number): Promise<Teacher | null> {
    await apiDelay();
    return mockTeachers.find(teacher => teacher.id === id) || null;
  },

  async createTeacher(data: Omit<Teacher, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'years_of_service' | 'gross_salary'>): Promise<Teacher> {
    await apiDelay();
    
    // Check for duplicate employee number
    const existingTeacher = mockTeachers.find(teacher => 
      teacher.employee_no.toLowerCase() === data.employee_no.toLowerCase() && teacher.school === data.school
    );
    
    if (existingTeacher) {
      throw new Error(`A teacher with employee number "${data.employee_no}" already exists`);
    }
    
    const newTeacher: Teacher = {
      ...data,
      id: Math.max(...mockTeachers.map(t => t.id)) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      full_name: `${data.first_name} ${data.last_name}`,
      years_of_service: 0,
      gross_salary: data.basic_salary + (data.house_allowance || 0) + (data.transport_allowance || 0) + (data.responsibility_allowance || 0) + (data.other_allowances || 0)
    };
    
    mockTeachers.push(newTeacher);
    return newTeacher;
  },

  async updateTeacher(id: number, data: Partial<Teacher>): Promise<Teacher | null> {
    await apiDelay();
    const index = mockTeachers.findIndex(teacher => teacher.id === id);
    if (index === -1) return null;
    
    const updatedTeacher = {
      ...mockTeachers[index],
      ...data,
      updated_at: new Date().toISOString(),
      full_name: `${data.first_name || mockTeachers[index].first_name} ${data.last_name || mockTeachers[index].last_name}`,
      gross_salary: (data.basic_salary || mockTeachers[index].basic_salary) + 
                   (data.house_allowance || mockTeachers[index].house_allowance || 0) + 
                   (data.transport_allowance || mockTeachers[index].transport_allowance || 0) + 
                   (data.responsibility_allowance || mockTeachers[index].responsibility_allowance || 0) + 
                   (data.other_allowances || mockTeachers[index].other_allowances || 0)
    };
    
    mockTeachers[index] = updatedTeacher;
    return updatedTeacher;
  },

  async deleteTeacher(id: number): Promise<boolean> {
    await apiDelay();
    const index = mockTeachers.findIndex(teacher => teacher.id === id);
    if (index === -1) return false;
    
    mockTeachers.splice(index, 1);
    return true;
  },

  // Subject assignments
  async getTeacherSubjects(teacherId: number): Promise<TeacherSubjectAssignment[]> {
    await apiDelay();
    return mockSubjectAssignments.filter(assignment => assignment.teacher_id === teacherId);
  },

  async assignTeacherToSubject(teacherId: number, subjectId: number, classId: number, streamId?: number, isClassTeacher: boolean = false): Promise<TeacherSubjectAssignment> {
    await apiDelay();
    const assignment: TeacherSubjectAssignment = {
      id: Date.now(),
      teacher_id: teacherId,
      subject_id: subjectId,
      class_id: classId,
      stream_id: streamId,
      academic_year: 2024,
      term: 1,
      is_class_teacher: isClassTeacher,
      created_at: new Date().toISOString()
    };
    
    mockSubjectAssignments.push(assignment);
    return assignment;
  },

  // Payroll operations
  async getTeacherPayroll(teacherId: number, year?: number): Promise<PayrollTransaction[]> {
    await apiDelay();
    let transactions = mockPayrollTransactions.filter(transaction => transaction.teacher_id === teacherId);
    
    if (year) {
      transactions = transactions.filter(transaction => transaction.year === year);
    }
    
    return transactions;
  },

  async generatePayslip(teacherId: number, month: number, year: number): Promise<PayrollTransaction> {
    await apiDelay();
    const teacher = mockTeachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found');
    
    const grossPay = teacher.basic_salary + 
                    (teacher.house_allowance || 0) + 
                    (teacher.transport_allowance || 0) + 
                    (teacher.responsibility_allowance || 0) + 
                    (teacher.other_allowances || 0);
    
    const payeTax = grossPay * 0.1; // Simplified PAYE calculation
    const nhifDeduction = Math.min(1700, grossPay * 0.025);
    const nssfDeduction = Math.min(2160, grossPay * 0.06);
    const totalDeductions = payeTax + nhifDeduction + nssfDeduction;
    
    const payslip: PayrollTransaction = {
      id: Date.now(),
      teacher_id: teacherId,
      teacher_name: teacher.full_name,
      employee_no: teacher.employee_no,
      month,
      year,
      basic_salary: teacher.basic_salary,
      house_allowance: teacher.house_allowance || 0,
      transport_allowance: teacher.transport_allowance || 0,
      responsibility_allowance: teacher.responsibility_allowance || 0,
      overtime_allowance: 0,
      other_allowances: teacher.other_allowances || 0,
      gross_pay: grossPay,
      paye_tax: payeTax,
      nhif_deduction: nhifDeduction,
      nssf_deduction: nssfDeduction,
      loan_deductions: 0,
      sacco_deductions: 0,
      other_deductions: 0,
      total_deductions: totalDeductions,
      net_pay: grossPay - totalDeductions,
      generated_on: new Date().toISOString(),
      status: 'Draft'
    };
    
    mockPayrollTransactions.push(payslip);
    return payslip;
  },

  // Statistics
  async getTeacherStats(): Promise<TeacherStats> {
    await apiDelay();
    
    const activeTeachers = mockTeachers.filter(t => t.status === 'Active');
    const departmentStats = mockTeachers.reduce((acc, teacher) => {
      acc[teacher.department] = (acc[teacher.department] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    const employmentTypeStats = mockTeachers.reduce((acc, teacher) => {
      acc[teacher.employment_type] = (acc[teacher.employment_type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    return {
      total_teachers: mockTeachers.length,
      active_teachers: activeTeachers.length,
      teachers_by_department: departmentStats,
      teachers_by_employment_type: employmentTypeStats,
      average_years_service: mockTeachers.reduce((sum, t) => sum + (t.years_of_service || 0), 0) / mockTeachers.length,
      total_payroll_cost: mockTeachers.reduce((sum, t) => sum + (t.gross_salary || 0), 0),
      teachers_on_leave: mockTeachers.filter(t => t.status === 'On Leave').length,
      new_hires_this_month: 1 // Mock data
    };
  }
};