import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { PWAHandler } from "@/components/PWAHandler";
import { Loader2 } from "lucide-react";
import { useDomainCheck, CustomDomainRouter } from "@/components/DomainRouter";

// Lazy pages
const Landing = lazy(() => import("@/pages/Landing"));
const Auth = lazy(() => import("@/pages/Auth"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const DashboardOverview = lazy(() => import("@/pages/dashboard/Overview"));
const DashboardAppointments = lazy(() => import("@/pages/dashboard/Appointments"));
const DashboardServices = lazy(() => import("@/pages/dashboard/Services"));
const DashboardProfessionals = lazy(() => import("@/pages/dashboard/Professionals"));
const DashboardUnits = lazy(() => import("@/pages/dashboard/Units"));
const DashboardClients = lazy(() => import("@/pages/dashboard/Clients"));
const DashboardSettings = lazy(() => import("@/pages/dashboard/Settings"));
const DashboardPlans = lazy(() => import("@/pages/dashboard/SubscriptionPlans"));
const DashboardAnalytics = lazy(() => import("@/pages/dashboard/Analytics"));
const DashboardLoyalty = lazy(() => import("@/pages/dashboard/Loyalty"));
const DashboardSubscriptions = lazy(() => import("@/pages/dashboard/Subscriptions"));
const DashboardCheckIn = lazy(() => import("@/pages/dashboard/CheckIn"));
const DashboardReviews = lazy(() => import("@/pages/dashboard/Reviews"));
const DashboardNotifications = lazy(() => import("@/pages/dashboard/Notifications"));
const DashboardNotificationQueue = lazy(() => import("@/pages/dashboard/NotificationQueue"));
const DashboardAutomations = lazy(() => import("@/pages/dashboard/Automations"));
const DashboardIntegrations = lazy(() => import("@/pages/dashboard/Integrations"));
const DashboardStyleGallery = lazy(() => import("@/pages/dashboard/StyleGallery"));
const DashboardDemandForecast = lazy(() => import("@/pages/dashboard/DemandForecast"));
const DashboardRewards = lazy(() => import("@/pages/dashboard/Rewards"));
const DashboardSmartCampaigns = lazy(() => import("@/pages/dashboard/SmartCampaigns"));
const DashboardAIPower = lazy(() => import("@/pages/dashboard/AIPowerCenter"));
const DashboardSchedule = lazy(() => import("@/pages/dashboard/Schedule"));
const DashboardSEORanking = lazy(() => import("@/pages/AdminSEOSettings"));
const AIMarketing = lazy(() => import("@/pages/dashboard/AIMarketing"));
const BookingPage = lazy(() => import("@/pages/BookingPage"));
const ClientArea = lazy(() => import("@/pages/ClientArea"));
const PublicBusinessPage = lazy(() => import("@/pages/PublicBusinessPage"));
const PublicServicePage = lazy(() => import("@/pages/PublicServicePage"));
const CityServiceLandingPage = lazy(() => import("@/pages/CityServiceLandingPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const MyAppointments = lazy(() => import("@/pages/client/MyAppointments"));
const ClientLoyalty = lazy(() => import("@/pages/client/ClientLoyalty"));
const ClientSubscriptions = lazy(() => import("@/pages/client/ClientSubscriptions"));
const ClientReviews = lazy(() => import("@/pages/client/ClientReviews"));
const ClientProfile = lazy(() => import("@/pages/client/ClientProfile"));
const ClientPreferences = lazy(() => import("@/pages/client/ClientPreferences"));
const ClientNotifications = lazy(() => import("@/pages/client/ClientNotifications"));
const ClientHistory = lazy(() => import("@/pages/client/ClientHistory"));
const ClientRewards = lazy(() => import("@/pages/client/ClientRewards"));

// Admin Global
const GlobalAdminLayout = lazy(() => import("@/pages/global_admin/GlobalAdminLayout"));
const GlobalMetrics = lazy(() => import("@/pages/global_admin/GlobalMetrics"));
const GlobalObservability = lazy(() => import("@/pages/global_admin/GlobalObservability"));
const GlobalAutoHealing = lazy(() => import("@/pages/global_admin/GlobalAutoHealing"));
const GlobalLearning = lazy(() => import("@/pages/global_admin/GlobalLearning"));
const GlobalAdministrators = lazy(() => import("@/pages/global_admin/GlobalAdministrators"));

import GlobalAuditLogs from "@/pages/global_admin/GlobalAuditLogs";
import GlobalDatabase from "@/pages/global_admin/GlobalDatabase";
import GlobalTenants from "@/pages/global_admin/GlobalTenants";
import GlobalCoupons from "@/pages/global_admin/GlobalCoupons";
import GlobalSettings from "@/pages/global_admin/GlobalSettings";
import GlobalFeatures from "@/pages/global_admin/GlobalFeatures";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const AppContent = () => {
  const { loading, isCustomDomain, tenantSlug, error } = useDomainCheck();

  if (loading) {
    return <PageLoader />;
  }

  if (isCustomDomain) {
    if (tenantSlug) {
      return (
        <Suspense fallback={<PageLoader />}>
          <CustomDomainRouter tenantSlug={tenantSlug} />
        </Suspense>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Domínio Não Encontrado</h1>
        <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
        <a href="https://flowza.com" className="text-primary hover:underline">
          Criar um negócio no Flowza
        </a>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/b/:slug" element={<BookingPage />} />
        <Route path="/b/:slug/area" element={<ClientArea />} />

                {/* SUPER ADMIN DASHBOARD */}
                <Route path="/admin" element={<GlobalAdminLayout />}>
                  <Route index element={<GlobalMetrics />} />
                  <Route path="observability" element={<GlobalObservability />} />
                  <Route path="auto-healing" element={<GlobalAutoHealing />} />
                  <Route path="ai-learning" element={<GlobalLearning />} />
                  <Route path="users" element={<GlobalAdministrators />} />
                  <Route path="audit-logs" element={<GlobalAuditLogs />} />
                  <Route path="database" element={<GlobalDatabase />} />
                  <Route path="tenants" element={<GlobalTenants />} />
                  <Route path="coupons" element={<GlobalCoupons />} />
                  <Route path="settings" element={<GlobalSettings />} />
                  <Route path="features" element={<GlobalFeatures />} />
                </Route>

                {/* Business dashboard */}
                <Route path="/dashboard" element={<Dashboard />}>
                  <Route index element={<DashboardOverview />} />
                  <Route path="appointments" element={<DashboardAppointments />} />
                  <Route path="services" element={<DashboardServices />} />
                  <Route path="professionals" element={<DashboardProfessionals />} />
                  <Route path="units" element={<DashboardUnits />} />
                  <Route path="clients" element={<DashboardClients />} />
                  <Route path="checkin" element={<DashboardCheckIn />} />
                  <Route path="analytics" element={<DashboardAnalytics />} />
                  <Route path="loyalty" element={<DashboardLoyalty />} />
                  <Route path="subscriptions" element={<DashboardSubscriptions />} />
                  <Route path="reviews" element={<DashboardReviews />} />
                  <Route path="notifications" element={<DashboardNotifications />} />
                  <Route path="queue" element={<DashboardNotificationQueue />} />
                  <Route path="automations" element={<DashboardAutomations />} />
                  <Route path="integrations" element={<DashboardIntegrations />} />
                  <Route path="gallery" element={<DashboardStyleGallery />} />
                  <Route path="forecast" element={<DashboardDemandForecast />} />
                  <Route path="rewards" element={<DashboardRewards />} />
                  <Route path="ai-power" element={<DashboardAIPower />} />
                  <Route path="campaigns" element={<DashboardSmartCampaigns />} />
                  <Route path="schedule" element={<DashboardSchedule />} />
                  <Route path="settings" element={<DashboardSettings />} />
                  <Route path="plans" element={<DashboardPlans />} />
                  <Route path="seo" element={<DashboardSEORanking />} />
                  <Route path="marketing" element={<AIMarketing />} />
                </Route>

                {/* Client dashboard */}
                <Route path="/client" element={<ClientDashboard />}>
                  <Route index element={<MyAppointments />} />
                  <Route path="loyalty" element={<ClientLoyalty />} />
                  <Route path="subscriptions" element={<ClientSubscriptions />} />
                  <Route path="reviews" element={<ClientReviews />} />
                  <Route path="gallery" element={<DashboardStyleGallery />} />
                  <Route path="preferences" element={<ClientPreferences />} />
                  <Route path="notifications" element={<ClientNotifications />} />
                  <Route path="history" element={<ClientHistory />} />
                  <Route path="rewards" element={<ClientRewards />} />
                  <Route path="profile" element={<ClientProfile />} />
                </Route>

                {/* SEO Friendly Public Routes */}
                <Route path="/:businessSlug" element={<PublicBusinessPage />} />
                <Route path="/:businessSlug/:serviceSlug" element={<PublicServicePage />} />
                <Route path="/cidade/:city/:service" element={<CityServiceLandingPage />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BusinessProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PWAHandler />
            <AppContent />
          </BrowserRouter>
        </BusinessProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
