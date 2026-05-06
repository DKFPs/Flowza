import { useState } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";
import { useBusiness } from "@/contexts/BusinessContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Settings, 
  Gift, 
  Trophy, 
  Plus, 
  Trash2, 
  Sparkles, 
  Star,
  Target,
  CheckCircle,
  Loader2,
  Clock,
  History
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  LoyaltyConfig, 
  LoyaltyReward, 
  LoyaltyLevel, 
  LoyaltyMission 
} from "@/types";

import { FeatureLock } from "@/components/dashboard/MonetizationComponents";
import { PlanId } from "@/types";

const LoyaltyDashboard = () => {
  const { business, plan , limits } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isEligible = limits?.automation === "full";
  
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  
  const [newReward, setNewReward] = useState<Partial<LoyaltyReward>>({
    name: "",
    description: "",
    points_required: 100,
    type: "discount",
    value: 0
  });

  const [newMission, setNewMission] = useState<Partial<LoyaltyMission>>({
    name: "",
    description: "",
    type: "visit_count",
    target: 5,
    reward_points: 50
  });

  // --- QUERY: CONFIG ---
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["loyalty_config", business?.id],
    queryFn: async () => {
      if (!business?.id) return null;
      const q = query(collection(db, "loyalty_configs"), where("business_id", "==", business.id));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as LoyaltyConfig;
    },
    enabled: !!business?.id,
  });

  // --- QUERY: REWARDS ---
  const { data: rewards = [] } = useQuery({
    queryKey: ["loyalty_rewards", business?.id],
    queryFn: async () => {
      const q = query(collection(db, "loyalty_rewards"), where("business_id", "==", business.id));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as LoyaltyReward));
    },
    enabled: !!business?.id,
  });

  // --- QUERY: HISTORY ---
  const { data: globalHistory = [] } = useQuery({
    queryKey: ["loyalty_points", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const q = query(
        collection(db, "loyalty_points"), 
        where("business_id", "==", business.id)
      );
      // Not ordering by desc because missing index usually, we will handle sort in memory
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      data.sort((a, b) => {
         const tA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
         const tB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
         return tB - tA;
      });
      return data;
    },
    enabled: !!business?.id,
  });

  // --- QUERY: CLIENT NAMES ---
  const { data: clientsData = [] } = useQuery({
    queryKey: ["clients", business?.id],
    queryFn: async () => {
      const q = query(collection(db, "clients"), where("business_id", "==", business?.id));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    enabled: !!business?.id,
  });

  // --- QUERY: MISSIONS ---
  const { data: missions = [] } = useQuery({
    queryKey: ["loyalty_missions", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const q = query(collection(db, "loyalty_missions"), where("business_id", "==", business.id));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as LoyaltyMission));
    },
    enabled: !!business?.id,
  });

  // --- MUTATION: SAVE CONFIG ---
  const saveConfigMutation = useMutation({
    mutationFn: async (newData: Partial<LoyaltyConfig>) => {
      if (!business?.id) return;
      if (config?.id) {
        await updateDoc(doc(db, "loyalty_configs", config.id), newData);
      } else {
        await setDoc(doc(db, "loyalty_configs", business.id), {
          ...newData,
          business_id: business.id,
          is_enabled: true
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty_config"] });
      toast({ title: "Configurações salvas!" });
    }
  });

  // --- MUTATION: ADD REWARD ---
  const addRewardMutation = useMutation({
    mutationFn: async (reward: Partial<LoyaltyReward>) => {
      await addDoc(collection(db, "loyalty_rewards"), {
        ...reward,
        business_id: business?.id,
        is_active: true,
        created_at: serverTimestamp()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty_rewards"] });
      toast({ title: "Recompensa criada!" });
    }
  });

  const deleteRewardMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, "loyalty_rewards", id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty_rewards"] });
    }
  });

  // --- MUTATION: ADD MISSION ---
  const addMissionMutation = useMutation({
    mutationFn: async (mission: Partial<LoyaltyMission>) => {
      await addDoc(collection(db, "loyalty_missions"), {
        ...mission,
        business_id: business?.id,
        is_active: true,
        created_at: serverTimestamp()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty_missions"] });
      toast({ title: "Missão criada!" });
    }
  });

  const deleteMissionMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, "loyalty_missions", id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty_missions"] });
    }
  });

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReward.name || !newReward.points_required) return;
    await addRewardMutation.mutateAsync(newReward);
    setIsRewardModalOpen(false);
    setNewReward({ name: "", description: "", points_required: 100, type: "discount", value: 0 });
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMission.name || !newMission.target || !newMission.reward_points) return;
    await addMissionMutation.mutateAsync(newMission);
    setIsMissionModalOpen(false);
    setNewMission({ name: "", description: "", type: "visit_count", target: 5, reward_points: 50 });
  };

  return (
    <FeatureLock isLocked={!isEligible} featureName="Fidelidade" planName="Business ou Premium">
      <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fidelidade</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure o sistema de pontos e retenha seus clientes.</p>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="bg-card border border-border h-12 p-1.5 rounded-2xl flex flex-wrap h-auto">
          <TabsTrigger value="config" className="rounded-xl gap-2 font-bold px-6">
            <Settings className="w-4 h-4" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="rewards" className="rounded-xl gap-2 font-bold px-6">
            <Gift className="w-4 h-4" /> Recompensas
          </TabsTrigger>
          <TabsTrigger value="levels" className="rounded-xl gap-2 font-bold px-6">
            <Trophy className="w-4 h-4" /> Níveis
          </TabsTrigger>
          <TabsTrigger value="missions" className="rounded-xl gap-2 font-bold px-6">
            <Target className="w-4 h-4" /> Missões
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl gap-2 font-bold px-6">
            <History className="w-4 h-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="validations" className="rounded-xl gap-2 font-bold px-6">
            <CheckCircle className="w-4 h-4" /> Validação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configurações Gerais</CardTitle>
                  <CardDescription>Defina as regras de pontuação do seu negócio.</CardDescription>
                </div>
                <Switch 
                  checked={config?.is_enabled ?? true} 
                  onCheckedChange={(checked) => saveConfigMutation.mutate({ is_enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black opacity-60">Pontos por Real Gasto (R$1 = X pontos)</Label>
                    <div className="flex items-center gap-4">
                      <Input 
                        type="number" 
                        defaultValue={config?.points_per_brl || 1} 
                        className="h-12 text-lg font-bold rounded-xl"
                        onBlur={(e) => saveConfigMutation.mutate({ points_per_brl: Number(e.target.value) })}
                      />
                      <Sparkles className="text-primary w-6 h-6 animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black opacity-60">Expiração de Pontos (dias)</Label>
                    <Input 
                        type="number" 
                        defaultValue={config?.point_expiration_days || 90} 
                        className="h-12 rounded-xl"
                        onBlur={(e) => saveConfigMutation.mutate({ point_expiration_days: Number(e.target.value) })}
                      />
                    <p className="text-[10px] opacity-40">Recomendado: 90 dias para manter o cliente retornando.</p>
                  </div>
                </div>

                   <div className="space-y-4 p-6 bg-primary/5 rounded-3xl border border-primary/10">
                   <h4 className="font-bold flex items-center gap-2">
                     <Star className="w-4 h-4 text-primary fill-current" /> Bônus de Engajamento
                   </h4>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <Label className="text-sm font-medium">Bônus de Registro (Novos Clientes)</Label>
                         <Input 
                            type="number" 
                            defaultValue={config?.registration_bonus || 0} 
                            className="w-24 h-10 rounded-xl"
                            onBlur={(e) => saveConfigMutation.mutate({ registration_bonus: Number(e.target.value) })}
                         />
                      </div>
                      <div className="flex items-center justify-between">
                         <Label className="text-sm font-medium">Bônus por Visita (Recorrência)</Label>
                         <Input 
                            type="number" 
                            defaultValue={config?.recurring_visit_bonus || 0} 
                            className="w-24 h-10 rounded-xl"
                            onBlur={(e) => saveConfigMutation.mutate({ recurring_visit_bonus: Number(e.target.value) })}
                         />
                      </div>
                      <div className="flex items-center justify-between">
                         <Label className="text-sm font-medium">Bônus de Primeira Reserva</Label>
                         <Input 
                            type="number" 
                            defaultValue={config?.first_visit_bonus || 0} 
                            className="w-24 h-10 rounded-xl"
                            onBlur={(e) => saveConfigMutation.mutate({ first_visit_bonus: Number(e.target.value) })}
                         />
                      </div>
                      <div className="flex items-center justify-between">
                         <Label className="text-sm font-medium">Bônus por Indicação</Label>
                         <Input 
                            type="number" 
                            defaultValue={config?.referral_bonus || 0} 
                            className="w-24 h-10 rounded-xl"
                            onBlur={(e) => saveConfigMutation.mutate({ referral_bonus: Number(e.target.value) })}
                         />
                      </div>
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card 
              className="rounded-3xl border-dashed border-2 border-border bg-transparent flex flex-col items-center justify-center py-12 text-center group cursor-pointer hover:border-primary transition-all"
              onClick={() => setIsRewardModalOpen(true)}
            >
               <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Plus className="w-8 h-8 text-primary" />
               </div>
               <h4 className="font-bold">Nova Recompensa</h4>
               <p className="text-xs text-muted-foreground mt-1 max-w-[150px]">Crie um prêmio para seus clientes fiéis</p>
            </Card>

            {rewards.map(reward => (
              <Card key={reward.id} className="rounded-3xl border-border bg-card shadow-sm overflow-hidden flex flex-col">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 rounded-lg">
                      {reward.type === 'discount' ? 'Desconto' : 'Serviço Grátis'}
                    </Badge>
                    <button onClick={() => deleteRewardMutation.mutate(reward.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <CardTitle className="mt-4 text-xl font-bold">{reward.name}</CardTitle>
                  <CardDescription>{reward.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <span className="text-xl font-black">{reward.points_required}</span>
                      <span className="text-[10px] font-bold opacity-40 uppercase">pontos</span>
                   </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="levels">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[
                { name: 'Bronze', points: 0, color: 'text-amber-700', bg: 'bg-amber-700/5' },
                { name: 'Prata', points: 500, color: 'text-slate-400', bg: 'bg-slate-400/5' },
                { name: 'Ouro', points: 1500, color: 'text-yellow-500', bg: 'bg-yellow-500/5' },
                { name: 'Platina', points: 3000, color: 'text-cyan-500', bg: 'bg-cyan-500/5' },
                { name: 'Diamante', points: 5000, color: 'text-violet-500', bg: 'bg-violet-500/5' },
                { name: 'Rubi', points: 10000, color: 'text-rose-500', bg: 'bg-rose-500/5' }
              ].map(level => (
                <Card key={level.name} className={`rounded-3xl border-border bg-card shadow-sm overflow-hidden p-6 text-center ${level.bg}`}>
                   <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center border-4 border-current mb-4 ${level.color}`}>
                      <Trophy className="w-10 h-10" />
                   </div>
                   <h3 className={`text-2xl font-black ${level.color}`}>{level.name}</h3>
                   <div className="mt-4 space-y-1">
                      <p className="text-xs font-bold opacity-60 uppercase">Mínimo de Pontos</p>
                      <p className="text-2xl font-black">{level.points}</p>
                   </div>
                </Card>
              ))}
           </div>
        </TabsContent>

        <TabsContent value="missions">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card 
              className="rounded-3xl border-dashed border-2 border-border bg-transparent flex flex-col items-center justify-center py-12 text-center hover:border-primary transition-all cursor-pointer group"
              onClick={() => setIsMissionModalOpen(true)}
            >
               <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Plus className="w-8 h-8 text-primary" />
               </div>
               <h4 className="font-bold">Nova Missão</h4>
               <p className="text-xs text-muted-foreground mt-1 max-w-[150px]">Crie desafios para engajar seus clientes</p>
            </Card>

            {missions.map((mission: LoyaltyMission) => (
              <Card key={mission.id} className="rounded-3xl border-border bg-card shadow-sm overflow-hidden flex flex-col">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 rounded-lg">
                      {mission.type === 'visit_count' ? 'Visitas' : 'Gasto Acumulado'}
                    </Badge>
                    <div className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase">
                       +{mission.reward_points} pts
                    </div>
                  </div>
                  <CardTitle className="mt-4 text-xl font-bold">{mission.name}</CardTitle>
                  <CardDescription>{mission.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-4 border-t border-border space-y-4">
                   <div className="flex justify-between text-xs font-bold uppercase opacity-40">
                      <span>Meta: {mission.target} {mission.type === 'visit_count' ? 'visitas' : 'reais'}</span>
                      <span>{mission.is_active ? 'Ativa' : 'Pausada'}</span>
                   </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="rounded-[2rem] border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/10">
              <CardTitle className="text-xl">Histórico de Pontuações e Resgates</CardTitle>
              <CardDescription>Veja as movimentações de pontos de todos os clientes em tempo real.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               {globalHistory.length === 0 ? (
                  <div className="p-16 text-center text-xs font-bold opacity-30 uppercase tracking-widest">Nenhum evento registrado ainda</div>
               ) : (
                  <div className="divide-y divide-border">
                     {globalHistory.map((pt: any, idx: number) => {
                        const clientName = clientsData.find((c:any) => c.user_id === pt.client_id)?.name || 'Cliente desconhecido';
                        
                        return (
                           <div key={pt.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-4">
                                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${pt.points > 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                    {pt.points < 0 ? <Gift className="w-6 h-6 text-rose-500" /> : pt.source === 'appointment' ? <Clock className="w-6 h-6 text-emerald-500" /> : <Sparkles className="w-6 h-6 text-emerald-500" />}
                                 </div>
                                 <div>
                                    <p className="font-bold">
                                       {pt.points < 0 ? 'Resgate de Recompensa' : pt.source === 'appointment' ? 'Serviço Realizado' : pt.source === 'bonus' ? 'Bônus de Missão' : 'Ajuste Manual'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                       <span className="text-xs font-bold uppercase tracking-widest text-primary">{clientName}</span>
                                       <span className="w-1 h-1 rounded-full bg-border"></span>
                                       <span className="text-[10px] opacity-60 font-bold uppercase tracking-widest">
                                          {pt.created_at?.toDate ? format(pt.created_at.toDate(), "d 'de' MMMM 'às' HH:mm", { locale: ptBR }) : ''}
                                       </span>
                                    </div>
                                 </div>
                              </div>
                              <div className="text-right shrink-0">
                                 <p className={`text-xl font-black ${pt.points > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {pt.points > 0 ? '+' : ''}{pt.points}
                                 </p>
                                 <p className="text-[10px] opacity-40 font-bold uppercase">pontos</p>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validations">
           <Card className="rounded-[2rem] border-border bg-card shadow-sm overflow-hidden">
              <CardHeader>
                 <CardTitle>Validar Código de Resgate</CardTitle>
                 <CardDescription>Busque pelo código apresentado pelo cliente para marcar como utilizado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="flex gap-4">
                    <Input placeholder="Ex: BARBER4821" className="h-12 rounded-xl font-mono text-lg tracking-widest uppercase" id="redemption-code-input" />
                    <Button className="h-12 px-8 rounded-xl font-bold" onClick={async () => {
                       const codeInput = document.getElementById('redemption-code-input') as HTMLInputElement;
                       const code = codeInput.value.trim().toUpperCase();
                       if (!code) return;

                       const q = query(
                          collection(db, "loyalty_redemptions"), 
                          where("business_id", "==", business?.id),
                          where("code", "==", code)
                       );
                       const snap = await getDocs(q);
                       if (snap.empty) {
                          toast({ title: "Código não encontrado", variant: "destructive" });
                          return;
                       }
                       const rd = snap.docs[0];
                       if (rd.data().status === 'used') {
                          toast({ title: "Código já utilizado", variant: "destructive" });
                          return;
                       }

                       await updateDoc(doc(db, "loyalty_redemptions", rd.id), {
                          status: 'used',
                          used_at: serverTimestamp()
                       });
                       toast({ title: "Recompensa validada com sucesso! ✨" });
                       codeInput.value = "";
                    }}>Validar</Button>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

       {/* MODAL NOVA RECOMPENSA */}
       <Dialog open={isRewardModalOpen} onOpenChange={setIsRewardModalOpen}>
         <DialogContent className="sm:max-w-[425px]">
           <form onSubmit={handleCreateReward}>
             <DialogHeader>
               <DialogTitle>Nova Recompensa</DialogTitle>
               <DialogDescription>
                 Crie uma recompensa que os clientes podem resgatar com pontos.
               </DialogDescription>
             </DialogHeader>
             <div className="grid gap-4 py-4">
               <div className="space-y-2">
                 <div className="flex gap-2 overflow-x-auto pb-4 pt-1 mb-2">
                   <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 shrink-0 font-normal" onClick={() => setNewReward({ name: "Corte / Serviço Grátis", description: "Troque seus pontos por um serviço 100% gratuito.", points_required: 500, type: 'free_service', value: 0 })}>Corte Grátis (500 pts)</Badge>
                   <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 shrink-0 font-normal" onClick={() => setNewReward({ name: "Brinde Especial", description: "Ganhe um produto de brinde ao nos visitar.", points_required: 150, type: 'free_service', value: 0 })}>Brinde (150 pts)</Badge>
                   <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 shrink-0 font-normal" onClick={() => setNewReward({ name: "Desconto de 20%", description: "Ganhe 20% de desconto no seu próximo agendamento.", points_required: 300, type: 'discount', value: 20 })}>Desconto 20% (300 pts)</Badge>
                 </div>
                 <Label htmlFor="reward-name">Nome da Recompensa</Label>
                 <Input 
                   id="reward-name" 
                   required
                   placeholder="Ex: Corte Grátis, 20% de Desconto..."
                   value={newReward.name}
                   onChange={e => setNewReward(r => ({ ...r, name: e.target.value }))}
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="reward-desc">Descrição</Label>
                 <Input 
                   id="reward-desc" 
                   placeholder="Detalhes ou condições"
                   value={newReward.description}
                   onChange={e => setNewReward(r => ({ ...r, description: e.target.value }))}
                 />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Tipo</Label>
                   <Select 
                     value={newReward.type} 
                     onValueChange={(val) => setNewReward(r => ({ ...r, type: val as LoyaltyReward["type"] }))}
                   >
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="discount">Desconto</SelectItem>
                       <SelectItem value="free_service">Serviço Grátis</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="reward-points">Pontos Necessários</Label>
                   <Input 
                     id="reward-points" 
                     type="number" 
                     required
                     value={newReward.points_required}
                     onChange={e => setNewReward(r => ({ ...r, points_required: Number(e.target.value) }))}
                   />
                 </div>
               </div>
               <div className="space-y-2">
                 <Label htmlFor="reward-val">Valor (R$ ou ID do Serviço)</Label>
                 <Input 
                   id="reward-val" 
                   type="text" 
                   placeholder="Ex: 50.00"
                   value={newReward.value || ""}
                   onChange={e => setNewReward(r => ({ ...r, value: Number(e.target.value) || 0 }))}
                 />
               </div>
             </div>
             <DialogFooter>
               <Button type="button" variant="outline" onClick={() => setIsRewardModalOpen(false)}>Cancelar</Button>
               <Button type="submit" disabled={addRewardMutation.isPending}>
                 {addRewardMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                 Salvar Recompensa
               </Button>
             </DialogFooter>
           </form>
         </DialogContent>
       </Dialog>

       {/* MODAL NOVA MISSÃO */}
       <Dialog open={isMissionModalOpen} onOpenChange={setIsMissionModalOpen}>
         <DialogContent className="sm:max-w-[425px]">
           <form onSubmit={handleCreateMission}>
             <DialogHeader>
               <DialogTitle>Nova Missão</DialogTitle>
               <DialogDescription>
                 Incentive os clientes a atingirem metas de visitas ou gastos para ganhar pontos.
               </DialogDescription>
             </DialogHeader>
             <div className="grid gap-4 py-4">
               <div className="space-y-2">
                 <Label htmlFor="mission-name">Nome da Missão</Label>
                 <Input 
                   id="mission-name" 
                   required
                   placeholder="Ex: Cliente VIP, Fã Carteirinha..."
                   value={newMission.name}
                   onChange={e => setNewMission(m => ({ ...m, name: e.target.value }))}
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="mission-desc">Descrição</Label>
                 <Input 
                   id="mission-desc" 
                   placeholder="Detalhes ou condições"
                   value={newMission.description}
                   onChange={e => setNewMission(m => ({ ...m, description: e.target.value }))}
                 />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Tipo de Meta</Label>
                   <Select 
                     value={newMission.type} 
                     onValueChange={(val) => setNewMission(m => ({ ...m, type: val as LoyaltyMission["type"] }))}
                   >
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="visit_count">Visitas Totais</SelectItem>
                       <SelectItem value="spend_total">Gasto Acumulado (R$)</SelectItem>
                       <SelectItem value="referral_count">Indicações</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="mission-target">Alvo (Qtd/Valor)</Label>
                   <Input 
                     id="mission-target" 
                     type="number" 
                     required
                     value={newMission.target}
                     onChange={e => setNewMission(m => ({ ...m, target: Number(e.target.value) }))}
                   />
                 </div>
               </div>
               <div className="space-y-2">
                 <Label htmlFor="mission-pts">Pontos de Prêmio</Label>
                 <Input 
                   id="mission-pts" 
                   type="number" 
                   required
                   value={newMission.reward_points}
                   onChange={e => setNewMission(m => ({ ...m, reward_points: Number(e.target.value) }))}
                 />
               </div>
             </div>
             <DialogFooter>
               <Button type="button" variant="outline" onClick={() => setIsMissionModalOpen(false)}>Cancelar</Button>
               <Button type="submit" disabled={addMissionMutation.isPending}>
                 {addMissionMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                 Salvar Missão
               </Button>
             </DialogFooter>
           </form>
         </DialogContent>
       </Dialog>
     </div>
    </FeatureLock>
  );
};

export default LoyaltyDashboard;
