import { useEffect, useState, useCallback } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  limit, 
  orderBy,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { FeatureLock } from "@/components/dashboard/MonetizationComponents";
import { useBusiness } from "@/contexts/BusinessContext";
import { PlanId } from "@shared/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Gift, Plus, Trash2, Loader2, Ticket, CheckCircle } from "lucide-react";

interface Reward {
  id: string;
  business_id: string;
  name: string;
  description: string;
  points_required: number;
  max_redemptions: number;
  current_redemptions: number;
  is_active: boolean;
}

interface Redemption {
  id: string;
  reward_id: string;
  code: string;
  client_id: string;
  is_used: boolean;
  used_at?: Timestamp;
  client_name?: string;
  client_phone?: string;
}

const Rewards = () => {
  const { user } = useAuth();
  const { plan , limits } = useBusiness();
  const { toast } = useToast();
  
  const isEligible = limits?.automation === "full";
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [redemptionsOpen, setRedemptionsOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    points_required: "100",
    max_redemptions: "10",
  });

  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyName, setCurrencyName] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const bizQuery = query(collection(db, "businesses"), where("owner_id", "==", user.uid), limit(1));
      const bizSnap = await getDocs(bizQuery);
      if (bizSnap.empty) return;
      const bizData = bizSnap.docs[0];
      setBusinessId(bizData.id);
      setCurrencyName(bizData.data().loyalty_currency_name || "");

      const rwQuery = query(
        collection(db, "loyalty_rewards"),
        where("business_id", "==", bizData.id),
        orderBy("created_at", "desc")
      );
      const rwSnap = await getDocs(rwQuery);
      setRewards(rwSnap.docs.map(d => ({ id: d.id, ...d.data() } as Reward)));
    } catch (err) {
      console.error("Error fetching rewards:", err);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveCurrencyLabel = async () => {
    if (!businessId) return;
    setSavingCurrency(true);
    try {
      await updateDoc(doc(db, "businesses", businessId), {
        loyalty_currency_name: currencyName.trim()
      });
      toast({ title: "Nome da moeda de fidelidade salvo!" });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar o nome da moeda", variant: "destructive" });
    }
    setSavingCurrency(false);
  };


  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setLoading(true);

    try {
      await addDoc(collection(db, "loyalty_rewards"), {
        business_id: businessId,
        name: form.name,
        description: form.description,
        points_required: parseInt(form.points_required),
        max_redemptions: parseInt(form.max_redemptions),
        current_redemptions: 0,
        is_active: true,
        created_at: serverTimestamp()
      });

      toast({ title: "Recompensa criada!" });
      setCreateOpen(false);
      setForm({ name: "", description: "", points_required: "100", max_redemptions: "10" });
      fetchData();
    } catch (err: unknown) {
      const error = err as Error;
      toast({ title: "Erro ao criar recompensa", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "loyalty_rewards", id));
      toast({ title: "Recompensa removida" });
      fetchData();
    } catch (err: unknown) {
      const error = err as Error;
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await updateDoc(doc(db, "loyalty_rewards", id), { is_active: active });
      fetchData();
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const viewRedemptions = async (reward: Reward) => {
    setSelectedReward(reward);
    try {
      const redQuery = query(
        collection(db, "loyalty_redemptions"),
        where("reward_id", "==", reward.id),
        orderBy("created_at", "desc")
      );
      const redSnap = await getDocs(redQuery);
      
      const redList = await Promise.all(redSnap.docs.map(async (d) => {
        const data = d.data();
        let client_name = "";
        let client_phone = "";
        
        if (data.client_id) {
          const clientSnap = await getDocs(query(collection(db, "clients"), where("__name__", "==", data.client_id), limit(1)));
          if (!clientSnap.empty) {
            client_name = clientSnap.docs[0].data().name;
            client_phone = clientSnap.docs[0].data().phone;
          }
        }
        
        return { 
          id: d.id, 
          ...data,
          client_name,
          client_phone
        } as Redemption;
      }));
      
      setRedemptions(redList);
      setRedemptionsOpen(true);
    } catch (err) {
      console.error("Redemptions fetch error:", err);
    }
  };

  const markCodeUsed = async (redemptionId: string) => {
    try {
      await updateDoc(doc(db, "loyalty_redemptions", redemptionId), {
        is_used: true,
        used_at: serverTimestamp()
      });
      toast({ title: "Código marcado como usado!" });
      if (selectedReward) viewRedemptions(selectedReward);
    } catch (err: unknown) {
      const error = err as Error;
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  return (
    <FeatureLock isLocked={!isEligible} featureName="Recompensas" planName="Business ou Premium">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Recompensas</h1>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Recompensa
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="text-base font-bold mb-2">Nome da Moeda de Fidelidade</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Defina o nome da sua moeda virtual (ex: Pontos, Estrelas, LordCoins). 
          Os códigos de resgate serão gerados com este prefixo seguido de 4 números (ex: LORDCOINS1234).
        </p>
        <div className="flex items-center gap-3">
          <Input 
            value={currencyName}
            onChange={(e) => setCurrencyName(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            placeholder="Ex: LORD" 
            className="max-w-[200px] uppercase"
          />
          <Button onClick={handleSaveCurrencyLabel} disabled={savingCurrency} size="sm">
            {savingCurrency ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Nome
          </Button>
        </div>
      </div>

      {rewards.length === 0 ? (
        <div className="text-center py-16 space-y-4 border rounded-xl bg-card/50">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nenhuma recompensa criada</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Crie recompensas que seus clientes poderão resgatar com pontos de fidelidade.
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <Button onClick={() => {
              setForm({ name: "Desconto de 20%", description: "Ganhe 20% de desconto no próximo serviço.", points_required: "200", max_redemptions: "50" });
              setCreateOpen(true);
            }} variant="outline">
              Modelo: Desconto de 20%
            </Button>
            <Button onClick={() => {
              setForm({ name: "Serviço Gratuito", description: "Troque seus pontos por um serviço padrão gratuito.", points_required: "500", max_redemptions: "20" });
              setCreateOpen(true);
            }}>
              Modelo: Serviço Gratuito
            </Button>
            <Button onClick={() => {
              setForm({ name: "", description: "", points_required: "100", max_redemptions: "10" });
              setCreateOpen(true);
            }} variant="ghost">
              <Plus className="w-4 h-4 mr-2" /> Personalizado
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {rewards.map((rw) => (
            <div key={rw.id} className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-card-foreground text-lg">{rw.name}</h3>
                  {!rw.is_active && <Badge variant="secondary">Inativa</Badge>}
                </div>
                {rw.description && <p className="text-sm text-muted-foreground">{rw.description}</p>}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="font-medium text-primary">{rw.points_required} pontos</span>
                  <span>Resgatados: {rw.current_redemptions}/{rw.max_redemptions}</span>
                  {rw.current_redemptions >= rw.max_redemptions && (
                    <Badge variant="destructive">Esgotado</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={rw.is_active} onCheckedChange={(v) => handleToggle(rw.id, v)} />
                <Button variant="outline" size="sm" onClick={() => viewRedemptions(rw)} className="gap-1">
                  <Ticket className="w-3.5 h-3.5" /> Códigos
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(rw.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Recompensa</DialogTitle></DialogHeader>
          
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-primary/10 shrink-0" 
              onClick={() => setForm({ name: "Corte / Serviço Grátis", description: "Troque seus pontos por um serviço 100% gratuito.", points_required: "500", max_redemptions: "20" })}
            >
              Corte Grátis (500 pts)
            </Badge>
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-primary/10 shrink-0" 
              onClick={() => setForm({ name: "Brinde Especial", description: "Ganhe um produto de brinde ao nos visitar.", points_required: "150", max_redemptions: "50" })}
            >
              Brinde (150 pts)
            </Badge>
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-primary/10 shrink-0" 
              onClick={() => setForm({ name: "Desconto de 20%", description: "Ganhe 20% de desconto no seu próximo agendamento.", points_required: "300", max_redemptions: "100" })}
            >
              Desconto 20% (300 pts)
            </Badge>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nome</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Corte Grátis" required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Descrição</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhe a recompensa..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Pontos necessários</label>
                <Input type="number" min="1" value={form.points_required} onChange={(e) => setForm({ ...form, points_required: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Limite de resgates</label>
                <Input type="number" min="1" value={form.max_redemptions} onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })} required />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Criar Recompensa
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Redemptions Dialog */}
      <Dialog open={redemptionsOpen} onOpenChange={setRedemptionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Códigos — {selectedReward?.name}</DialogTitle></DialogHeader>
          {redemptions.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhum resgate ainda.</p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((rd) => (
                    <TableRow key={rd.id}>
                      <TableCell className="font-mono font-bold text-primary">{rd.code}</TableCell>
                      <TableCell>
                        <div>{rd.client_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{rd.client_phone}</div>
                      </TableCell>
                      <TableCell>
                        {rd.is_used ? (
                          <Badge variant="secondary">Usado</Badge>
                        ) : (
                          <Badge variant="default">Ativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!rd.is_used && (
                          <Button variant="ghost" size="sm" onClick={() => markCodeUsed(rd.id)} title="Marcar como usado">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
     </div>
    </FeatureLock>
  );
};

export default Rewards;
