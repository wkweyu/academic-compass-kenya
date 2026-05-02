// @ts-nocheck
import { api } from "@/api/api";
import { Guardian, GuardianFilters, SiblingGroup } from '@/types/guardian';
import { Student } from '@/types/student';
import { supabase } from '@/integrations/supabase/client';

export const findExistingGuardian = async (phone: string, email?: string): Promise<Guardian | null> => {
    const response = await api.get('/guardians/find/', {phone, email});
    const data = response.data;
    return data.guardian;
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
    const response = await api.post('/guardians/create_or_update/', {guardianData, studentId});
    const data = response.data;
    return data;
};

export const getGuardianById = async (id: string): Promise<Guardian | null> => {
    const response = await api.get(`/guardians/${id}/`);
    const data = response.data;
    return data;
};

export const getGuardianStudents = async (guardianId: string): Promise<Student[]> => {
    const response = await api.get(`/guardians/${guardianId}/students/`);
    const data = response.data;
    return data;
};

export const getSiblings = async (studentId: string): Promise<Student[]> => {
    try {
        // First, get the student's guardian information
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('guardian_phone, guardian_email, guardian_name')
            .eq('id', studentId)
            .single();

        if (studentError || !student) {
            console.error('Error fetching student:', studentError);
            return [];
        }

        // Find all students with the same guardian phone or email (excluding the current student)
        const { data: siblings, error: siblingsError } = await supabase
            .from('students')
            .select('*')
            .neq('id', studentId)
            .or(`guardian_phone.eq.${student.guardian_phone},guardian_email.eq.${student.guardian_email}`)
            .eq('is_active', true);

        if (siblingsError) {
            console.error('Error fetching siblings:', siblingsError);
            return [];
        }

        return siblings || [];
    } catch (error) {
        console.error('Error in getSiblings:', error);
        return [];
    }
};

export const findPotentialSiblings = async (guardianName: string, guardianPhone: string): Promise<Guardian[]> => {
    try {
        // Validate inputs
        if (!guardianName || guardianName.trim().length < 3) {
            console.log('Guardian name too short, skipping sibling check');
            return [];
        }
        
        if (!guardianPhone || guardianPhone.trim().length < 10) {
            console.log('Guardian phone too short, skipping sibling check');
            return [];
        }

        console.log('Checking for potential siblings with:', { guardianName, guardianPhone });

        // Search for students with matching guardian phone or similar guardian name
        const { data: matchingStudents, error } = await supabase
            .from('students')
            .select('*')
            .or(`guardian_phone.eq.${guardianPhone},guardian_name.ilike.%${guardianName}%`)
            .eq('is_active', true)
            .limit(10);

        if (error) {
            console.error('Error finding potential siblings:', error);
            return [];
        }

        if (!matchingStudents || matchingStudents.length === 0) {
            console.log('No matching students found');
            return [];
        }

        console.log('Found matching students:', matchingStudents.length);

        // Transform students to guardian format with proper null checks
        const guardians: Guardian[] = matchingStudents
            .filter(student => student.guardian_name && student.guardian_phone) // Filter out students with missing guardian info
            .map(student => {
                const nameParts = (student.guardian_name || '').split(' ');
                return {
                    id: `guardian-${student.id}`,
                    first_name: nameParts[0] || '',
                    last_name: nameParts.slice(1).join(' ') || '',
                    name: student.guardian_name || '',
                    phone: student.guardian_phone || '',
                    email: student.guardian_email || '',
                    relationship: student.guardian_relationship || 'Parent',
                    address: '',
                    occupation: '',
                    students: [student], // Include the student in the guardian object
                    created_at: student.created_at,
                    updated_at: student.updated_at,
                };
            });

        // Remove duplicates based on phone number
        const uniqueGuardians = guardians.filter((guardian, index, self) =>
            index === self.findIndex((g) => g.phone === guardian.phone)
        );

        console.log('Unique guardians found:', uniqueGuardians.length);

        return uniqueGuardians;
    } catch (error) {
        console.error('Error in findPotentialSiblings:', error);
        return [];
    }
}

export const getFamilyGroups = async (): Promise<SiblingGroup[]> => {
    // TODO: Implement this function
    return [];
}

export const updateGuardianContactPreferences = async (
    guardianId: string,
    preferences: {
        preferred_contact_method: 'phone' | 'email' | 'sms';
        emergency_contact: boolean;
    }
): Promise<Guardian | null> => {
    const response = await api.patch(`/guardians/${guardianId}/`, preferences);
    const data = response.data;
    return data;
};

export const searchGuardians = async (filters: GuardianFilters = {}): Promise<Guardian[]> => {
    const response = await api.get('/guardians/', filters);
    const data = response.data;
    return data.results;
};