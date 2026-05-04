import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  LayoutDashboard, Calendar, Scissors, Users, MapPin, UserCircle, Settings, LogOut, Menu, X,
  BarChart3, Coins, CreditCard, ClipboardCheck, Star, Bell, Image, Activity, Gift, CalendarClock,
  Sparkles, Zap, Brain, ShieldCheck, MessageCircle, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HelpGuide } from "@/components/dashboard/HelpGuide";
import { UpgradeTrigger } from "@/components/dashboard/UpgradeTrigger";
import { PromoBanner } from "@/components/dashboard/PromoBanner";
import { WelcomeTrigger } from "@/components/dashboard/WelcomeTrigger";
import { InactivityTrigger } from "@/components/dashboard/InactivityTrigger";
import { BottomNav } from "@/components/dashboard/BottomNav";

import { useBusiness } from "@/contexts/BusinessContext";
import { PlanId } from "@/types";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Visão Geral", exact: true },
  { to: "/dashboard/appointments", icon: Calendar, label: "Agendamentos" },
  { to: "/dashboard/checkin", icon: ClipboardCheck, label: "Check-in" },
  { to: "/dashboard/services", icon: Scissors, label: "Serviços" },
  { to: "/dashboard/professionals", icon: Users, label: "Profissionais" },
  { to: "/dashboard/units", icon: MapPin, label: "Unidades" },
  { to: "/dashboard/clients", icon: UserCircle, label: "Clientes" },
  { to: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/dashboard/campaigns", icon: Sparkles, label: "Smart Campaigns" },
  { to: "/dashboard/loyalty", icon: Coins, label: "Fidelidade" },
  { to: "/dashboard/subscriptions", icon: CreditCard, label: "Assinaturas" },
  { to: "/dashboard/reviews", icon: Star, label: "Avaliações" },
  { to: "/dashboard/notifications", icon: Bell, label: "Notificações" },
  { to: "/dashboard/queue", icon: Activity, label: "Fila de Mensagens" },
  { to: "/dashboard/gallery", icon: Image, label: "Galeria" },
  { to: "/dashboard/forecast", icon: Activity, label: "Previsão" },
  { to: "/dashboard/ai-power", icon: Brain, label: "AI Power Center", highlight: true },
  { to: "/dashboard/rewards", icon: Gift, label: "Recompensas" },
  { to: "/dashboard/schedule", icon: CalendarClock, label: "Agenda & Horários" },
  { to: "/dashboard/marketing", icon: MessageCircle, label: "AI Marketing" },
  { to: "/dashboard/settings", icon: Settings, label: "Configurações" },
  { to: "/dashboard/plans", icon: Sparkles, label: "Planos & Upgrade", highlight: true },
];

const Dashboard = () => {
  const { user, loading: authLoading, signOut, isGlobalAdmin } = useAuth();
  const { plan } = useBusiness();
  const navigate = useNavigate();

  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    
    const fetchBiz = async () => {
      const bizQuery = query(collection(db, "businesses"), where("owner_id", "==", user.uid), limit(1));
      const bizSnap = await getDocs(bizQuery);
      if (!bizSnap.empty) {
        setBusinessName(bizSnap.docs[0].data().name);
      }
    };
    
    fetchBiz();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const bottomNavItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Início", exact: true },
    { to: "/dashboard/appointments", icon: Calendar, label: "Agendas" },
    { to: "/dashboard/schedule", icon: CalendarClock, label: "Horários" },
    { to: "/dashboard/clients", icon: UserCircle, label: "Clientes" },
    { to: "/dashboard/settings", icon: Settings, label: "Ajustes" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary fill-primary" />
            <span className="font-heading text-xl font-black text-sidebar-primary-foreground tracking-tighter">
              FLOWZA
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            // Hide plans/subscriptions if already business/premium
            if (plan?.id === PlanId.PREMIUM || plan?.id === PlanId.BUSINESS) {
              if (item.to === "/dashboard/plans" || item.to === "/dashboard/subscriptions") return null;
            }
            
            let restricted = false;
            if (["/dashboard/ai-power", "/dashboard/queue", "/dashboard/rewards", "/dashboard/loyalty"].includes(item.to)) {
              restricted = plan?.id !== PlanId.PREMIUM && plan?.id !== PlanId.BUSINESS;
            }
            if (item.to === "/dashboard/marketing") {
              restricted = plan?.id !== PlanId.PREMIUM;
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors justify-between",
                  isActive(item.to, item.exact)
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : item.highlight 
                      ? "text-primary hover:bg-primary/10 bg-primary/5 font-bold" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </div>
                {restricted && <Lock className="w-3 h-3 opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          {isGlobalAdmin && (
             <Link
                to="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-red-600/10 text-red-600 hover:bg-red-600/20 w-full transition-colors"
                onClick={() => setSidebarOpen(false)}
             >
                <ShieldCheck className="w-4 h-4" />
                Painel Admin
             </Link>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <PromoBanner />
        <UpgradeTrigger />
        <WelcomeTrigger />
        <InactivityTrigger />
        <header className="h-16 flex items-center gap-4 px-6 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {navItems.find((n) => isActive(n.to, n.exact))?.label || "Dashboard"}
          </h2>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto pb-24 lg:pb-6">
          <Outlet />
        </main>
        <BottomNav items={bottomNavItems} />
        <HelpGuide />
      </div>
    </div>
  );
};

export default Dashboard;
