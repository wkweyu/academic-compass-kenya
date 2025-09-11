import { NavLink, useLocation } from "react-router-dom";
import { 
  BookOpen, 
  ClipboardList, 
  GraduationCap, 
  BarChart3, 
  FileText,
  Users,
  UserCheck,
  Settings,
  School
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
];

const staffNavigation = [
  { id: 'teachers', title: 'Staff & Teachers', url: '/teachers', icon: UserCheck },
];

const academicNavigation = [
  { id: 'exams', title: 'Exam Management', url: '/exams', icon: ClipboardList },
  { id: 'subjects', title: 'Subject Management', url: '/subjects', icon: BookOpen },
  { id: 'scores', title: 'Score Entry', url: '/scores', icon: FileText },
  { id: 'results', title: 'Student Results', url: '/results', icon: GraduationCap },
];

const systemNavigation = [
  { id: 'settings', title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center w-full ${isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"}`;

  const renderNavGroup = (items: typeof mainNavigation, label: string) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton asChild>
                <NavLink 
                  to={item.url} 
                  className={getNavCls}
                  end
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
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
              <p className="text-sm text-muted-foreground">Academic Year 2024</p>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        {renderNavGroup(mainNavigation, "Overview")}
        {renderNavGroup(studentNavigation, "Student Management")}
        {renderNavGroup(staffNavigation, "Staff Management")}
        {renderNavGroup(academicNavigation, "Academic")}
        {renderNavGroup(systemNavigation, "System")}

        {/* Footer */}
        {!collapsed && (
          <div className="mt-auto p-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">Current Term</p>
              <p className="text-xs text-muted-foreground">Term 2, 2024</p>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}