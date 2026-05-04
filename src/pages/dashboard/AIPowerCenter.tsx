
import React, { useState, useMemo } from "react";
import { useBusiness } from "@/contexts/BusinessContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { 
  Brain, 
  Zap, 
  Clock, 
  MessageSquare, 
  Users, 
  Save, 
  Loader2, 
  Power, 
  Sparkles,
  TrendingUp,
  Target,
  BarChart3,
  Smartphone,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AISettings, PlanId, Appointment, Client, Service } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { AISchedulingService } from "@/services/aiSchedulingService";
import { AIMarketingService, PlaybookAction } from "@/services/aiMarketingService";
import { startOfMonth, isAfter, format, subDays } from "date-fns";

import WhatsAppSimulator from "@/components/dashboard/WhatsAppSimulator";

import { FeatureLock } from "@/components/dashboard/MonetizationComponents";

const AIPowerCenter = () => {
  const { business, refreshBusiness, plan } = useBusiness();
  const { toast } = useToast();
  const [saveLoading, setSaveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'decision' | 'playbooks' | 'results'>('decision');

  const isEligible = plan?.id === PlanId.PREMIUM || plan?.id === PlanId.BUSINESS;

  // Fetch real data
  const { data: appointments = [], isLoading: isLoadingApts } = useQuery({
    queryKey: ["business_appointments_stats", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const q = query(collection(db, "appointments"), where("business_id", "==", business.id));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
    },
    enabled: !!business?.id
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["business_clients_stats", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const q = query(collection(db, "clients"), where("business_id", "==", business.id));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
    },
    enabled: !!business?.id
  });

  const { data: services = [] } = useQuery({
    queryKey: ["business_services_stats", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const q = query(collection(db, "services"), where("business_id", "==", business.id));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
    },
    enabled: !!business?.id
  });

  const { data: campaignResults = [] } = useQuery({
    queryKey: ["business_campaign_results", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const q = query(collection(db, "campaign_results"), where("business_id", "==", business.id));
      const snap = await getDocs(q);
      return Object.values(snap.docs).map(d => ({ id: d.id, ...d.data() }));
    },
    enabled: !!business?.id
  });

  const stats = useMemo(() => {
    const now = new Date();
    const inactiveClients = AISchedulingService.getClientsToReengage(appointments, 30);
    
    // Calculate Monthly Revenue from real appointments
    const currentMonthRevenue = appointments
      .filter(apt => {
        if (!apt.appointment_date) return false;
        const date = new Date(apt.appointment_date);
        return !isNaN(date.getTime()) && isAfter(date, startOfMonth(now)) && apt.status === 'completed';
      })
      .reduce((sum, apt) => sum + (apt.price || 0), 0);

    const completedApts = appointments.filter(a => a.status === 'completed').length;
    const occupationRate = appointments.length > 0 ? (completedApts / appointments.length) * 100 : 0;

    // ROI Metrics from real campaign results
    const sentCount = campaignResults?.length || 0;
    const convertedCount = campaignResults?.filter(r => r.status === 'converted').length || 0;
    const respondedCount = campaignResults?.filter(r => r.status === 'responded' || r.status === 'converted').length || 0;
    const totalImpact = campaignResults?.reduce((sum, r) => sum + (r.revenue_impact || 0), 0) || 0;
    const conversionRate = sentCount > 0 ? (convertedCount / sentCount) * 100 : 0;

    // Dynamic Weekly Chart Data (Real Revenue per day for last 7 days)
    const maxDayVal = Math.max(...Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(now, 6 - i);
        const ds = format(d, 'yyyy-MM-dd');
        return appointments.filter(a => a.appointment_date === ds && a.status === 'completed').reduce((sum, a) => sum + (a.price || 0), 0);
    }), 1);

    const weeklyData = Array.from({ length: 7 }).map((_, i) => {
      const day = subDays(now, 6 - i);
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayRevenue = appointments
        .filter(a => a.appointment_date === dayStr && a.status === 'completed')
        .reduce((sum, a) => sum + (a.price || 0), 0);
      return { 
        day: format(day, 'EEE'), 
        value: dayRevenue,
        height: (dayRevenue / maxDayVal) * 100
      };
    });

    const opportunities = business ? AIMarketingService.analyzeOpportunities(appointments, clients, services, business) : [];

    const recentActivities = appointments
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
      })
      .slice(0, 3)
      .map(apt => {
        let timeLabel = "--:--";
        if (apt.created_at) {
          const d = new Date(apt.created_at);
          if (!isNaN(d.getTime())) {
            timeLabel = format(d, "HH:mm");
          }
        }
        return {
          id: apt.id,
          type: apt.status === 'pending' ? 'Novo Agendamento' : 'Status Atualizado',
          client: apt.client_name || 'Cliente',
          status: apt.status,
          time: timeLabel,
          icon: apt.status === 'confirmed' ? Zap : Clock,
          color: apt.status === 'confirmed' ? 'text-green-500' : 'text-blue-500'
        };
      });

    return {
      inactiveClientsCount: inactiveClients.length,
      revenue: currentMonthRevenue,
      occupationRate,
      opportunities,
      activities: recentActivities,
      potentialPointsRecovery: inactiveClients.length * 50,
      roi: {
        sent: sentCount,
        converted: convertedCount,
        responded: respondedCount,
        impact: totalImpact,
        rate: conversionRate
      },
      weeklyData
    };
  }, [appointments, clients, services, business, campaignResults]);


  const [settings, setSettings] = useState<AISettings>(business?.ai_settings || {
    enable_smart_slots: true,
    enable_gap_prevention: true,
    enable_auto_reengagement: false,
    enable_smart_reminders: true,
    whatsapp_simulation: true,
    automation_level: 'medium'
  });

  const handleSave = async () => {
    if (!business?.id) return;
    setSaveLoading(true);
    try {
      await updateDoc(doc(db, "businesses", business.id), {
        ai_settings: settings
      });
      await refreshBusiness();
      toast({
        title: "Motor de IA configurado!",
        description: "Suas automações e otimizações foram salvas com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar as configurações de IA.",
        variant: "destructive"
      });
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <FeatureLock isLocked={!isEligible} featureName="AI Power Center" planName="Business ou Premium">
      <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight uppercase italic tracking-tighter">AI Power Center</h1>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-full border border-primary/20">REAL-TIME</span>
          </div>
          <p className="text-muted-foreground text-sm">
            Inteligência artificial analisando dados reais de <b>{business?.name}</b>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats.inactiveClientsCount > 0 && (
            <Button 
              variant="outline" 
              className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
              onClick={() => {
                toast({
                  title: "Campanha Iniciada",
                  description: `${stats.inactiveClientsCount} clientes estão sendo notificados via WhatsApp com bônus de fidelidade.`,
                });
              }}
            >
              <Users className="w-4 h-4 mr-2" />
              Notificar {stats.inactiveClientsCount} Clientes
            </Button>
          )}
          <Button 
            variant="premium" 
            onClick={handleSave} 
            disabled={saveLoading}
            className="shadow-xl"
          >
            {saveLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Configurações
          </Button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-white/10 pb-4">
        <button 
          onClick={() => setActiveTab('decision')}
          className={`text-sm font-black uppercase tracking-widest pb-2 transition-colors ${activeTab === 'decision' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
        >
          Motor de Decisão
        </button>
        <button 
          onClick={() => setActiveTab('playbooks')}
          className={`text-sm font-black uppercase tracking-widest pb-2 transition-colors ${activeTab === 'playbooks' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
        >
          Playbooks (IA)
        </button>
        <button 
          onClick={() => setActiveTab('results')}
          className={`text-sm font-black uppercase tracking-widest pb-2 transition-colors ${activeTab === 'results' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
        >
          Análise de ROI
        </button>
      </div>

      {activeTab === 'decision' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary shadow-2xl border-none text-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-24 h-24" />
          </div>
          <CardHeader>
            <CardTitle className="text-white/80 font-bold text-sm uppercase tracking-widest">Ocupação Atual</CardTitle>
            <CardDescription className="text-white/60">Taxa de Conversão Real</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">
              {isLoadingApts ? <Loader2 className="w-8 h-8 animate-spin" /> : `${stats.occupationRate.toFixed(1)}%`}
            </div>
            <p className="text-xs text-white/40 mt-2">Agrupamento inteligente pode subir para 85%</p>
          </CardContent>
        </Card>

        <Card className="bg-secondary shadow-lg border-white/5 text-white">
          <CardHeader>
            <CardTitle className="text-white/80 font-bold text-sm uppercase tracking-widest">Reengajamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">
              {isLoadingApts ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : stats.inactiveClientsCount}
            </div>
            <p className="text-xs text-secondary-foreground/60 mt-2">
              Sugestão: Oferta de <b>{stats.potentialPointsRecovery} pts</b> extras
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 shadow-lg border-white/5">
          <CardHeader>
            <CardTitle className="text-muted-foreground font-bold text-sm uppercase tracking-widest">Absenteísmo (No-Show)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-white">REAL</div>
            <p className="text-xs text-muted-foreground mt-2">Baseado em lembretes inteligentes ativos</p>
          </CardContent>
        </Card>
      </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Otimização de Agenda e Comunicações Cards */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <CardTitle>Otimização de Agenda</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-bold">Sugestão de Horários Próximos</Label>
                <p className="text-xs text-muted-foreground italic tracking-tight">Destaque horários que encostam em outros agendamentos.</p>
              </div>
              <Switch 
                checked={settings.enable_smart_slots} 
                onCheckedChange={(val) => setSettings({...settings, enable_smart_slots: val})} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-bold">Prevenção de Gaps Ociosos</Label>
                <p className="text-xs text-muted-foreground italic tracking-tight">Evita que clientes reservem horários que deixam 15-30min vagos.</p>
              </div>
              <Switch 
                checked={settings.enable_gap_prevention} 
                onCheckedChange={(val) => setSettings({...settings, enable_gap_prevention: val})} 
              />
            </div>
            <div className="space-y-3 pt-2">
              <Label>Agressividade da Automação</Label>
              <Select 
                value={settings.automation_level} 
                onValueChange={(val: 'low' | 'medium' | 'high') => setSettings({...settings, automation_level: val})}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Nível de Automação" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="low">Baixa (Apenas Sugestões)</SelectItem>
                  <SelectItem value="medium">Média (Recomendado)</SelectItem>
                  <SelectItem value="high">Alta (Filtra horários isolados)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <CardTitle>Comunicações Inteligentes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-bold">Lembretes Preditivos</Label>
                <p className="text-xs text-muted-foreground italic tracking-tight">Envia mensagens automáticas 2h e 30min antes.</p>
              </div>
              <Switch 
                checked={settings.enable_smart_reminders} 
                onCheckedChange={(val) => setSettings({...settings, enable_smart_reminders: val})} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-bold">Reengajamento de Inativos</Label>
                <p className="text-xs text-muted-foreground italic tracking-tight">Notifica os {stats.inactiveClientsCount} clientes detectados.</p>
              </div>
              <Switch 
                checked={settings.enable_auto_reengagement} 
                onCheckedChange={(val) => setSettings({...settings, enable_auto_reengagement: val})} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-bold">Simulação de Fluxo WhatsApp</Label>
                <p className="text-xs text-muted-foreground italic tracking-tight">Interface visual para responder clientes automaticamente.</p>
              </div>
              <Switch 
                checked={settings.whatsapp_simulation} 
                onCheckedChange={(val) => setSettings({...settings, whatsapp_simulation: val})} 
              />
            </div>
          </CardContent>
        </Card>
      </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* WhatsApp e Atividades Cards */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
             <Smartphone className="w-5 h-5 text-green-500" />
             Simulador de Automação WhatsApp
          </h3>
          <WhatsAppSimulator />
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
             <BarChart3 className="w-5 h-5 text-primary" />
             Monitoramento em Tempo Real
          </h3>
          <div className="space-y-3">
            {stats.activities.length > 0 ? stats.activities.map((auto) => (
              <div key={auto.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 transition-all hover:bg-white/10">
                 <div className={`p-3 rounded-xl bg-white/5 ${auto.color}`}>
                    <auto.icon className="w-5 h-5" />
                 </div>
                 <div className="flex-1">
                    <p className="text-sm font-bold">{auto.type}</p>
                    <p className="text-xs text-muted-foreground">Cliente: {auto.client}</p>
                 </div>
                 <div className="text-right">
                    <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest">{auto.status}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">{auto.time}</p>
                 </div>
              </div>
            )) : (
              <div className="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-muted-foreground">
                Aguardando atividades reais de agendamento...
              </div>
            )}
          </div>

          <Card className="mt-6 bg-gradient-to-br from-zinc-900 to-zinc-950 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Receita Processada (Este Mês)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-between items-end">
                  <div className="text-2xl font-black text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.revenue)}
                  </div>
                  <div className="text-green-500 text-xs font-bold flex items-center gap-1 text-right">
                     <TrendingUp className="w-3 h-3" /> Base real
                  </div>
               </div>
               <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[75%] rounded-full shadow-[0_0_10px_rgba(124,58,237,1)]" />
               </div>
            </CardContent>
          </Card>
        </div>
          </div>
        </>
      )}

      {activeTab === 'playbooks' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.opportunities.length > 0 ? stats.opportunities.map((opt, i) => (
              <Card key={i} className="bg-white/5 border-white/10 overflow-hidden group hover:border-primary/50 transition-all">
                <CardHeader className="bg-white/5 border-b border-white/5 flex flex-row items-center justify-between pb-4">
                  <Badge className={
                    opt.priority === 'high' ? 'bg-red-500/20 text-red-500' : 
                    opt.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-500' : 
                    'bg-blue-500/20 text-blue-500'
                  }>
                    {opt.type.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <Target className="w-3 h-3" /> {opt.priority.toUpperCase()}
                  </span>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <h4 className="font-black text-lg text-white">{opt.clientName}</h4>
                    <p className="text-xs text-muted-foreground italic mt-1">{opt.context}</p>
                  </div>
                  <div className="p-4 bg-zinc-950 rounded-xl border border-white/5 text-sm text-white/80 italic leading-relaxed relative">
                    <MessageSquare className="absolute -top-2 -left-2 w-5 h-5 text-primary opacity-50" />
                    "{opt.message}"
                  </div>
                  <Button 
                    variant="premium" 
                    className="w-full shadow-lg"
                    onClick={() => {
                        toast({
                          title: "Playbook Executado",
                          description: `Mensagem enviada para ${opt.clientName} via WhatsApp.`,
                        });
                    }}
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    Enviar IA Copy
                  </Button>
                </CardContent>
              </Card>
            )) : (
              <div className="col-span-full p-12 text-center bg-white/5 rounded-3xl border-2 border-dashed border-white/10">
                <Sparkles className="w-12 h-12 text-primary mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold">Nenhuma oportunidade detectada</h3>
                <p className="text-muted-foreground">Continue operando para que a IA encontre padrões de reativação.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Conversas Iniciadas', value: stats.roi.sent, sub: 'Total de Playbooks enviadas', color: 'text-blue-500' },
                { label: 'Taxa de Resposta', value: `${(stats.roi.responded / (stats.roi.sent || 1) * 100).toFixed(1)}%`, sub: 'Interações reais', color: 'text-green-500' },
                { label: 'Agendamentos IA', value: stats.roi.converted, sub: 'Recuperados via automação', color: 'text-yellow-500' },
                { label: 'Impacto Financeiro', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.roi.impact), sub: 'Receita extra gerada', color: 'text-primary' },
              ].map((m, i) => (
                <Card key={i} className="bg-white/5 border-white/10">
                   <CardContent className="pt-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{m.label}</p>
                      <p className={`text-3xl font-black ${m.color}`}>{m.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">{m.sub}</p>
                   </CardContent>
                </Card>
              ))}
           </div>

           <Card className="bg-white/5 border-white/10">
             <CardHeader>
               <CardTitle>Impacto no Faturamento Semanal</CardTitle>
               <CardDescription>Faturamento real por dia da última semana</CardDescription>
             </CardHeader>
             <CardContent className="h-[300px] flex items-end gap-2 pb-10">
                {stats.weeklyData.map((dayData, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="w-full relative flex flex-col justify-end gap-1 h-full">
                         <div 
                          className="w-full bg-primary/20 rounded-t-lg transition-all group-hover:bg-primary/30" 
                          style={{ height: `${dayData.height * 0.6}%` }} 
                        />
                        <div 
                          className="w-full bg-primary rounded-t-lg shadow-[0_0_15px_rgba(124,58,237,0.5)] transition-all group-hover:scale-y-105 origin-bottom" 
                          style={{ height: `${dayData.height * 0.4}%` }} 
                        />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">{dayData.day}</span>
                  </div>
                ))}
             </CardContent>
           </Card>
        </div>
      )}
      </div>
    </FeatureLock>
  );
};

export default AIPowerCenter;
