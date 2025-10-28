import { supabase } from "@/integrations/supabase/client";
import { Student, StudentFilters, StudentStats, ImportResult } from "@/types/student";

export const getStudents = async (
  params: StudentFilters = {}
): Promise<Student[]> => {
  try {
    let query = supabase
      .from('students')
      .select(`
        *,
        classes:current_class_id(id, name, grade_level),
        streams:current_stream_id(id, name)
      `);
    
    if (params.search) {
      query = query.or(`full_name.ilike.%${params.search}%,admission_number.ilike.%${params.search}%`);
    }
    
    if (params.class_id) {
      query = query.eq('current_class_id', params.class_id);
    }
    
    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    // Transform to expected format
    return data?.map((item: any) => ({
      id: item.id.toString(),
      admission_number: item.admission_number,
      level: item.level || 'Primary',
      full_name: item.full_name,
      first_name: item.first_name,
      last_name: item.last_name,
      date_of_birth: item.date_of_birth,
      gender: item.gender,
      guardian_name: item.guardian_name || '',
      guardian_phone: item.guardian_phone || '',
      guardian_email: item.guardian_email || '',
      guardian_relationship: item.guardian_relationship || 'Parent',
      current_class: item.current_class_id?.toString() || null,
      current_stream: item.current_stream_id?.toString() || null,
      current_class_name: item.classes?.name || '',
      current_stream_name: item.streams?.name || '',
      current_class_stream: `${item.classes?.name || ''} ${item.streams?.name || ''}`.trim(),
      academic_year: item.academic_year || new Date().getFullYear(),
      enrollment_date: item.admission_date,
      admission_year: item.admission_year || new Date().getFullYear(),
      term: item.term || 1,
      upi_number: item.upi_number,
      status: item.status,
      is_active: item.is_active,
      is_on_transport: item.is_on_transport || false,
      transport_route: item.transport_route,
      transport_type: item.transport_type,
      stream: item.streams?.name || '',
      photo: item.photo,
      photo_url: item.photo_url,
      address: item.address,
      phone: item.phone,
      email: item.email,
      medical_conditions: item.medical_conditions,
      emergency_contact: item.emergency_contact,
      emergency_phone: item.emergency_phone,
      previous_school: item.previous_school,
      created_at: item.created_at,
      updated_at: item.updated_at
    })) || [];
  } catch (error) {
    console.error('Error fetching students:', error);
    throw error;
  }
};

