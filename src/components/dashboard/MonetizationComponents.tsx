import { ReactNode } from "react";
import { lock, Sparkles, ChevronRight, Lock, TrendingUp, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { useBusiness } from "@/contexts/BusinessContext";
import { PlanId } from "@/types";

interface UpgradeButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost" | "link" | "secondary";
  children?: ReactNode;
}

export const UpgradeButton = ({ className, variant = "default", children }: UpgradeButtonProps) => {
  const { plan } = useBusiness();
  if (plan?.id === PlanId.PREMIUM) return null;

  return (
    <Link to="/dashboard/plans">
      <Button 
        variant={variant} 
        size="sm" 
        className={`gap-2 font-bold uppercase text-[10px] tracking-widest ${className}`}
      >
        <Sparkles className="w-3 h-3" />
        {children || "Ativar Crescimento Automático"}
      </Button>
    </Link>
  );
};

interface FeatureLockProps {
  children: ReactNode;
  isLocked: boolean;
  featureName: string;
  planName: string;
}

export const FeatureLock = ({ children, isLocked, featureName, planName }: FeatureLockProps) => {
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative group overflow-hidden border border-border/40 rounded-2xl min-h-[70vh]">
      <div className="pointer-events-none opacity-50 transition-opacity group-hover:opacity-30">
        {children}
      </div>
      <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px]" />
      <div className="absolute inset-0 flex flex-col items-center p-6 text-center animate-in fade-in duration-500 z-50 pointer-events-auto">
        <div className="sticky top-1/3 bg-background/95 backdrop-blur shadow-2xl border border-border/50 p-8 rounded-3xl max-w-sm flex flex-col items-center">
          <div className="p-3 rounded-full bg-primary/10 mb-4 group-hover:scale-110 transition-transform">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h4 className="font-bold text-lg mb-2">{featureName || "Visualização Liberada"}</h4>
          <p className="text-sm text-muted-foreground mb-6">
            Esta área mostra as ferramentas disponíveis. Para usar as funções ativamente, é necessário ter o plano <span className="text-primary font-black uppercase text-[10px]">{planName || "PREMIUM"}</span>.
          </p>
          <UpgradeButton className="rounded-xl w-full h-11 shadow-lg shadow-primary/20">
            Fazer Upgrade Agora
          </UpgradeButton>
        </div>
      </div>
    </div>
  );
};

interface UpgradeTriggerProps {
  type: "limit" | "cancellation" | "growth" | "opportunity";
  title: string;
  description: string;
  solution: string;
}

export const UpgradeTrigger = ({ type, title, description, solution }: UpgradeTriggerProps) => {
  const { plan } = useBusiness();
  if (plan?.id === PlanId.PREMIUM) return null;

  const icons = {
    limit: AlertCircle,
    cancellation: Zap,
    growth: TrendingUp,
    opportunity: Sparkles
  };
  const Icon = icons[type];
  
  // Custom text for cancellation/limit to focus on lost revenue
  const isLoss = type === "limit" || type === "cancellation";

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-5 rounded-2xl border ${isLoss ? 'bg-red-50/50 border-red-200' : 'bg-gradient-to-br from-primary/5 to-transparent border-primary/20'} flex gap-4 relative overflow-hidden group`}
    >
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-colors ${isLoss ? 'bg-red-100 group-hover:bg-red-200' : 'bg-primary/5 group-hover:bg-primary/10'}`} />
      
      <div className={`p-3 h-fit rounded-xl ${isLoss ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
        <Icon className="w-6 h-6" />
      </div>
      
      <div className="flex-1 space-y-3">
        <div>
          <Badge variant="outline" className={`text-[9px] font-black uppercase mb-1 ${isLoss ? 'border-red-200 text-red-600' : 'border-primary/20 text-primary'}`}>
            {isLoss ? 'Dinheiro Deixado na Mesa' : 'Ação Recomendada'}
          </Badge>
          <h3 className="font-black text-sm tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        
        <div className="p-3 rounded-xl bg-white/50 border border-border/40 space-y-2">
          <p className="text-xs font-bold flex items-center gap-2">
             <Zap className="w-3 h-3 text-amber-500" /> COMO O PREMIUM RESOLVE:
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{solution}</p>
        </div>

        <UpgradeButton className="w-full rounded-xl h-10 shadow-md shadow-primary/10">
          Ativar crescimento automático
        </UpgradeButton>
      </div>
    </motion.div>
  );
};

export const GrowthOpportunity = ({ potentialAmount }: { potentialAmount: number }) => {
  const { plan } = useBusiness();
  if (plan?.id === PlanId.PREMIUM) return null;

  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.02] shadow-sm relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[60px] translate-x-12 -translate-y-12" />
      <CardContent className="pt-6 relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-sm uppercase tracking-tight">Oportunidade de Receita</h4>
            <p className="text-[10px] text-muted-foreground">O sistema identificou um ganho garantido</p>
          </div>
        </div>
        
        <div className="mb-6">
          <p className="text-xs text-muted-foreground mb-1">Você pode ganhar até:</p>
          <h3 className="text-3xl font-black text-primary">R$ {potentialAmount.toLocaleString()} <span className="text-xs text-muted-foreground">/mês</span></h3>
        </div>

        <div className="grid grid-cols-1 gap-2 mb-6">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-white/50 p-2 rounded-lg border border-border/40">
            <Sparkles className="w-4 h-4 text-primary shrink-0" /> Campanhas automáticas (IA) para reter clientes
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-white/50 p-2 rounded-lg border border-border/40">
            <Zap className="w-4 h-4 text-primary shrink-0" /> Reativação de clientes inativos 100% automática
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-white/50 p-2 rounded-lg border border-border/40">
            <AlertCircle className="w-4 h-4 text-primary shrink-0" /> Previsões financeiras para garantir fluxo de caixa
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-white/50 p-2 rounded-lg border border-border/40">
            <TrendingUp className="w-4 h-4 text-primary shrink-0" /> Playbooks de ação para lotar a agenda
          </div>
        </div>

        <UpgradeButton className="w-full rounded-xl py-6 text-sm hover:scale-[1.02] transition-transform">
          Aumentar faturamento agora
        </UpgradeButton>
      </CardContent>
    </Card>
  );
};
