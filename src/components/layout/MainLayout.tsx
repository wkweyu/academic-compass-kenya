import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  BookOpen, 
  ClipboardList, 
  GraduationCap, 
  BarChart3, 
  FileText,
  Users,
  UserCheck,
  Settings,
  Menu,
  School
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MainLayoutProps {
  children?: React.ReactNode; // children is no longer used, but kept for safety
}

const navigation = [
  { id: 'dashboard', name: 'Dashboard', icon: BarChart3, path: '/dashboard' },
  { id: 'students', name: 'Students', icon: Users, path: '/students' },
  { id: 'teachers', name: 'Teachers', icon: UserCheck, path: '/teachers' },
  { id: 'classes', name: 'Classes', icon: School, path: '/classes' },
  { id: 'exams', name: 'Exam Management', icon: ClipboardList, path: '/exams' },
  { id: 'subjects', name: 'Subject Management', icon: BookOpen, path: '/subjects' },
  { id: 'scores', name: 'Score Entry', icon: FileText, path: '/scores' },
  { id: 'results', name: 'Student Results', icon: GraduationCap, path: '/results' },
  { id: 'settings', name: 'Settings', icon: Settings, path: '/settings' },
];

export function MainLayout({ children }: MainLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const NavContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-6">
        <GraduationCap className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">CBC Exam System</h1>
          <p className="text-sm text-muted-foreground">Academic Year 2024</p>
        </div>
      </div>
      
      <Separator />
      
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `w-full justify-start gap-3 rounded-md px-3 py-2 flex items-center text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>
      
      <Separator />
      
      <div className="p-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm font-medium">Current Term</p>
          <p className="text-xs text-muted-foreground">Term 2, 2024</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r">
        <NavContent />
      </div>

      {/* Mobile Navigation */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden fixed top-4 left-4 z-50">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <NavContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="h-full p-6 pt-20 lg:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}