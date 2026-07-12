
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { collection, query, where, getDocs, limit, onSnapshot, doc, getDoc } from "firebase/firestore";
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

    setLoading(true);

    const fallbackFetch = async () => {
      try {
        const q = query(collection(db, "businesses"), where("owner_id", "==", user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          // Sort client-side by created_at descending to find the latest
          const sortedDocs = [...snap.docs].sort((a, b) => {
            const aVal = a.data().created_at;
            const bVal = b.data().created_at;
            const aTime = aVal?.toMillis ? aVal.toMillis() : (aVal?.seconds ? aVal.seconds * 1000 : new Date(aVal || 0).getTime());
            const bTime = bVal?.toMillis ? bVal.toMillis() : (bVal?.seconds ? bVal.seconds * 1000 : new Date(bVal || 0).getTime());
            return bTime - aTime;
          });
          const latestDoc = sortedDocs[0];
          const biz = { id: latestDoc.id, ...latestDoc.data() } as Business;
          setBusiness(biz);
          setUsage({
            appointments: biz.usage_appointments || 0,
            professionals: biz.usage_professionals || 0,
            services: biz.usage_services || 0,
            units: biz.usage_units || 0,
          });
        } else {
          setBusiness(null);
        }
      } catch (err) {
        console.error("Fallback fetch error:", err);
        setBusiness(null);
      } finally {
        setLoading(false);
      }
    };

    // Listen to the user's profile to retrieve the linked business_id
    const profileRef = doc(db, "profiles", user.uid);
    const unsubscribeProfile = onSnapshot(profileRef, (profileSnap) => {
      if (profileSnap.exists()) {
        const linkedBizId = profileSnap.data().business_id;
        if (linkedBizId) {
          // Listen to the specific business document
          const bizRef = doc(db, "businesses", linkedBizId);
          getDoc(bizRef).then((bizSnap) => {
            if (bizSnap.exists()) {
              const biz = { id: bizSnap.id, ...bizSnap.data() } as Business;
              setBusiness(biz);
              setUsage({
                appointments: biz.usage_appointments || 0,
                professionals: biz.usage_professionals || 0,
                services: biz.usage_services || 0,
                units: biz.usage_units || 0,
              });
              setLoading(false);
            } else {
              fallbackFetch();
            }
          }).catch((err) => {
            console.error("Error fetching linked business:", err);
            fallbackFetch();
          });
        } else {
          fallbackFetch();
        }
      } else {
        fallbackFetch();
      }
    }, (error) => {
      console.error("Error listening to profile:", error);
      fallbackFetch();
    });

    return () => {
      unsubscribeProfile();
    };
  }, [user]);

  const fetchBusiness = useCallback(async () => {
    // Left for backwards compatibility if called manually, but onSnapshot handles state naturally
  }, []);



  let planIdRaw = business?.plan_id?.toLowerCase() as PlanId;
  const subStatus = business?.subscription_status;
  
  if (subStatus && subStatus !== 'active' && subStatus !== 'trialing') {
    planIdRaw = PlanId.FREE;
  } else if (business?.subscription_status === 'trialing' && business?.trial_expires_at) {
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
