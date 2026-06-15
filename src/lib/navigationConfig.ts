/**
 * Central navigation and route permission configuration.
 *
 * - `navGroups` defines sidebar/top-nav entries and their role visibility.
 * - `ROUTE_PERMISSIONS` is derived from `navGroups` for route guards.
 * - `HIDDEN_ROUTE_PERMISSIONS` covers non-nav routes or dynamic paths.
 * - `appRoutes` exports path/component mappings for `<App />` routing.
 */
import { createElement, type ComponentType } from 'react';
import type { ElementType } from 'react';
import type { AppRole } from '@/lib/permissions';
import {
  BarChart3,
  MessageSquare,
  Users,
  School,
  TrendingUp,
  CalendarCheck,
  UserCheck,
  ClipboardList,
  BookOpen,
  Receipt,
  Truck,
  ShoppingCart,
  Sprout,
  DollarSign,
  CreditCard,
  Settings,
  CalendarDays,
  FileText,
  FileCheck,
  FileClock,
} from 'lucide-react';
import {
  ADMIN_ROLES,
  FINANCE_ROLES,
  TRANSPORT_ROLES,
  IGA_ROLES,
  SETTINGS_ROLES,
} from '@/lib/permissions';
import { Navigate } from 'react-router-dom';
import DashboardPage from '@/pages/DashboardPage';
import CommunicationsPage from '@/pages/CommunicationsPage';
import ExamsPage from '@/pages/ExamsPage';
import StudentsPage from '@/pages/StudentsPage';
import StudentProfilePage from '@/pages/StudentProfilePage';
import ClassesPage from '@/pages/ClassesPage';
import TeachersPage from '@/pages/TeachersPage';
import SubjectsPage from '@/pages/SubjectsPage';
import ScoresPage from '@/pages/ScoresPage';
import AttendancePage from '@/pages/AttendancePage';
import AttendanceReportsPage from '@/pages/AttendanceReportsPage';
import { BiometricIntegration } from '@/pages/Attendance/BiometricIntegration';
import { SmsIntegration } from '@/pages/Attendance/SmsIntegration';
import ResultsPage from '@/pages/ResultsPage';
import TermReportsPage from '@/pages/TermReportsPage';
import PaymentsPage from '@/pages/PaymentsPage';
import UnresolvedPaymentsPage from '@/pages/UnresolvedPaymentsPage';
import PaymentReportsPage from '@/pages/PaymentReportsPage';
import StudentStatementPage from '@/pages/StudentStatementPage';
import PromotionsPage from '@/pages/PromotionsPage';
import ComingSoonPage from '@/pages/ComingSoonPage';
import TransportPage from '@/pages/TransportPage';
import SettingsPage from '@/pages/SettingsPage';
import StaffProfilePage from '@/pages/StaffProfilePage';
import ProcurementPage from '@/pages/ProcurementPage';
import AccountingPage from '@/pages/AccountingPage';
import PayrollPage from '@/pages/PayrollPage';
import IGAPage from '@/pages/IGAPage';
import TimetablePage from '@/pages/TimetablePage';
import MyTimetablePage from '@/pages/MyTimetablePage';

