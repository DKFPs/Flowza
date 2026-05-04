
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Check, Sparkles, Rocket, Zap, Crown } from "lucide-react";
import { PlanId } from "@/types";
import { PLANS } from "@/lib/plans";
import { useNavigate } from "react-router-dom";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  targetPlan?: PlanId;
}

export const UpgradeModal = ({ open, onOpenChange, feature, targetPlan = PlanId.BUSINESS }: UpgradeModalProps) => {
  const navigate = useNavigate();
  const plan = PLANS[targetPlan];

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/dashboard/settings?tab=subscription");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold">
            {feature ? `Libere ${feature}` : "Faça o upgrade da sua conta"}
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Essa funcionalidade está disponível no plano <strong>{plan.name}</strong>. 
            Automatize seu negócio e atenda mais clientes sem esforço.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            O que você ganha com o plano {plan.name}:
          </h4>
          <ul className="space-y-3">
            {[
              "Agendamentos ilimitados",
              "Notificações avançadas via WhatsApp",
              "Sistema de fidelidade e recorrência",
              "Relatórios detalhados de faturamento",
              "Suporte prioritário"
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <div className="bg-green-500/10 p-1 rounded-full">
                  <Check className="w-4 h-4 text-green-500" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:flex-1">
            Agora não
          </Button>
          <Button onClick={handleUpgrade} className="sm:flex-1 gap-2 bg-primary hover:bg-primary/90">
            Fazer Upgrade agora <Zap className="w-4 h-4 fill-current" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
