import { 
  Staff,
  Teacher,
  StaffSubjectAssignment,
  StaffClassAssignment,
  PayrollTransaction,
  AllowanceDeduction,
  StaffAttendance,
  StaffPerformance,
  StaffFilters,
  StaffStats,
  TeacherSubjectAssignment,
  TeacherClassAssignment,
  TeacherAttendance,
  TeacherPerformance,
  TeacherFilters,
  TeacherStats
} from '@/types/teacher';

// Mock data for staff (including teachers and non-teaching staff)
const mockStaff: Staff[] = [
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
    staff_category: 'Teaching Staff',
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
    staff_category: 'Teaching Staff',
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
    staff_category: 'Teaching Staff',
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
  },
  {
    id: 4,
    first_name: 'James',
    last_name: 'Mwangi',
    national_id: '45678901',
    date_of_birth: '1978-05-12',
    gender: 'Male',
    phone: '+254700456789',
    email: 'james.mwangi@school.ac.ke',
    address: '321 Admin Block, Nairobi',
    emergency_contact_name: 'Mary Mwangi',
    emergency_contact_phone: '+254700987654',
    employee_no: 'EMP004',
    employment_type: 'Permanent',
    hire_date: '2010-03-01',
    job_title: 'School Secretary',
    designation: 'Administrative Officer',
    department: 'Administration',
    staff_category: 'Administrative Staff',
    bank_name: 'NCBA Bank',
    bank_branch: 'Nairobi Branch',
    account_number: '4567890123',
    kra_pin: 'A456789012W',
    nhif_number: 'NH456789',
    nssf_number: 'NS456789',
    salary_scale: 'A2',
    basic_salary: 42000,
    house_allowance: 14000,
    transport_allowance: 7000,
    responsibility_allowance: 3000,
    status: 'Active',
    school: 1,
    created_at: '2010-03-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    full_name: 'James Mwangi',
    years_of_service: 14,
    gross_salary: 66000
  },
  {
    id: 5,
    first_name: 'Mary',
    last_name: 'Njeri',
    national_id: '56789012',
    date_of_birth: '1992-08-30',
    gender: 'Female',
    phone: '+254700567890',
    email: 'mary.njeri@school.ac.ke',
    address: '654 Support Staff Quarters, Nakuru',
    emergency_contact_name: 'Paul Njeri',
    emergency_contact_phone: '+254700198765',
    employee_no: 'EMP005',
    employment_type: 'Permanent',
    hire_date: '2020-06-15',
    job_title: 'Security Guard',
    designation: 'Night Security',
    department: 'Security',
    staff_category: 'Security Staff',
    bank_name: 'KCB Bank',
    bank_branch: 'Nakuru Branch',
    account_number: '5678901234',
    kra_pin: 'A567890123V',
    nhif_number: 'NH567890',
    nssf_number: 'NS567890',
    salary_scale: 'S1',
    basic_salary: 25000,
    house_allowance: 8000,
    transport_allowance: 3000,
    responsibility_allowance: 2000,
    status: 'Active',
    school: 1,
    created_at: '2020-06-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    full_name: 'Mary Njeri',
    years_of_service: 4,
    gross_salary: 38000
  }
];

