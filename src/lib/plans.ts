
import { PlanId } from "@/types";
export { PlanId };

export interface PlanLimit {
  maxAppointments: number;
  maxProfessionals: number;
  maxServices: number;
  maxUnits: number;
  hasWaitlist: boolean;
  hasLoyalty: boolean;
  hasRecurring: boolean;
  hasAdvancedCustomization: boolean;
  hasReminders: boolean;
  hasAnalytics: boolean;
  hasPrioritySupport: boolean;
  hasSmartCampaigns: boolean;
  hasInstagram: boolean;
  hasApiKeys: boolean;
  hasCustomDomain: boolean;
}

export const PLANS = {
  [PlanId.FREE]: {
    id: PlanId.FREE,
    name: 'Free',
    price: 0,
    stripePriceIdMonthly: null,
    stripePriceIdAnnually: null,
    limits: {
      maxAppointments: 30,
      maxProfessionals: 1,
      maxServices: 3,
      maxUnits: 1,
      hasWaitlist: false,
      hasLoyalty: false,
      hasRecurring: false,
      hasAdvancedCustomization: false,
      hasReminders: false,
      hasAnalytics: false,
      hasPrioritySupport: false,
      hasSmartCampaigns: false,
      hasInstagram: false,
      hasApiKeys: false,
      hasCustomDomain: false,
    },
  },
  [PlanId.PRO]: {
    id: PlanId.PRO,
    name: 'Pro',
    price: 97,
    stripePriceIdMonthly: 'price_1TRht8LnvMLPfJUGkD8Ytmfj',
    stripePriceIdAnnually: 'price_1TRhxBLnvMLPfJUGUycmWlsH',
    limits: {
      maxAppointments: 150,
      maxProfessionals: 1,
      maxServices: 10,
      maxUnits: 1,
      hasWaitlist: true,
      hasLoyalty: false,
      hasRecurring: false,
      hasAdvancedCustomization: false,
      hasReminders: true,
      hasAnalytics: false,
      hasPrioritySupport: false,
      hasSmartCampaigns: false,
      hasInstagram: true,
      hasApiKeys: false,
      hasCustomDomain: false,
    },
  },
  [PlanId.BUSINESS]: {
    id: PlanId.BUSINESS,
    name: 'Business',
    price: 197,
    isRecommended: true,
    stripePriceIdMonthly: 'price_1TRhtYLnvMLPfJUGFibDaKw4',
    stripePriceIdAnnually: 'price_1TRhyDLnvMLPfJUGAcGiAawT',
    limits: {
      maxAppointments: 500,
      maxProfessionals: 5,
      maxServices: 999, // unlimited
      maxUnits: 3,
      hasWaitlist: true,
      hasLoyalty: true,
      hasRecurring: true,
      hasAdvancedCustomization: true,
      hasReminders: true,
      hasAnalytics: true,
      hasPrioritySupport: true,
      hasSmartCampaigns: false,
      hasInstagram: true,
      hasApiKeys: true,
      hasCustomDomain: true,
    },
  },
  [PlanId.PREMIUM]: {
    id: PlanId.PREMIUM,
    name: 'Premium',
    price: 297,
    stripePriceIdMonthly: 'price_1TRhtyLnvMLPfJUGW9V9ECyw',
    stripePriceIdAnnually: 'price_1TRhygLnvMLPfJUGTTf2pypj',
    limits: {
      maxAppointments: 9999, // unlimited
      maxProfessionals: 999, // unlimited
      maxServices: 999,
      maxUnits: 99,
      hasWaitlist: true,
      hasLoyalty: true,
      hasRecurring: true,
      hasAdvancedCustomization: true,
      hasReminders: true,
      hasAnalytics: true,
      hasPrioritySupport: true,
      hasSmartCampaigns: true,
      hasInstagram: true,
      hasApiKeys: true,
      hasCustomDomain: true,
    },
  },
};
