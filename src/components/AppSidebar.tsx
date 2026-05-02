import { NavLink, useLocation } from "react-router-dom";
import { TermManager } from "@/utils/termManager";
import { 
  BookOpen, 
  ClipboardList, 
  GraduationCap, 
  BarChart3, 
  FileText,
  Users,
  UserCheck,
  Settings,
  School,
  DollarSign,
  CreditCard,
  Receipt,
  TrendingUp,
  CalendarCheck,
  CalendarDays,
  Truck,
  ShoppingCart,
  Sprout,
  FileCheck,
  FileClock
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNavigation = [
  { id: 'dashboard', title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
];

const studentNavigation = [
  { id: 'students', title: 'Students', url: '/students', icon: Users },
  { id: 'classes', title: 'Classes', url: '/classes', icon: School },
  { id: 'promotions', title: 'Promotions', url: '/promotions', icon: TrendingUp },
  {
    id: 'attendance',
    title: 'Attendance',
    icon: CalendarCheck,
    subItems: [
      { id: 'attendance-marking', title: 'Mark Attendance', url: '/attendance' },
      { id: 'attendance-reports', title: 'View Reports', url: '/attendance/reports' },
    ]
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
    ]
  },
];

const staffNavigation = [
  {
    id: 'teachers',
    title: 'Staff & Teachers',
    icon: UserCheck,
    subItems: [
      { id: 'staff-list', title: 'All Staff', url: '/teachers' },
      { id: 'staff-assignments', title: 'Assignments', url: '/teachers/assignments' },
      { id: 'staff-availability', title: 'Availability', url: '/teachers/availability' },
      { id: 'staff-workload', title: 'Workload', url: '/teachers/workload' },
      { id: 'staff-attendance', title: 'Attendance', url: '/teachers/attendance' },
      { id: 'staff-leave', title: 'Leave Management', url: '/teachers/leave' },
      { id: 'staff-performance', title: 'Performance', url: '/teachers/performance' },
      { id: 'staff-reports', title: 'Reports', url: '/teachers/reports' },
    ]
  },
];

const academicNavigation = [
  {
    id: 'exams',
    title: 'Exam Management',
    icon: ClipboardList,
    subItems: [
      { id: 'exams-sessions', title: 'Exam Sessions', url: '/exams' },
      { id: 'term-reports', title: 'Term Reports', url: '/term-reports' },
    ]
  },
  {
    id: 'subjects',
    title: 'Subject Management',
    icon: BookOpen,
    subItems: [
      { id: 'subjects-list', title: 'All Subjects', url: '/subjects' },
      { id: 'subjects-categories', title: 'Categories', url: '/subjects/categories' },
      { id: 'subjects-allocations', title: 'Class Allocations', url: '/subjects/allocations' },
    ]
  },
];

const financeNavigation = [
  { id: 'fees', title: 'Fees Management', url: '/fees', icon: Receipt },
  { id: 'transport', title: 'Transport', url: '/transport', icon: Truck },
  { id: 'procurement', title: 'Procurement', url: '/procurement', icon: ShoppingCart },
  { id: 'iga', title: 'IGA Management', url: '/iga', icon: Sprout },
  { id: 'payroll', title: 'Payroll', url: '/payroll', icon: DollarSign },
  { id: 'accounting', title: 'Accounting', url: '/accounting', icon: CreditCard },
];

const systemNavigation = [
  { id: 'settings', title: 'System Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center w-full ${isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"}`;

  const renderNavGroup = (items: typeof studentNavigation, label: string) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) =>
            item.subItems ? (
              <div key={item.id}>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <div className="flex items-center w-full font-medium">
                      <item.icon className="h-4 w-4 mr-2" />
                      {!collapsed && <span>{item.title}</span>}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {item.subItems.map((subItem) => (
                  <SidebarMenuItem key={subItem.id} className="pl-6">
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={subItem.url}
                        className={getNavCls}
                        end
                      >
                        {!collapsed && <span>{subItem.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </div>
            ) : (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton asChild>
                  <NavLink to={item.url} className={getNavCls} end>
                    <item.icon className="h-4 w-4 mr-2" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        {/* Header */}
        <div className={`flex items-center gap-2 p-4 ${collapsed ? 'justify-center' : ''}`}>
          <GraduationCap className="h-8 w-8 text-primary flex-shrink-0" />
          {!collapsed && (
            <div>
              <h1 className="text-lg font-semibold">CBC Exam System</h1>
              <p className="text-sm text-muted-foreground">Academic Year {TermManager.getCurrentYear()}</p>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        {renderNavGroup(mainNavigation, "Overview")}
        {renderNavGroup(studentNavigation, "Student Management")}
        {renderNavGroup(staffNavigation, "Staff Management")}
        {renderNavGroup(academicNavigation, "Academic")}
        {renderNavGroup(financeNavigation, "Finance & Accounting")}
        {renderNavGroup(systemNavigation, "System")}

        {/* Footer */}
        {!collapsed && (
          <div className="mt-auto p-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">Current Term</p>
              <p className="text-xs text-muted-foreground">Term {TermManager.getCurrentTerm()}, {TermManager.getCurrentYear()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure in Settings
              </p>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}