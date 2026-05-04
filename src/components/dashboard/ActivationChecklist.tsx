import { CheckCircle2, Circle, ArrowRight, Share2, Calendar, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "motion/react";
import { useBusiness } from "@/contexts/BusinessContext";
import { Link } from "react-router-dom";

export const ActivationChecklist = () => {
  const { business, usage } = useBusiness();

  if (!business) return null;

  // Determination of progress based on real usage and settings
  const items = [
    { 
      id: "service", 
      title: "Crie seu primeiro serviço", 
      done: (usage.services || 0) >= 1, 
      link: "/dashboard/services",
      icon: Sparkles
    },
    { 
      id: "hours", 
      title: "Configure seus horários", 
      done: !!business.settings?.business_hours, 
      link: "/dashboard/settings",
      icon: Clock
    },
    { 
      id: "share", 
      title: "Compartilhe seu link", 
      done: usage.appointments > 0 || (localStorage.getItem('link_shared') === 'true'), 
      link: "/dashboard",
      icon: Share2,
      action: "copy"
    },
    { 
      id: "booking", 
      title: "Receba seu 1º agendamento", 
      done: (usage.appointments || 0) >= 1, 
      link: "/dashboard/schedule",
      icon: Calendar
    }
  ];

  const completedCount = items.filter(i => i.done).length;
  const progressPercent = (completedCount / items.length) * 100;

  if (completedCount === items.length && (usage.appointments || 0) > 2) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-3xl border bg-card shadow-sm space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black tracking-tight">Ativação da Agenda</h3>
          <p className="text-xs text-muted-foreground">Complete estes passos para começar a faturar.</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-primary">{Math.round(progressPercent)}%</span>
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Concluído</p>
        </div>
      </div>

      <Progress value={progressPercent} className="h-2" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => (
          <div 
            key={item.id}
            className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${item.done ? "bg-primary/[0.03] border-primary/20 opacity-80" : "bg-muted/30 border-border"}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${item.done ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground"}`}>
                {item.done ? <CheckCircle2 className="w-4 h-4" /> : <item.icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-bold ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {item.title}
              </span>
            </div>
            {!item.done && (
              <Link to={item.link}>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
