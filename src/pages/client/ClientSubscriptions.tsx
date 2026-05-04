import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const ClientSubscriptions = () => {
  const { user } = useAuth();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id);
      if (!clients || clients.length === 0) { setLoading(false); return; }

      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .in("client_id", clients.map(c => c.id))
        .order("created_at", { ascending: false });

      setSubs(data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (subs.length === 0) {
    return (
      <div className="text-center py-16">
        <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">Sem assinaturas</h3>
        <p className="text-muted-foreground">Você não possui assinaturas ativas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Minhas Assinaturas</h1>
      <div className="grid gap-3">
        {subs.map((s) => (
          <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-card-foreground">{s.plan_name}</p>
              <p className="text-sm text-muted-foreground">
                Início: {format(new Date(s.start_date), "dd/MM/yyyy")}
                {s.end_date && ` • Fim: ${format(new Date(s.end_date), "dd/MM/yyyy")}`}
              </p>
              <p className="text-sm font-medium text-primary">R$ {Number(s.price).toFixed(2)}/mês</p>
            </div>
            <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status === "active" ? "Ativa" : s.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientSubscriptions;
