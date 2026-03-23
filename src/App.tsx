import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import '@/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import { OrganizationProvider } from '@/hooks/useOrganizations';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute';
import { RequireOrganization } from '@/components/RequireOrganization';
import { RequirePremium } from '@/components/RequirePremium';
import { ForceDarkTheme } from '@/components/ForceDarkTheme';
import { ScrollToTop } from '@/components/ScrollToTop';
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
import PricingPage from "./pages/PricingPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import RefundPage from "./pages/RefundPage";
import BillingCheckoutPage from "./pages/BillingCheckoutPage";
import BillingSuccessPage from "./pages/BillingSuccessPage";
import BillingCancelPage from "./pages/BillingCancelPage";
import LocationDetailPage from "./pages/LocationDetailPage";
import QuizLocationsPage from "./pages/QuizLocationsPage";
import QuizMapPage from "./pages/QuizMapPage";
import UnsubscribePage from "./pages/UnsubscribePage";
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
        <OrganizationProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<ForceDarkTheme><LandingPage /></ForceDarkTheme>} />
            <Route path="/login" element={<ForceDarkTheme><PublicOnlyRoute><LoginPage /></PublicOnlyRoute></ForceDarkTheme>} />
            <Route path="/register" element={<ForceDarkTheme><PublicOnlyRoute><RegisterPage /></PublicOnlyRoute></ForceDarkTheme>} />
            <Route path="/forgot-password" element={<ForceDarkTheme><ForgotPasswordPage /></ForceDarkTheme>} />
            <Route path="/reset-password" element={<ForceDarkTheme><ResetPasswordPage /></ForceDarkTheme>} />
            <Route path="/terms" element={<ForceDarkTheme><TermsPage /></ForceDarkTheme>} />
            <Route path="/privacy" element={<ForceDarkTheme><PrivacyPage /></ForceDarkTheme>} />
            <Route path="/refund" element={<ForceDarkTheme><RefundPage /></ForceDarkTheme>} />
            <Route path="/billing/checkout" element={<ForceDarkTheme><BillingCheckoutPage /></ForceDarkTheme>} />
            <Route path="/billing/success" element={<ForceDarkTheme><BillingSuccessPage /></ForceDarkTheme>} />
            <Route path="/billing/cancel" element={<ForceDarkTheme><BillingCancelPage /></ForceDarkTheme>} />
            <Route path="/map" element={<QuizMapPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/quiz-map/:id" element={<LocationDetailPage />} />
            <Route path="/onboarding" element={<ForceDarkTheme><ProtectedRoute><OnboardingPage /></ProtectedRoute></ForceDarkTheme>} />
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
            <Route path="/dashboard/locations" element={<OrgRoute><QuizLocationsPage /></OrgRoute>} />
            <Route path="/dashboard/settings" element={<OrgRoute><SettingsPage /></OrgRoute>} />
            <Route path="/dashboard/pricing" element={<OrgRoute><PricingPage /></OrgRoute>} />
            <Route path="/dashboard/*" element={<OrgRoute><DashboardPage /></OrgRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </OrganizationProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
