import { useEffect, useState, useCallback } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, UserCircle, AlertTriangle, Zap, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Professional, PlanId } from "@/types";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";

const Professionals = () => {
  const { user } = useAuth();
  const { business, limits, usage, refreshBusiness } = useBusiness();
  const { toast } = useToast();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", specialty: "", description: "", avatar_url: "", file: null as File | null });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || !business) return;
    try {
      const q = query(collection(db, "professionals"), where("business_id", "==", business.id), orderBy("name"));
      const snap = await getDocs(q);
      setProfessionals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Professional)));
    } catch (error) {
      console.error("Error fetching professionals:", error);
    }
  }, [user, business]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenNew = () => {
    setForm({ id: "", name: "", specialty: "", description: "", avatar_url: "", file: null });
    if (usage.professionals >= limits.maxProfessionals && limits.maxProfessionals < 999) {
      setUpgradeModalOpen(true);
    } else {
      setDialogOpen(true);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setLoading(true);

    try {
      let avatarUrl = form.avatar_url;
      if (form.file) {
        setUploading(true);
        try {
          avatarUrl = await compressImage(form.file);
        } catch (error: any) {
          toast({ title: "Erro no Upload da Foto", description: "Ocorreu um erro ao processar a imagem.", variant: "destructive" });
          throw error;
        }
      }

      const batch = writeBatch(db);
      
      if (form.id) {
        const profRef = doc(db, "professionals", form.id);
        const updateData: any = {
          name: form.name,
          specialty: form.specialty || null,
          description: form.description || null,
        };
        if (avatarUrl) {
          updateData.avatar_url = avatarUrl;
        }
        batch.update(profRef, updateData);
      } else {
        const newProfRef = doc(collection(db, "professionals"));
        batch.set(newProfRef, {
          business_id: business.id,
          name: form.name,
          specialty: form.specialty || null,
          description: form.description || null,
          avatar_url: avatarUrl || null,
          is_active: true,
          created_at: serverTimestamp()
        });

        // Aplicar horários padrão se existirem
        if (business.default_working_hours && business.default_working_hours.length > 0) {
          business.default_working_hours.filter(h => h.is_active).forEach(h => {
             const hourRef = doc(collection(db, "working_hours"));
             batch.set(hourRef, {
               business_id: business.id,
               professional_id: newProfRef.id,
               day_of_week: h.day_of_week,
               start_time: h.start_time,
               end_time: h.end_time,
               created_at: serverTimestamp()
             });
          });
        }

        batch.update(doc(db, "businesses", business.id), {
          usage_professionals: increment(1)
        });
      }

      await batch.commit();
      
      toast({ title: form.id ? "Profissional atualizado!" : "Profissional adicionado!" });
      setDialogOpen(false);
      setForm({ id: "", name: "", specialty: "", description: "", avatar_url: "", file: null });
      fetchData();
      refreshBusiness();
    } catch (error: unknown) {
      handleFirestoreError(error, OperationType.WRITE, "professionals");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!business) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "professionals", id));
      batch.update(doc(db, "businesses", business.id), {
        usage_professionals: increment(-1)
      });
      await batch.commit();

      toast({ title: "Profissional removido" });
      fetchData();
      refreshBusiness();
    } catch (error: unknown) {
      handleFirestoreError(error, OperationType.DELETE, `professionals/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profissionais</h1>
          <p className="text-sm text-muted-foreground">{usage.professionals} de {limits.maxProfessionals >= 999 ? "ilimitados" : limits.maxProfessionals} utilizados</p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2"><Plus className="w-4 h-4" />Novo Profissional</Button>
      </div>

      {usage.professionals >= limits.maxProfessionals && limits.maxProfessionals < 999 && (
        <div className="bg-warning/10 border border-warning/20 p-4 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-warning">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm font-medium">Você atingiu o limite de profissionais do seu plano.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setUpgradeModalOpen(true)} className="gap-2">
            Aumentar Limite <Zap className="w-4 h-4 fill-current text-primary" />
          </Button>
        </div>
      )}

      {professionals.length === 0 ? (
        <div className="text-center py-16"><p className="text-muted-foreground">Nenhum profissional cadastrado.</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {professionals.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt={p.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <UserCircle className="w-7 h-7 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{p.name}</p>
                <p className="text-sm text-muted-foreground">{p.specialty || "Sem especialidade"}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                  {p.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="flex items-center">
                <button 
                  onClick={() => {
                    setForm({
                      id: p.id,
                      name: p.name,
                      specialty: p.specialty || "",
                      description: p.description || "",
                      avatar_url: p.avatar_url || "",
                      file: null
                    });
                    setDialogOpen(true);
                  }} 
                  className="text-muted-foreground hover:text-primary p-2 transition-colors shrink-0"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive p-2 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Editar Profissional" : "Novo Profissional"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div><label className="text-sm font-medium mb-1 block">Nome</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label className="text-sm font-medium mb-1 block">Especialidade</label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Ex: Corte masculino" /></div>
            <div><label className="text-sm font-medium mb-1 block">Descrição</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve biografia ou apresentação..." /></div>
            <div>
              <label className="text-sm font-medium mb-1 block">Foto (Opcional)</label>
              <div className="flex items-center gap-3">
                {form.avatar_url && !form.file && (
                  <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                    <img src={form.avatar_url} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} 
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" 
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading || uploading}>{(loading || uploading) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{form.id ? "Salvar Profissional" : "Novo Profissional"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <UpgradeModal 
        open={upgradeModalOpen} 
        onOpenChange={setUpgradeModalOpen} 
        feature="mais profissionais" 
        targetPlan={PlanId.BUSINESS} 
      />
    </div>
  );
};

export default Professionals;
