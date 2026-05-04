import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, DollarSign, User, Scissors, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  completed: "bg-green-500",
  cancelled: "bg-destructive",
  no_show: "bg-orange-500",
  scheduled: "bg-primary",
  confirmed: "bg-blue-500",
  in_progress: "bg-yellow-500",
};

const statusLabels: Record<string, string> = {
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
};

const ClientHistory = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, completed: 0, totalSpent: 0 });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id);

      if (!clients || clients.length === 0) {
        setLoading(false);
        return;
      }

      const clientIds = clients.map((c) => c.id);
      const { data } = await supabase
        .from("booking_appointments")
        .select("*, services(name, price, duration_minutes), professionals(name, avatar_url)")
        .in("client_id", clientIds)
        .order("appointment_date", { ascending: false });

      const apts = data || [];
      setAppointments(apts);

      const completed = apts.filter((a) => a.status === "completed");
      setStats({
        total: apts.length,
        completed: completed.length,
        totalSpent: completed.reduce((sum, a) => sum + (a.services?.price || 0), 0),
      });

      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground">Histórico Completo</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Calendar className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Scissors className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Concluídos</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <DollarSign className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">R$ {stats.totalSpent.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Investido</p>
        </div>
      </div>

      {/* Timeline */}
      {appointments.length === 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">Sem histórico</h3>
          <p className="text-muted-foreground">Seu histórico aparecerá aqui após o primeiro atendimento.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {appointments.map((apt, i) => {
              const dotColor = statusColors[apt.status] || "bg-muted";
              return (
                <div key={apt.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className={`absolute left-2.5 top-5 w-3 h-3 rounded-full ${dotColor} ring-2 ring-background`} />

                  <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{apt.services?.name || "Serviço"}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(apt.appointment_date), "dd MMM yyyy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {apt.start_time?.slice(0, 5)} - {apt.end_time?.slice(0, 5)}
                          </span>
                        </div>
                      </div>
                      <Badge variant={apt.status === "completed" ? "default" : apt.status === "cancelled" ? "destructive" : "secondary"}>
                        {statusLabels[apt.status] || apt.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span>{apt.professionals?.name || "Profissional"}</span>
                      </div>
                      {apt.services?.price > 0 && (
                        <span className="text-sm font-medium text-foreground">
                          R$ {Number(apt.services.price).toFixed(2)}
                        </span>
                      )}
                    </div>

                    {apt.services?.duration_minutes && (
                      <p className="text-xs text-muted-foreground">
                        Duração: {apt.services.duration_minutes} min
                      </p>
                    )}

                    {apt.notes && (
                      <p className="text-xs text-muted-foreground italic">"{apt.notes}"</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientHistory;
