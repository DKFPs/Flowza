import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, CreditCard, Loader2 } from "lucide-react";
import { PlanGuard } from "@/components/dashboard/PlanGuard";
import { PlanId } from "@/types";
import { collection, query, where, getDocs, limit, doc, addDoc, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
  paused: "bg-warning/10 text-warning",
};

const statusLabels: Record<string, string> = {
  active: "Ativa",
  cancelled: "Cancelada",
  expired: "Expirada",
  paused: "Pausada",
};

const Subscriptions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", plan_name: "", price: "0", end_date: "" });
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    try {
      const bizQuery = query(collection(db, "businesses"), where("owner_id", "==", user.uid), limit(1));
      const bizSnap = await getDocs(bizQuery);
      if (bizSnap.empty) return;
      const bizId = bizSnap.docs[0].id;
      setBusinessId(bizId);

      const [subsSnap, clsSnap] = await Promise.all([
        getDocs(query(collection(db, "subscriptions"), where("business_id", "==", bizId), orderBy("created_at", "desc"))),
        getDocs(query(collection(db, "clients"), where("business_id", "==", bizId), orderBy("name"))),
      ]);

      setSubscriptions(subsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClients(clsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching subscription data:", error);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !form.client_id) return;
    setLoading(true);

    try {
      await addDoc(collection(db, "subscriptions"), {
        business_id: businessId,
        client_id: form.client_id,
        plan_name: form.plan_name,
        price: parseFloat(form.price),
        end_date: form.end_date || null,
        status: "active",
        created_at: serverTimestamp()
      });

      toast({ title: "Assinatura criada!" });
      setDialogOpen(false);
      setForm({ client_id: "", plan_name: "", price: "0", end_date: "" });
      fetchData();
    } catch (error) {
      console.error("Error adding subscription:", error);
      toast({ title: "Erro ao criar assinatura", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PlanGuard feature="hasRecurring" label="Assinaturas Recorrentes" targetPlan={PlanId.BUSINESS}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Assinaturas</h1>
          <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Nova Assinatura</Button>
        </div>

        {subscriptions.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Assinaturas Mensais</h3>
            <p className="text-muted-foreground max-w-md mx-auto">Crie planos de assinatura para seus clientes recorrentes.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase tracking-wider">Cliente ID</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Plano</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Preço</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Fim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-xs">{s.client_id || "—"}</TableCell>
                    <TableCell>{s.plan_name}</TableCell>
                    <TableCell>R$ {Number(s.price).toFixed(2)}/mês</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[s.status] || ""}`}>
                        {statusLabels[s.status] || s.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.end_date || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Assinatura</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Cliente</label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nome do Plano</label>
                <Input value={form.plan_name} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} placeholder="Ex: Plano Barba Ilimitada" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Preço Mensal (R$)</label>
                  <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Data de Fim</label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Criar Assinatura
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PlanGuard>
  );
};

export default Subscriptions;
