
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { collection, query, where, getDocs, limit, onSnapshot, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Business, PlanId } from "@/types";
import { PLANS, PlanLimits } from "@/lib/plans";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";

interface BusinessContextType {
  business: Business | null;
  loading: boolean;
  plan: typeof PLANS[PlanId];
  limits: PlanLimits;
  usage: {
    appointments: number;
    professionals: number;
    services: number;
    units: number;
  };
  refreshBusiness: () => Promise<void>;
  checkPermission: (feature: keyof PlanLimits) => boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (!context) throw new Error("useBusiness must be used within a BusinessProvider");
  return context;
};

export const BusinessProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState({ appointments: 0, professionals: 0, services: 0, units: 0 });

  useEffect(() => {
    if (!user) {
      setBusiness(null);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "businesses"), where("owner_id", "==", user.uid), limit(1));
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const biz = { id: snap.docs[0].id, ...snap.docs[0].data() } as Business;
        setBusiness(biz);
        
        // Use counters from business document as source of truth
        setUsage({
          appointments: biz.usage_appointments || 0,
          professionals: biz.usage_professionals || 0,
          services: biz.usage_services || 0,
          units: biz.usage_units || 0,
        });
      } else {
        setBusiness(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching business snapshot:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const fetchBusiness = useCallback(async () => {
    // Left for backwards compatibility if called manually, but onSnapshot handles state naturally
  }, []);



  let planIdRaw = business?.plan_id?.toLowerCase() as PlanId;
  
  if (business?.subscription_status === 'trialing' && business?.trial_expires_at) {
    const getExpiryDate = () => {
      if (typeof business.trial_expires_at.toDate === 'function') {
        return business.trial_expires_at.toDate();
      }
      return new Date(business.trial_expires_at as any);
    };
    
    if (getExpiryDate() < new Date()) {
      planIdRaw = PlanId.FREE;
    }
  }

  const currentPlanId = Object.values(PlanId).includes(planIdRaw) ? planIdRaw : PlanId.FREE;
  const currentPlan = PLANS[currentPlanId];

  const checkPermission = (feature: keyof PlanLimits) => {
    return !!currentPlan?.limits?.[feature];
  };

  return (
    <BusinessContext.Provider 
      value={{ 
        business, 
        loading, 
        plan: currentPlan,
        limits: currentPlan.limits,
        usage,
        refreshBusiness: fetchBusiness,
        checkPermission
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};