export interface NavItem {
  id: string;
  title: string;
  url?: string;
  icon: ElementType;
  allowedRoles?: readonly AppRole[];
  subItems?: {
    id: string;
    title: string;
    url: string;
    icon?: ElementType;
    allowedRoles?: readonly AppRole[];
  }[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const filterNavItemsByRole = (
  items: NavItem[],
  hasAnyRole: (roles: AppRole[]) => boolean
): NavItem[] => {
  return items
    .map((item) => {
      const visibleSubItems = item.subItems?.filter((subItem) => {
        if (subItem.allowedRoles && subItem.allowedRoles.length > 0) {
          return hasAnyRole(subItem.allowedRoles);
        }
        return true;
      }) ?? [];

      const itemVisible =
        !(item.allowedRoles && item.allowedRoles.length > 0) ||
        hasAnyRole(item.allowedRoles);

      if (!itemVisible && visibleSubItems.length === 0) {
        return null;
      }

      return {
        ...item,
        subItems: visibleSubItems,
      };
    })
    .filter((item): item is NavItem => item !== null);
};

export const getVisibleNavGroups = (
  groups: NavGroup[],
  hasAnyRole: (roles: AppRole[]) => boolean
): NavGroup[] => {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItemsByRole(group.items, hasAnyRole),
    }))
    .filter((group) => group.items.length > 0);
};

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
      { id: 'communications', title: 'Communication', url: '/communications', icon: MessageSquare },
    ],
  },
  {
    label: 'Students',
    items: [
      { id: 'students', title: 'Students', url: '/students', icon: Users },
      { id: 'classes', title: 'Classes', url: '/classes', icon: School },
      { id: 'promotions', title: 'Promotions', url: '/promotions', icon: TrendingUp },
      {
        id: 'attendance',
        title: 'Attendance',
        icon: CalendarCheck,
        subItems: [
          { id: 'att-mark', title: 'Mark Attendance', url: '/attendance' },
          { id: 'att-reports', title: 'View Reports', url: '/attendance/reports' },
        ],
      },
      {
        id: 'timetable',
        title: 'Timetable',
        icon: CalendarDays,
        subItems: [
          { id: 'timetable-class', title: 'Class Timetable', url: '/timetable' },
          { id: 'timetable-teacher', title: 'Teacher Schedule', url: '/timetable/teacher' },
          { id: 'timetable-room', title: 'Special Rooms', url: '/timetable/room' },
          { id: 'timetable-periods', title: 'Periods & Calendar', url: '/timetable/periods' },
          { id: 'timetable-substitutions', title: 'Substitutions', url: '/timetable/substitutions' },
        ],
      },
    ],
  },
  {
    label: 'Staff',
    items: [
      {
        id: 'teachers',
        title: 'Staff & Teachers',
        icon: UserCheck,
        subItems: [
          { id: 'staff-all', title: 'All Staff', url: '/teachers' },
          { id: 'staff-assign', title: 'Assignments', url: '/teachers/assignments' },
          { id: 'staff-avail', title: 'Availability', url: '/teachers/availability' },
          { id: 'staff-work', title: 'Workload', url: '/teachers/workload' },
          { id: 'staff-att', title: 'Attendance', url: '/teachers/attendance' },
          { id: 'staff-leave', title: 'Leave Management', url: '/teachers/leave' },
          { id: 'staff-perf', title: 'Performance', url: '/teachers/performance' },
          { id: 'staff-rep', title: 'Reports', url: '/teachers/reports' },
        ],
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        id: 'exams',
        title: 'Exams',
        icon: ClipboardList,
        subItems: [
          { id: 'exam-sessions', title: 'Exam Sessions', url: '/exams' },
          { id: 'term-reports', title: 'Term Reports', url: '/term-reports' },
        ],
      },
      {
        id: 'subjects',
        title: 'Subjects',
        icon: BookOpen,
        subItems: [
          { id: 'subj-all', title: 'All Subjects', url: '/subjects' },
          { id: 'subj-cat', title: 'Categories', url: '/subjects/categories' },
          { id: 'subj-alloc', title: 'Class Allocations', url: '/subjects/allocations' },
        ],
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'payments', title: 'Payments', url: '/finance/payments', icon: Receipt, allowedRoles: FINANCE_ROLES },
      { id: 'payments-unresolved', title: 'Unresolved Payments', url: '/finance/payments/unresolved', icon: FileText, allowedRoles: FINANCE_ROLES },
      { id: 'payments-reports', title: 'Collections Reports', url: '/finance/payments/reports', icon: BarChart3, allowedRoles: FINANCE_ROLES },
      { id: 'student-statements', title: 'Student Statements', url: '/students', icon: FileText },
      { id: 'iga', title: 'IGA', url: '/iga', icon: Sprout, allowedRoles: IGA_ROLES },
      { id: 'payroll', title: 'Payroll', url: '/payroll', icon: DollarSign, allowedRoles: FINANCE_ROLES },
      { id: 'accounting', title: 'Accounting', url: '/accounting', icon: CreditCard, allowedRoles: FINANCE_ROLES },
      { id: 'procurement', title: 'Procurement', url: '/procurement', icon: ShoppingCart, allowedRoles: FINANCE_ROLES },
      { id: 'transport', title: 'Transport', url: '/transport', icon: Truck, allowedRoles: TRANSPORT_ROLES },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings', title: 'Settings', url: '/settings', icon: Settings, allowedRoles: SETTINGS_ROLES },
    ],
  },
];

const deriveRoutePermissions = (groups: NavGroup[]) => {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => {
      const routes: Array<[string, readonly AppRole[]]> = [];

      if (item.url && item.allowedRoles && item.allowedRoles.length > 0) {
        routes.push([item.url, item.allowedRoles]);
      }

      if (item.subItems) {
        item.subItems.forEach((subItem) => {
          if (subItem.url && subItem.allowedRoles && subItem.allowedRoles.length > 0) {
            routes.push([subItem.url, subItem.allowedRoles]);
          }
        });
      }

      return routes;
    })
  ).reduce<Record<string, readonly AppRole[]>>((map, [url, roles]) => {
    map[url] = roles;
    return map;
  }, {});
};

export const ROUTE_PERMISSIONS = deriveRoutePermissions(navGroups);

