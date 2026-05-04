import { useState, useEffect, useCallback } from "react";
import { Zap, AlertTriangle, ArrowRight, CheckCircle2, RotateCcw, TrendingUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBusiness } from "@/contexts/BusinessContext";
import { PlaybookService, PlaybookLog } from "@/services/playbookService";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PlaybookDef {
  id: string;
  title: string;
  problem: string;
  solution: string;
  impact_estimate: string;
  actions_preview: string[];
  condition: (stats: Record<string, unknown>) => boolean;
  execute: (businessId: string) => Promise<unknown>;
  rollback: (businessId: string, actionsTaken: unknown) => Promise<void>;
  icon: React.ElementType;
  color: string;
  bg: string;
}

const PLAYBOOKS: PlaybookDef[] = [
  {
    id: "reduce_no_shows",
    title: "Reduzir Faltas & Atrasos",
    problem: "Alta taxa de cancelamento ou não comparecimento (no-show).",
    solution: "Ativação de camada extra de alertas (lembrete 2h antes via WhatsApp).",
    impact_estimate: "-30% de faltas no mês",
    actions_preview: [
      "Configurar lembrete automático 2h antes",
      "Ativar integração dupla via WhatsApp"
    ],
    condition: (stats: Record<string, unknown>) => !!stats && typeof stats.noShowRate === 'number' && stats.noShowRate >= 10,
    execute: PlaybookService.executeReduceFaltas,
    rollback: (b, data) => PlaybookService.rollbackReduceFaltas(b, data),
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-500/10"
  },
  {
    id: "reactivation",
    title: "Reativar Clientes Inativos",
    problem: "Baixa taxa de clientes retornando no último mês.",
    solution: "Campanha automática de incentivo (pontos em dobro ou descontos para o retorno).",
    impact_estimate: "+15% de agendamentos recuperados",
    actions_preview: [
      "Criar campanha 'Bônus de Reativação' no Loyalty",
      "Notificar clientes inativos > 30 dias"
    ],
    condition: (stats: Record<string, unknown>) => !!stats && typeof stats.recurringClients === 'number' && typeof stats.totalClients === 'number' && (stats.recurringClients / (stats.totalClients || 1)) < 0.4 && stats.totalClients > 10,
    execute: PlaybookService.executeReactivation,
    rollback: (b, data) => PlaybookService.rollbackReactivation((data as Record<string, string>)?.reward_id),
    icon: RotateCcw,
    color: "text-blue-500",
    bg: "bg-blue-500/10"
  },
  {
    id: "increase_recurrence",
    title: "Aumentar Recorrência Diária",
    problem: "Lenta captação e pouco estímulo na fidelização.",
    solution: "Criar combo atrativo no Loyalty incentivando a 3ª visita seguida.",
    impact_estimate: "+20% na frequência de visitas",
    actions_preview: [
      "Criar prêmio 'Agende 3 e ganhe 1 brinde'",
      "Destacar no painel do cliente"
    ],
    condition: (stats: Record<string, unknown>) => !!stats && typeof stats.totalAppointments === 'number' && stats.totalAppointments > 5, // Apenas para simular que apareça
    execute: PlaybookService.executeRecurrence,
    rollback: (b, data) => PlaybookService.rollbackReactivation((data as Record<string, string>)?.reward_id),
    icon: TrendingUp,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10"
  },
  {
    id: "upsell_ticket",
    title: "Aumentar Ticket Médio",
    problem: "A maioria dos clientes agenda apenas 1 serviço básico e vai embora.",
    solution: "Sugestão inteligente de serviços complementares (Upsell) na hora da confirmação.",
    impact_estimate: "+10% de faturamento por cliente",
    actions_preview: [
      "Ativar sugestões automáticas combinadas",
      "Habilitar campo 'Upsell' do negócio"
    ],
    condition: (stats: Record<string, unknown>) => !!stats && typeof stats.completedAppointments === 'number' && stats.completedAppointments > 0, // Sempre sugerido se tiver movimento
    execute: PlaybookService.executeTicketMedio,
    rollback: (b, data) => PlaybookService.rollbackTicketMedio(b, data),
    icon: Zap,
    color: "text-purple-500",
    bg: "bg-purple-500/10"
  }
];

