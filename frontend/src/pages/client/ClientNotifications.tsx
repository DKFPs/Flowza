import { useEffect, useState } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, BellOff, CheckCircle, AlertCircle, Info, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Notification as AppNotification } from "@shared/types";

const typeIcons: Record<string, any> = {
  booking_confirmation: CheckCircle,
  booking_reminder: Bell,
  review_request: Info,
  no_show_recovery: AlertCircle,
  booking_cancelled: AlertCircle,
};

const ClientNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);

  // Preferences stored locally (could be extended to DB)
  const [prefs, setPrefs] = useState({
    confirmations: true,
    reminders: true,
    reviews: true,
    promotions: true,
  });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        // Get Client ID
        const clientQuery = query(collection(db, "clients"), where("user_id", "==", user.uid), limit(1));
        const clientSnap = await getDocs(clientQuery);
        
        if (clientSnap.empty) {
          setLoading(false);
          return;
        }

        const clientId = clientSnap.docs[0].id;
        
        const q = query(
          collection(db, "notifications"),
          where("client_id", "==", clientId),
          orderBy("created_at", "desc"),
          limit(30)
        );
        const snap = await getDocs(q);
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Check if push is enabled
        if ("Notification" in window) {
           setPushEnabled(Notification.permission === "granted");
        }

      } catch (err) {
        console.error("Error loading notifications:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const requestPushPermission = async () => {
     if (!("Notification" in window)) {
        toast({ title: "Não suportado", description: "Seu navegador não suporta notificações push.", variant: "destructive" });
        return;
     }

     const permission = await Notification.requestPermission();
     if (permission === "granted") {
        setPushEnabled(true);
        toast({ title: "Notificações ativadas! ✨", description: "Agora você receberá alertas de agendamentos." });
     } else {
        toast({ title: "Notificações negadas", description: "Você pode mudar isso nas configurações do navegador.", variant: "destructive" });
     }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in duration-700">
      <h1 className="text-3xl font-black text-foreground">Notificações</h1>

      {/* PUSH STATUS */}
      <div className={`p-6 rounded-3xl border-2 transition-all ${pushEnabled ? 'bg-primary/5 border-primary/10' : 'bg-orange-500/5 border-orange-500/10'}`}>
         <div className="flex items-center justify-between gap-6">
            <div className="flex gap-4 items-center">
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${pushEnabled ? 'bg-primary text-white' : 'bg-orange-500 text-white'}`}>
                  {pushEnabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
               </div>
               <div>
                  <h3 className="font-bold">{pushEnabled ? 'Notificações Ativas' : 'Notificações Desativadas'}</h3>
                  <p className="text-xs text-muted-foreground">
                    {pushEnabled ? 'Você está pronto para receber lembretes em tempo real.' : 'Ative para não perder nenhum compromisso.'}
                  </p>
               </div>
            </div>
            {!pushEnabled && (
               <Button onClick={requestPushPermission} className="rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20">
                  ATIVAR
               </Button>
            )}
         </div>
      </div>

      {/* Preferences */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Canais Preferidos
        </h2>
        {[
          { key: "confirmations" as const, label: "Confirmações de agendamento", desc: "Receber quando um agendamento for confirmado" },
          { key: "reminders" as const, label: "Lembretes", desc: "Lembrete 24h antes do agendamento" },
          { key: "reviews" as const, label: "Solicitações de avaliação", desc: "Pedir avaliação após atendimento" },
          { key: "promotions" as const, label: "Promoções e novidades", desc: "Ofertas especiais e novos serviços" },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch
              checked={prefs[item.key]}
              onCheckedChange={(checked) => setPrefs((p) => ({ ...p, [item.key]: checked }))}
            />
          </div>
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-foreground">Recentes</h2>
        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 border border-dashed border-border rounded-3xl">
            <BellOff className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="text-xs font-bold opacity-40 uppercase tracking-widest">Nenhuma notificação encontrada</p>
          </div>
        ) : (
          notifications.map((n) => {
            const Icon = typeIcons[n.type] || Info;
            return (
              <div key={n.id} className="bg-card border border-border rounded-2xl p-5 flex gap-4 hover:shadow-md transition-all group">
                <div className="shrink-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    n.status === "sent" ? "bg-emerald-500/10" : "bg-muted"
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      n.status === "sent" ? "text-emerald-600" : "text-muted-foreground"
                    }`} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm text-foreground">{n.title}</p>
                    <span className="text-[10px] font-black opacity-30 uppercase">
                      {n.created_at?.toDate ? format(n.created_at.toDate(), "dd/MM/yyyy", { locale: ptBR }) : ''}
                    </span>
                  </div>
                  {n.body && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.body}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ClientNotifications;
