import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PlanId } from "@/types";
import { PLANS, PlanLimits } from "@/lib/plans";

export function useSubscription() {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<PlanId>(PlanId.FREE);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<{ key: keyof PlanLimits; label: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setCurrentPlan(PlanId.FREE);
      setLoading(false);
      return;
    }

    setLoading(true);
    const fetchPerms = async () => {
      try {
        const profileRef = doc(db, "profiles", user.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const bizId = profileSnap.data().business_id;
          if (bizId) {
            const bizRef = doc(db, "businesses", bizId);
            const bizSnap = await getDoc(bizRef);
            if (bizSnap.exists()) {
              const data = bizSnap.data();
              let planRaw = (data.plan_id || PlanId.FREE).toLowerCase() as PlanId;
              const subStatus = data.subscription_status;
              
              if (subStatus && subStatus !== "active" && subStatus !== "trialing") {
                planRaw = PlanId.FREE;
              }
              
              const finalPlan = Object.values(PlanId).includes(planRaw) ? planRaw : PlanId.FREE;
              setCurrentPlan(finalPlan);
              setBusinessName(data.name || "");
            }
          }
        }
      } catch (err) {
        console.error("Error fetching permissions from Firestore:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerms();
  }, [user]);

  const hasFeature = (feature: keyof PlanLimits): boolean => {
    const planConfig = PLANS[currentPlan];
    if (!planConfig) return false;
    return !!planConfig.limits[feature];
  };

  const getRequiredPlan = (feature: keyof PlanLimits): PlanId => {
    if (PLANS[PlanId.FREE].limits[feature]) return PlanId.FREE;
    if (PLANS[PlanId.PRO].limits[feature]) return PlanId.PRO;
    if (PLANS[PlanId.BUSINESS].limits[feature]) return PlanId.BUSINESS;
    return PlanId.PREMIUM;
  };

  const triggerUpgrade = (feature: keyof PlanLimits, label: string) => {
    setUpgradeFeature({ key: feature, label });
    setIsUpgradeOpen(true);
  };

  return {
    plan: currentPlan,
    planName: PLANS[currentPlan]?.name || "Free",
    limits: PLANS[currentPlan]?.limits || PLANS[PlanId.FREE].limits,
    loading,
    businessName,
    hasFeature,
    getRequiredPlan,
    isPro: currentPlan === PlanId.PRO,
    isBusiness: currentPlan === PlanId.BUSINESS,
    isPremium: currentPlan === PlanId.PREMIUM,
    isUpgradeOpen,
    setIsUpgradeOpen,
    upgradeFeature,
    triggerUpgrade,
  };
}
