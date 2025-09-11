// Guardian Management Types

export interface Guardian {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  national_id?: string;
  occupation?: string;
  
  // Relationship tracking
  students: string[]; // Array of student IDs
  primary_relationship: string; // Most common relationship (Parent, Father, Mother, etc.)
  
  // Contact preferences
  preferred_contact_method: 'phone' | 'email' | 'sms';
  emergency_contact: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

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

export const GUARDIAN_CONTACT_METHODS = [
  { value: 'phone', label: 'Phone Call' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
];

// Import Student type
import { Student } from './student';