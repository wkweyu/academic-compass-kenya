import { TermSetting, SchoolProfile, AcademicYearSetting, SystemSettings, GradingSystemSettings } from '@/types/settings';

// Mock data for development
const mockTermSettings: TermSetting[] = [
  {
    id: 1,
    school: 1,
    year: 2024,
    term: 1,
    start_date: '2024-01-08',
    end_date: '2024-04-05',
  },
  {
    id: 2,
    school: 1,
    year: 2024,
    term: 2,
    start_date: '2024-05-06',
    end_date: '2024-08-23',
  },
  {
    id: 3,
    school: 1,
    year: 2024,
    term: 3,
    start_date: '2024-09-09',
    end_date: '2024-11-08',
  },
  {
    id: 4,
    school: 1,
    year: 2025,
    term: 1,
    start_date: '2025-01-06',
    end_date: '2025-04-04',
  },
];

const mockSchoolProfile: SchoolProfile = {
  id: 1,
  name: 'Greenfield Primary School',
  code: 'SCH0001',
  address: '123 Education Lane, Nairobi, Kenya',
  phone: '+254 700 123 456',
  email: 'info@greenfieldprimary.ac.ke',
  logo: '',
  active: true,
  created_at: '2024-01-01T00:00:00Z',
};

const mockAcademicYears: AcademicYearSetting[] = [
  {
    id: 1,
    year: 2024,
    is_current: true,
    start_date: '2024-01-08',
    end_date: '2024-11-08',
  },
  {
    id: 2,
    year: 2025,
    is_current: false,
    start_date: '2025-01-06',
    end_date: '2025-11-07',
  },
];

const mockSystemSettings: SystemSettings = {
  default_currency: 'KSH',
  late_payment_penalty_rate: 5,
  auto_generate_invoices: true,
  mpesa_integration_enabled: true,
  backup_frequency: 'daily',
  session_timeout_minutes: 30,
};

const mockGradingSettings: GradingSystemSettings = {
  grading_system: 'CBC',
  pass_mark: 50,
  grade_boundaries: {
    A: 80,
    B: 70,
    C: 60,
    D: 50,
    E: 40,
  },
};

export const settingsService = {
  // Term Settings
  getTermSettings: async (): Promise<TermSetting[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockTermSettings;
  },

  createTermSetting: async (termSetting: Omit<TermSetting, 'id'>): Promise<TermSetting> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newSetting = { ...termSetting, id: Date.now() };
    mockTermSettings.push(newSetting);
    return newSetting;
  },

  updateTermSetting: async (id: number, termSetting: Partial<TermSetting>): Promise<TermSetting> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = mockTermSettings.findIndex(t => t.id === id);
    if (index !== -1) {
      mockTermSettings[index] = { ...mockTermSettings[index], ...termSetting };
      return mockTermSettings[index];
    }
    throw new Error('Term setting not found');
  },

  deleteTermSetting: async (id: number): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const index = mockTermSettings.findIndex(t => t.id === id);
    if (index !== -1) {
      mockTermSettings.splice(index, 1);
    }
  },

  // School Profile
  getSchoolProfile: async (): Promise<SchoolProfile> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockSchoolProfile;
  },

  updateSchoolProfile: async (profile: Partial<SchoolProfile>): Promise<SchoolProfile> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    Object.assign(mockSchoolProfile, profile);
    return mockSchoolProfile;
  },

  // Academic Years
  getAcademicYears: async (): Promise<AcademicYearSetting[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockAcademicYears;
  },

  getCurrentAcademicYear: async (): Promise<AcademicYearSetting | null> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockAcademicYears.find(year => year.is_current) || null;
  },

  setCurrentAcademicYear: async (yearId: number): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    mockAcademicYears.forEach(year => {
      year.is_current = year.id === yearId;
    });
  },

  // System Settings
  getSystemSettings: async (): Promise<SystemSettings> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockSystemSettings;
  },

  updateSystemSettings: async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    Object.assign(mockSystemSettings, settings);
    return mockSystemSettings;
  },

  // Grading System Settings
  getGradingSettings: async (): Promise<GradingSystemSettings> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockGradingSettings;
  },

  updateGradingSettings: async (settings: Partial<GradingSystemSettings>): Promise<GradingSystemSettings> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    Object.assign(mockGradingSettings, settings);
    return mockGradingSettings;
  },

  // Utility functions
  getCurrentTerm: (): { term: number; year: number } | null => {
    const currentDate = new Date();
    const currentTermSetting = mockTermSettings.find(term => {
      const startDate = new Date(term.start_date);
      const endDate = new Date(term.end_date);
      return currentDate >= startDate && currentDate <= endDate;
    });

    return currentTermSetting 
      ? { term: currentTermSetting.term, year: currentTermSetting.year }
      : null;
  },
};