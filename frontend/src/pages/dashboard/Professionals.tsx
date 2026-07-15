import { apiFetch } from "@/lib/api";
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
import { Professional, PlanId } from "@shared/types";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";

const Professionals = () => {
  const { user } = useAuth();
  const { business, limits, usage, refreshBusiness } = useBusiness();
  const { toast } = useToast();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ 
    id: "", name: "", specialty: "", description: "", avatar_url: "", file: null as File | null,
    buffer_minutes: 0,
    working_hours_start: "08:00",
    working_hours_end: "18:00",
    working_days: [1, 2, 3, 4, 5, 6] // default Mon-Sat
  });

  const fetchData = useCallback(async () => {
    if (!user || !business) return;
    try {
      const q = query(collection(db, "professionals"), where("business_id", "==", business.id));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Professional));
      setProfessionals(list.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    } catch (error) {
      console.error("Error fetching professionals:", error);
    }
  }, [user, business]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenNew = () => {
    setForm({ 
      id: "", name: "", specialty: "", description: "", avatar_url: "", file: null,
      buffer_minutes: 0, working_hours_start: "08:00", working_hours_end: "18:00",
      working_days: [1, 2, 3, 4, 5, 6]
    });
    if (usage.professionals >= limits.professionalsLimit && limits.professionalsLimit < 999) {
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
      const token = await user?.getIdToken();
      if (!token) throw new Error("Não autorizado");

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

      const working_hours = { start: form.working_hours_start, end: form.working_hours_end };

      const payload = {
        businessId: business.id,
        name: form.name,
        specialty: form.specialty || null,
        description: form.description || null,
        buffer_minutes: form.buffer_minutes,
        working_hours: working_hours,
        working_days: form.working_days,
        avatar_url: avatarUrl || null
      };

      const url = (import.meta.env.VITE_API_URL || '') + (form.id ? `/api/professionals/${form.id}` : '/api/professionals');
      const method = form.id ? 'PUT' : 'POST';

      let usedApi = false;
      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          usedApi = true;
        } else {
          const err = await res.json();
          console.warn("API write failed, using client fallback. Error:", err);
        }
      } catch (e) {
        console.warn("API write threw exception, using client fallback. Exception:", e);
      }

      if (!usedApi) {
        // --- CLIENT-SIDE DIRECT FIRESTORE FALLBACK ---
        const profData = {
          business_id: business.id,
          name: form.name,
          specialty: form.specialty || null,
          description: form.description || null,
          buffer_minutes: form.buffer_minutes || 0,
          working_days: form.working_days,
          avatar_url: avatarUrl || null,
          is_active: true
        };

        const batch = writeBatch(db);
        if (form.id) {
          const profRef = doc(db, "professionals", form.id);
          batch.set(profRef, {
            ...profData,
            updated_at: serverTimestamp()
          }, { merge: true });
        } else {
          const newProfRef = doc(collection(db, "professionals"));
          batch.set(newProfRef, {
            ...profData,
            created_at: serverTimestamp()
          });

          // Create working hours for new professional
          for (const day of form.working_days) {
            const hourRef = doc(collection(db, "working_hours"));
            batch.set(hourRef, {
              business_id: business.id,
              professional_id: newProfRef.id,
              day_of_week: day,
              start_time: form.working_hours_start,
              end_time: form.working_hours_end,
              created_at: serverTimestamp()
            });
          }

          // Increment usage counter on business
          const bizRef = doc(db, "businesses", business.id);
          batch.update(bizRef, {
            usage_professionals: increment(1)
          });
        }
        await batch.commit();
      }
      
      toast({ title: form.id ? "Profissional atualizado!" : "Profissional adicionado!" });
      setDialogOpen(false);
      setForm({ id: "", name: "", specialty: "", description: "", avatar_url: "", file: null, buffer_minutes: 0, working_hours_start: "08:00", working_hours_end: "18:00", working_days: [1, 2, 3, 4, 5, 6] });
      fetchData();
      refreshBusiness();
    } catch (error: unknown) {
      toast({ title: "Erro", description: (error as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!business) return;
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Não autorizado");
      
      let usedApi = false;
      try {
        const res = await apiFetch(`/api/professionals/${id}?businessId=${business.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          usedApi = true;
        } else {
          const err = await res.json();
          console.warn("API delete failed, using client fallback. Error:", err);
        }
      } catch (e) {
        console.warn("API delete threw exception, using client fallback. Exception:", e);
      }

      if (!usedApi) {
        // --- CLIENT-SIDE DIRECT FIRESTORE FALLBACK ---
        const profRef = doc(db, "professionals", id);
        const bizRef = doc(db, "businesses", business.id);
        const batch = writeBatch(db);
        batch.delete(profRef);
        batch.update(bizRef, {
          usage_professionals: increment(-1)
        });
        await batch.commit();
      }

      toast({ title: "Profissional removido" });
      fetchData();
      refreshBusiness();
    } catch (error: unknown) {
      toast({ title: "Erro", description: (error as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profissionais</h1>
          <p className="text-sm text-muted-foreground">{usage.professionals} de {limits.professionalsLimit >= 999 ? "ilimitados" : limits.professionalsLimit} utilizados</p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2"><Plus className="w-4 h-4" />Novo Profissional</Button>
      </div>

      {usage.professionals >= limits.professionalsLimit && limits.professionalsLimit < 999 && (
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
                      buffer_minutes: p.buffer_minutes || 0,
                      working_hours_start: p.working_hours?.start || "08:00",
                      working_hours_end: p.working_hours?.end || "18:00",
                      working_days: p.working_days || [1, 2, 3, 4, 5, 6],
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Início Expediente</label>
                <Input type="time" value={form.working_hours_start} onChange={(e) => setForm({ ...form, working_hours_start: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Término Expediente</label>
                <Input type="time" value={form.working_hours_end} onChange={(e) => setForm({ ...form, working_hours_end: e.target.value })} required />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Intervalo (Minutos após atendimento)</label>
              <Input type="number" value={form.buffer_minutes} onChange={(e) => setForm({ ...form, buffer_minutes: parseInt(e.target.value) || 0 })} placeholder="0" min="0" />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Dias Atendidos</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 1, label: "Seg" },
                  { value: 2, label: "Ter" },
                  { value: 3, label: "Qua" },
                  { value: 4, label: "Qui" },
                  { value: 5, label: "Sex" },
                  { value: 6, label: "Sáb" },
                  { value: 0, label: "Dom" }
                ].map(day => (
                  <label key={day.value} className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full text-sm cursor-pointer hover:bg-muted transition-colors border border-border">
                    <input 
                      type="checkbox" 
                      className="rounded text-primary focus:ring-primary"
                      checked={form.working_days.includes(day.value)}
                      onChange={(e) => {
                        const newDays = e.target.checked 
                          ? [...form.working_days, day.value]
                          : form.working_days.filter(d => d !== day.value);
                        setForm({ ...form, working_days: newDays });
                      }}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>

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
