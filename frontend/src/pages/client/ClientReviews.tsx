import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Star } from "lucide-react";

const ClientReviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
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
        .from("reviews")
        .select("*")
        .in("client_id", clients.map(c => c.id))
        .order("created_at", { ascending: false });

      setReviews(data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-16">
        <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">Sem avaliações</h3>
        <p className="text-muted-foreground">Após seus atendimentos, deixe sua avaliação!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Minhas Avaliações</h1>
      <div className="grid gap-3">
        {reviews.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-1 mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              ))}
            </div>
            {r.comment && <p className="text-sm text-card-foreground">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientReviews;
