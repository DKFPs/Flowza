import { useState } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  orderBy, 
  serverTimestamp,
  writeBatch,
  increment 
} from "firebase/firestore";
import { compressImage } from "@/lib/imageUtils";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";
import { useBusiness } from "@/contexts/BusinessContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, ImageIcon, AlertTriangle, Zap, Clock, DollarSign, Edit2 } from "lucide-react";
import { Service, PlanId } from "@/types";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";

const Services = () => {
  const { business, limits, usage, refreshBusiness } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", duration_minutes: "30", price: "0", description: "", image_url: "", file: null as File | null });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const q = query(
        collection(db, "services"), 
        where("business_id", "==", business.id), 
        orderBy("name")
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
    },
    enabled: !!business?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (!business) return;
      
      let imageUrl = data.image_url;
      if (data.file) {
        setUploading(true);
        try {
          imageUrl = await compressImage(data.file);
        } catch (error: any) {
          toast({ title: "Erro no Upload da Foto", description: "Ocorreu um erro ao processar a imagem.", variant: "destructive" });
          throw error;
        }
      }

      const batch = writeBatch(db);
      
      if (data.id) {
        const serviceRef = doc(db, "services", data.id);
        const updateData: any = {
          name: data.name,
          duration: parseInt(data.duration_minutes),
          price: parseFloat(data.price),
          description: data.description || null,
        };
        if (imageUrl) {
          updateData.image_url = imageUrl;
        }
        batch.update(serviceRef, updateData);
      } else {
        const newServiceRef = doc(collection(db, "services"));
        batch.set(newServiceRef, {
          business_id: business.id,
          name: data.name,
          duration: parseInt(data.duration_minutes),
          price: parseFloat(data.price),
          description: data.description || null,
          image_url: imageUrl || null,
          is_active: true,
          created_at: serverTimestamp()
        });

        batch.update(doc(db, "businesses", business.id), {
          usage_services: increment(1)
        });
      }

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      refreshBusiness();
      toast({ title: form.id ? "Serviço atualizado!" : "Serviço criado!" });
      setDialogOpen(false);
      setForm({ id: "", name: "", duration_minutes: "30", price: "0", description: "", image_url: "", file: null });
      setUploading(false);
    },
    onError: (err) => {
      setUploading(false);
      handleFirestoreError(err, OperationType.WRITE, "services");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!business) return;
      const batch = writeBatch(db);
      batch.delete(doc(db, "services", id));
      batch.update(doc(db, "businesses", business.id), {
        usage_services: increment(-1)
      });
      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      refreshBusiness();
      toast({ title: "Serviço removido" });
    },
    onError: (err) => handleFirestoreError(err, OperationType.DELETE, "services")
  });

  const handleOpenNew = () => {
    setForm({ id: "", name: "", duration_minutes: "30", price: "0", description: "", image_url: "", file: null });
    if (usage.services >= limits.servicesLimit && limits.servicesLimit < 999) {
      setUpgradeModalOpen(true);
    } else {
      setDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Serviços</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-bold text-primary">{usage.services}</span> de <span className="font-bold">{limits.servicesLimit >= 999 ? "ilimitados" : limits.servicesLimit}</span> utilizados
          </p>
        </div>
        <Button onClick={handleOpenNew} className="h-10 px-5 rounded-xl gap-2 bg-primary shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" /> Novo Serviço
        </Button>
      </div>

      {usage.services >= limits.servicesLimit && limits.servicesLimit < 999 && (
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 text-primary">
            <Zap className="w-5 h-5 fill-current" />
            <p className="text-sm font-bold uppercase tracking-tight">Limite do plano {business?.plan_id?.toUpperCase()} atingido</p>
          </div>
          <Button size="sm" onClick={() => setUpgradeModalOpen(true)} className="rounded-xl px-5 h-9 text-xs font-black uppercase">
            Fazer Upgrade Agora
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-3xl bg-card border border-border" />)}
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border shadow-sm">
          <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
          <p className="font-bold text-lg">Sem serviços cadastrados</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">Seus serviços aparecerão aqui para os clientes agendarem.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <div key={s.id} className="bg-card border border-border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-muted/50 overflow-hidden flex items-center justify-center border border-border/40">
                    {s.image_url ? (
                      <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex items-center">
                    <button 
                      onClick={() => {
                        setForm({
                          id: s.id,
                          name: s.name,
                          duration_minutes: String(s.duration || 30),
                          price: String(s.price || 0),
                          description: s.description || "",
                          image_url: s.image_url || "",
                          file: null
                        });
                        setDialogOpen(true);
                      }} 
                      className="text-muted-foreground hover:text-primary p-2 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteMutation.mutate(s.id)} 
                      disabled={deleteMutation.isPending}
                      className="text-muted-foreground hover:text-destructive p-2 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <h3 className="font-black text-lg uppercase tracking-tight mb-1">{s.name}</h3>
                {s.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-4 italic">"{s.description}"</p>}
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-border/40 mt-auto">
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span className="font-bold">{s.duration} min</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-border" />
                <div className="flex items-center gap-1.5 text-xs">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-bold">R$ {Number(s.price).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ResponsiveModal open={dialogOpen} onOpenChange={setDialogOpen} title={form.id ? "Editar Serviço" : "Novo Serviço"}>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome do Serviço</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Corte de Cabelo Masculino" required className="h-12 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Duração (min)</label>
                <Input type="number" inputMode="numeric" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} required className="h-12 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Preço (R$)</label>
                <Input type="number" inputMode="decimal" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required className="h-12 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Descrição Breve</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Acabamento premium com toalha quente" className="h-12 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Foto (Opcional)</label>
              <div className="flex items-center gap-3">
                {form.image_url && !form.file && (
                  <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                    <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} 
                  className="h-12 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" 
                />
              </div>
            </div>
          </div>
          <Button type="submit" className="w-full h-14 rounded-2xl font-black uppercase tracking-tight shadow-xl shadow-primary/20" disabled={saveMutation.isPending || uploading}>
            {saveMutation.isPending || uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : (form.id ? "Salvar Serviço" : "Criar Serviço")}
          </Button>
        </form>
      </ResponsiveModal>

      <UpgradeModal 
        open={upgradeModalOpen} 
        onOpenChange={setUpgradeModalOpen} 
        feature="mais serviços" 
        targetPlan={PlanId.PRO} 
      />
    </div>
  );
};

export default Services;
