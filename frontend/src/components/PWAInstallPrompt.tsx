import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "motion/react";
import { useBusiness } from "@/contexts/BusinessContext";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();
  
  const { business } = useBusiness();
  const businessName = business?.name || "o Aplicativo";

  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone;
    
    if (isIOSDevice && !isStandalone) {
      setIsIOS(true);
      // Show iOS prompt after delay
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Delay showing the prompt to not interfere with initial load
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 5000);

      return () => clearTimeout(timer);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      toast({
        title: "Instruções para iOS",
        description: "Toque no ícone de compartilhar e depois em 'Adicionar à Tela de Início'.",
      });
      return;
    }

    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      toast({ title: "Obrigado por instalar!", description: `Agora você tem acesso rápido a ${businessName}.` });
    }

    // We've used the prompt, and can't use it again, so clear it
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-24 left-6 right-6 z-50 md:left-auto md:max-w-sm md:bottom-10 md:right-10"
      >
        <div className="bg-card border border-border shadow-2xl rounded-3xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex justify-between items-start">
             <div className="flex gap-4 items-center">
                <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shrink-0">
                   <Download className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                   <h4 className="font-bold text-sm">
                     {isIOS ? `Instalar ${businessName === 'o Aplicativo' ? 'App' : businessName}` : `Instalar ${businessName === 'o Aplicativo' ? 'App' : businessName}`}
                   </h4>
                   <p className="text-xs text-muted-foreground">
                     {isIOS ? "Adicione à tela de início para melhor experiência." : "Tenha uma experiência de aplicativo no seu celular."}
                   </p>
                </div>
             </div>
             <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setIsVisible(false)}>
                <X className="w-4 h-4" />
             </Button>
          </div>
          
          {isIOS ? (
            <div className="bg-muted/50 rounded-2xl p-4 flex flex-col gap-2">
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Passo a passo:</p>
              <ol className="text-xs space-y-2 list-decimal list-inside">
                <li>Toque no botão de <strong>Compartilhar</strong> (ícone de quadrado com seta)</li>
                <li>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong></li>
              </ol>
            </div>
          ) : (
            <Button onClick={handleInstallClick} className="w-full rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-12">
              Adicionar à tela inicial
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