// Explicit permission rules for routes that do not appear in the main navGroups.
// This keeps UI visibility rules and route guard rules aligned, while allowing
// unlinked or dynamic routes to still be protected centrally.
const HIDDEN_ROUTE_PERMISSIONS: Record<string, readonly AppRole[]> = {
  '/attendance/biometric': ADMIN_ROLES,
  '/attendance/sms': ADMIN_ROLES,
  '/students/:id': ROUTE_PERMISSIONS['/students'] ?? [],
  '/students/:id/statement': ROUTE_PERMISSIONS['/students'] ?? [],
  '/teachers/:id': ROUTE_PERMISSIONS['/teachers'] ?? [],
  '/results': ROUTE_PERMISSIONS['/exams'] ?? [],
  '/scores': ROUTE_PERMISSIONS['/exams'] ?? [],
  '/my-timetable': [], // student-facing authenticated route, no special role required
  '/grading': ADMIN_ROLES,
};

const getRoutePermissionsForPath = (path: string): readonly AppRole[] | undefined => {
  // First honor explicit hidden-route mappings.
  if (path in HIDDEN_ROUTE_PERMISSIONS) {
    return HIDDEN_ROUTE_PERMISSIONS[path];
  }

  // Then exact nav route permissions.
  if (ROUTE_PERMISSIONS[path]) {
    return ROUTE_PERMISSIONS[path];
  }

  const matchingRoute = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => route !== '/' && (path === route || path.startsWith(`${route}/`)))
    .sort((a, b) => b.length - a.length)[0];

  return matchingRoute ? ROUTE_PERMISSIONS[matchingRoute] : undefined;
};

const RedirectToDashboard: ComponentType = () =>
  createElement(Navigate, { to: '/dashboard', replace: true });

export interface AppRouteDefinition {
  path: string;
  component: ComponentType;
  requiredRoles?: readonly AppRole[];
}

const appRouteDefinitions: AppRouteDefinition[] = [
  { path: '/', component: RedirectToDashboard },
  { path: '/dashboard', component: DashboardPage },
  { path: '/communications', component: CommunicationsPage },
  { path: '/exams', component: ExamsPage },
  { path: '/exams/types', component: ExamsPage },
  { path: '/exams/register', component: ExamsPage },
  { path: '/exams/marks', component: ExamsPage },
  { path: '/exams/merit', component: ExamsPage },
  { path: '/exams/analysis', component: ExamsPage },
  { path: '/exams/reports', component: ExamsPage },
  { path: '/students', component: StudentsPage },
  { path: '/students/:id', component: StudentProfilePage },
  { path: '/students/:id/statement', component: StudentStatementPage },
  { path: '/classes', component: ClassesPage },
  { path: '/teachers', component: TeachersPage },
  { path: '/teachers/assignments', component: TeachersPage },
  { path: '/teachers/availability', component: TeachersPage },
  { path: '/teachers/workload', component: TeachersPage },
  { path: '/teachers/attendance', component: TeachersPage },
  { path: '/teachers/leave', component: TeachersPage },
  { path: '/teachers/performance', component: TeachersPage },
  { path: '/teachers/reports', component: TeachersPage },
  { path: '/teachers/:id', component: StaffProfilePage },
  { path: '/subjects', component: SubjectsPage },
  { path: '/subjects/categories', component: SubjectsPage },
  { path: '/subjects/allocations', component: SubjectsPage },
  { path: '/scores', component: ScoresPage },
  { path: '/results', component: ResultsPage },
  { path: '/term-reports', component: TermReportsPage },
  { path: '/promotions', component: PromotionsPage },
  { path: '/finance/payments', component: PaymentsPage },
  { path: '/finance/payments/unresolved', component: UnresolvedPaymentsPage },
  { path: '/finance/payments/reports', component: PaymentReportsPage },
  { path: '/attendance', component: AttendancePage },
  { path: '/attendance/reports', component: AttendanceReportsPage },
  { path: '/attendance/biometric', component: BiometricIntegration },
  { path: '/attendance/sms', component: SmsIntegration },
  { path: '/timetable', component: TimetablePage },
  { path: '/timetable/teacher', component: TimetablePage },
  { path: '/timetable/room', component: TimetablePage },
  { path: '/timetable/periods', component: TimetablePage },
  { path: '/timetable/substitutions', component: TimetablePage },
  { path: '/my-timetable', component: MyTimetablePage },
  { path: '/grading', component: ComingSoonPage },
  { path: '/transport', component: TransportPage },
  { path: '/procurement', component: ProcurementPage },
  { path: '/iga', component: IGAPage },
  { path: '/payroll', component: PayrollPage },
  { path: '/accounting', component: AccountingPage },
  { path: '/settings', component: SettingsPage },
];

export const appRoutes: AppRouteDefinition[] = appRouteDefinitions.map((route) => ({
  ...route,
  requiredRoles: getRoutePermissionsForPath(route.path),
}));
