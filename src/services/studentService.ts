import { supabase } from "@/integrations/supabase/client";
import { Student, StudentFilters, StudentStats, ImportResult } from "@/types/student";

export const getStudents = async (
  params: StudentFilters = {}
): Promise<Student[]> => {
  try {
    let query = supabase
      .from('students')
      .select('*');
    
    if (params.search) {
      query = query.or(`first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,admission_number.ilike.%${params.search}%`);
    }
    
    if (params.class_id) {
      query = query.eq('class_id', params.class_id);
    }
    
    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    // Transform to expected format
    return data?.map((item: any) => ({
      id: item.id,
      admission_number: item.admission_number,
      level: item.level || 'Primary',
      full_name: `${item.first_name} ${item.last_name}`,
      first_name: item.first_name,
      last_name: item.last_name,
      date_of_birth: item.date_of_birth,
      gender: item.gender,
      guardian_name: item.guardian_name || '',
      guardian_phone: item.guardian_phone || '',
      guardian_email: item.guardian_email || '',
      guardian_relationship: item.guardian_relationship || 'Parent',
      current_class: item.class_id || null,
      current_stream: item.class_id || null,
      current_class_name: 'Grade 1', // TODO: Join with classes table
      current_stream_name: 'Main',
      current_class_stream: 'Grade 1 Main',
      academic_year: item.academic_year || new Date().getFullYear(),
      enrollment_date: item.admission_date,
      admission_year: item.academic_year || new Date().getFullYear(),
      term: item.term || 1,
      upi_number: item.upi_number,
      status: item.status,
      is_active: item.status === 'Active',
      is_on_transport: item.is_on_transport || false,
      stream: 'Main', // Add default stream value
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
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    
    if (!data) return null;
    
    return {
      id: data.id,
      admission_number: data.admission_number,
      level: data.level || 'Primary',
      full_name: `${data.first_name} ${data.last_name}`,
      first_name: data.first_name,
      last_name: data.last_name,
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      guardian_name: data.guardian_name || '',
      guardian_phone: data.guardian_phone || '',
      guardian_email: data.guardian_email || '',
      guardian_relationship: data.guardian_relationship || 'Parent',
      current_class: data.class_id || null,
      current_stream: data.class_id || null,
      current_class_name: 'Grade 1',
      current_stream_name: 'Main',
      current_class_stream: 'Grade 1 Main',
      academic_year: data.academic_year || new Date().getFullYear(),
      enrollment_date: data.admission_date,
      admission_year: data.academic_year || new Date().getFullYear(),
      term: data.term || 1,
      upi_number: data.upi_number,
      status: data.status,
      is_active: data.status === 'Active',
      is_on_transport: data.is_on_transport || false,
      stream: 'Main', // Add default stream value
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
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    console.log('User authenticated:', user.id);
    
    // Get user's school ID
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    console.log('User school ID:', schoolId);
    
    if (!schoolId) {
      throw new Error('User does not have a school assigned');
    }
    
    // Generate admission number - the database will do this automatically
    const insertData = {
      school_id: schoolId,
      full_name: studentData.full_name,
      gender: studentData.gender,
      date_of_birth: studentData.date_of_birth,
      guardian_name: studentData.guardian_name,
      guardian_phone: studentData.guardian_phone,
      guardian_email: studentData.guardian_email || '',
      guardian_relationship: studentData.guardian_relationship,
      current_class_id: studentData.current_class ? parseInt(studentData.current_class) : null,
      current_stream_id: studentData.current_stream ? parseInt(studentData.current_stream) : null,
      level: studentData.level,
      admission_year: studentData.academic_year || new Date().getFullYear(),
      is_on_transport: studentData.is_on_transport || false,
      is_active: studentData.is_active !== undefined ? studentData.is_active : true,
      photo: studentData.photo_url || null,
    };
    
    console.log('Inserting data:', insertData);
    
    const { data, error } = await supabase
      .from('students')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    
    console.log('Student created successfully:', data);
    
    // Split full_name into first and last name for return data
    const nameParts = data.full_name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || nameParts[0];
    
    return {
      id: data.id,
      admission_number: data.admission_number,
      level: data.level,
      full_name: data.full_name,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      guardian_name: data.guardian_name,
      guardian_phone: data.guardian_phone,
      guardian_email: data.guardian_email || '',
      guardian_relationship: data.guardian_relationship,
      current_class: data.current_class_id?.toString() || null,
      current_stream: data.current_stream_id?.toString() || null,
      current_class_name: studentData.current_class_name,
      current_stream_name: studentData.current_stream_name,
      current_class_stream: studentData.current_class_stream || '',
      academic_year: data.admission_year,
      enrollment_date: new Date().toISOString().split('T')[0],
      admission_year: data.admission_year,
      term: studentData.term || 1,
      upi_number: undefined,
      status: data.is_active ? 'active' : 'inactive',
      is_active: data.is_active,
      is_on_transport: data.is_on_transport,
      stream: studentData.stream || 'Main',
      photo_url: data.photo || null,
      photo: data.photo || null,
      address: undefined,
      phone: undefined,
      email: undefined,
      medical_conditions: undefined,
      emergency_contact: undefined,
      emergency_phone: undefined,
      previous_school: undefined,
      created_at: data.created_at,
      updated_at: data.updated_at
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
    const { data, error } = await supabase
      .from('students')
      .update({
        first_name: studentData.first_name,
        last_name: studentData.last_name,
        date_of_birth: studentData.date_of_birth,
        gender: studentData.gender,
        guardian_name: studentData.guardian_name,
        guardian_phone: studentData.guardian_phone,
        guardian_email: studentData.guardian_email,
        guardian_relationship: studentData.guardian_relationship,
        class_id: studentData.current_class ? studentData.current_class.toString() : null,
        level: studentData.level,
        academic_year: studentData.academic_year,
        upi_number: studentData.upi_number,
        status: studentData.status,
        is_on_transport: studentData.is_on_transport,
        photo_url: studentData.photo_url,
        address: studentData.address,
        phone: studentData.phone,
        email: studentData.email,
        medical_conditions: studentData.medical_conditions,
        emergency_contact: studentData.emergency_contact,
        emergency_phone: studentData.emergency_phone,
        previous_school: studentData.previous_school
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    
    if (!data) return null;
    
    return {
      id: data.id,
      admission_number: data.admission_number,
      level: data.level,
      full_name: `${data.first_name} ${data.last_name}`,
      first_name: data.first_name,
      last_name: data.last_name,
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      guardian_name: data.guardian_name,
      guardian_phone: data.guardian_phone,
      guardian_email: data.guardian_email || '',
      guardian_relationship: data.guardian_relationship,
      current_class: data.class_id || null,
      current_stream: data.class_id || null,
      current_class_name: 'Grade 1',
      current_stream_name: 'Main',
      current_class_stream: 'Grade 1 Main',
      academic_year: data.academic_year,
      enrollment_date: data.admission_date,
      admission_year: data.academic_year,
      term: data.term,
      upi_number: data.upi_number,
      status: data.status,
      is_active: data.status === 'Active',
      is_on_transport: data.is_on_transport,
      stream: 'Main',
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
  try {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting student:', error);
    return false;
  }
};

export const getStudentStats = async (): Promise<StudentStats> => {
  // TODO: Implement this function
  // const response = await api.get('/students/stats/');
  // const data = JSON.parse(response.data as string);
  // return data;
  return {
    total_students: 0,
    active_students: 0,
    male_students: 0,
    female_students: 0,
    students_by_class: {},
    students_by_status: {},
    enrollment_trend: [],
  };
};

export const bulkImportStudents = async (file: File): Promise<ImportResult> => {
  // TODO: Implement this function
  console.log(file);
  return {
    success: 0,
    errors: 0,
    warnings: 0,
    details: [],
  };
};

export const exportStudents = async (filters: StudentFilters = {}): Promise<Blob> => {
  // TODO: Implement this function
  console.log(filters);
  const csvContent = "id,name\n1,John Doe";
  return new Blob([csvContent], { type: 'text/csv' });
};

export const getImportTemplate = (): Blob => {
  // TODO: Implement this function
  const csvContent = "id,name\n1,John Doe";
  return new Blob([csvContent], { type: 'text/csv' });
};