// Mock assignments
const mockSubjectAssignments: StaffSubjectAssignment[] = [
  {
    id: 1,
    staff_id: 1,
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
    staff_id: 1,
    staff_name: 'Sarah Johnson',
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

export const staffService = {
  // Staff CRUD operations
  async getStaff(filters?: StaffFilters): Promise<Staff[]> {
    await apiDelay();
    let staff = [...mockStaff];
    
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      staff = staff.filter(member => 
        member.first_name.toLowerCase().includes(search) ||
        member.last_name.toLowerCase().includes(search) ||
        member.employee_no.toLowerCase().includes(search) ||
        member.email.toLowerCase().includes(search)
      );
    }
    
    if (filters?.department) {
      staff = staff.filter(member => member.department === filters.department);
    }
    
    if (filters?.employment_type) {
      staff = staff.filter(member => member.employment_type === filters.employment_type);
    }
    
    if (filters?.status) {
      staff = staff.filter(member => member.status === filters.status);
    }
    
    if (filters?.staff_category) {
      staff = staff.filter(member => member.staff_category === filters.staff_category);
    }
    
    return staff;
  },

  async getStaffMember(id: number): Promise<Staff | null> {
    await apiDelay();
    return mockStaff.find(member => member.id === id) || null;
  },

  async createStaff(data: Omit<Staff, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'years_of_service' | 'gross_salary'>): Promise<Staff> {
    await apiDelay();
    
    // Check for duplicate employee number
    const existingStaff = mockStaff.find(member => 
      member.employee_no.toLowerCase() === data.employee_no.toLowerCase() && member.school === data.school
    );
    
    if (existingStaff) {
      throw new Error(`A staff member with employee number "${data.employee_no}" already exists`);
    }
    
    const newStaff: Staff = {
      ...data,
      id: Math.max(...mockStaff.map(s => s.id)) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      full_name: `${data.first_name} ${data.last_name}`,
      years_of_service: 0,
      gross_salary: data.basic_salary + (data.house_allowance || 0) + (data.transport_allowance || 0) + (data.responsibility_allowance || 0) + (data.other_allowances || 0)
    };
    
    mockStaff.push(newStaff);
    return newStaff;
  },

  async updateStaff(id: number, data: Partial<Staff>): Promise<Staff | null> {
    await apiDelay();
    const index = mockStaff.findIndex(member => member.id === id);
    if (index === -1) return null;
    
    const updatedStaff = {
      ...mockStaff[index],
      ...data,
      updated_at: new Date().toISOString(),
      full_name: `${data.first_name || mockStaff[index].first_name} ${data.last_name || mockStaff[index].last_name}`,
      gross_salary: (data.basic_salary || mockStaff[index].basic_salary) + 
                   (data.house_allowance || mockStaff[index].house_allowance || 0) + 
                   (data.transport_allowance || mockStaff[index].transport_allowance || 0) + 
                   (data.responsibility_allowance || mockStaff[index].responsibility_allowance || 0) + 
                   (data.other_allowances || mockStaff[index].other_allowances || 0)
    };
    
    mockStaff[index] = updatedStaff;
    return updatedStaff;
  },

  async deleteStaff(id: number): Promise<boolean> {
    await apiDelay();
    const index = mockStaff.findIndex(member => member.id === id);
    if (index === -1) return false;
    
    mockStaff.splice(index, 1);
    return true;
  },

  // Subject assignments (mainly for teaching staff)
  async getStaffSubjects(staffId: number): Promise<StaffSubjectAssignment[]> {
    await apiDelay();
    return mockSubjectAssignments.filter(assignment => assignment.staff_id === staffId);
  },

  async assignStaffToSubject(staffId: number, subjectId: number, classId: number, streamId?: number, isClassTeacher: boolean = false): Promise<StaffSubjectAssignment> {
    await apiDelay();
    const assignment: StaffSubjectAssignment = {
      id: Date.now(),
      staff_id: staffId,
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
  async getStaffPayroll(staffId: number, year?: number): Promise<PayrollTransaction[]> {
    await apiDelay();
    let transactions = mockPayrollTransactions.filter(transaction => transaction.staff_id === staffId);
    
    if (year) {
      transactions = transactions.filter(transaction => transaction.year === year);
    }
    
    return transactions;
  },

  async generatePayslip(staffId: number, month: number, year: number): Promise<PayrollTransaction> {
    await apiDelay();
    const staff = mockStaff.find(s => s.id === staffId);
    if (!staff) throw new Error('Staff member not found');
    
    const grossPay = staff.basic_salary + 
                    (staff.house_allowance || 0) + 
                    (staff.transport_allowance || 0) + 
                    (staff.responsibility_allowance || 0) + 
                    (staff.other_allowances || 0);
    
    const payeTax = grossPay * 0.1; // Simplified PAYE calculation
    const nhifDeduction = Math.min(1700, grossPay * 0.025);
    const nssfDeduction = Math.min(2160, grossPay * 0.06);
    const totalDeductions = payeTax + nhifDeduction + nssfDeduction;
    
    const payslip: PayrollTransaction = {
      id: Date.now(),
      staff_id: staffId,
      staff_name: staff.full_name,
      employee_no: staff.employee_no,
      month,
      year,
      basic_salary: staff.basic_salary,
      house_allowance: staff.house_allowance || 0,
      transport_allowance: staff.transport_allowance || 0,
      responsibility_allowance: staff.responsibility_allowance || 0,
      overtime_allowance: 0,
      other_allowances: staff.other_allowances || 0,
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
  async getStaffStats(): Promise<StaffStats> {
    await apiDelay();
    
    const activeStaff = mockStaff.filter(s => s.status === 'Active');
    const departmentStats = mockStaff.reduce((acc, staff) => {
      acc[staff.department] = (acc[staff.department] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    const categoryStats = mockStaff.reduce((acc, staff) => {
      acc[staff.staff_category] = (acc[staff.staff_category] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    const employmentTypeStats = mockStaff.reduce((acc, staff) => {
      acc[staff.employment_type] = (acc[staff.employment_type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    return {
      total_staff: mockStaff.length,
      active_staff: activeStaff.length,
      staff_by_department: departmentStats,
      staff_by_category: categoryStats,
      staff_by_employment_type: employmentTypeStats,
      average_years_service: mockStaff.reduce((sum, s) => sum + (s.years_of_service || 0), 0) / mockStaff.length,
      total_payroll_cost: mockStaff.reduce((sum, s) => sum + (s.gross_salary || 0), 0),
      staff_on_leave: mockStaff.filter(s => s.status === 'On Leave').length,
      new_hires_this_month: 1 // Mock data
    };
  }
};

// Backward compatibility - Teacher service methods
export const teacherService = {
  async getTeachers(filters?: TeacherFilters): Promise<Teacher[]> {
    const staffFilters: StaffFilters = { ...filters, staff_category: 'Teaching Staff' };
    const staff = await staffService.getStaff(staffFilters);
    return staff.filter(s => s.staff_category === 'Teaching Staff') as Teacher[];
  },

  async getTeacher(id: number): Promise<Teacher | null> {
    const staff = await staffService.getStaffMember(id);
    return staff && staff.staff_category === 'Teaching Staff' ? staff as Teacher : null;
  },

  async createTeacher(data: Omit<Teacher, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'years_of_service' | 'gross_salary'>): Promise<Teacher> {
    const staffData = { ...data, staff_category: 'Teaching Staff' as const };
    return await staffService.createStaff(staffData) as Teacher;
  },

  async updateTeacher(id: number, data: Partial<Teacher>): Promise<Teacher | null> {
    const result = await staffService.updateStaff(id, data);
    return result as Teacher | null;
  },

  async deleteTeacher(id: number): Promise<boolean> {
    return await staffService.deleteStaff(id);
  },

  async getTeacherSubjects(teacherId: number): Promise<TeacherSubjectAssignment[]> {
    return await staffService.getStaffSubjects(teacherId);
  },

  async assignTeacherToSubject(teacherId: number, subjectId: number, classId: number, streamId?: number, isClassTeacher: boolean = false): Promise<TeacherSubjectAssignment> {
    return await staffService.assignStaffToSubject(teacherId, subjectId, classId, streamId, isClassTeacher);
  },

  async getTeacherPayroll(teacherId: number, year?: number): Promise<PayrollTransaction[]> {
    return await staffService.getStaffPayroll(teacherId, year);
  },

  async generatePayslip(teacherId: number, month: number, year: number): Promise<PayrollTransaction> {
    return await staffService.generatePayslip(teacherId, month, year);
  },

  async getTeacherStats(): Promise<TeacherStats> {
    return await staffService.getStaffStats();
  }
};