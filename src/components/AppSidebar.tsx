import { NavLink } from "react-router-dom";
import { TermManager } from "@/utils/termManager";
import { useAuth } from "@/hooks/useAuth";
import { getVisibleNavGroups, navGroups, type NavItem } from '@/lib/navigationConfig';
import { GraduationCap } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const { hasAnyRole } = useAuth();
  const collapsed = state === "collapsed";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center w-full ${isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"}`;

  const visibleGroups = getVisibleNavGroups(navGroups, hasAnyRole);

  const renderNavGroup = (items: NavItem[], label: string) => {
    if (items.length === 0) {
      return null;
    }

    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const visibleSubItems = item.subItems ?? [];

              return item.subItems ? (
                <div key={item.id}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <div className="flex items-center w-full font-medium">
                        <item.icon className="h-4 w-4 mr-2" />
                        {!collapsed && <span>{item.title}</span>}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {visibleSubItems.map((subItem) => (
                    <SidebarMenuItem key={subItem.id} className="pl-6">
                      <SidebarMenuButton asChild>
                        <NavLink to={subItem.url} className={getNavCls} end>
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
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <div className={`flex items-center gap-2 p-4 ${collapsed ? 'justify-center' : ''}`}>
          <GraduationCap className="h-8 w-8 text-primary flex-shrink-0" />
          {!collapsed && (
            <div>
              <h1 className="text-lg font-semibold">CBC Exam System</h1>
              <p className="text-sm text-muted-foreground">Academic Year {TermManager.getCurrentYear()}</p>
            </div>
          )}
        </div>

        {visibleGroups.map((group) => renderNavGroup(group.items, group.label))}

        {!collapsed && (
          <div className="mt-auto p-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">Current Term</p>
              <p className="text-xs text-muted-foreground">Term {TermManager.getCurrentTerm()}, {TermManager.getCurrentYear()}</p>
              <p className="text-xs text-muted-foreground mt-1">Configure in Settings</p>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
