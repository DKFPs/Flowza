import { useEffect, useState, Suspense } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Calendar, UserCircle, LogOut, Menu, X, Coins, CreditCard, Star, Image, Heart, Bell, History, Gift,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/dashboard/BottomNav";

const clientNavItems = [
  { to: "/client", icon: Calendar, label: "Meus Agendamentos", exact: true },
  { to: "/client/history", icon: History, label: "Histórico" },
  { to: "/client/loyalty", icon: Coins, label: "Fidelidade" },
  { to: "/client/rewards", icon: Gift, label: "Recompensas" },
  { to: "/client/subscriptions", icon: CreditCard, label: "Assinaturas" },
  { to: "/client/reviews", icon: Star, label: "Avaliações" },
  { to: "/client/gallery", icon: Image, label: "Galeria" },
  { to: "/client/preferences", icon: Heart, label: "Preferências" },
  { to: "/client/notifications", icon: Bell, label: "Notificações" },
  { to: "/client/profile", icon: UserCircle, label: "Meu Perfil" },
];

const ClientDashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const bottomNavItems = [
    { to: "/client", icon: Calendar, label: "Agendas", exact: true },
    { to: "/client/history", icon: History, label: "Histórico" },
    { to: "/client/loyalty", icon: Coins, label: "Fidelidade" },
    { to: "/client/profile", icon: UserCircle, label: "Perfil" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-sidebar-border">
          <span className="font-heading text-lg font-bold text-sidebar-primary-foreground">
            Flowza
          </span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {clientNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(item.to, item.exact)
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
          
          <div className="pt-4 mt-4 border-t border-sidebar-border">
            <Link
              to="/dashboard"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-primary hover:bg-sidebar-accent/50 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              Área do Profissional
            </Link>
          </div>
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center gap-4 px-6 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {clientNavItems.find((n) => isActive(n.to, n.exact))?.label || "Área do Cliente"}
          </h2>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto pb-24 lg:pb-6">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
        <BottomNav items={bottomNavItems} />
      </div>
    </div>
  );
};

export default ClientDashboard;