export function PlaybooksManager({ stats }: { stats: Record<string, unknown> }) {
  const { business } = useBusiness();
  const { toast } = useToast();
  const [logs, setLogs] = useState<PlaybookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookDef | null>(null);

  const loadLogs = useCallback(async () => {
    if (!business) return;
    const executed = await PlaybookService.getExecutedPlaybooks(business.id);
    setLogs(executed);
  }, [business]);

  useEffect(() => {
    if (business) {
      loadLogs();
    }
  }, [business, loadLogs]);

  const isExecuted = (playbookId: string) => {
    return logs.some(l => l.playbook_id === playbookId && l.status === 'executed');
  };

  const recommendedPlaybooks = PLAYBOOKS.filter(p => !isExecuted(p.id) && p.condition(stats));
  const activePlaybooks = PLAYBOOKS.filter(p => isExecuted(p.id));

  const handleExecute = async () => {
    if (!selectedPlaybook || !business) return;
    setLoading(true);
    try {
      const actionsData = await selectedPlaybook.execute(business.id);
      await PlaybookService.logExecution(business.id, selectedPlaybook.id, actionsData);
      toast({ title: "Playbook ativado com sucesso!", description: "Ações automáticas configuradas." });
      await loadLogs();
      setSelectedPlaybook(null);
    } catch (error) {
      toast({ title: "Erro", description: "Ocorreu um erro ao ativar o Playbook", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (playbook: PlaybookDef) => {
    if (!business) return;
    const log = logs.find(l => l.playbook_id === playbook.id && l.status === 'executed');
    if (!log || !log.id) return;
    
    setLoading(true);
    try {
      await playbook.rollback(business.id, log.actions_taken);
      await PlaybookService.logRollback(log.id);
      toast({ title: "Playbook desfeito com sucesso!", description: "As ações foram revertidas ao estado original." });
      await loadLogs();
    } catch (error) {
      toast({ title: "Erro", description: "Ocorreu um erro ao desfazer o Playbook", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!business || (recommendedPlaybooks.length === 0 && activePlaybooks.length === 0)) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold font-heading">Playbooks Inteligentes</h2>
      </div>

      {recommendedPlaybooks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
             <AlertTriangle className="w-4 h-4" /> 
             Problemas Detectados / Oportunidades
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedPlaybooks.map(playbook => (
              <div key={playbook.id} className="bg-card rounded-xl border border-border p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 -mr-16 -mt-16 group-hover:opacity-40 transition-opacity ${playbook.bg}`} />
                
                <div className="relative z-10 space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", playbook.bg)}>
                       <playbook.icon className={cn("w-5 h-5", playbook.color)} />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">{playbook.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">Detectado: {playbook.problem}</p>
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
                    <p className="text-xs font-semibold mb-2">Ação Sugerida:</p>
                    <p className="text-xs text-muted-foreground mb-3">{playbook.solution}</p>
                    <ul className="text-[10px] space-y-1 mb-3">
                      {playbook.actions_preview.map((a, i) => (
                        <li key={i} className="flex items-center gap-1.5 opacity-80">
                           <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                           {a}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                       <TrendingUp className="w-3 h-3" /> Impacto esperado: {playbook.impact_estimate}
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    variant="default"
                    onClick={() => setSelectedPlaybook(playbook)}
                  >
                    1-Click: Corrigir agora <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activePlaybooks.length > 0 && (
        <div className="space-y-4 mt-8">
           <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Playbooks em execução (Tracking)</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activePlaybooks.map(playbook => (
                <div key={playbook.id} className="bg-card rounded-xl border border-primary/20 p-5 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                           <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{playbook.title}</h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[250px] truncate">{playbook.solution}</p>
                        </div>
                    </div>
                    <Button 
                       variant="ghost" 
                       size="sm" 
                       className="text-xs text-destructive hover:bg-destructive/10"
                       onClick={() => handleRollback(playbook)}
                       disabled={loading}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Desfazer
                    </Button>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex justify-between items-center bg-emerald-500/5 p-3 rounded-md">
                     <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Medindo impacto contínuo...</span>
                     </div>
                     <span className="text-[10px] opacity-60">Ativo</span>
                  </div>
                </div>
              ))}
           </div>
        </div>
      )}

      <Dialog open={!!selectedPlaybook} onOpenChange={(o) => (!o ? setSelectedPlaybook(null) : null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               Confirmação de Segurança <Info className="w-4 h-4 text-muted-foreground" />
             </DialogTitle>
             <DialogDescription>
               Você está prestes a ativar o playbook <strong>"{selectedPlaybook?.title}"</strong>.<br />
               Esta ação criará regras automáticas no seu negócio, e pode ser desfeita a qualquer momento.
             </DialogDescription>
           </DialogHeader>
           <div className="bg-muted p-4 rounded-lg">
             <p className="text-xs font-bold mb-2">Ações que serão realizadas agora:</p>
             <ul className="text-xs space-y-2">
                {selectedPlaybook?.actions_preview.map((a, i) => (
                  <li key={i} className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-primary" /> {a}
                  </li>
                ))}
             </ul>
           </div>
           <DialogFooter>
             <Button variant="ghost" onClick={() => setSelectedPlaybook(null)} disabled={loading}>Cancelar</Button>
             <Button onClick={handleExecute} disabled={loading}>
               {loading ? "Executando..." : "Confirmar & Executar"}
             </Button>
           </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
