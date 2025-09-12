export interface TermSetting {
  id?: number;
  school: number;
  year: number;
  term: 1 | 2 | 3;
  start_date: string;
  end_date: string;
}

export interface SchoolProfile {
  id: number;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  active: boolean;
  created_at: string;
}

export interface AcademicYearSetting {
  id?: number;
  year: number;
  is_current: boolean;
  start_date: string;
  end_date: string;
}

export interface SystemSettings {
  default_currency: string;
  late_payment_penalty_rate: number;
  auto_generate_invoices: boolean;
  mpesa_integration_enabled: boolean;
  backup_frequency: 'daily' | 'weekly' | 'monthly';
  session_timeout_minutes: number;
}

export interface GradingSystemSettings {
  grading_system: 'CBC' | 'Legacy';
  pass_mark: number;
  grade_boundaries: {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
  };
}