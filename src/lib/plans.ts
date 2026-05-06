
import { PlanId } from "@/types";
export { PlanId };

export interface PlanLimits {
  professionalsLimit: number; // 999 for unlimited
  servicesLimit: number; // 999 for unlimited
  customDomain: boolean;
  automation: "none" | "basic" | "full";
  analytics: "none" | "basic" | "advanced";
  ai: boolean;
  brandingFlowza: boolean;
  whatsappIntegration: "none" | "basic" | "full";
  instagramIntegration: boolean;
  reviews: boolean;
  // extras
  buffer?: boolean;
  socialProof?: boolean;
  smartScheduling?: boolean;
  aiMarketing?: boolean;
  whiteLabelPartial?: boolean;
  multiUnit?: boolean;
  prioritySupport?: boolean;
}

export const PLANS: Record<PlanId, { id: PlanId, name: string, price: number, stripePriceIdMonthly: string | null, stripePriceIdAnnually: string | null, isRecommended?: boolean, limits: PlanLimits }> = {
  [PlanId.FREE]: {
    id: PlanId.FREE,
    name: 'Free',
    price: 0,
    stripePriceIdMonthly: null,
    stripePriceIdAnnually: null,
    limits: {
      professionalsLimit: 1,
      servicesLimit: 3,
      customDomain: false,
      automation: "none",
      analytics: "none",
      ai: false,
      brandingFlowza: true,
      whatsappIntegration: "none",
      instagramIntegration: false,
      reviews: false,
    },
  },
  [PlanId.PRO]: {
    id: PlanId.PRO,
    name: 'Pro',
    price: 97,
    stripePriceIdMonthly: 'price_1TTV5NLnvMLPfJUGtr1Ypkkm',
    stripePriceIdAnnually: null,
    limits: {
      professionalsLimit: 5,
      servicesLimit: 999, // unlimited
      customDomain: false,
      automation: "basic",
      analytics: "basic",
      ai: false,
      brandingFlowza: true,
      whatsappIntegration: "basic",
      instagramIntegration: false,
      reviews: false,
      buffer: true,
    },
  },
  [PlanId.BUSINESS]: {
    id: PlanId.BUSINESS,
    name: 'Business',
    price: 197,
    isRecommended: true,
    stripePriceIdMonthly: 'price_1TTV5aLnvMLPfJUGvRFC87OU',
    stripePriceIdAnnually: null,
    limits: {
      professionalsLimit: 999, // unlimited
      servicesLimit: 999, // unlimited
      customDomain: true,
      automation: "full",
      analytics: "advanced",
      ai: false,
      brandingFlowza: true,
      whatsappIntegration: "full",
      instagramIntegration: true,
      reviews: true,
      socialProof: true,
      smartScheduling: true,
    },
  },
  [PlanId.PREMIUM]: {
    id: PlanId.PREMIUM,
    name: 'Premium',
    price: 297,
    stripePriceIdMonthly: 'price_1TTV1sLnvMLPfJUGluNzgczX',
    stripePriceIdAnnually: null,
    limits: {
      professionalsLimit: 999, // unlimited
      servicesLimit: 999, // unlimited
      customDomain: true,
      automation: "full",
      analytics: "advanced",
      ai: true,
      aiMarketing: true,
      brandingFlowza: false,
      whatsappIntegration: "full",
      instagramIntegration: true,
      reviews: true,
      socialProof: true,
      smartScheduling: true,
      whiteLabelPartial: true,
      multiUnit: true,
      prioritySupport: true,
    },
  },
};

export const checkFeatureAccess = (planId: PlanId, feature: keyof PlanLimits, requiredValue?: any): boolean => {
  const plan = PLANS[planId] || PLANS[PlanId.FREE];
  const value = plan.limits[feature];
  
  if (requiredValue !== undefined) {
    // Handling enum escalations
    if (feature === "automation" || feature === "whatsappIntegration") {
      const levels = ["none", "basic", "full"];
      return levels.indexOf(value as string) >= levels.indexOf(requiredValue);
    }
    if (feature === "analytics") {
      const levels = ["none", "basic", "advanced"];
      return levels.indexOf(value as string) >= levels.indexOf(requiredValue);
    }
    return value === requiredValue;
  }
  
  return !!value;
};

export const checkLimit = (planId: PlanId, type: "professionals" | "services", currentCount: number): boolean => {
  const plan = PLANS[planId] || PLANS[PlanId.FREE];
  if (type === "professionals") {
    return currentCount < plan.limits.professionalsLimit;
  }
  if (type === "services") {
    return currentCount < plan.limits.servicesLimit;
  }
  return false;
};
