import { useEffect, useState } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs,
  getDoc, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  increment,
  limit,
  orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Gift, Coins, Ticket, Loader2, Copy, CheckCircle, Sparkles, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoyaltyReward, LoyaltyRedemption } from "@shared/types";
import { LoyaltyService } from "@backend/services/loyaltyService";

const ClientRewards = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [redemptions, setRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [codesOpen, setCodesOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [loyaltyCurrency, setLoyaltyCurrency] = useState("");
  const [clientId, setClientId] = useState("");
  const [businessId, setBusinessId] = useState("");

  const fetchData = async () => {
    if (!user) return;

    try {
      const clientQuery = query(collection(db, "clients"), where("user_id", "==", user.uid), limit(1));
      const clientSnap = await getDocs(clientQuery);
      if (clientSnap.empty) { setLoading(false); return; }
      
      const client = clientSnap.docs[0];
      setClientId(client.id);
      const bizId = client.data().business_id;
      setBusinessId(bizId);

      // Get business name
      const bizDoc = await getDoc(doc(db, "businesses", bizId));
      if (bizDoc.exists()) {
        setBusinessName(bizDoc.data().name);
        setLoyaltyCurrency(bizDoc.data().loyalty_currency_name || "");
      }

      // Get balance
      const balanceQuery = query(
        collection(db, "loyalty_balances"), 
        where("client_id", "==", client.id),
        where("business_id", "==", bizId),
        limit(1)
      );
      const balanceSnap = await getDocs(balanceQuery);
      if (!balanceSnap.empty) {
        setBalance(balanceSnap.docs[0].data().balance || 0);
      }

      // Get available rewards
      const rewardsQuery = query(
        collection(db, "loyalty_rewards"),
        where("business_id", "==", bizId),
        where("is_active", "==", true),
        orderBy("points_required", "asc")
      );
      const rewardsSnap = await getDocs(rewardsQuery);
      setRewards(rewardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LoyaltyReward)));

      // Get redemptions
      const rdQuery = query(
        collection(db, "loyalty_redemptions"),
        where("client_id", "==", client.id),
        orderBy("created_at", "desc")
      );
      const rdSnap = await getDocs(rdQuery);
      setRedemptions(rdSnap.docs.map(d => ({ id: d.id, ...d.data() } as LoyaltyRedemption)));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRedeem = async (reward: LoyaltyReward) => {
    if (balance < reward.points_required) {
      toast({ title: "Pontos insuficientes", variant: "destructive" });
      return;
    }

    setRedeeming(reward.id);

    try {
      let code = "";
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        code = LoyaltyService.generateRedemptionCode(loyaltyCurrency, businessName);
        const codeQuery = query(
          collection(db, "loyalty_redemptions"),
          where("code", "==", code),
          limit(1)
        );
        const codeSnap = await getDocs(codeQuery);
        if (codeSnap.empty) {
          isUnique = true;
        }
        attempts++;
      }
      
      if (!isUnique) {
        throw new Error("Não foi possível gerar um código único. Tente novamente.");
      }

      // Add redemption
      await addDoc(collection(db, "loyalty_redemptions"), {
        business_id: businessId,
        client_id: clientId,
        reward_id: reward.id,
        reward_name: reward.name,
        code: code,
        status: 'active',
        created_at: serverTimestamp()
      });

      // Deduct points
      const balanceQuery = query(
        collection(db, "loyalty_balances"), 
        where("client_id", "==", clientId),
        where("business_id", "==", businessId),
        limit(1)
      );
      const balanceSnap = await getDocs(balanceQuery);
      if (!balanceSnap.empty) {
        await updateDoc(doc(db, "loyalty_balances", balanceSnap.docs[0].id), {
          balance: increment(-reward.points_required),
          updated_at: serverTimestamp()
        });
      }

      // Log point use
      await addDoc(collection(db, "loyalty_points"), {
        business_id: businessId,
        client_id: clientId,
        points: -reward.points_required,
        source: 'manual',
        reference_id: 'redemption',
        created_at: serverTimestamp()
      });

      toast({ title: "Recompensa resgatada!", description: `Seu código é ${code}` });
      await fetchData();
    } catch (error) {
      toast({ title: "Erro ao resgatar", variant: "destructive" });
    } finally {
      setRedeeming(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Código copiado!" });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
           <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
           <Gift className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-sm font-bold opacity-40 uppercase tracking-widest">Carregando prêmios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between px-2">
        <h1 className="text-3xl font-black">Prêmios</h1>
        <Button variant="outline" onClick={() => setCodesOpen(true)} className="rounded-2xl gap-2 font-bold bg-card border-border shadow-sm">
          <Ticket className="w-4 h-4 text-primary" /> Meus Códigos
        </Button>
      </div>

      {/* BALANCE BANNER */}
      <div className="bg-primary/5 border border-primary/10 rounded-[2.5rem] p-10 flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-[1.5rem] bg-primary flex items-center justify-center shadow-xl shadow-primary/30">
           <Coins className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="text-5xl font-black text-primary">{balance}</p>
          <p className="text-sm font-bold opacity-60 uppercase tracking-widest mt-1">Pontos para troca</p>
        </div>
      </div>

      {/* REWARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rewards.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-card rounded-[2rem] border border-dashed border-border">
             <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
             <p className="text-sm font-bold opacity-40 uppercase tracking-widest">Nenhum prêmio disponível</p>
          </div>
        ) : (
          rewards.map(reward => {
            const hasEnough = balance >= reward.points_required;
            const progress = Math.min(100, (balance / reward.points_required) * 100);
            
            return (
              <Card key={reward.id} className="rounded-[2rem] border-border bg-card shadow-sm overflow-hidden flex flex-col group">
                <CardHeader className="p-6 pb-2">
                   <div className="flex justify-between items-start">
                     <Badge variant="outline" className="rounded-lg border-primary/20 text-primary bg-primary/5 uppercase text-[10px] font-black tracking-widest">
                        {reward.type === 'discount' ? 'Cupom de Desconto' : 'Serviço Especial'}
                     </Badge>
                     {hasEnough && <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />}
                   </div>
                   <CardTitle className="mt-4 text-xl font-black">{reward.name}</CardTitle>
                   <CardDescription className="line-clamp-2 text-xs">{reward.description || `Ganhe um benefício exclusivo ao acumular ${reward.points_required} pontos.`}</CardDescription>
                </CardHeader>
                
                <CardContent className="p-6 flex-1 flex flex-col justify-end space-y-6">
                   <div className="space-y-3">
                      <div className="flex justify-between items-end">
                         <div>
                            <span className="text-2xl font-black">{reward.points_required}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Pontos</span>
                         </div>
                         <span className="text-[10px] font-black uppercase opacity-60">{Math.floor(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                   </div>

                   <Button 
                      onClick={() => handleRedeem(reward)} 
                      disabled={!hasEnough || redeeming === reward.id}
                      className={`h-14 rounded-2xl font-black uppercase tracking-widest translate-y-0 active:translate-y-1 transition-all ${hasEnough ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-muted text-muted-foreground'}`}
                   >
                      {redeeming === reward.id ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Resgatar Agora'}
                   </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* CODES DIALOG */}
      <Dialog open={codesOpen} onOpenChange={setCodesOpen}>
        <DialogContent className="rounded-[2.5rem] border-none bg-card p-0 overflow-hidden max-w-md">
           <div className="bg-primary p-8 text-white">
              <div className="flex justify-between items-center mb-6">
                 <DialogTitle className="text-2xl font-black">Meus Códigos</DialogTitle>
                 <X className="w-6 h-6 cursor-pointer opacity-70 hover:opacity-100" onClick={() => setCodesOpen(false)} />
              </div>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest leading-relaxed">
                 Apresente esses códigos no estabelecimento para validar sua recompensa.
              </p>
           </div>
           
           <div className="p-8 space-y-4 max-h-[60vh] overflow-auto">
              {redemptions.length === 0 ? (
                 <div className="py-12 text-center">
                    <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-10" />
                    <p className="text-xs font-bold opacity-30 uppercase tracking-widest">Nenhum código gerado</p>
                 </div>
              ) : (
                 redemptions.map(rd => (
                    <div key={rd.id} className={`p-6 rounded-3xl border-2 transition-all ${rd.status === 'used' ? 'bg-muted/30 border-muted opacity-60 grayscale' : 'bg-primary/5 border-primary/10 border-dashed'}`}>
                       <div className="flex justify-between items-start mb-4">
                          <div>
                             <h5 className="font-black text-sm uppercase tracking-wide">{rd.reward_name}</h5>
                             <p className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">
                                RESGATADO EM {rd.created_at?.toDate ? format(rd.created_at.toDate(), "dd/MM/yyyy") : ''}
                             </p>
                          </div>
                          {rd.status === 'used' ? (
                             <Badge className="bg-slate-500 text-white border-none rounded-lg text-[10px]">USADO</Badge>
                          ) : (
                             <Badge className="bg-primary text-white border-none rounded-lg text-[10px] animate-pulse">ATIVO</Badge>
                          )}
                       </div>
                       
                       <div className="flex items-center justify-between bg-white border border-border p-4 rounded-2xl shadow-sm">
                          <span className="font-mono text-xl font-black tracking-widest text-primary">{rd.code}</span>
                          <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/5 rounded-full" onClick={() => copyCode(rd.code)}>
                             <Copy className="w-4 h-4" />
                          </Button>
                       </div>
                    </div>
                 ))
              )}
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientRewards;
