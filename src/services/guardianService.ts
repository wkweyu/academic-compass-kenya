// Guardian Service - Manages guardian records and sibling relationships
import { Guardian, GuardianStudent, GuardianFilters, SiblingGroup } from '@/types/guardian';
import { Student } from '@/types/student';

// Mock guardian data
const mockGuardians: Guardian[] = [
  {
    id: '1',
    name: 'Jane Doe',
    phone: '0722345678',
    email: 'jane.doe@example.com',
    address: '123 Main Street, Nairobi',
    national_id: '28765432',
    occupation: 'Teacher',
    students: ['1'],
    primary_relationship: 'Mother',
    preferred_contact_method: 'phone',
    emergency_contact: true,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Robert Smith',
    phone: '0733456789',
    email: 'robert.smith@example.com',
    address: '456 Oak Avenue, Nairobi',
    national_id: '29876543',
    occupation: 'Engineer',
    students: ['2'],
    primary_relationship: 'Father',
    preferred_contact_method: 'email',
    emergency_contact: true,
    created_at: '2024-01-20T09:00:00Z',
    updated_at: '2024-01-20T09:00:00Z',
  },
  {
    id: '3',
    name: 'Susan Johnson',
    phone: '0744567890',
    email: 'susan.johnson@example.com',
    address: '789 Pine Road, Nairobi',
    national_id: '30987654',
    occupation: 'Nurse',
    students: ['3'],
    primary_relationship: 'Mother',
    preferred_contact_method: 'phone',
    emergency_contact: true,
    created_at: '2023-01-10T08:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
  },
  {
    id: '4',
    name: 'Mary Johnson',
    phone: '0755123456',
    email: 'mary.johnson@example.com',
    address: '321 Elm Street, Nairobi',
    national_id: '31234567',
    occupation: 'Doctor',
    students: ['4', '5'],
    primary_relationship: 'Mother',
    preferred_contact_method: 'phone',
    emergency_contact: true,
    created_at: '2023-01-10T08:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
  },
];

