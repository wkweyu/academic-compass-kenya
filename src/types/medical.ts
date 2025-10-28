// Medical Records Types

export interface MedicalRecord {
  id: string;
  student_id: number;
  record_type: MedicalRecordType;
  record_date: string;
  description: string;
  diagnosis?: string;
  treatment?: string;
  medication_prescribed?: string;
  dosage?: string;
  medical_officer?: string;
  facility?: string;
  temperature?: number;
  blood_pressure?: string;
  weight?: number;
  height?: number;
  follow_up_required: boolean;
  follow_up_date?: string;
  parent_notified: boolean;
  parent_notification_date?: string;
  doctor_certificate?: string;
  notes?: string;
  recorded_by?: number;
  created_at: string;
  updated_at: string;
}

export type MedicalRecordType =
  | 'checkup'
  | 'illness'
  | 'injury'
  | 'vaccination'
  | 'allergy'
  | 'chronic_condition'
  | 'medication'
  | 'sick_bay_visit'
  | 'emergency'
  | 'other';

export interface Vaccination {
  id: string;
  student_id: number;
  vaccine_name: string;
  vaccination_date: string;
  next_dose_date?: string;
  batch_number?: string;
  administered_by?: string;
  facility?: string;
  reaction?: string;
  certificate_number?: string;
  verified: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const MEDICAL_RECORD_TYPES: {
  value: MedicalRecordType;
  label: string;
  icon: string;
}[] = [
  { value: 'checkup', label: 'Regular Checkup', icon: '🩺' },
  { value: 'illness', label: 'Illness', icon: '🤒' },
  { value: 'injury', label: 'Injury', icon: '🤕' },
  { value: 'vaccination', label: 'Vaccination', icon: '💉' },
  { value: 'allergy', label: 'Allergy', icon: '🤧' },
  { value: 'chronic_condition', label: 'Chronic Condition', icon: '⚕️' },
  { value: 'medication', label: 'Medication', icon: '💊' },
  { value: 'sick_bay_visit', label: 'Sick Bay Visit', icon: '🛏️' },
  { value: 'emergency', label: 'Emergency', icon: '🚨' },
  { value: 'other', label: 'Other', icon: '📋' },
];
