
import { useState, useEffect } from "react";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useBusiness } from "@/contexts/BusinessContext";
import { useAuth } from "@/contexts/AuthContext";
import { DiscountService, UserOffer } from "@backend/services/discountService";
import { PlanId } from "@shared/types";
import { CountdownTimer } from "./CountdownTimer";

export function PromoBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [offer, setOffer] = useState<UserOffer | null>(null);
  const navigate = useNavigate();
  const { plan } = useBusiness();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchOffer = async () => {
      // Só mostrar banner se for plano gratuito
      if (plan.id === PlanId.FREE) {
        const offers = await DiscountService.getUserOffers(user.uid);
        if (offers.length > 0) {
          setOffer(offers[0]);
          
          const dismissTime = localStorage.getItem("promo_banner_dismissed");
          const oneHour = 60 * 60 * 1000;
          
          if (!dismissTime || (Date.now() - parseInt(dismissTime) > oneHour)) {
            setIsVisible(true);
          }
        }
      } else {
        setIsVisible(false);
      }
    };

    fetchOffer();
  }, [plan.id, user]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("promo_banner_dismissed", Date.now().toString());
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-primary overflow-hidden relative"
        >
          <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-4 text-primary-foreground text-sm font-medium">
            <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse hidden sm:block" />
            <div className="flex flex-col sm:flex-row items-center gap-x-4 gap-y-1">
              <p className="text-center">
                Oferta Exclusiva: <span className="font-bold text-yellow-200">{offer?.code || "START30"}</span> para 30% de desconto!
              </p>
              <div className="flex items-center gap-2 bg-black/20 px-3 py-0.5 rounded-full border border-white/10">
                <span className="text-[10px] uppercase opacity-70">Expira em:</span>
                <CountdownTimer hours={2} />
              </div>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-xs font-bold px-4 hidden md:flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
              onClick={() => navigate("/dashboard/plans")}
            >
              Resgatar Agora <ArrowRight className="w-3 h-3" />
            </Button>
            <button 
              onClick={handleDismiss}
              className="absolute right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
