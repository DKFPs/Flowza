import { useState, useEffect } from "react";
import { PWAInstallPrompt } from "./PWAInstallPrompt";
import { useToast } from "@/hooks/use-toast";
import { WifiOff } from "lucide-react";
import { registerSW } from 'virtual:pwa-register';
import { useLocation } from "react-router-dom";

export const PWAHandler = () => {
  const { toast } = useToast();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const location = useLocation();

  // Simplified: Always assume it's part of the platform PWA
  const isFlowzaApp = true;

  useEffect(() => {
    // Keep manifest active
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink && manifestLink.hasAttribute('data-href')) {
      manifestLink.setAttribute('href', manifestLink.getAttribute('data-href') || '');
    }

    // Solicitar permissão de notificação para lembretes de agendamento
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          toast({
            title: "Notificações Ativadas",
            description: "Você receberá lembretes automáticos dos seus agendamentos.",
          });
        }
      });
    }
  }, [toast]);

  useEffect(() => {
    // Registrando a PWA para suportar offline caching na Flowza
    const updateSW = registerSW({
      onNeedRefresh() {
        toast({
          title: "Nova versão disponível",
          description: "Atualize a página para acessar a nova versão.",
        });
      },
      onOfflineReady() {
        console.log("PWA ready for offline use");
      },
    });

    const handleOnline = () => {
      setIsOffline(false);
      toast({
        title: "Conexão restabelecida",
        description: "Você está online novamente.",
        variant: "default",
      });
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast({
        title: "Estamos offline",
        description: "Algumas funcionalidades podem estar limitadas.",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  return (
    <>
      {isFlowzaApp && <PWAInstallPrompt />}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground py-2 px-4 text-center text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-full">
          <WifiOff className="w-3 h-3" />
          Sem conexão com a internet. Verifique seu sinal.
        </div>
      )}
    </>
  );
};
