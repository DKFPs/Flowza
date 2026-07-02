import { useEffect, useState, useCallback } from "react";
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
import { Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Review, Client } from "@/types";

const Reviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const bizQuery = query(collection(db, "businesses"), where("owner_id", "==", user.uid), limit(1));
      const bizSnap = await getDocs(bizQuery);
      if (bizSnap.empty) { setLoading(false); return; }
      const bizId = bizSnap.docs[0].id;

      const [reviewsSnap, clientsSnap] = await Promise.all([
        getDocs(query(collection(db, "reviews"), where("business_id", "==", bizId))),
        getDocs(query(collection(db, "clients"), where("business_id", "==", bizId))),
      ]);

      const clientsMap = new Map(clientsSnap.docs.map(d => [d.id, d.data() as Client]));
      
      let list = reviewsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          clients: { name: clientsMap.get(data.client_id)?.name || "Anônimo" }
        } as Review;
      });

      // Sort reviews descending by created_at in-memory
      list = list.sort((a, b) => {
        const dateA = a.created_at?.seconds || 0;
        const dateB = b.created_at?.seconds || 0;
        return dateB - dateA;
      });

      setReviews(list);
      if (list.length > 0) {
        setAvgRating(list.reduce((sum, r) => sum + r.rating, 0) / list.length);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Avaliações</h1>

      {/* Summary */}
      <div className="bg-card rounded-xl border border-border p-6 flex items-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-heading font-bold text-card-foreground">{avgRating.toFixed(1)}</p>
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? "text-warning fill-warning" : "text-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{reviews.length} avaliações</p>
        </div>

        {/* Rating distribution */}
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map(rating => {
            const count = reviews.filter(r => r.rating === rating).length;
            const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
            return (
              <div key={rating} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-3">{rating}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-warning rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-6">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review list */}
      {reviews.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma avaliação ainda.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-card-foreground">{r.clients?.name || "Anônimo"}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "text-warning fill-warning" : "text-muted"}`} />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.created_at ? format(new Date(r.created_at?.toDate?.() || r.created_at), "dd/MM/yyyy", { locale: ptBR }) : ""}
                </span>
              </div>
              {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reviews;
