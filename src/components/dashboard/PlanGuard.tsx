
import { useState, ReactNode } from "react";
import { useBusiness } from "@/contexts/BusinessContext";
import { PlanLimit } from "@/lib/plans";
import { PlanId } from "@/types";
import { UpgradeModal } from "./UpgradeModal";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanGuardProps {
  feature: keyof PlanLimit;
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  targetPlan?: PlanId;
  label?: string;
}

export const PlanGuard = ({ 
  feature, 
  children, 
  fallback, 
  className, 
  targetPlan = PlanId.BUSINESS,
  label
}: PlanGuardProps) => {
  const { checkPermission } = useBusiness();
  const [modalOpen, setModalOpen] = useState(false);
  
  const hasPermission = checkPermission(feature);

  if (hasPermission) {
    return <>{children}</>;
  }

  if (fallback) {
    return <div onClick={() => setModalOpen(true)} className="cursor-pointer">{fallback}</div>;
  }

  return (
    <div className={cn("relative group", className)}>
      <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setModalOpen(true)}>
        <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
          <Lock className="w-3 h-3" />
          Libere com {targetPlan.toUpperCase()}
        </div>
      </div>
      <div className="filter grayscale-[0.5] opacity-60 pointer-events-none select-none">
        {children}
      </div>
      <UpgradeModal 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
        feature={label} 
        targetPlan={targetPlan}
      />
    </div>
  );
};
