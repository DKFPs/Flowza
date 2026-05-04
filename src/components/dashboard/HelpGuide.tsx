import React, { useState, useEffect } from "react";
import { 
  HelpCircle, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Info,
  Lightbulb,
  Target,
  Calendar,
  Users,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion, AnimatePresence } from "motion/react";
import { useLocation } from "react-router-dom";

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface PageGuide {
  [key: string]: Step[];
}

const GUIDES: PageGuide = {
  "/dashboard": [
    {
      title: "Resumo Geral",
      description: "Aqui você tem uma visão rápida do seu negócio: agendamentos de hoje, novos clientes e faturamento.",
      icon: <Target className="w-5 h-5 text-primary" />
    },
    {
      title: "Link de Agendamento",
      description: "Use o link em destaque para compartilhar sua página com seus clientes no Instagram e WhatsApp.",
      icon: <Lightbulb className="w-5 h-5 text-yellow-500" />
    }
  ],
  "/dashboard/schedule": [
    {
      title: "Sua Agenda",
      description: "Visualize todos os compromissos em formato de calendário. Você pode arrastar para reagendar ou clicar para ver detalhes.",
      icon: <Info className="w-5 h-5 text-blue-500" />
    }
  ],
  "/dashboard/services": [
    {
      title: "Gestão de Serviços",
      description: "Cadastre tudo o que você oferece. Defina preços, duração e profissionais que realizam cada tarefa.",
      icon: <Lightbulb className="w-5 h-5 text-primary" />
    }
  ],
  "/dashboard/settings": [
    {
      title: "Personalização",
      description: "Mude as cores, o logo e as informações do seu negócio. Deixe sua página com a sua cara!",
      icon: <HelpCircle className="w-5 h-5 text-purple-500" />
    }
  ],
  "/dashboard/clients": [
    {
      title: "Base de Clientes",
      description: "Acompanhe o histórico de cada cliente, fidelidade e preferências automáticas.",
      icon: <Target className="w-5 h-5 text-green-500" />
    }
  ],
  "/dashboard/appointments": [
    {
      title: "Gestão de Reservas",
      description: "Aqui você gerencia todos os agendamentos. Você pode confirmar, cancelar ou reagendar com um clique.",
      icon: <Calendar className="w-5 h-5 text-primary" />
    },
    {
      title: "Filtros Rápidos",
      description: "Use os filtros no topo para ver apenas os atendimentos de hoje ou de um profissional específico.",
      icon: <Info className="w-5 h-5 text-blue-400" />
    }
  ],
  "/dashboard/professionals": [
    {
      title: "Sua Equipe",
      description: "Cadastre seus funcionários aqui. Cada um pode ter horários de trabalho e serviços específicos vinculados.",
      icon: <Users className="w-5 h-5 text-orange-500" />
    }
  ],
  "/dashboard/analytics": [
    {
      title: "Saúde do Negócio",
      description: "Gráficos detalhados sobre seu faturamento, horários de pico e serviços mais procurados.",
      icon: <Activity className="w-5 h-5 text-blue-600" />
    }
  ]
};

export function HelpGuide() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasNewInfo, setHasNewInfo] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("onboarding_seen");
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        localStorage.setItem("onboarding_seen", "true");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const guide = GUIDES[location.pathname] || GUIDES["/dashboard"];

  useEffect(() => {
    // Notify user when they enter a new page with guidance
    if (GUIDES[location.pathname]) {
      setHasNewInfo(true);
      const timer = setTimeout(() => setHasNewInfo(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const toggleGuide = () => {
    setIsOpen(!isOpen);
    setCurrentStep(0);
    setHasNewInfo(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4"
          >
            <Card className="w-80 shadow-2xl border-primary/20 bg-card/95 backdrop-blur-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    {guide[currentStep].icon}
                  </div>
                  <CardTitle className="text-sm font-bold">Dica Útil</CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="pb-4">
                <h3 className="font-bold text-base mb-1">{guide[currentStep].title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {guide[currentStep].description}
                </p>
              </CardContent>
              <CardFooter className="flex items-center justify-between pt-0">
                <div className="flex gap-1">
                  {guide.map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-1 w-4 rounded-full transition-colors ${i === currentStep ? 'bg-primary' : 'bg-primary/20'}`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  {currentStep > 0 && (
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentStep(prev => prev - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  {currentStep < guide.length - 1 ? (
                    <Button variant="default" size="sm" className="h-7 text-[10px]" onClick={() => setCurrentStep(prev => prev + 1)}>
                      Próximo <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  ) : (
                    <Button variant="default" size="sm" className="h-7 text-[10px]" onClick={() => setIsOpen(false)}>
                      Entendi!
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        {hasNewInfo && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-14 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap shadow-lg pointer-events-none"
          >
            Novas dicas aqui! ✨
          </motion.div>
        )}
        <Button
          onClick={toggleGuide}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg border-2 border-background animate-in fade-in zoom-in duration-300"
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
