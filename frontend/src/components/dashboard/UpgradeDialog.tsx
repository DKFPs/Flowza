import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Check, Sparkles, Rocket, Zap, Crown, Lock } from "lucide-react";
import { PlanId } from "@shared/types";
import { PLANS, PlanLimits } from "@/lib/plans";
import { useNavigate } from "react-router-dom";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
  featureKey?: keyof PlanLimits;
  targetPlan?: PlanId;
}

export const UpgradeDialog = ({ 
  open, 
  onOpenChange, 
  featureName = "Funcionalidade Restrita", 
  featureKey, 
  targetPlan = PlanId.BUSINESS 
}: UpgradeDialogProps) => {
  const navigate = useNavigate();
  const plan = PLANS[targetPlan];

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/dashboard/plans");
  };

  // Determine key benefits to highlight
  const benefits = targetPlan === PlanId.PRO ? [
    "Notificações e lembretes automáticos via WhatsApp",
    "Confirmação instantânea de clientes por mensagens",
    "Cadastro de até 5 profissionais dedicados",
    "Retirada de marca e anúncios da Flowza"
  ] : targetPlan === PlanId.BUSINESS ? [
    "Personalização completa com Domínio Próprio (SEO)",
    "Controle total de até 15 profissionais na sua equipe",
    "Configuração de Sistema de Fidelidade integrado",
    "Agendamento recorrente e recorribilidade preditiva",
    "Automações e marketing em tempo real com WhatsApp"
  ] : [
    "Tudo do plano Business com controle em larga escala",
    "Suporte VIP 24/7 com prioridade máxima",
    "Gestão unificada Multi-Unidades / Múltiplas filiais",
    "Inteligência Artificial (IA) integrada para campanhas",
    "Analytics avançado de escala e rotatividade de clientes"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card text-foreground border-border rounded-3xl overflow-hidden p-0 gap-0">
        <div className="bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent p-6 pb-4 border-b border-border/40 relative">
          <div className="absolute top-4 right-4 text-primary/10">
            <Lock className="w-24 h-24 stroke-[1.5]" />
          </div>
          
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/30">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          </div>
          
          <DialogTitle className="text-2xl font-bold font-heading text-foreground pr-10 leading-tight">
            Desbloqueie {featureName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm mt-2 leading-relaxed">
            Seu plano atual não possui acesso a este recurso. Adquira o plano <strong className="text-primary font-bold">{plan.name}</strong> para expandir seu negócio e decolar seus lucros no piloto automático.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between bg-secondary/40 px-4 py-2.5 rounded-xl border border-border/50">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Investimento Recomendado</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-foreground">R$ {plan.price}</span>
              <span className="text-xs text-muted-foreground">/mês</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">
              Benefícios Inclusos no Plano {plan.name}:
            </h4>
            <ul className="grid gap-2.5">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-snug text-muted-foreground">
                  <div className="bg-primary/10 p-0.5 rounded-full mt-0.5 border border-primary/20 shrink-0">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2 border-t border-border/40 flex-col sm:flex-row gap-3 bg-secondary/20">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="sm:flex-1 font-medium rounded-xl h-11">
            Agora não, obrigado
          </Button>
          <Button 
            onClick={handleUpgrade} 
            variant="premium"
            className="sm:flex-1 h-11 gap-2 font-bold shadow-lg shadow-primary/20 rounded-xl"
          >
            Ver Planos <Zap className="w-4 h-4 fill-current" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
