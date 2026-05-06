import { useBusiness } from "@/contexts/BusinessContext";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

export function TrialBanner() {
  const { business } = useBusiness();

  if (!business || business.subscription_status !== "trialing" || !business.trial_expires_at) {
    return null;
  }

  // Handle firestore timestamp format
  const getExpiryDate = () => {
    if (business.trial_expires_at?.toDate) {
      return business.trial_expires_at.toDate();
    }
    return new Date(business.trial_expires_at);
  };

  const expiryDate = getExpiryDate();
  const daysLeft = differenceInDays(expiryDate, new Date());

  if (daysLeft < 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-400 text-white px-4 py-2 text-sm flex items-center justify-center font-medium gap-2">
      <Clock className="w-4 h-4" />
      <span>
        Você está no período de avaliação gratuita do plano {business.plan_id?.toUpperCase()}. Restam {daysLeft} dia{daysLeft !== 1 ? 's' : ''}.
      </span>
      <Link to="/dashboard/plans" className="underline ml-2 hover:text-amber-100">
        Assinar agora
      </Link>
    </div>
  );
}
