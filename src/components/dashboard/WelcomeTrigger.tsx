
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DiscountService } from "@/services/discountService";
import { useBusiness } from "@/contexts/BusinessContext";

export function WelcomeTrigger() {
  const { user } = useAuth();
  const { business } = useBusiness();

  useEffect(() => {
    if (!user || !business) return;

    const checkWelcomeOffer = async () => {
      const hasOffer = localStorage.getItem("welcome_offer_created");
      
      if (!hasOffer) {
        // Criar oferta de 30% OFF de ativação válida por 24h
        await DiscountService.createOffer(user.uid, "welcome_30", "START30", "activation", 1);
        localStorage.setItem("welcome_offer_created", "true");
      }
    };

    checkWelcomeOffer();
  }, [user, business]);

  return null;
}
