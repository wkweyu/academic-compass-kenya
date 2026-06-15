export const APP_ROLES = [
  'superadmin',
  'schooladmin',
  'finance',
  'transport',
  'teacher',
  'parent',
  'support',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLES = {
  SUPERADMIN: 'superadmin' as const,
  SCHOOLADMIN: 'schooladmin' as const,
  FINANCE: 'finance' as const,
  TRANSPORT: 'transport' as const,
  TEACHER: 'teacher' as const,
  PARENT: 'parent' as const,
  SUPPORT: 'support' as const,
};

export const ADMIN_ROLES = [ROLES.SCHOOLADMIN, ROLES.SUPERADMIN] as const;
export const FINANCE_ROLES = [ROLES.FINANCE, ROLES.SCHOOLADMIN, ROLES.SUPERADMIN] as const;
export const TRANSPORT_ROLES = [ROLES.TRANSPORT, ROLES.SCHOOLADMIN, ROLES.SUPERADMIN] as const;
export const IGA_ROLES = ADMIN_ROLES;
export const SETTINGS_ROLES = ADMIN_ROLES;

export const isAuthorized = (
  roles: AppRole[],
  requiredRoles: readonly AppRole[]
) => requiredRoles.some((requiredRole) => roles.includes(requiredRole));
