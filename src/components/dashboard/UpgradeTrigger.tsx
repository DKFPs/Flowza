
import { useEffect } from "react";
import { useBusiness } from "@/contexts/BusinessContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { DiscountService } from "@/services/discountService";
import { Rocket, AlertTriangle } from "lucide-react";
import { PlanId } from "@/types";

export function UpgradeTrigger() {
  const { usage, limits, plan } = useBusiness();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (plan.id === PlanId.PREMIUM) return;

    const checkLimits = async () => {
      const items = [
        { name: "agendamentos", current: usage.appointments, max: 999999 },
        { name: "profissionais", current: usage.professionals, max: limits.professionalsLimit },
        { name: "unidades", current: usage.units, max: (limits.multiUnit ? 999 : 1) },
      ];

      for (const item of items) {
        if (item.max === 9999 || item.max === 999) continue;

        const percentage = (item.current / item.max) * 100;
        
        if (percentage >= 100) {
          toast({
            title: "Limite atingido!",
            description: `Você atingiu o limite de ${item.name} do seu plano ${plan.name}.`,
            variant: "destructive",
            action: (
              <Button size="sm" onClick={() => navigate("/dashboard/plans")}>
                Fazer Upgrade
              </Button>
            ),
          });
          return;
        }

        if (percentage >= 80) {
          const toastId = `limit-80-${item.name}`;
          const hasNotified = sessionStorage.getItem(toastId);
          
          if (!hasNotified) {
            // Criar oferta no banco para persistência
            await DiscountService.createOffer(user.uid, "upgrade_limit_30", "UPGRADE30", "limit_reached", 2);

            toast({
              title: "Oferta de Upgrade Liberada! 🚀",
              description: `Você atingiu 80% do limite de ${item.name}. Faça upgrade agora e use o cupom UPGRADE30 para 30% OFF.`,
              action: (
                <Button size="sm" variant="default" className="bg-primary text-white" onClick={() => navigate("/dashboard/plans")}>
                  Resgatar Desconto
                </Button>
              ),
            });
            sessionStorage.setItem(toastId, "true");
          }
        }
      }
    };

    const timer = setTimeout(checkLimits, 3000); // Small delay
    return () => clearTimeout(timer);
  }, [usage, limits, plan.name, navigate, user]);

  return null;
}
