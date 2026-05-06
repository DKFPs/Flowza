import { useEffect, useState } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  limit,
  getDocs,
  orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { 
  Calendar, 
  Users, 
  TrendingUp, 
  Clock, 
  Bell, 
  AlertTriangle, 
  Zap, 
  Sparkles, 
  DollarSign, 
  Star, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  Share2,
  ChevronRight,
  TrendingDown,
  Target,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import OnboardingWizard from "@/components/dashboard/OnboardingWizard";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  UpgradeTrigger, 
  GrowthOpportunity, 
  FeatureLock, 
  UpgradeButton 
} from "@/components/dashboard/MonetizationComponents";
import { ActivationChecklist } from "@/components/dashboard/ActivationChecklist";
import { PlanId } from "@/types";
import { cn } from "@/lib/utils";

const FirstBookingTrigger = () => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="bg-primary text-primary-foreground p-8 rounded-[2rem] shadow-2xl shadow-primary/40 relative overflow-hidden flex flex-col items-center text-center gap-4 border-4 border-white/20"
  >
    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
    <div className="p-4 rounded-full bg-white/20 backdrop-blur-xl">
       <Zap className="w-10 h-10 text-white animate-pulse" />
    </div>
    <div className="space-y-2 relative z-10">
       <h2 className="text-3xl font-black leading-tight italic tracking-tighter">PARABÉNS! SEU 1º AGENDAMENTO CHEGOU! 🚀</h2>
       <p className="text-primary-foreground/80 font-medium max-w-sm">
         Agora que você começou, que tal <b>automatizar 100%</b> da sua agenda e focar apenas no que importa?
       </p>
    </div>
    <div className="flex flex-col w-full gap-3 mt-4 relative z-10 sm:flex-row">
      <UpgradeButton className="w-full bg-white text-primary hover:bg-white/90 h-14 rounded-2xl text-lg shadow-xl" />
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 sm:hidden">Disponível em planos Business e Premium</p>
    </div>
  </motion.div>
);

const LockedStat = ({ label, isLocked, planName }: { label: string; isLocked: boolean; planName: string }) => (
  <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm relative overflow-hidden group">
    {isLocked && (
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-4 text-center">
        <Lock className="w-4 h-4 text-primary mb-1" />
        <p className="text-[8px] font-black uppercase text-primary tracking-tighter">Liberar no {planName}</p>
        <UpgradeButton variant="link" className="h-auto p-0 text-[10px] scale-75" />
      </div>
    )}
    <div className={cn("space-y-1", isLocked && "blur-[2px] opacity-40 select-none")}>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <h3 className="text-2xl font-black text-foreground tabular-nums">---</h3>
    </div>
  </div>
);

// Real growth data will be stored in component state

