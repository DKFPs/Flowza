
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Crown, Rocket } from "lucide-react";
import { PLANS, PlanId } from "@/lib/plans";
import { useBusiness } from "@/contexts/BusinessContext";
import { cn } from "@/lib/utils";

export const PricingGrid = () => {
  const { business } = useBusiness();
  const currentPlanId = business?.plan_id || PlanId.FREE;

  const plans = Object.values(PLANS);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-8">
      {plans.map((plan) => {
        const isCurrent = currentPlanId === plan.id;
        const isBusiness = plan.id === PlanId.BUSINESS;

        return (
          <div 
            key={plan.id}
            className={cn(
              "relative bg-card rounded-2xl border flex flex-col p-6 transition-all duration-300",
              isBusiness ? "border-primary shadow-xl ring-1 ring-primary scale-105 z-10" : "border-border hover:border-border-hover shadow-sm",
              isCurrent && !isBusiness && "ring-2 ring-muted-foreground/20"
            )}
          >
            {isBusiness && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 fill-current" /> Mais escolhido
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground font-heading">R$ {plan.price}</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
              {plan.id === PlanId.FREE && (
                <>
                  <FeatureItem text="Até 30 agendamentos/mês" />
                  <FeatureItem text="1 profissional" />
                  <FeatureItem text="3 serviços" />
                  <FeatureItem text="Página pública básica" />
                </>
              )}
              {plan.id === PlanId.PRO && (
                <>
                  <FeatureItem text="Até 150 agendamentos/mês" />
                  <FeatureItem text="1 profissional" />
                  <FeatureItem text="Até 10 serviços" />
                  <FeatureItem text="Lembretes via WhatsApp" />
                  <FeatureItem text="Confirmação automática" />
                  <FeatureItem text="Personalização básica" />
                </>
              )}
              {plan.id === PlanId.BUSINESS && (
                <>
                  <FeatureItem text="Até 500 agendamentos/mês" />
                  <FeatureItem text="Até 5 profissionais" />
                  <FeatureItem text="Serviços ilimitados" />
                  <FeatureItem text="Sistema de Fidelidade" />
                  <FeatureItem text="Agendamento Recorrente" />
                  <FeatureItem text="Domínio Personalizado" />
                  <FeatureItem text="Notificações avançadas" />
                  <FeatureItem text="Personalização completa" />
                  <FeatureItem text="Suporte prioritário" />
                </>
              )}
              {plan.id === PlanId.PREMIUM && (
                <>
                  <FeatureItem text="Agendamentos ilimitados" />
                  <FeatureItem text="Profissionais ilimitados" />
                  <FeatureItem text="Relatórios avançados" />
                  <FeatureItem text="Métricas de crescimento" />
                  <FeatureItem text="Suporte VIP" />
                  <FeatureItem text="Acesso antecipado" />
                </>
              )}
            </ul>

            <Button 
              className={cn(
                "w-full gap-2",
                isCurrent ? "bg-muted text-muted-foreground hover:bg-muted" : (isBusiness ? "bg-primary hover:bg-primary/90" : "bg-foreground text-background hover:bg-foreground/90")
              )}
              disabled={isCurrent}
            >
              {isCurrent ? "Plano Atual" : "Selecionar Plano"}
              {!isCurrent && (plan.id === PlanId.BUSINESS ? <Zap className="w-4 h-4 fill-current" /> : (plan.id === PlanId.PREMIUM ? <Crown className="w-4 h-4 fill-current" /> : <Rocket className="w-4 h-4" />))}
            </Button>
          </div>
        );
      })}
    </div>
  );
};

const FeatureItem = ({ text }: { text: string }) => (
  <li className="flex items-start gap-3 text-sm">
    <div className="bg-green-500/10 p-0.5 rounded-full mt-0.5">
      <Check className="w-3.5 h-3.5 text-green-500" />
    </div>
    <span className="text-muted-foreground leading-tight">{text}</span>
  </li>
);
