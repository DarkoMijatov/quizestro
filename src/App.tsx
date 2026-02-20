import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import '@/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute';
import { RequireOrganization } from '@/components/RequireOrganization';
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import TeamsPage from "./pages/TeamsPage";
import CategoriesPage from "./pages/CategoriesPage";
import QuizzesPage from "./pages/QuizzesPage";
import CreateQuizPage from "./pages/CreateQuizPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const OrgRoute = ({ children }: { children: React.ReactNode }) => (
  <RequireOrganization>{children}</RequireOrganization>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<OrgRoute><DashboardPage /></OrgRoute>} />
            <Route path="/dashboard/teams" element={<OrgRoute><TeamsPage /></OrgRoute>} />
            <Route path="/dashboard/categories" element={<OrgRoute><CategoriesPage /></OrgRoute>} />
            <Route path="/dashboard/quizzes" element={<OrgRoute><QuizzesPage /></OrgRoute>} />
            <Route path="/dashboard/quizzes/new" element={<OrgRoute><CreateQuizPage /></OrgRoute>} />
            <Route path="/dashboard/*" element={<OrgRoute><DashboardPage /></OrgRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
