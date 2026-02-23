import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import '@/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute';
import { RequireOrganization } from '@/components/RequireOrganization';
import { RequirePremium } from '@/components/RequirePremium';
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import TeamsPage from "./pages/TeamsPage";
import TeamDetailPage from "./pages/TeamDetailPage";
import CategoriesPage from "./pages/CategoriesPage";
import CategoryDetailPage from "./pages/CategoryDetailPage";
import QuizzesPage from "./pages/QuizzesPage";
import CreateQuizPage from "./pages/CreateQuizPage";
import QuizDetailPage from "./pages/QuizDetailPage";
import LeaguesPage from "./pages/LeaguesPage";
import LeagueDetailPage from "./pages/LeagueDetailPage";
import QuestionBankPage from "./pages/QuestionBankPage";
import StatsPage from "./pages/StatsPage";
import MembersPage from "./pages/MembersPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const OrgRoute = ({ children }: { children: React.ReactNode }) => (
  <RequireOrganization>{children}</RequireOrganization>
);

const PremiumRoute = ({ children }: { children: React.ReactNode }) => (
  <RequireOrganization><RequirePremium>{children}</RequirePremium></RequireOrganization>
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
            <Route path="/dashboard/teams/:id" element={<OrgRoute><TeamDetailPage /></OrgRoute>} />
            <Route path="/dashboard/categories" element={<OrgRoute><CategoriesPage /></OrgRoute>} />
            <Route path="/dashboard/categories/:id" element={<OrgRoute><CategoryDetailPage /></OrgRoute>} />
            <Route path="/dashboard/quizzes" element={<OrgRoute><QuizzesPage /></OrgRoute>} />
            <Route path="/dashboard/quizzes/new" element={<OrgRoute><CreateQuizPage /></OrgRoute>} />
            <Route path="/dashboard/quizzes/:id" element={<OrgRoute><QuizDetailPage /></OrgRoute>} />
            <Route path="/dashboard/leagues" element={<PremiumRoute><LeaguesPage /></PremiumRoute>} />
            <Route path="/dashboard/leagues/:id" element={<PremiumRoute><LeagueDetailPage /></PremiumRoute>} />
            <Route path="/dashboard/questions" element={<PremiumRoute><QuestionBankPage /></PremiumRoute>} />
            <Route path="/dashboard/stats" element={<OrgRoute><StatsPage /></OrgRoute>} />
            <Route path="/dashboard/members" element={<OrgRoute><MembersPage /></OrgRoute>} />
            <Route path="/dashboard/settings" element={<OrgRoute><SettingsPage /></OrgRoute>} />
            <Route path="/dashboard/*" element={<OrgRoute><DashboardPage /></OrgRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
