import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BarChart3, TrendingDown, Users, Clock, AlertTriangle, TrendingUp, Sparkles, Brain, Plus, Zap, Minus } from "lucide-react";
import { PlanGuard } from "@/components/dashboard/PlanGuard";
import { PlanId } from "@/types";
import { PlaybooksManager } from "@/components/dashboard/PlaybooksManager";
import { AnalyticsIntelligenceService, DashboardInsights } from "@/services/analyticsIntelligenceService";
import { Button } from "@/components/ui/button";

const Analytics = () => {
  const { user } = useAuth();
  const { business } = useBusiness();
  const [stats, setStats] = useState({
    totalAppointments: 0,
    completedAppointments: 0,
    noShowCount: 0,
    noShowRate: 0,
    cancelledCount: 0,
    recurringClients: 0,
    totalClients: 0,
  });
  const [hourlyData, setHourlyData] = useState<{ hour: string; count: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; count: number }[]>([]);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !business) return;
    const load = async () => {
      try {
        const apptsQuery = query(collection(db, "appointments"), where("business_id", "==", business.id));
        const apptsSnap = await getDocs(apptsQuery);
        const appointments = apptsSnap.docs.map(d => d.data());

        const srvQuery = query(collection(db, "services"), where("business_id", "==", business.id));
        const srvSnap = await getDocs(srvQuery);
        const services = srvSnap.docs.map(d => ({id: d.id, ...d.data()}));

        const total = appointments.length;
        const completed = appointments.filter(a => a.status === "completed").length;
        const noShow = appointments.filter(a => a.status === "no_show").length;
        const cancelled = appointments.filter(a => a.status === "cancelled").length;

        const clientCounts: Record<string, number> = {};
        appointments.forEach(a => { if (a.client_id) clientCounts[a.client_id] = (clientCounts[a.client_id] || 0) + 1; });
        const recurring = Object.values(clientCounts).filter(c => c >= 2).length;
        const uniqueClients = Object.keys(clientCounts).length;

        const hourCounts: Record<string, number> = {};
        for (let h = 8; h <= 20; h++) {
          const key = `${String(h).padStart(2, "0")}:00`;
          hourCounts[key] = 0;
        }
        appointments.forEach(a => {
          if (a.start_time) {
            const hour = a.start_time.slice(0, 2) + ":00";
            if (hourCounts[hour] !== undefined) hourCounts[hour]++;
          }
        });

        const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        appointments.forEach(a => {
          if (a.appointment_date) {
            const d = new Date(a.appointment_date + "T12:00:00");
            dayCounts[d.getDay()]++;
          }
        });

        setStats({
          totalAppointments: total,
          completedAppointments: completed,
          noShowCount: noShow,
          noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
          cancelledCount: cancelled,
          recurringClients: recurring,
          totalClients: uniqueClients,
        });

        setHourlyData(Object.entries(hourCounts).map(([hour, count]) => ({ hour, count })));
        setWeeklyData(Object.entries(dayCounts).map(([day, count]) => ({ day: dayNames[Number(day)], count })));

        // Generate AI Insights
        const aiInsights = AnalyticsIntelligenceService.generateInsights(appointments, services, business);
        setInsights(aiInsights);

      } catch (error) {
        console.error("Error loading analytics:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, business]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const maxHourly = Math.max(...hourlyData.map(d => d.count), 1);
  const maxWeekly = Math.max(...weeklyData.map(d => d.count), 1);

  const cards = [
    { icon: BarChart3, label: "Total de Agendamentos", value: stats.totalAppointments, color: "text-primary" },
    { icon: AlertTriangle, label: "Taxa de Faltas", value: `${stats.noShowRate}%`, sub: `${stats.noShowCount} faltas`, color: "text-destructive" },
    { icon: Users, label: "Clientes Recorrentes", value: stats.recurringClients, sub: `de ${stats.totalClients} clientes`, color: "text-success" },
    { icon: TrendingDown, label: "Cancelamentos", value: stats.cancelledCount, color: "text-warning" },
  ];

  return (
    <PlanGuard feature="hasAnalytics" label="Relatórios Avançados" targetPlan={PlanId.BUSINESS}>
      <div className="space-y-8">
        
        {/* Header with Smart Score */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">Visão inteligente do seu negócio</p>
          </div>
          
          {insights && (
            <div className="bg-card rounded-xl border border-border p-4 flex gap-4 items-center shadow-sm">
              <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full border-4 border-muted relative">
                 <span className={`text-sm font-bold ${insights.score.color}`}>{insights.score.value}</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Health Score</p>
                <div className="flex items-center gap-1.5">
                  <span className={`text-lg font-bold font-heading ${insights.score.color}`}>{insights.score.rating}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actionable Insights Priority List */}
        {insights && insights.insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {insights.insights.map((insight, i) => (
                <div key={i} className={`p-4 rounded-xl border ${insight.type === 'critical' ? 'bg-destructive/10 border-destructive/20' : insight.type === 'opportunity' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      {insight.type === 'critical' ? <AlertTriangle className="w-4 h-4 text-destructive" /> : 
                       insight.type === 'opportunity' ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : 
                       <Sparkles className="w-4 h-4 text-amber-500" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-1">{
                        insight.type === 'critical' ? 'Alerta Crítico' : 
                        insight.type === 'opportunity' ? 'Oportunidade' : 'Atenção'
                      }</h4>
                      <p className="text-xs text-muted-foreground mb-3">{insight.message}</p>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] w-full bg-background/50 hover:bg-background">
                         <Brain className="w-3 h-3 mr-1" /> {insight.actionText}
                      </Button>
                    </div>
                  </div>
                </div>
             ))}
          </div>
        )}

        <PlaybooksManager stats={stats} />

        {/* Intelligent Overview Dash */}
        {insights && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
             {/* Loss & Opps */}
             <div className="col-span-1 lg:col-span-1 bg-card rounded-xl border border-destructive/20 p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                   <TrendingDown className="w-24 h-24 text-destructive" />
                </div>
                <h3 className="text-sm font-bold opacity-80 mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> Perdas e Oportunidades</h3>
                <div className="space-y-4 relative z-10">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Perdido em Faltas</p>
                    <p className="text-2xl font-bold font-heading text-destructive">R$ {insights.revenueLost.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Oportunidade de Receita (Reduzir cancelamentos)</p>
                    <p className="text-xl font-bold font-heading text-emerald-500">+ R$ {insights.revenueOpportunity.toFixed(2)}</p>
                  </div>
                </div>
             </div>

             {/* Forecast */}
             <div className="col-span-1 lg:col-span-1 bg-primary/5 rounded-xl border border-primary/20 p-5 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5">
                   <Zap className="w-24 h-24 text-primary" />
                </div>
                <h3 className="text-sm font-bold opacity-80 mb-4 flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Previsão 7 Dias</h3>
                <div className="space-y-4 relative z-10">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Estimativa de Agendamentos</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold font-heading text-foreground">{insights.forecast.next7DaysAppts}</p>
                      {insights.forecast.trend === 'growing' ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Previsão Média de Faturamento</p>
                    <p className="text-xl font-bold font-heading text-foreground">R$ {insights.forecast.next7DaysRevenue.toFixed(2)}</p>
                  </div>
                </div>
             </div>

             {/* Advanced Retention */}
             <div className="col-span-1 lg:col-span-1 bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-bold opacity-80 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Retenção Inteligente</h3>
                <div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                   <div className="flex-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Taxa de Conversão</p>
                      <p className="text-lg font-bold font-heading text-foreground">{Math.round(insights.retention.rate)}%</p>
                   </div>
                   <div className="flex-1 text-right">
                      <p className="text-xs font-medium text-muted-foreground">"{insights.retention.text}"</p>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                   <div className="p-2 border rounded border-border bg-card">
                     <span className="opacity-60 block">Novos</span>
                     <span className="font-bold text-sm">{insights.retention.newClients}</span>
                   </div>
                   <div className="p-2 border rounded border-border bg-card">
                     <span className="opacity-60 block">Recorrentes</span>
                     <span className="font-bold text-sm text-emerald-500">{insights.retention.recurring}</span>
                   </div>
                   <div className="p-2 border rounded border-border bg-card">
                     <span className="opacity-60 block">VIPs (+5)</span>
                     <span className="font-bold text-sm text-purple-500">{insights.retention.vip}</span>
                   </div>
                   <div className="p-2 border rounded border-border bg-card">
                     <span className="opacity-60 block">Inativos (+60d)</span>
                     <span className="font-bold text-sm text-destructive">{insights.retention.lost}</span>
                   </div>
                </div>
             </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <c.icon className={`w-5 h-5 ${c.color}`} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-3xl font-heading font-bold text-card-foreground">{c.value}</p>
              {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
            </div>
          ))}
        </div>

        

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card flex-1 rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-heading font-semibold text-foreground mb-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Horários Mais Movimentados
            </h3>
            <p className="text-xs text-muted-foreground mb-6">Distribuição de agendamentos por horário</p>
            <div className="flex items-end gap-1 h-40">
              {hourlyData.map((d) => (
                <div key={d.hour} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{d.count || ""}</span>
                  <div
                    className="w-full rounded-t-sm bg-primary/80 hover:bg-primary transition-all min-h-[2px]"
                    style={{ height: `${(d.count / maxHourly) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.hour.slice(0, 2)}h</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card flex-1 rounded-xl border border-border p-6 shadow-sm">
            <h3 className="font-heading font-semibold text-foreground mb-1">Distribuição Semanal</h3>
            <p className="text-xs text-muted-foreground mb-6">Agendamentos por dia da semana</p>
            <div className="space-y-3">
              {weeklyData.map((d) => (
                <div key={d.day} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground w-8">{d.day}</span>
                  <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${Math.max((d.count / maxWeekly) * 100, 5)}%` }}
                    >
                      <span className="text-[10px] font-medium text-primary-foreground">{d.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </PlanGuard>
  );
};

export default Analytics;
