import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { TermManager } from '@/utils/termManager';
import { useAuth } from '@/hooks/useAuth';
import skooltrackLogo from '@/assets/skooltrack-logo.png';
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
  GraduationCap,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  Bell,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  title: string;
  url?: string;
  icon: React.ElementType;
  subItems?: { id: string; title: string; url: string; icon?: React.ElementType }[];
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
      { id: 'onboarding', title: 'Onboarding', url: '/onboarding', icon: GraduationCap },
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
      { id: 'fees', title: 'Fees', url: '/fees', icon: Receipt },
      { id: 'iga', title: 'IGA', url: '/iga', icon: Sprout },
      { id: 'payroll', title: 'Payroll', url: '/payroll', icon: DollarSign },
      { id: 'accounting', title: 'Accounting', url: '/accounting', icon: CreditCard },
      { id: 'procurement', title: 'Procurement', url: '/procurement', icon: ShoppingCart },
      { id: 'transport', title: 'Transport', url: '/transport', icon: Truck },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings', title: 'Settings', url: '/settings', icon: Settings },
    ],
  },
];

function NavDropdown({ label, items }: { label: string; items: NavItem[] }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const allUrls = items.flatMap(item =>
    item.subItems ? item.subItems.map(s => s.url) : item.url ? [item.url] : []
  );
  const isGroupActive = allUrls.some(url => location.pathname === url || location.pathname.startsWith(url + '/'));

  // Single items without dropdown
  if (items.length === 1 && !items[0].subItems && items[0].url) {
    const item = items[0];
    const Icon = item.icon;
    return (
      <NavLink
        to={item.url!}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors',
            isActive
              ? 'bg-nav-active text-white'
              : 'text-nav-foreground hover:bg-nav-hover hover:text-white'
          )
        }
        end={item.url === '/dashboard'}
      >
        <Icon className="h-4 w-4" />
        <span>{item.title}</span>
      </NavLink>
    );
  }

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        className={cn(
          'flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
          isGroupActive
            ? 'bg-nav-active text-white'
            : 'text-nav-foreground hover:bg-nav-hover hover:text-white'
        )}
        onClick={() => setOpen(!open)}
      >
        <span>{label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-lg shadow-elevated z-50 animate-slide-down">
          <div className="p-1.5">
            {items.map(item =>
              item.subItems ? (
                <div key={item.id}>
                  <div className="px-2.5 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.title}
                  </div>
                  {item.subItems.map(sub => (
                    <NavLink
                      key={sub.id}
                      to={sub.url}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-foreground hover:bg-muted'
                        )
                      }
                      end
                    >
                      <span>{sub.title}</span>
                    </NavLink>
                  ))}
                </div>
              ) : (
                <NavLink
                  key={item.id}
                  to={item.url!}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-muted'
                    )
                  }
                  end
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TopNavBar() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Main navigation bar */}
      <header className="bg-nav border-b border-nav-hover sticky top-0 z-50 print:hidden">
        {/* Top row: Brand + User */}
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          {/* Brand */}
          <NavLink to="/dashboard" className="flex items-center gap-2.5 text-white shrink-0">
            <img src={skooltrackLogo} alt="SkoolTrack Pro" className="h-8 w-auto rounded" />
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white leading-tight">SkoolTrack Pro</h1>
              <p className="text-[11px] text-nav-foreground/70 leading-tight">
                Term {TermManager.getCurrentTerm()}, {TermManager.getCurrentYear()}
              </p>
            </div>
          </NavLink>

          {/* Desktop nav items */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navGroups.map(group => (
              <NavDropdown key={group.label} label={group.label} items={group.items} />
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-nav-foreground hover:text-white hover:bg-nav-hover hidden sm:flex"
            >
              <Bell className="h-4.5 w-4.5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-nav-foreground hover:text-white hover:bg-nav-hover gap-2">
                  <div className="h-7 w-7 rounded-full bg-nav-active/30 border border-nav-foreground/20 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="hidden md:inline text-sm max-w-[160px] truncate">{user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">School Administrator</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-nav-foreground hover:text-white hover:bg-nav-hover"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile navigation overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="fixed top-14 left-0 right-0 bottom-0 overflow-y-auto bg-card border-t border-border animate-slide-down">
            <nav className="p-4 space-y-1">
              {navGroups.map(group => (
                <div key={group.label}>
                  <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </p>
                  {group.items.map(item =>
                    item.subItems ? (
                      <div key={item.id} className="space-y-0.5">
                        <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground">
                          <item.icon className="h-4 w-4" />
                          {item.title}
                        </div>
                        {item.subItems.map(sub => (
                          <NavLink
                            key={sub.id}
                            to={sub.url}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-2 pl-9 pr-3 py-2 text-sm rounded-md',
                                isActive
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              )
                            }
                            end
                          >
                            {sub.title}
                          </NavLink>
                        ))}
                      </div>
                    ) : (
                      <NavLink
                        key={item.id}
                        to={item.url!}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-2 px-3 py-2 text-sm rounded-md',
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-foreground hover:bg-muted'
                          )
                        }
                        end
                      >
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </NavLink>
                    )
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}