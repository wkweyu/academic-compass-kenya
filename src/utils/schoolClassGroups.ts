import { CLASS_GROUPS } from '@/types/class';

export type ManagedClassGroupValue = 'pre-primary' | 'primary' | 'junior-secondary' | 'senior-secondary';

export interface ManagedClassGroupOption {
  value: ManagedClassGroupValue;
  label: string;
  description: string;
}

export interface PredefinedClassTemplate {
  name: string;
  grade_level: number;
  description: string;
}

const MANAGED_CLASS_GROUP_ORDER: ManagedClassGroupValue[] = [
  'pre-primary',
  'primary',
  'junior-secondary',
  'senior-secondary',
];

const MANAGED_CLASS_GROUP_LABELS: Record<ManagedClassGroupValue, string> = {
  'pre-primary': 'Pre-Primary',
  primary: 'Primary',
  'junior-secondary': 'Junior Secondary',
  'senior-secondary': 'Senior Secondary',
};

const LEGACY_TYPE_ALIASES: Record<string, ManagedClassGroupValue> = {
  'pre primary': 'pre-primary',
  'pre-primary': 'pre-primary',
  preprimary: 'pre-primary',
  primary: 'primary',
  'primary school': 'primary',
  secondary: 'junior-secondary',
  'secondary school': 'junior-secondary',
  'junior secondary': 'junior-secondary',
  'junior-secondary': 'junior-secondary',
  'junior secondary school': 'junior-secondary',
  'senior secondary': 'senior-secondary',
  'senior-secondary': 'senior-secondary',
  'senior secondary school': 'senior-secondary',
};

const MERGED_TYPE_ALIASES: Record<string, ManagedClassGroupValue[]> = {
  mixed: ['primary', 'junior-secondary'],
  'mixed (primary & secondary)': ['primary', 'junior-secondary'],
  'mixed primary & secondary': ['primary', 'junior-secondary'],
  'primary-secondary': ['primary', 'junior-secondary'],
  'primary and junior secondary': ['primary', 'junior-secondary'],
  'pre-primary and primary': ['pre-primary', 'primary'],
};

const PREDEFINED_CLASS_PREFIX: Record<Exclude<ManagedClassGroupValue, 'pre-primary'>, string> = {
  primary: 'Primary',
  'junior-secondary': 'Junior Secondary',
  'senior-secondary': 'Senior Secondary',
};

export const MANAGED_CLASS_GROUP_OPTIONS: ManagedClassGroupOption[] = [
  {
    value: 'pre-primary',
    label: 'Pre-Primary',
    description: 'Use when the school also manages playgroup, PP1, or PP2. This is stored safely without changing the working grade-based class logic.',
  },
  {
    value: 'primary',
    label: 'Primary',
    description: 'Uses the existing grade-based setup for Grade 1 to Grade 6.',
  },
  {
    value: 'junior-secondary',
    label: 'Junior Secondary',
    description: 'Uses the existing grade-based setup for Grade 7 to Grade 9.',
  },
  {
    value: 'senior-secondary',
    label: 'Senior Secondary',
    description: 'Uses the existing grade-based setup for Grade 10 to Grade 12.',
  },
];

const uniqueOrderedGroups = (groups: ManagedClassGroupValue[]) => {
  const uniqueGroups = new Set(groups);
  return MANAGED_CLASS_GROUP_ORDER.filter((group) => uniqueGroups.has(group));
};

export const normalizeManagedClassGroup = (value?: string | null): ManagedClassGroupValue | null => {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (LEGACY_TYPE_ALIASES[normalized]) {
    return LEGACY_TYPE_ALIASES[normalized];
  }

  if (normalized.includes('pre') && normalized.includes('primary')) return 'pre-primary';
  if (normalized.includes('senior') && normalized.includes('secondary')) return 'senior-secondary';
  if (normalized.includes('junior') && normalized.includes('secondary')) return 'junior-secondary';
  if (normalized.includes('secondary')) return 'junior-secondary';
  if (normalized.includes('primary')) return 'primary';

  return null;
};

