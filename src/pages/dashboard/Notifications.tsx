import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw, Mail, MessageSquare } from "lucide-react";
import { PlanGuard } from "@/components/dashboard/PlanGuard";
import { PlanId } from "@/types";
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { db } from "@/lib/firebase";

const typeLabels: Record<string, string> = {
  booking_confirmation: "Confirmação",
  booking_reminder: "Lembrete",
  review_request: "Avaliação",
  no_show_recovery: "Recuperação",
  booking_cancelled: "Cancelamento",
  info: "Info",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  sent: { label: "Enviado", variant: "default", icon: CheckCircle2 },
  failed: { label: "Falhou", variant: "destructive", icon: XCircle },
  skipped: { label: "Ignorado", variant: "secondary", icon: AlertTriangle },
};

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageSquare,
};

const Notifications = () => {
  const { user } = useAuth();
  const { business } = useBusiness();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchNotifications = useCallback(async () => {
    if (!user || !business) return;
    setLoading(true);
    
    try {
      const q = query(
        collection(db, "notifications"),
        where("business_id", "==", business.id),
        orderBy("created_at", "desc"),
        firestoreLimit(100)
      );

      // Note: Composite indexes might be needed for these filters in production
      const snap = await getDocs(q);
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (filterType !== "all") data = data.filter((n: any) => n.type === filterType);
      if (filterStatus !== "all") data = data.filter((n: any) => n.status === filterStatus);

      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [user, business, filterType, filterStatus]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const stats = {
    total: notifications.length,
    pending: notifications.filter(n => n.status === "pending").length,
    sent: notifications.filter(n => n.status === "sent").length,
    failed: notifications.filter(n => n.status === "failed").length,
  };

  if (!business && loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <PlanGuard feature="hasReminders" label="Notificações & WhatsApp" targetPlan={PlanId.PRO}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
            <p className="text-sm text-muted-foreground">Histórico de notificações automáticas enviadas aos clientes</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchNotifications} className="gap-1">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, icon: Bell, color: "text-foreground" },
            { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-yellow-500" },
            { label: "Enviadas", value: stats.sent, icon: CheckCircle2, color: "text-green-500" },
            { label: "Falhas", value: stats.failed, icon: XCircle, color: "text-destructive" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="booking_confirmation">Confirmação</SelectItem>
              <SelectItem value="booking_reminder">Lembrete</SelectItem>
              <SelectItem value="review_request">Avaliação</SelectItem>
              <SelectItem value="no_show_recovery">Recuperação</SelectItem>
              <SelectItem value="booking_cancelled">Cancelamento</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" /></div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma notificação encontrada.</p>
            <p className="text-sm text-muted-foreground mt-1">As notificações serão enviadas automaticamente no plano {business?.plan_id?.toUpperCase()}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const sc = statusConfig[n.status] || statusConfig.pending;
              const StatusIcon = sc.icon;
              const ChannelIcon = channelIcons[n.channel] || Mail;

              return (
                <div key={n.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
                  <div className="mt-0.5">
                    <ChannelIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-card-foreground">{n.title}</span>
                      <Badge variant={sc.variant} className="text-xs gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {sc.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[n.type] || n.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{n.body}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{n.client_name || "Cliente"}</span>
                      {n.recipient_email && <span>{n.recipient_email}</span>}
                      <span>{format(new Date(n.created_at?.toDate ? n.created_at.toDate() : n.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                    {n.error_message && (
                      <p className="text-xs text-destructive mt-1">{n.error_message}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PlanGuard>
  );
};

export default Notifications;