const Overview = () => {
  const { user } = useAuth();
  const { business, loading, usage, limits, plan } = useBusiness();
  const { toast } = useToast();
  const [realtimeAlerts, setRealtimeAlerts] = useState<{ message: string; time: string; type: 'info' | 'error' | 'success' }[]>([]);
  
  // Real data states
  const [growthData, setGrowthData] = useState<{ name: string; value: number }[]>([]);
  const [cancellationRate, setCancellationRate] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [retentionRate, setRetentionRate] = useState(0);
  const [estimatedRevenue, setEstimatedRevenue] = useState(0);
  const [nextAppointments, setNextAppointments] = useState<{ time: string; name: string; service: string; status: string }[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!user || !business) return;

    const loadRealData = async () => {
      try {
        const apptsQuery = query(collection(db, "appointments"), where("business_id", "==", business.id));
        const apptsSnap = await getDocs(apptsQuery);
        const appointments = apptsSnap.docs.map(d => d.data());

        const srvQuery = query(collection(db, "services"), where("business_id", "==", business.id));
        const srvSnap = await getDocs(srvQuery);
        const services = srvSnap.docs.map(d => ({id: d.id, ...d.data()}));

        // Next Appointments
        const now = new Date();
        const nextAppts = appointments
          .filter(a => new Date(`${a.appointment_date}T${a.start_time}`) > now && a.status !== 'cancelled')
          .sort((a, b) => new Date(`${a.appointment_date}T${a.start_time}`).getTime() - new Date(`${b.appointment_date}T${b.start_time}`).getTime())
          .slice(0, 5)
          .map(a => {
            const service = services.find(s => s.id === a.service_id);
            // We show the time simply as the start_time (which usually is HH:mm) or parse it
            const startStr = a.start_time ? a.start_time.slice(0,5) : "--:--";
            let statusLabel = "Confirmado";
            if (a.status === 'pending') statusLabel = "Pendente";
            if (a.status === 'no_show') statusLabel = "Falta";
            
            return {
              time: startStr,
              name: a.client_name || "Cliente " + (a.client_id || "").slice(0,4),
              service: service?.name || "Serviço",
              status: statusLabel
            };
          });
        setNextAppointments(nextAppts);

        // Stats calculation
        const total = appointments.length;
        const cancelled = appointments.filter(a => a.status === 'cancelled').length;
        const completed = appointments.filter(a => a.status === 'completed').length;
        const noShow = appointments.filter(a => a.status === 'no_show').length;
        
        setCancellationRate(total > 0 ? (cancelled / total) * 100 : 0);
        
        // Attendance Rate: completed out of (completed + no_show) OR just total past
        const pastAppointments = appointments.filter(a => new Date(`${a.appointment_date}T${a.start_time}`) < now);
        const pastTotal = pastAppointments.length;
        const pastCompleted = pastAppointments.filter(a => a.status === 'completed').length;
        setAttendanceRate(pastTotal > 0 ? Math.round((pastCompleted / pastTotal) * 100) : 0);

        // Estimated revenue (from all upcoming and completed)
        let revenue = 0;
        appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').forEach(a => {
           const s = services.find(srv => srv.id === a.service_id);
           revenue += (s?.price || 0);
        });
        setEstimatedRevenue(revenue);

        // Retention Rate -> (clients with >1 appts) / (total unique clients)
        const clientAppts = {};
        appointments.forEach(a => {
           if(a.client_id) {
             clientAppts[a.client_id] = (clientAppts[a.client_id] || 0) + 1;
           }
        });
        const clientIds = Object.keys(clientAppts);
        const recurring = clientIds.filter(id => clientAppts[id] > 1).length;
        setRetentionRate(clientIds.length > 0 ? Math.round((recurring / clientIds.length) * 100) : 0);

        // Growth Chart Data (Appointments by day for the last 7 days)
        const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const last7DaysData = [];
        for (let i = 6; i >= 0; i--) {
           const d = new Date(now);
           d.setDate(d.getDate() - i);
           const dayStr = d.toISOString().split('T')[0];
           const count = appointments.filter(a => a.appointment_date === dayStr && a.status !== 'cancelled').length;
           last7DaysData.push({ name: dayNames[d.getDay()], value: count });
        }
        setGrowthData(last7DaysData);
        
        setDataLoaded(true);

      } catch (err) {
        console.error("Error fetching real data", err);
      }
    };
    
    loadRealData();
    
    const unsubscribe = onSnapshot(
      query(collection(db, "appointments"), where("business_id", "==", business.id), limit(5)),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          if (change.type === "added") {
            const isNew = !snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache;
            if (isNew) {
              const msg = "Novo agendamento confirmado";
              toast({ title: msg });
              setRealtimeAlerts((prev) => [{ message: msg, time: now, type: 'success' }, ...prev].slice(0, 10));
            }
          } else if (change.type === "modified") {
            const data = change.doc.data();
            if (data.status === "cancelled") {
              const msg = "Um agendamento foi cancelado";
              toast({ title: msg, variant: "destructive" });
              setRealtimeAlerts((prev) => [{ message: msg, time: now, type: 'error' }, ...prev].slice(0, 10));
            }
          }
        });
      },
      (error) => handleFirestoreError(error, OperationType.GET, "appointments")
    );

    return () => unsubscribe();
  }, [user, business, toast]);

  const copyBookingLink = () => {
    if (!business) return;
    const url = `${window.location.origin}/b/${business.slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copiado!",
      description: "O link de agendamento foi copiado para sua área de transferência.",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Preparando seu dashboard...</p>
      </div>
    );
  }

  if (!business || (!dataLoaded && !loading)) {
    return <OnboardingWizard />;
  }

  // Feature availability based on plan
  const hasAdvancedCharts = limits.analytics === "advanced";
  const hasInsights = limits.analytics === "advanced";
  const hasAutomations = limits.automation !== "none";

  // Simulation logic for monetization triggers based on real data
  const isHighCancellation = cancellationRate > 15;
  const appointmentUsagePercent = 99999 > 0 ? Math.min((usage.appointments / 99999) * 100, 100) : 0;
  const isNearLimit = appointmentUsagePercent >= 80;
  const isStalledGrowth = usage.appointments < 5; // Can still be a trigger if they have low global usage
  const isOverLimit = usage.appointments >= 99999;

  return (
    <div className="space-y-6 md:space-y-8 pb-32 lg:pb-10">
      {/* Monetization Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="px-1">
          <div className="flex items-center gap-2 mb-1">
             {plan.id !== PlanId.PREMIUM && (
               <div className="p-1 px-2 rounded-md bg-primary/10 flex items-center gap-1.5">
                 <Zap className="w-3 h-3 text-primary" />
                 <span className="text-[10px] font-black uppercase text-primary tracking-widest">Upgrade Pro Disponível</span>
               </div>
             )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            {business.name}
            {plan.id === PlanId.PREMIUM && <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 border-none">PREMIUM</Badge>}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 capitalize font-bold text-[10px] px-2 py-0 h-5">
              Plano {plan.name}
            </Badge>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Início</span>
          </div>
        </div>

        <div className="flex lg:items-center gap-3">
          <Button onClick={copyBookingLink} variant="outline" size="sm" className="gap-2 rounded-xl border-border bg-card/50 backdrop-blur-sm shadow-sm h-12 lg:h-10 text-xs">
            <Share2 className="w-4 h-4" /> Link Bio
          </Button>
          <Link to="/dashboard/schedule?action=new" className="w-full">
            <Button size="sm" className="w-full gap-2 rounded-xl shadow-lg shadow-primary/20 h-12 lg:h-10 px-5 bg-primary hover:bg-primary/90 text-xs">
              <Plus className="w-4 h-4" /> Novo Agendamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Module 1: Gatilhos de Upgrade Dinâmicos */}
      <AnimatePresence>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Conversion Trigger for 1st Booking */}
            {usage.appointments === 1 && plan.id === PlanId.FREE && (
              <FirstBookingTrigger />
            )}

            {/* Step 6: Activation Checklist */}
            <ActivationChecklist />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isHighCancellation && plan.id !== PlanId.PREMIUM && (
                <UpgradeTrigger 
                  type="cancellation"
                  title="Taxa de Cancelamento Crítica (18%)"
                  description="Você está perdendo em média R$ 450,00 por semana devido a cancelamentos de última hora."
                  solution="Ative os lembretes automáticos via WhatsApp e Checkout Antecipado para garantir o pagamento."
                />
              )}
            
            {isNearLimit && plan.id !== PlanId.PREMIUM && (
              <UpgradeTrigger 
                type="limit"
                title={isOverLimit ? "Limite de Agendamentos ATINGIDO!" : "Atenção ao Limite (85%)"}
                description={`Você está operando no limite do plano ${plan.name} (${usage.appointments}/${99999} agendamentos).`}
                solution="Faça o upgrade para o plano superior e tenha agendamentos ilimitados para não perder clientes."
              />
            )}

            {isStalledGrowth && plan.id === PlanId.FREE && (
              <UpgradeTrigger 
                type="growth"
                title="Sinal de Estagnação Detectado"
                description="Seu volume de novos clientes não cresceu nos últimos 15 dias."
                solution="Utilize o Módulo de Campanhas e Cupons Inteligentes (disponível no plano Business) para reativar clientes antigos."
              />
            )}

            {realtimeAlerts.length > 0 && !isHighCancellation && !isNearLimit && (
              <div className="p-5 rounded-2xl border bg-card/50 flex items-start gap-4">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-foreground">Atividade Recente</h3>
                  <div className="mt-3 space-y-2">
                    {realtimeAlerts.slice(0, 3).map((alert, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-muted-foreground">
                          <span className={`w-1.5 h-1.5 rounded-full ${alert.type === 'success' ? 'bg-green-500' : alert.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} />
                          {alert.message}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 font-bold">{alert.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Module 2: Bloco de Oportunidade */}
          <div className="lg:col-span-1">
             <GrowthOpportunity potentialAmount={3500} />
          </div>
        </div>
      </AnimatePresence>

      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Agendamentos Hoje", value: "14", sub: "+12.5%", trend: "up", icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Clientes no Mês", value: usage.appointments || 0, sub: "Em crescimento", trend: "up", icon: Users, color: "text-green-600", bg: "bg-green-50" },
          { label: "Taxa de Comparecimento", value: `${attendanceRate}%`, sub: "Acima da média", trend: "up", icon: Target, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Faturamento Estimado", value: `R$ ${estimatedRevenue.toLocaleString()}`, sub: "Ticket Médio: R$ 85", trend: "up", icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <Badge variant="secondary" className="text-[10px] bg-green-100/50 text-green-700 border-none px-2">
                <TrendingUp className="w-3 h-3 mr-1" /> {stat.sub}
              </Badge>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-3xl font-black text-foreground mt-1 tabular-nums">{stat.value}</h3>
            </div>
          </motion.div>
        ))}

        {/* Premium Stats */}
        <LockedStat label="LTV (Life Time Value)" isLocked={limits?.analytics !== "advanced"} planName="Business" />
        <LockedStat label="CAC Médio" isLocked={!limits?.aiMarketing} planName="Premium" />
        <LockedStat label="Churn Rate" isLocked={!limits?.aiMarketing} planName="Premium" />
        <LockedStat label="ROI de Campanhas" isLocked={limits?.analytics !== "advanced"} planName="Business" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module 3 & 4: Feature Lock + Dashboard por Plano */}
        <div className="lg:col-span-2">
          <FeatureLock 
            isLocked={!hasAdvancedCharts} 
            featureName="Previsão de Demanda" 
            planName="Business"
          >
            <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden bg-white/50 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black tracking-tight uppercase">Fluxo Semanal Concluído</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-wider">Volume de agendamentos reais vs meta</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-bold">
                    <TrendingUp className="w-3 h-3 mr-1" /> +24% este mês
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[280px] w-full -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: '1px solid hsl(var(--border))', 
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', 
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '12px'
                        }}
                        cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5 5' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                        animationDuration={2000}
                      />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))'}} 
                        dy={10}
                      />
                      <YAxis hide />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </FeatureLock>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold">Resumo de Retenção</CardTitle>
              <CardDescription className="text-xs">Taxa de retorno nos últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Fidelização</p>
                    <h4 className="text-4xl font-black text-primary">{retentionRate}%</h4>
                  </div>
                  <div className={`p-4 rounded-full bg-primary/10 text-primary`}>
                      <Target className="w-8 h-8" />
                  </div>
              </div>
              
              <FeatureLock isLocked={!hasInsights} featureName="Insights de Clientes" planName="Business">
                <div className="space-y-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>Performance</span>
                    <span className="text-primary font-black">ACIMA DA MÉDIA</span>
                  </div>
                  <Progress value={85} className="h-2" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Seu negócio está no top 15% da categoria em retenção. Ative o <b>Módulo VIP</b> para automatizar bonificações.
                  </p>
                  <UpgradeButton variant="outline" className="w-full text-[9px] border-primary/20" />
                </div>
              </FeatureLock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-dashed border-2 bg-gradient-to-br from-amber-50 to-transparent border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase text-amber-700">Dica de Crescimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-amber-800/80 leading-relaxed font-medium">
                Clientes que recebem lembretes por WhatsApp têm <b>3.5x mais chance</b> de retornar no mês seguinte.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Module 5: CTA Contínuo (Plano Atual + Upgrade) - Hidden on Mobile to avoid BottomNav conflict */}
      {plan.id !== PlanId.PREMIUM && (
      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-lg hidden lg:block"
      >
        <div className="bg-foreground text-background rounded-3xl p-4 shadow-2xl shadow-black/40 flex items-center justify-between gap-4 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center gap-3 pl-2">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-white/10">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Seu Plano Atual</p>
              <p className="text-sm font-bold text-white uppercase">{plan.name}</p>
            </div>
          </div>
          <UpgradeButton className="bg-primary hover:bg-primary/90 text-white border-none px-6 rounded-2xl h-11" />
        </div>
      </motion.div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <CardTitle className="text-lg font-bold">Próximos Clientes</CardTitle>
            <Link to="/dashboard/schedule">
              <Button variant="ghost" size="sm" className="text-[10px] font-bold h-8">Ver Tudo</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {nextAppointments.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Nenhum agendamento futuro encontrado.
              </div>
            ) : (
              nextAppointments.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4 border-b last:border-0 grow">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold w-12">{item.time}</span>
                    <div>
                      <h5 className="text-sm font-bold">{item.name}</h5>
                      <p className="text-xs text-muted-foreground">{item.service}</p>
                    </div>
                  </div>
                  <Badge variant={item.status === 'Confirmado' ? 'default' : 'secondary'}>{item.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Feature locked section for FREE/PRO */}
        <FeatureLock isLocked={!hasAutomations} featureName="Painel de Automação" planName="Business">
           <Card className="rounded-2xl border-border/60 shadow-sm border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Automações de Hoje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold italic">"Lembrete de Agendamento Enviado"</p>
                  <p className="text-[10px] text-muted-foreground">Para Maria Clara às 09:00</p>
                </div>
                <Badge className="bg-green-100 text-green-700 border-none">Sucesso</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50/50">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold italic">"Ganho de Re-engajamento em Potencial"</p>
                  <p className="text-[10px] text-muted-foreground">5 clientes inativos identificados</p>
                </div>
                <Button variant="ghost" size="sm" className="text-[9px] font-bold h-8">Executar</Button>
              </div>
            </CardContent>
          </Card>
        </FeatureLock>
      </div>
    </div>
  );
};


export default Overview;
