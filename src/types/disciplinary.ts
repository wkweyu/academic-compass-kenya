// Disciplinary Records Types

export interface DisciplinaryRecord {
  id: string;
  student_id: number;
  incident_date: string;
  incident_type: IncidentType;
  severity: Severity;
  description: string;
  action_taken: ActionTaken;
  action_details?: string;
  reported_by?: number;
  witnesses?: string[];
  parent_notified: boolean;
  parent_notification_date?: string;
  follow_up_required: boolean;
  follow_up_date?: string;
  follow_up_notes?: string;
  resolved: boolean;
  resolved_date?: string;
  resolved_by?: number;
  academic_year: number;
  term: 1 | 2 | 3;
  created_at: string;
  updated_at: string;
}

export type IncidentType =
  | 'tardiness'
  | 'absence'
  | 'misconduct'
  | 'academic_dishonesty'
  | 'bullying'
  | 'violence'
  | 'theft'
  | 'substance_abuse'
  | 'dress_code'
  | 'disrespect'
  | 'vandalism'
  | 'other';

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export type ActionTaken =
  | 'verbal_warning'
  | 'written_warning'
  | 'detention'
  | 'suspension'
  | 'expulsion'
  | 'community_service'
  | 'counseling'
  | 'parent_conference'
  | 'other';

export const INCIDENT_TYPES: {
  value: IncidentType;
  label: string;
  icon: string;
}[] = [
  { value: 'tardiness', label: 'Tardiness', icon: '⏰' },
  { value: 'absence', label: 'Unexcused Absence', icon: '❌' },
  { value: 'misconduct', label: 'Misconduct', icon: '⚠️' },
  { value: 'academic_dishonesty', label: 'Academic Dishonesty', icon: '📝' },
  { value: 'bullying', label: 'Bullying', icon: '👊' },
  { value: 'violence', label: 'Violence', icon: '🥊' },
  { value: 'theft', label: 'Theft', icon: '🕵️' },
  { value: 'substance_abuse', label: 'Substance Abuse', icon: '🚫' },
  { value: 'dress_code', label: 'Dress Code Violation', icon: '👔' },
  { value: 'disrespect', label: 'Disrespect', icon: '😤' },
  { value: 'vandalism', label: 'Vandalism', icon: '🔨' },
  { value: 'other', label: 'Other', icon: '📋' },
];

export const SEVERITY_LEVELS: {
  value: Severity;
  label: string;
  color: string;
}[] = [
  { value: 'minor', label: 'Minor', color: 'bg-blue-100 text-blue-800' },
  { value: 'moderate', label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'serious', label: 'Serious', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

export const ACTIONS_TAKEN: {
  value: ActionTaken;
  label: string;
}[] = [
  { value: 'verbal_warning', label: 'Verbal Warning' },
  { value: 'written_warning', label: 'Written Warning' },
  { value: 'detention', label: 'Detention' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'expulsion', label: 'Expulsion' },
  { value: 'community_service', label: 'Community Service' },
  { value: 'counseling', label: 'Counseling' },
  { value: 'parent_conference', label: 'Parent Conference' },
  { value: 'other', label: 'Other' },
];
