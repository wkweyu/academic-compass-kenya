import { Outlet } from 'react-router-dom';
import { TopNavBar } from '@/components/layout/TopNavBar';

interface MainLayoutProps {
  children?: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <TopNavBar />
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-3 px-4 lg:px-8 print:hidden">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} SkoolTrack Pro</span>
          <span>School Management System</span>
        </div>
      </footer>
    </div>
  );
}