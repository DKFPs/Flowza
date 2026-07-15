
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DiscountService } from "@backend/services/discountService";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Gift } from "lucide-react";

export function InactivityTrigger() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Lógica: Se o usuário não visitou a página de agendamentos ou schedule por mais de 48h
    const checkInactivity = async () => {
      const lastActivity = localStorage.getItem("last_active_timestamp");
      const fortyEightHours = 48 * 60 * 60 * 1000;
      
      if (lastActivity) {
        const timeSince = Date.now() - parseInt(lastActivity);
        
        if (timeSince > fortyEightHours) {
          const hasReceivedInactivityOffer = localStorage.getItem("inactivity_offer_received");
          
          if (!hasReceivedInactivityOffer) {
            await DiscountService.createOffer(user.uid, "comeback_20", "VOLTE20", "inactivity", 7);
            
            toast({
              title: "Sentimos sua falta! 🎁",
              description: "Temos um presente para ajudar seu negócio a decolar. Ganhe 20% OFF com o cupom VOLTE20.",
              action: (
                <Button variant="default" onClick={() => navigate("/dashboard/plans")}>
                  Ver Presente
                </Button>
              )
            });
            
            localStorage.setItem("inactivity_offer_received", "true");
          }
        }
      }
      
      // Atualiza atividade atual
      localStorage.setItem("last_active_timestamp", Date.now().toString());
    };

    const timer = setTimeout(checkInactivity, 5000); 
    return () => clearTimeout(timer);
  }, [user, navigate]);

  return null;
}