export const getStudentById = async (id: string): Promise<Student | null> => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        classes:current_class_id(id, name, grade_level),
        streams:current_stream_id(id, name)
      `)
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    
    if (!data) return null;
    
    return {
      id: data.id.toString(),
      admission_number: data.admission_number,
      level: data.level || 'Primary',
      full_name: data.full_name,
      first_name: data.first_name,
      last_name: data.last_name,
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      guardian_name: data.guardian_name || '',
      guardian_phone: data.guardian_phone || '',
      guardian_email: data.guardian_email || '',
      guardian_relationship: data.guardian_relationship || 'Parent',
      current_class: data.current_class_id?.toString() || null,
      current_stream: data.current_stream_id?.toString() || null,
      current_class_name: data.classes?.name || '',
      current_stream_name: data.streams?.name || '',
      current_class_stream: `${data.classes?.name || ''} ${data.streams?.name || ''}`.trim(),
      academic_year: data.academic_year || new Date().getFullYear(),
      enrollment_date: data.admission_date,
      admission_year: data.admission_year || new Date().getFullYear(),
      term: data.term || 1,
      upi_number: data.upi_number,
      status: data.status,
      is_active: data.is_active,
      is_on_transport: data.is_on_transport || false,
      transport_route: data.transport_route,
      transport_type: data.transport_type,
      stream: data.streams?.name || '',
      photo: data.photo,
      photo_url: data.photo_url,
      address: data.address,
      phone: data.phone,
      email: data.email,
      medical_conditions: data.medical_conditions,
      emergency_contact: data.emergency_contact,
      emergency_phone: data.emergency_phone,
      previous_school: data.previous_school,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('Error fetching student:', error);
    throw error;
  }
};

export const createStudent = async (
  studentData: Omit<Student, "id" | "admission_number" | "created_at" | "updated_at">
): Promise<Student> => {
  try {
    console.log('Creating student with data:', studentData);
    
    // Use the create_student function (similar to create_school_profile)
    const { data, error } = await supabase.rpc('create_student', {
      p_full_name: studentData.full_name,
      p_gender: studentData.gender,
      p_date_of_birth: studentData.date_of_birth,
      p_guardian_name: studentData.guardian_name,
      p_guardian_phone: studentData.guardian_phone,
      p_guardian_email: studentData.guardian_email || '',
      p_guardian_relationship: studentData.guardian_relationship,
      p_current_class_id: studentData.current_class ? parseInt(studentData.current_class) : null,
      p_current_stream_id: studentData.current_stream ? parseInt(studentData.current_stream) : null,
      p_level: studentData.level,
      p_admission_year: studentData.academic_year || new Date().getFullYear(),
      p_is_on_transport: studentData.is_on_transport || false,
      p_photo: studentData.photo_url || null
    });
    
    if (error) {
      console.error('Error creating student:', error);
      throw new Error(error.message || 'Failed to create student');
    }
    
    if (!data || data.length === 0) {
      throw new Error('No student data returned');
    }
    
    const createdStudent = Array.isArray(data) ? data[0] : data;
    console.log('Student created successfully:', createdStudent);
    
    // Split full_name into first and last name for return data
    const nameParts = createdStudent.full_name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || nameParts[0];
    
    return {
      id: createdStudent.id.toString(),
      admission_number: createdStudent.admission_number,
      level: createdStudent.level,
      full_name: createdStudent.full_name,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: createdStudent.date_of_birth,
      gender: createdStudent.gender,
      guardian_name: createdStudent.guardian_name,
      guardian_phone: createdStudent.guardian_phone,
      guardian_email: createdStudent.guardian_email || '',
      guardian_relationship: createdStudent.guardian_relationship,
      current_class: createdStudent.current_class_id?.toString() || null,
      current_stream: createdStudent.current_stream_id?.toString() || null,
      current_class_name: studentData.current_class_name,
      current_stream_name: studentData.current_stream_name,
      current_class_stream: studentData.current_class_stream || '',
      academic_year: createdStudent.admission_year,
      enrollment_date: new Date().toISOString().split('T')[0],
      admission_year: createdStudent.admission_year,
      term: studentData.term || 1,
      upi_number: studentData.upi_number,
      status: createdStudent.is_active ? 'active' : 'inactive',
      is_active: createdStudent.is_active,
      is_on_transport: createdStudent.is_on_transport,
      transport_route: studentData.transport_route,
      transport_type: studentData.transport_type,
      stream: studentData.stream || '',
      photo_url: createdStudent.photo || null,
      photo: createdStudent.photo || null,
      address: studentData.address,
      phone: studentData.phone,
      email: studentData.email,
      medical_conditions: studentData.medical_conditions,
      emergency_contact: studentData.emergency_contact,
      emergency_phone: studentData.emergency_phone,
      previous_school: studentData.previous_school,
      created_at: createdStudent.created_at,
      updated_at: createdStudent.updated_at
    };
  } catch (error) {
    console.error('Error creating student:', error);
    throw error;
  }
};

async function generateAdmissionNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_admission_number');
  
  if (error) {
    console.error('Error generating admission number:', error);
    // Fallback to simple generation
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${year}${random}`;
  }
  
  return data;
}

