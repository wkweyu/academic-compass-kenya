import { useState } from 'react';
import { 
  BookOpen, 
  ClipboardList, 
  GraduationCap, 
  BarChart3, 
  FileText,
  Users,
  Settings,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

interface CBCLayoutProps {
  children: React.ReactNode;
  activeModule?: string;
  onModuleChange?: (module: string) => void;
}

const navigation = [
  { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
  { id: 'exams', name: 'Exam Management', icon: ClipboardList },
  { id: 'subjects', name: 'Subject Management', icon: BookOpen },
  { id: 'scores', name: 'Score Entry', icon: FileText },
  { id: 'results', name: 'Student Results', icon: GraduationCap },
  { id: 'students', name: 'Students', icon: Users },
  { id: 'settings', name: 'Settings', icon: Settings },
];

export function CBCLayout({ children, activeModule = 'dashboard', onModuleChange }: CBCLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleModuleClick = (moduleId: string) => {
    onModuleChange?.(moduleId);
    setIsMobileMenuOpen(false);
  };

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
          const isActive = activeModule === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => handleModuleClick(item.id)}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Button>
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
        <div className="h-full p-6">
          {children}
        </div>
      </main>
    </div>
  );
}