const mockGuardianStudents: GuardianStudent[] = [
  { student_id: '1', guardian_id: '1', relationship: 'Mother', is_primary_contact: true, can_pickup: true, emergency_contact: true },
  { student_id: '2', guardian_id: '2', relationship: 'Father', is_primary_contact: true, can_pickup: true, emergency_contact: true },
  { student_id: '3', guardian_id: '3', relationship: 'Mother', is_primary_contact: true, can_pickup: true, emergency_contact: true },
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const findExistingGuardian = async (phone: string, email?: string): Promise<Guardian | null> => {
  await delay(200);
  
  return mockGuardians.find(guardian => 
    guardian.phone === phone || (email && guardian.email === email)
  ) || null;
};

export const createOrUpdateGuardian = async (guardianData: {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  national_id?: string;
  occupation?: string;
  relationship: string;
}, studentId: string): Promise<{ guardian: Guardian; isNew: boolean }> => {
  await delay(300);
  
  // Check if guardian already exists
  const existingGuardian = await findExistingGuardian(guardianData.phone, guardianData.email);
  
  if (existingGuardian) {
    // Update existing guardian
    const updatedGuardian: Guardian = {
      ...existingGuardian,
      name: guardianData.name, // Update name in case of changes
      email: guardianData.email || existingGuardian.email,
      address: guardianData.address || existingGuardian.address,
      national_id: guardianData.national_id || existingGuardian.national_id,
      occupation: guardianData.occupation || existingGuardian.occupation,
      students: [...existingGuardian.students, studentId].filter((id, index, arr) => arr.indexOf(id) === index), // Remove duplicates
      updated_at: new Date().toISOString(),
    };
    
    // Update in mock data
    const index = mockGuardians.findIndex(g => g.id === existingGuardian.id);
    if (index !== -1) {
      mockGuardians[index] = updatedGuardian;
    }
    
    // Add guardian-student relationship
    const existingRelation = mockGuardianStudents.find(
      gs => gs.guardian_id === existingGuardian.id && gs.student_id === studentId
    );
    
    if (!existingRelation) {
      mockGuardianStudents.push({
        student_id: studentId,
        guardian_id: existingGuardian.id,
        relationship: guardianData.relationship,
        is_primary_contact: true,
        can_pickup: true,
        emergency_contact: true,
      });
    }
    
    return { guardian: updatedGuardian, isNew: false };
  } else {
    // Create new guardian
    const newGuardian: Guardian = {
      id: (mockGuardians.length + 1).toString(),
      name: guardianData.name,
      phone: guardianData.phone,
      email: guardianData.email,
      address: guardianData.address,
      national_id: guardianData.national_id,
      occupation: guardianData.occupation,
      students: [studentId],
      primary_relationship: guardianData.relationship,
      preferred_contact_method: 'phone',
      emergency_contact: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    mockGuardians.push(newGuardian);
    
    // Add guardian-student relationship
    mockGuardianStudents.push({
      student_id: studentId,
      guardian_id: newGuardian.id,
      relationship: guardianData.relationship,
      is_primary_contact: true,
      can_pickup: true,
      emergency_contact: true,
    });
    
    return { guardian: newGuardian, isNew: true };
  }
};

export const getGuardianById = async (id: string): Promise<Guardian | null> => {
  await delay(200);
  return mockGuardians.find(g => g.id === id) || null;
};

export const getGuardianStudents = async (guardianId: string): Promise<Student[]> => {
  await delay(200);
  
  const guardian = mockGuardians.find(g => g.id === guardianId);
  if (!guardian) return [];
  
  // This would normally fetch students from the student service
  // For now, returning empty array as we'd need to import student service
  return [];
};

export const getSiblings = async (studentId: string): Promise<Student[]> => {
  await delay(200);
  
  // Find guardian-student relationships for this student
  const studentRelations = mockGuardianStudents.filter(gs => gs.student_id === studentId);
  
  if (studentRelations.length === 0) return [];
  
  // Find all other students with the same guardians
  const siblingIds = new Set<string>();
  
  for (const relation of studentRelations) {
    const siblingRelations = mockGuardianStudents.filter(
      gs => gs.guardian_id === relation.guardian_id && gs.student_id !== studentId
    );
    
    siblingRelations.forEach(sr => siblingIds.add(sr.student_id));
  }
  
  // This would normally fetch students from the student service
  // For now, returning empty array
  return [];
};

export const findPotentialSiblings = async (guardianName: string, guardianPhone: string): Promise<Guardian[]> => {
  await delay(200);
  
  // Search for guardians with matching name or phone
  const matches = mockGuardians.filter(guardian => 
    guardian.name.toLowerCase() === guardianName.toLowerCase() || 
    guardian.phone === guardianPhone
  );
  
  return matches;
};

export const getFamilyGroups = async (): Promise<SiblingGroup[]> => {
  await delay(300);
  
  const familyGroups: SiblingGroup[] = [];
  
  // Group guardians with multiple children
  for (const guardian of mockGuardians) {
    if (guardian.students.length > 1) {
      familyGroups.push({
        guardian,
        students: [], // Would fetch actual student data
        family_name: guardian.name.split(' ').pop(), // Use last name as family name
      });
    }
  }
  
  return familyGroups;
};

export const updateGuardianContactPreferences = async (
  guardianId: string, 
  preferences: {
    preferred_contact_method: 'phone' | 'email' | 'sms';
    emergency_contact: boolean;
  }
): Promise<Guardian | null> => {
  await delay(200);
  
  const index = mockGuardians.findIndex(g => g.id === guardianId);
  if (index === -1) return null;
  
  const updatedGuardian = {
    ...mockGuardians[index],
    ...preferences,
    updated_at: new Date().toISOString(),
  };
  
  mockGuardians[index] = updatedGuardian;
  return updatedGuardian;
};

export const searchGuardians = async (filters: GuardianFilters = {}): Promise<Guardian[]> => {
  await delay(300);
  
  let filteredGuardians = [...mockGuardians];
  
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredGuardians = filteredGuardians.filter(guardian =>
      guardian.name.toLowerCase().includes(searchTerm) ||
      guardian.phone.includes(searchTerm) ||
      (guardian.email && guardian.email.toLowerCase().includes(searchTerm))
    );
  }
  
  if (filters.phone) {
    filteredGuardians = filteredGuardians.filter(guardian =>
      guardian.phone.includes(filters.phone!)
    );
  }
  
  if (filters.has_multiple_children) {
    filteredGuardians = filteredGuardians.filter(guardian =>
      guardian.students.length > 1
    );
  }
  
  if (filters.relationship) {
    filteredGuardians = filteredGuardians.filter(guardian =>
      guardian.primary_relationship.toLowerCase().includes(filters.relationship!.toLowerCase())
    );
  }
  
  return filteredGuardians;
};