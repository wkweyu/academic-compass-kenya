// Guardian Management Types - Enhanced for Multiple Guardians per Student

export interface Guardian {
  id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name?: string; // Computed field
  relationship: string;
  phone: string;
  alt_phone?: string;
  email?: string;
  occupation?: string;
  employer?: string;
  work_phone?: string;
  national_id?: string;
  address?: string;
  residence?: string;
  is_primary: boolean;
  can_pick_student: boolean;
  receive_reports: boolean;
  receive_communications: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Legacy fields (for backward compatibility)
  name?: string; // Will be computed from first_name + last_name
  students?: string[] | any[];
  preferred_contact_method?: 'phone' | 'email' | 'sms';
  emergency_contact?: boolean;
}

export interface StudentGuardian {
  id: string;
  student_id: number;
  guardian_id: string;
  guardian?: Guardian;
  relationship: string;
  is_primary: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

// Legacy interface for backward compatibility
export interface GuardianStudent {
  student_id: string;
  guardian_id: string;
  relationship: string;
  is_primary_contact: boolean;
  can_pickup: boolean;
  emergency_contact: boolean;
}

export interface GuardianFilters {
  search?: string;
  phone?: string;
  has_multiple_children?: boolean;
  relationship?: string;
}

export interface SiblingGroup {
  guardian: Guardian;
  students: Student[];
  family_name?: string;
}

export const GUARDIAN_RELATIONSHIPS = [
  'Father',
  'Mother',
  'Parent',
  'Guardian',
  'Grandparent',
  'Uncle',
  'Aunt',
  'Sibling',
  'Other',
] as const;

export type GuardianRelationship = typeof GUARDIAN_RELATIONSHIPS[number];

export const GUARDIAN_CONTACT_METHODS = [
  { value: 'phone', label: 'Phone Call' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
];

// Import Student type
import { Student } from './student';