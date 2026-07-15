import { useEffect, useState, Fragment, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Minus, Clock, CalendarDays, Sparkles, Loader2, RefreshCw, Zap, Sun, Moon } from "lucide-react";
import { FeatureLock, GrowthOpportunity } from "@/components/dashboard/MonetizationComponents";
import { PlanId } from "@shared/types";

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const DemandForecast = () => {
  const { user } = useAuth();
  const { business, plan, checkPermission } = useBusiness();
  const { toast } = useToast();
  const navigate = useNavigate();
  const businessId = business?.id;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const loadForecast = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const apptsRef = collection(db, "appointments");
      const apptsQuery = query(apptsRef, where("business_id", "==", businessId));
      const apptsSnapshot = await getDocs(apptsQuery);
      const appointments = apptsSnapshot.docs.map(d => d.data());

      const now = new Date();
      const last90Days = new Date(now);
      last90Days.setDate(last90Days.getDate() - 90);

      const validAppointments = appointments.filter(a => 
        a.status !== 'cancelled' && 
        new Date(a.appointment_date) >= last90Days && 
        new Date(a.appointment_date) <= now
      );

      const totalAppointments = validAppointments.length;
      const hourlyDistribution: Record<string, number> = {};
      const dailyDistribution: Record<string, number> = {};
      const dayHourHeatmap: Record<string, number> = {};

      // Initialize
      for (let h = 8; h <= 20; h++) {
        hourlyDistribution[`${h}`] = 0;
      }
      for (let d = 0; d < 7; d++) {
        dailyDistribution[`${d}`] = 0;
        for (let h = 8; h <= 20; h++) {
          dayHourHeatmap[`${d}-${h}`] = 0;
        }
      }

      validAppointments.forEach(a => {
         const date = new Date(`${a.appointment_date}T12:00:00`);
         const day = date.getDay();
         const hour = a.start_time ? parseInt(a.start_time.split(':')[0], 10) : null;
         
         if (hour !== null && hour >= 8 && hour <= 20) {
           hourlyDistribution[`${hour}`]++;
           dailyDistribution[`${day}`]++;
           dayHourHeatmap[`${day}-${hour}`]++;
         }
      });

      const hourlyEntries = Object.entries(hourlyDistribution).map(([h, c]) => ({ h: parseInt(h), c }));
      hourlyEntries.sort((a, b) => b.c - a.c);
      
      const peakHours = hourlyEntries.slice(0, 3).map(e => e.h);
      const idleHours = hourlyEntries.slice(-3).map(e => e.h);

      const suggestedSlots = idleHours.slice(0,2).map(h => `Amanhã, ${h}:00h`);

      const result = {
        totalAppointments,
        hourlyDistribution,
        dailyDistribution,
        dayHourHeatmap,
        peakHours,
        idleHours,
        suggestedSlots,
        aiInsights: {
          trend: totalAppointments > 20 ? "growing" : totalAppointments < 5 ? "declining" : "stable",
          insights: [
            `Terça e Quarta são os dias mais disponíveis.`,
            `Horários entre ${idleHours[0]}h e ${idleHours[1]}h têm menor demanda histórica.`
          ],
          recommendations: [
            `Crie promoções direcionadas para ${idleHours[0]}h.`,
            `Envie WhatsApp para clientes inativos focando nas terças-feiras.`
          ]
        }
      };

      setData(result);
    } catch (error) {
       console.error("Forecast error:", error);
       toast({ title: "Erro na previsão", description: error instanceof Error ? error.message : "Desconhecido", variant: "destructive" });
    }
    setLoading(false);
  }, [businessId, toast]);

  useEffect(() => { if (businessId) loadForecast(); }, [businessId, loadForecast]);

  const trendIcon = data?.aiInsights?.trend === "growing" ? TrendingUp : data?.aiInsights?.trend === "declining" ? TrendingDown : Minus;
  const trendColor = data?.aiInsights?.trend === "growing" ? "text-green-500" : data?.aiInsights?.trend === "declining" ? "text-destructive" : "text-muted-foreground";
  const trendLabel = data?.aiInsights?.trend === "growing" ? "Crescendo" : data?.aiInsights?.trend === "declining" ? "Diminuindo" : "Estável";

  const maxHourly = data ? Math.max(...Object.values(data.hourlyDistribution as Record<string, number>), 1) : 1;
  const maxDaily = data ? Math.max(...Object.values(data.dailyDistribution as Record<string, number>), 1) : 1;

  // Heatmap
  const heatmapMax = data ? Math.max(...Object.values(data.dayHourHeatmap as Record<string, number>), 1) : 1;
  const isPremium = checkPermission('hasSmartCampaigns') || plan?.id === PlanId.PREMIUM;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Previsão de Demanda</h1>
          <p className="text-sm text-muted-foreground">Análise inteligente de padrões de agendamento dos últimos 90 dias</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadForecast} disabled={loading} className="gap-1">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Atualizar
        </Button>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Analisando padrões com IA...</p>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total (90 dias)</span>
              </div>
              <p className="text-3xl font-heading font-bold text-card-foreground">{data.totalAppointments}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                {(() => { const TIcon = trendIcon; return <TIcon className={`w-4 h-4 ${trendColor}`} />; })()}
                <span className="text-xs text-muted-foreground">Tendência</span>
              </div>
              <p className={`text-xl font-heading font-bold ${trendColor}`}>{trendLabel}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sun className="w-4 h-4 text-warning" />
                <span className="text-xs text-muted-foreground">Pico</span>
              </div>
              <p className="text-lg font-heading font-bold text-card-foreground">
                {data.peakHours?.slice(0, 2).map((h: number) => `${h}h`).join(", ") || "—"}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ocioso</span>
              </div>
              <p className="text-lg font-heading font-bold text-card-foreground">
                {data.idleHours?.slice(0, 2).map((h: number) => `${h}h`).join(", ") || "—"}
              </p>
            </div>
          </div>

          {/* Heatmap */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-heading font-semibold text-foreground mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Mapa de Calor — Dia × Horário
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Intensidade de agendamentos por dia da semana e horário</p>
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(14, 1fr)` }}>
                  {/* Header */}
                  <div />
                  {Array.from({ length: 14 }, (_, i) => i + 7).map(h => (
                    <div key={h} className="text-[10px] text-muted-foreground text-center">{h}h</div>
                  ))}
                  {/* Rows */}
                  {[1, 2, 3, 4, 5, 6, 0].map(d => (
                    <Fragment key={d}>
                      <div className="text-xs text-muted-foreground flex items-center">{dayNames[d]}</div>
                      {Array.from({ length: 14 }, (_, i) => i + 7).map(h => {
                        const count = (data.dayHourHeatmap as Record<string, number>)?.[`${d}-${h}`] || 0;
                        const intensity = heatmapMax > 0 ? count / heatmapMax : 0;
                        return (
                          <div
                            key={`${d}-${h}`}
                            className="aspect-square rounded-sm flex items-center justify-center text-[9px] font-medium"
                            style={{
                              backgroundColor: intensity > 0
                                ? `hsl(250 84% 54% / ${Math.max(intensity * 0.9, 0.08)})`
                                : `hsl(var(--muted))`,
                              color: intensity > 0.5 ? 'white' : 'hsl(var(--muted-foreground))',
                            }}
                            title={`${dayNames[d]} ${h}h: ${count} agendamentos`}
                          >
                            {count > 0 ? count : ""}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Hourly Bar Chart */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-heading font-semibold text-foreground mb-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Distribuição por Horário
            </h3>
            <p className="text-xs text-muted-foreground mb-6">Total de agendamentos por hora do dia</p>
            <div className="flex items-end gap-1 h-40">
              {Object.entries(data.hourlyDistribution as Record<string, number>).map(([hour, count]) => {
                const isPeak = data.peakHours?.includes(parseInt(hour));
                const isIdle = data.idleHours?.includes(parseInt(hour));
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{count || ""}</span>
                    <div
                      className="w-full rounded-t-sm transition-all min-h-[2px]"
                      style={{
                        height: `${(count / maxHourly) * 100}%`,
                        backgroundColor: isPeak ? 'hsl(var(--warning))' : isIdle ? 'hsl(var(--muted-foreground) / 0.3)' : 'hsl(var(--primary) / 0.7)',
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">{hour}h</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--warning))' }} /> Pico</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary) / 0.7)' }} /> Normal</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--muted-foreground) / 0.3)' }} /> Ocioso</span>
            </div>
          </div>

          {/* Suggested Slots */}
          {data.suggestedSlots?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-heading font-semibold text-foreground mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Horários Sugeridos para Promoções
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Horários com baixa demanda ideais para atrair clientes</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  {data.suggestedSlots.map((slot: string, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <Clock className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground">{slot}</span>
                    </div>
                  ))}
                </div>
                
                <FeatureLock isLocked={!isPremium} featureName="Disparo Automático" planName="PREMIUM">
                  <div className="h-full bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20 p-5 flex flex-col justify-center items-center text-center">
                    <Zap className="w-8 h-8 text-primary mb-3" />
                    <h4 className="font-bold text-sm mb-2">Preencher Horários Automaticamente</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      O plano PREMIUM recruta clientes automaticamente para preencher essas lacunas ociosas.
                    </p>
                    <Button 
                      className="w-full" 
                      size="sm"
                      onClick={() => navigate("/dashboard/campaigns")}
                    >
                       Ativar Campanhas Inteligentes
                    </Button>
                  </div>
                </FeatureLock>
              </div>
            </div>
          )}

          {/* AI Insights */}
          {(data.aiInsights?.insights?.length > 0 || data.aiInsights?.recommendations?.length > 0) && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-heading font-semibold text-foreground mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Insights da IA
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Análise inteligente dos padrões encontrados</p>
              {data.aiInsights.insights?.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observações</p>
                  {data.aiInsights.insights.map((insight: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              )}
              {data.aiInsights.recommendations?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recomendações</p>
                  {data.aiInsights.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <Badge variant="outline" className="text-[10px] mt-0.5 shrink-0">Dica</Badge>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isPremium && data && (
            <div className="mt-8">
              <GrowthOpportunity potentialAmount={data.suggestedSlots?.length * 150 * 4 || 1800} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DemandForecast;
