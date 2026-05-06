import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ShieldCheck, Activity, Brain, BarChart, Settings, LogOut, ArrowLeft, Users, Menu, X, ShieldAlert, Database, Building2, Ticket, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const adminGroups = [
  {
    title: "Visão Geral",
    links: [
      { to: "/admin", icon: BarChart, label: "Home / Métricas" },
      { to: "/admin/tenants", icon: Building2, label: "Tenants & Planos" },
      { to: "/admin/coupons", icon: Ticket, label: "Cupons Stripe" },
    ]
  },
  {
    title: "Monitoramento",
    links: [
      { to: "/admin/observability", icon: Activity, label: "Observabilidade" },
      { to: "/admin/auto-healing", icon: ShieldCheck, label: "Auto-Healing" },
    ]
  },
  {
    title: "Sistema & Dados",
    links: [
      { to: "/admin/database", icon: Database, label: "Banco de Dados" },
      { to: "/admin/settings", icon: Settings, label: "Configurações Globais" },
      { to: "/admin/features", icon: Layers, label: "Controle de Abas" },
      { to: "/admin/ai-learning", icon: Brain, label: "Sistema de IA (Aprendizado)" },
    ]
  },
  {
    title: "Segurança",
    links: [
      { to: "/admin/users", icon: Users, label: "Administradores" },
      { to: "/admin/audit-logs", icon: ShieldAlert, label: "Logs de Auditoria" },
    ]
  }
];

export default function GlobalAdminLayout() {
  const { isGlobalAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!loading && !isGlobalAdmin) {
      toast.error("Acesso negado. Apenas administradores globais podem acessar esta área.");
      navigate("/dashboard");
    }
  }, [loading, isGlobalAdmin, navigate]);

  if (loading) return <div className="flex h-screen items-center justify-center">Carregando admin...</div>;
  if (!isGlobalAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 flex-col transition-transform duration-300 md:relative md:translate-x-0 flex",
        isSidebarOpen ? "w-64" : "w-20 hidden md:flex",
        isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 flex-shrink-0 cursor-pointer text-white" onClick={() => {
            if (window.innerWidth >= 768) setIsSidebarOpen(!isSidebarOpen);
        }}>
          {isSidebarOpen || isMobileMenuOpen ? (
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Flowza Admin</h2>
          ) : (
             <ShieldCheck className="w-8 h-8 text-blue-400 mx-auto" />
          )}
          <button className="md:hidden" onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); }}>
              <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-6 px-2">
            {adminGroups.map((group, i) => (
              <div key={i} className="space-y-1">
                {isSidebarOpen && <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group.title}</h3>}
                {group.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      title={(!isSidebarOpen && !isMobileMenuOpen) ? link.label : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-blue-600/20 text-blue-400"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      )}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {(isSidebarOpen || isMobileMenuOpen) && <span>{link.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 w-full mb-2"
          >
            <ArrowLeft className="w-5 h-5 flex-shrink-0" />
            {(isSidebarOpen || isMobileMenuOpen) && "Voltar ao App"}
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {(isSidebarOpen || isMobileMenuOpen) && "Sair"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-50 min-h-screen pb-20 md:pb-0 w-full">
        <header className="h-16 bg-white border-b flex items-center px-4 md:px-8 gap-4">
            <button className="md:hidden p-2 text-slate-600 rounded hover:bg-slate-100" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-slate-800 flex-1 truncate">
               {adminGroups.flatMap(g => g.links).find(l => l.to === location.pathname)?.label || "Global Admin Control"}
            </h1>
        </header>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