export const updateStudent = async (id: string, studentData: Partial<Student>): Promise<Student | null> => {
  try {
    const updateData: any = {
      full_name: studentData.full_name,
      first_name: studentData.first_name,
      last_name: studentData.last_name,
      date_of_birth: studentData.date_of_birth,
      gender: studentData.gender,
      guardian_name: studentData.guardian_name,
      guardian_phone: studentData.guardian_phone,
      guardian_email: studentData.guardian_email,
      guardian_relationship: studentData.guardian_relationship,
      current_class_id: studentData.current_class ? parseInt(studentData.current_class) : null,
      current_stream_id: studentData.current_stream ? parseInt(studentData.current_stream) : null,
      level: studentData.level,
      academic_year: studentData.academic_year,
      term: studentData.term,
      upi_number: studentData.upi_number,
      status: studentData.status,
      is_on_transport: studentData.is_on_transport,
      transport_route: studentData.transport_route,
      transport_type: studentData.transport_type,
      photo: studentData.photo,
      photo_url: studentData.photo_url,
      address: studentData.address,
      phone: studentData.phone,
      email: studentData.email,
      medical_conditions: studentData.medical_conditions,
      emergency_contact: studentData.emergency_contact,
      emergency_phone: studentData.emergency_phone,
      previous_school: studentData.previous_school
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const { data, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        classes:current_class_id(id, name, grade_level),
        streams:current_stream_id(id, name)
      `)
      .maybeSingle();
    
    if (error) throw error;
    
    if (!data) return null;
    
    return {
      id: data.id.toString(),
      admission_number: data.admission_number,
      level: data.level,
      full_name: data.full_name,
      first_name: data.first_name,
      last_name: data.last_name,
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      guardian_name: data.guardian_name,
      guardian_phone: data.guardian_phone,
      guardian_email: data.guardian_email || '',
      guardian_relationship: data.guardian_relationship,
      current_class: data.current_class_id?.toString() || null,
      current_stream: data.current_stream_id?.toString() || null,
      current_class_name: data.classes?.name || '',
      current_stream_name: data.streams?.name || '',
      current_class_stream: `${data.classes?.name || ''} ${data.streams?.name || ''}`.trim(),
      academic_year: data.academic_year,
      enrollment_date: data.admission_date,
      admission_year: data.admission_year,
      term: data.term,
      upi_number: data.upi_number,
      status: data.status,
      is_active: data.is_active,
      is_on_transport: data.is_on_transport,
      transport_route: data.transport_route,
      transport_type: data.transport_type,
      stream: data.streams?.name || '',
      photo: data.photo,
      photo_url: data.photo_url,
      address: data.address,
      phone: data.phone,
      email: data.email,
      medical_conditions: data.medical_conditions,
      emergency_contact: data.emergency_contact,
      emergency_phone: data.emergency_phone,
      previous_school: data.previous_school,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
};

export const deleteStudent = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting student:', error);
    throw new Error(error.message || 'Failed to delete student');
  }
  
  return true;
};

export const getStudentStats = async (): Promise<StudentStats> => {
  try {
    console.log('Fetching student stats...');
    
    // Get user's school ID
    const { data: schoolId, error: schoolError } = await supabase.rpc('get_user_school_id');
    
    console.log('School ID:', schoolId, 'Error:', schoolError);
    
    if (schoolError) {
      console.error('Error getting school ID:', schoolError);
      throw schoolError;
    }
    
    if (!schoolId) {
      console.warn('No school associated with user');
      return {
        total_students: 0,
        active_students: 0,
        male_students: 0,
        female_students: 0,
        students_by_class: {},
        students_by_status: {},
        enrollment_trend: [],
      };
    }

    // Fetch all students for this school
    const { data: students, error } = await supabase
      .from('students')
      .select('*, classes:current_class_id(name)')
      .eq('school_id', schoolId);
    
    console.log('Students fetched:', students?.length, 'Error:', error);
    
    if (error) {
      console.error('Error fetching students:', error);
      throw error;
    }

    const studentList = students || [];
    
    // Calculate stats
    const total_students = studentList.length;
    const active_students = studentList.filter(s => s.is_active).length;
    
    // Gender comparison - handle both single letters (M/F) and full words (Male/Female)
    const male_students = studentList.filter(s => {
      const gender = s.gender?.toLowerCase();
      return gender === 'male' || gender === 'm';
    }).length;
    
    const female_students = studentList.filter(s => {
      const gender = s.gender?.toLowerCase();
      return gender === 'female' || gender === 'f';
    }).length;
    
    console.log('Student stats calculated:', { total_students, active_students, male_students, female_students });
    
    // Group by class
    const students_by_class: Record<string, number> = {};
    studentList.forEach(student => {
      const className = (student.classes as any)?.name || 'Unassigned';
      students_by_class[className] = (students_by_class[className] || 0) + 1;
    });
    
    // Group by status
    const students_by_status: Record<string, number> = {
      active: active_students,
      inactive: total_students - active_students
    };

    return {
      total_students,
      active_students,
      male_students,
      female_students,
      students_by_class,
      students_by_status,
      enrollment_trend: [],
    };
  } catch (error) {
    console.error('Error in getStudentStats:', error);
    return {
      total_students: 0,
      active_students: 0,
      male_students: 0,
      female_students: 0,
      students_by_class: {},
      students_by_status: {},
      enrollment_trend: [],
    };
  }
};

export const bulkImportStudents = async (file: File): Promise<ImportResult> => {
  const result: ImportResult = {
    success: 0,
    errors: 0,
    warnings: 0,
    details: [],
  };

  try {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    // Skip header row
    const dataLines = lines.slice(1);

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const rowNum = i + 2; // +2 because we skip header and arrays are 0-indexed

      try {
        // Validate required fields
        if (values.length < 14) {
          throw new Error(`Insufficient columns (expected at least 14, got ${values.length})`);
        }

        const [
          full_name, date_of_birth, gender, upi_number,
          guardian_name, guardian_phone, guardian_email, guardian_relationship,
          level, current_class_name, current_stream_name,
          enrollment_date, status, academic_year, admission_year, term,
          is_on_transport, transport_route, transport_type
        ] = values;

        // Basic validation
        if (!full_name || full_name.length < 3) {
          throw new Error('Full name is required (min 3 characters)');
        }
        if (!['M', 'F', 'Male', 'Female'].includes(gender)) {
          throw new Error('Gender must be M, F, Male, or Female');
        }
        if (!guardian_name || !guardian_phone) {
          throw new Error('Guardian name and phone are required');
        }

        // Prepare student data
        const studentData: Omit<Student, 'id' | 'admission_number' | 'created_at' | 'updated_at'> = {
          full_name,
          first_name: full_name.split(' ')[0],
          last_name: full_name.split(' ').slice(1).join(' ') || full_name.split(' ')[0],
          date_of_birth: date_of_birth || new Date().toISOString().split('T')[0],
          gender: gender.toUpperCase().startsWith('M') ? 'M' : 'F',
          upi_number: upi_number || undefined,
          guardian_name,
          guardian_phone,
          guardian_email: guardian_email || undefined,
          guardian_relationship: guardian_relationship || 'Parent',
          level: level || 'Primary',
          current_class: null,
          current_stream: null,
          current_class_name: current_class_name || '',
          current_stream_name: current_stream_name || '',
          current_class_stream: `${current_class_name || ''} ${current_stream_name || ''}`.trim(),
          enrollment_date: enrollment_date || new Date().toISOString().split('T')[0],
          status: (status as any) || 'active',
          academic_year: parseInt(academic_year) || new Date().getFullYear(),
          admission_year: parseInt(admission_year) || new Date().getFullYear(),
          term: (parseInt(term) || 1) as 1 | 2 | 3,
          is_on_transport: is_on_transport?.toLowerCase() === 'true' || is_on_transport === '1',
          transport_route: transport_route ? parseInt(transport_route) : undefined,
          transport_type: transport_type && ['one_way', 'two_way'].includes(transport_type) ? transport_type as 'one_way' | 'two_way' : undefined,
          is_active: true,
          stream: current_stream_name || 'Main',
          photo: null,
          photo_url: null,
        };

        // Create student
        await createStudent(studentData);
        result.success++;
      } catch (error: any) {
        result.errors++;
        result.details.push({
          row: rowNum,
          message: `Error: ${error.message || 'Unknown error'}`,
          type: 'error',
        });
      }
    }
  } catch (error: any) {
    result.errors++;
    result.details.push({
      row: 0,
      message: `File processing error: ${error.message || 'Unknown error'}`,
      type: 'error',
    });
  }

  return result;
};

export const exportStudents = async (filters: StudentFilters = {}): Promise<Blob> => {
  try {
    const students = await getStudents(filters);
    
    // CSV headers
    const headers = [
      'Admission Number', 'Full Name', 'Date of Birth', 'Gender', 'UPI Number',
      'Guardian Name', 'Guardian Phone', 'Guardian Email', 'Guardian Relationship',
      'Level', 'Class', 'Stream', 'Enrollment Date', 'Status',
      'Academic Year', 'Admission Year', 'Term',
      'Transport', 'Transport Route', 'Transport Type'
    ];

    // Build CSV rows
    const rows = students.map(student => [
      student.admission_number || '',
      student.full_name,
      student.date_of_birth,
      student.gender === 'M' ? 'Male' : 'Female',
      student.upi_number || '',
      student.guardian_name,
      student.guardian_phone,
      student.guardian_email || '',
      student.guardian_relationship || '',
      student.level || '',
      student.current_class_name || '',
      student.current_stream_name || '',
      student.enrollment_date,
      student.status,
      student.academic_year,
      student.admission_year,
      student.term,
      student.is_on_transport ? 'Yes' : 'No',
      student.transport_route || '',
      student.transport_type || ''
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  } catch (error) {
    console.error('Error exporting students:', error);
    throw error;
  }
};

export const getImportTemplate = (): Blob => {
  const headers = [
    'full_name', 'date_of_birth', 'gender', 'upi_number',
    'guardian_name', 'guardian_phone', 'guardian_email', 'guardian_relationship',
    'level', 'current_class_name', 'current_stream_name',
    'enrollment_date', 'status', 'academic_year', 'admission_year', 'term',
    'is_on_transport', 'transport_route', 'transport_type'
  ];

  const exampleRow = [
    'John Doe',
    '2010-01-15',
    'M',
    '',
    'Jane Doe',
    '+254712345678',
    'jane@example.com',
    'Parent',
    'Primary',
    'Grade 1',
    'East',
    new Date().toISOString().split('T')[0],
    'active',
    new Date().getFullYear().toString(),
    new Date().getFullYear().toString(),
    '1',
    'false',
    '',
    ''
  ];

  const csvContent = [
    headers.join(','),
    exampleRow.map(cell => `"${cell}"`).join(',')
  ].join('\n');

  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};
