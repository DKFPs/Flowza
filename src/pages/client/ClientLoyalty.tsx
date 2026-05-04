import { useEffect, useState } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Coins, 
  Trophy, 
  Target, 
  Sparkles, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  Gift,
  ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  LoyaltyLevel, 
  LoyaltyMission, 
  ClientMissionProgress, 
  LoyaltyPoints,
  LoyaltyReward,
  LoyaltyBalance
} from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

interface MissionWithProgress extends LoyaltyMission {
  progress: {
    current_value: number;
    is_completed: boolean;
  };
}

const ClientLoyalty = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<LoyaltyBalance | null>(null);
  const [missions, setMissions] = useState<MissionWithProgress[]>([]);
  const [levels, setLevels] = useState<LoyaltyLevel[]>([]);
  const [pointsHistory, setPointsHistory] = useState<LoyaltyPoints[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // 1. Get Client ID
        const clientQuery = query(collection(db, "clients"), where("user_id", "==", user.uid), limit(1));
        const clientSnap = await getDocs(clientQuery);
        if (clientSnap.empty) { setLoading(false); return; }
        
        const client = clientSnap.docs[0];
        setClientId(client.id);
        const bizId = client.data().business_id;

        // 2. Get Balance
        const balanceQuery = query(
          collection(db, "loyalty_balances"), 
          where("client_id", "==", client.id),
          where("business_id", "==", bizId),
          limit(1)
        );
        const balanceSnap = await getDocs(balanceQuery);
        if (!balanceSnap.empty) {
          setBalance(balanceSnap.docs[0].data());
        }

        // 3. Get Levels
        const levelsQuery = query(collection(db, "loyalty_levels"), where("business_id", "==", bizId), orderBy("min_points", "asc"));
        const levelsSnap = await getDocs(levelsQuery);
        setLevels(levelsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LoyaltyLevel)));

        // 4. Get Missions & Progress
        const missionsQuery = query(collection(db, "loyalty_missions"), where("business_id", "==", bizId), where("is_active", "==", true));
        const missionsSnap = await getDocs(missionsQuery);
        
        const missionsData = [];
        for (const mDoc of missionsSnap.docs) {
          const m = { id: mDoc.id, ...mDoc.data() } as LoyaltyMission;
          const progQuery = query(
            collection(db, "loyalty_mission_progress"), 
            where("mission_id", "==", m.id), 
            where("client_id", "==", client.id),
            limit(1)
          );
          const progSnap = await getDocs(progQuery);
          const prog = progSnap.empty ? { current_value: 0, is_completed: false } : progSnap.docs[0].data();
          missionsData.push({ ...m, progress: prog });
        }
        setMissions(missionsData);

        // 5. Points History
        const pointsQuery = query(
          collection(db, "loyalty_points"), 
          where("client_id", "==", client.id), 
          orderBy("created_at", "desc"),
          limit(5)
        );
        const pointsSnap = await getDocs(pointsQuery);
        setPointsHistory(pointsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LoyaltyPoints)));

      } catch (err) {
        console.error("Error fetching loyalty data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
           <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
           <Coins className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-sm font-bold opacity-40 uppercase tracking-widest">Carregando recompensas...</p>
      </div>
    );
  }

  const currentLevel = levels.filter(l => (balance?.total_earned || 0) >= l.min_points).pop() || (levels.length > 0 ? levels[0] : null);
  const nextLevel = levels.find(l => l.min_points > (balance?.total_earned || 0));
  const progressToNext = nextLevel ? ((balance?.total_earned || 0) / nextLevel.min_points) * 100 : 100;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* HEADER CARD: POINTS & LEVEL */}
      <Card className="rounded-[2.5rem] border-none bg-primary text-white shadow-2xl shadow-primary/20 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 shrink-0" />
        <CardContent className="p-8 relative z-10">
          <div className="flex items-start justify-between">
            <div className="space-y-4">
               <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full w-fit">
                  <Trophy className="w-4 h-4 text-yellow-300" />
                  <span className="text-xs font-black uppercase tracking-widest">{currentLevel?.name || "Member"}</span>
               </div>
               <div>
                  <p className="text-7xl font-black">{balance?.balance || 0}</p>
                  <p className="text-sm font-bold opacity-80 uppercase tracking-widest mt-1">Pontos Disponíveis</p>
               </div>
            </div>
            <Sparkles className="w-12 h-12 text-yellow-300 animate-pulse" />
          </div>

          {nextLevel && (
            <div className="mt-10 space-y-3">
              <div className="flex justify-between text-xs font-black uppercase tracking-widest opacity-80">
                 <span>Faltam {nextLevel.min_points - (balance?.total_earned || 0)} para Nível {nextLevel.name}</span>
                 <span>{Math.floor(progressToNext)}%</span>
              </div>
              <Progress value={progressToNext} className="h-2 bg-white/20"  />
            </div>
          )}
        </CardContent>
      </Card>

      {/* QUICK ACTIONS/REWARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Link to="/client/rewards" className="group">
           <Card className="rounded-3xl border-border bg-card shadow-sm hover:shadow-md transition-all h-full overflow-hidden">
              <CardContent className="p-6 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Gift className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                       <h4 className="font-bold">Resgatar Prêmios</h4>
                       <p className="text-xs text-muted-foreground">Troque seus pontos por descontos</p>
                    </div>
                 </div>
                 <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </CardContent>
           </Card>
         </Link>

         <Card className="rounded-3xl border-border bg-card shadow-sm h-full overflow-hidden">
            <CardContent className="p-6 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                     <TrendingUp className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                     <h4 className="font-bold">Total Acumulado</h4>
                     <p className="text-xs text-muted-foreground">{balance?.total_earned || 0} pontos desde o início</p>
                  </div>
               </div>
               <div className="text-right">
                  <Badge variant="outline" className="rounded-lg border-blue-500/20 text-blue-500 bg-blue-500/5 font-bold">HISTÓRICO</Badge>
               </div>
            </CardContent>
         </Card>
      </div>

      {/* MISSIONS SECTION */}
      <div className="space-y-4">
         <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-black flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" /> Missões Ativas
            </h3>
         </div>
         
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {missions.length === 0 ? (
               <div className="col-span-full py-10 bg-muted/20 border border-dashed border-border rounded-3xl text-center">
                  <p className="text-xs font-bold opacity-40 uppercase tracking-widest">Nenhuma missão no momento</p>
               </div>
            ) : (
               missions.map(mission => (
                 <Card key={mission.id} className={`rounded-3xl border-border shadow-sm overflow-hidden relative ${mission.progress.is_completed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-card'}`}>
                    <CardHeader className="pb-3 border-b border-white/5 bg-muted/10">
                       <div className="flex justify-between items-start">
                          <h4 className="font-bold text-sm leading-tight max-w-[70%]">{mission.name}</h4>
                          <div className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase">
                             +{mission.reward_points} pts
                          </div>
                       </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                       <p className="text-[10px] text-muted-foreground leading-relaxed">{mission.description || `Complete ${mission.target} atendimentos para ganhar sua recompensa.`}</p>
                       
                       <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase opacity-40">
                             <span>Progresso</span>
                             <span>{mission.progress.current_value} / {mission.target}</span>
                          </div>
                          <Progress value={(mission.progress.current_value / mission.target) * 100} className="h-1.5" />
                       </div>

                       {mission.progress.is_completed && (
                          <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs mt-2 animate-in zoom-in-95">
                             <CheckCircle2 className="w-4 h-4" /> Missão Cumprida!
                          </div>
                       )}
                    </CardContent>
                 </Card>
               ))
            )}
         </div>
      </div>

      {/* RECENT HISTORY */}
      <div className="space-y-4">
         <h3 className="text-xl font-black px-2">Histórico de Pontos e Resgates</h3>
         <div className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-sm">
            {pointsHistory.length === 0 ? (
               <div className="p-10 text-center text-xs font-bold opacity-30 uppercase tracking-widest">Sem atividades recentes</div>
            ) : (
               <div className="divide-y divide-border">
                  {pointsHistory.map((pt, idx) => (
                     <div key={pt.id} className={`p-5 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300 delay-[${idx*100}ms]`}>
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pt.points > 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                              {pt.points < 0 ? <Gift className="w-5 h-5 text-rose-500" /> : pt.source === 'appointment' ? <Clock className="w-5 h-5 text-emerald-500" /> : <Sparkles className="w-5 h-5 text-emerald-500" />}
                           </div>
                           <div>
                              <p className="font-bold text-sm">
                                 {pt.points < 0 ? 'Resgate de Recompensa' : pt.source === 'appointment' ? 'Serviço Realizado' : pt.source === 'bonus' ? 'Bônus de Missão' : 'Ajuste Manual'}
                              </p>
                              <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">
                                 {pt.created_at?.toDate ? format(pt.created_at.toDate(), "d 'de' MMMM 'às' HH:mm", { locale: ptBR }) : ''}
                              </p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className={`text-lg font-black ${pt.points > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {pt.points > 0 ? '+' : ''}{pt.points}
                           </p>
                           <p className="text-[10px] opacity-40 font-bold uppercase">pontos</p>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ClientLoyalty;
