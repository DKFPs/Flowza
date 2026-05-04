import { useQuery } from "@tanstack/react-query";
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const useSocialProof = (businessId: string | undefined | null) => {
  // 1. Recent Appointments
  const { data: recentBookings = [] } = useQuery({
    queryKey: ["social_proof_recent", businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const q = query(
        collection(db, "appointments"),
        where("business_id", "==", businessId),
        orderBy("created_at", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    },
    enabled: !!businessId,
    staleTime: 1000 * 60 * 5 // 5 min
  });

  // 2. Aggregate counts
  const { data: realStats } = useQuery({
    queryKey: ["social_proof_stats", businessId],
    queryFn: async () => {
      if (!businessId) return null;
      try {
        const aptQuery = query(collection(db, "appointments"), where("business_id", "==", businessId), where("status", "==", "completed"));
        const clientQuery = query(collection(db, "clients"), where("business_id", "==", businessId));
        
        const [aptCount, clientCount] = await Promise.all([
          getCountFromServer(aptQuery),
          getCountFromServer(clientQuery)
        ]);

        return {
          totalAppointments: aptCount.data().count,
          totalClients: clientCount.data().count
        };
      } catch (err) {
        console.error("Error fetching stats:", err);
        return null;
      }
    },
    enabled: !!businessId,
    staleTime: 1000 * 60 * 60 // 1 hour
  });

  return {
    recentBookings,
    realStats
  };
};
