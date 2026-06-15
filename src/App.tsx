import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import { MainLayout } from "./components/layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import SaaSLoginPage from "./pages/SaaSLoginPage";
import SaaSDashboardPage from "./pages/SaaSDashboardPage";
import NotFound from "./pages/NotFound";
import { appRoutes } from '@/lib/navigationConfig';

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/saas/login" element={<SaaSLoginPage />} />
              <Route path="/saas/dashboard" element={<SaaSDashboardPage />} />
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                {appRoutes.map(({ path, requiredRoles, component: RouteComponent }) => (
                  <Route
                    key={path}
                    path={path}
                    element={
                      requiredRoles ? (
                        <ProtectedRoute requiredRoles={requiredRoles}>
                          <RouteComponent />
                        </ProtectedRoute>
                      ) : (
                        <RouteComponent />
                      )
                    }
                  />
                ))}
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;