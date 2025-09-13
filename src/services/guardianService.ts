import { api } from "@/api/api";
import { Guardian, GuardianFilters, SiblingGroup } from '@/types/guardian';
import { Student } from '@/types/student';

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
    // TODO: Implement this function
    console.log(studentId);
    return [];
};

export const findPotentialSiblings = async (guardianName: string, guardianPhone: string): Promise<Guardian[]> => {
    // TODO: Implement this function
    console.log(guardianName, guardianPhone);
    return [];
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