export const normalizeManagedClassGroups = (
  values?: Array<string | null | undefined> | string | null,
  fallbackType?: string | null,
): ManagedClassGroupValue[] => {
  const rawValues = Array.isArray(values)
    ? values
    : typeof values === 'string' && values.trim().length > 0
      ? [values]
      : [];

  const expandedValues = rawValues.flatMap((value) => {
    const normalized = value?.trim().toLowerCase();
    if (normalized && MERGED_TYPE_ALIASES[normalized]) {
      return MERGED_TYPE_ALIASES[normalized];
    }

    const singleValue = normalizeManagedClassGroup(value);
    return singleValue ? [singleValue] : [];
  });

  if (expandedValues.length > 0) {
    return uniqueOrderedGroups(expandedValues);
  }

  const fallbackMerged = fallbackType?.trim().toLowerCase();
  if (fallbackMerged && MERGED_TYPE_ALIASES[fallbackMerged]) {
    return uniqueOrderedGroups(MERGED_TYPE_ALIASES[fallbackMerged]);
  }

  const fallbackGroup = normalizeManagedClassGroup(fallbackType);
  return fallbackGroup ? [fallbackGroup] : [];
};

export const getManagedClassGroupLabel = (value?: string | null) => {
  const normalized = normalizeManagedClassGroup(value);
  return normalized ? MANAGED_CLASS_GROUP_LABELS[normalized] : value?.trim() || '';
};

export const getManagedClassGroupLabels = (values?: Array<string | null | undefined> | string | null, fallbackType?: string | null) => {
  return normalizeManagedClassGroups(values, fallbackType).map((group) => MANAGED_CLASS_GROUP_LABELS[group]);
};

export const getLegacySchoolTypeFromManagedClassGroups = (
  values?: Array<string | null | undefined> | string | null,
  fallbackType?: string | null,
) => {
  const normalizedGroups = normalizeManagedClassGroups(values, fallbackType);

  if (normalizedGroups.length === 0) {
    return getManagedClassGroupLabel(fallbackType);
  }

  if (normalizedGroups.length === 1) {
    return MANAGED_CLASS_GROUP_LABELS[normalizedGroups[0]];
  }

  if (normalizedGroups.includes('primary')) {
    return MANAGED_CLASS_GROUP_LABELS.primary;
  }

  const firstAcademicGroup = normalizedGroups.find((group) => group !== 'pre-primary');
  return MANAGED_CLASS_GROUP_LABELS[firstAcademicGroup || normalizedGroups[0]];
};

export const hasManagedClassGroupConfiguration = (profile?: {
  managed_class_groups?: Array<string | null | undefined> | null;
  type?: string | null;
} | null) => {
  return normalizeManagedClassGroups(profile?.managed_class_groups ?? null, profile?.type).length > 0;
};

export const hasOnlyPrePrimaryManagedClassGroups = (
  values?: Array<string | null | undefined> | string | null,
  fallbackType?: string | null,
) => {
  const groups = normalizeManagedClassGroups(values, fallbackType);
  return groups.length > 0 && groups.every((group) => group === 'pre-primary');
};

export const getManagedClassGroupSummary = (profile?: {
  managed_class_groups?: Array<string | null | undefined> | null;
  type?: string | null;
} | null) => {
  const labels = getManagedClassGroupLabels(profile?.managed_class_groups ?? null, profile?.type);
  return labels.join(', ');
};

export const getPredefinedClassTemplatesForManagedGroups = (
  values?: Array<string | null | undefined> | string | null,
  fallbackType?: string | null,
): PredefinedClassTemplate[] => {
  const groups = normalizeManagedClassGroups(values, fallbackType);
  const templates: PredefinedClassTemplate[] = [];
  const seenLevels = new Set<number>();

  groups.forEach((group) => {
    if (group === 'pre-primary') {
      return;
    }

    const classGroup = CLASS_GROUPS.find((item) => item.value === group);
    const prefix = PREDEFINED_CLASS_PREFIX[group];
    if (!classGroup || !prefix) {
      return;
    }

    classGroup.levels.forEach((level) => {
      if (seenLevels.has(level)) {
        return;
      }

      seenLevels.add(level);
      templates.push({
        name: `${prefix} Grade ${level}`,
        grade_level: level,
        description: `${prefix} School Grade ${level}`,
      });
    });
  });

  return templates.sort((left, right) => left.grade_level - right.grade_level);
};
