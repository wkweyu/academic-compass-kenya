// Student Document Types

export interface StudentDocument {
  id: string;
  student_id: number;
  document_type: DocumentType;
  document_name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  description?: string;
  uploaded_by?: number;
  is_verified: boolean;
  verified_by?: number;
  verified_at?: string;
  expiry_date?: string;
  document_number?: string;
  issuing_authority?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export type DocumentType = 
  | 'birth_certificate'
  | 'national_id'
  | 'passport'
  | 'medical_record'
  | 'report_card'
  | 'transfer_letter'
  | 'consent_form'
  | 'immunization_record'
  | 'photo'
  | 'other';

export const DOCUMENT_TYPES: {
  value: DocumentType;
  label: string;
  icon: string;
  requiresExpiry: boolean;
}[] = [
  { value: 'birth_certificate', label: 'Birth Certificate', icon: '📄', requiresExpiry: false },
  { value: 'national_id', label: 'National ID', icon: '🆔', requiresExpiry: true },
  { value: 'passport', label: 'Passport', icon: '🛂', requiresExpiry: true },
  { value: 'medical_record', label: 'Medical Record', icon: '🏥', requiresExpiry: false },
  { value: 'report_card', label: 'Report Card', icon: '📊', requiresExpiry: false },
  { value: 'transfer_letter', label: 'Transfer Letter', icon: '📝', requiresExpiry: false },
  { value: 'consent_form', label: 'Consent Form', icon: '✍️', requiresExpiry: false },
  { value: 'immunization_record', label: 'Immunization Record', icon: '💉', requiresExpiry: false },
  { value: 'photo', label: 'Photo', icon: '📷', requiresExpiry: false },
  { value: 'other', label: 'Other', icon: '📁', requiresExpiry: false },
];
