/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";
import { useBusiness } from "@/contexts/BusinessContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Clock, CalendarDays, Users, Pencil } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Professional, WorkingHour, FixedSlot, Service, Client } from "@/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";

const DAYS = [
  { value: "monday", label: "Segunda" },
  { value: "tuesday", label: "Terça" },
  { value: "wednesday", label: "Quarta" },
  { value: "thursday", label: "Quinta" },
  { value: "friday", label: "Sexta" },
  { value: "saturday", label: "Sábado" },
  { value: "sunday", label: "Domingo" },
] as const;

const Schedule = () => {
  const { business } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Working hours form state
  const [whDialog, setWhDialog] = useState(false);
  const [whForm, setWhForm] = useState({ professional_id: "", day_of_week: "", start_time: "08:00", end_time: "18:00" });

  // Fixed slots form state
  const [fsDialog, setFsDialog] = useState(false);
  const [fsForm, setFsForm] = useState({ professional_id: "", client_name: "", day_of_week: "", start_time: "09:00", end_time: "10:00", service_id: "", notes: "" });

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ["schedule_data", business?.id],
    queryFn: async () => {
      if (!business?.id) return { professionals: [], workingHours: [], fixedSlots: [], clients: [], services: [] };
      
      const bizId = business.id;
      const [profsSnap, whSnap, fsSnap, clientsSnap, servicesSnap] = await Promise.all([
        getDocs(query(collection(db, "professionals"), where("business_id", "==", bizId))),
        getDocs(query(collection(db, "working_hours"), where("business_id", "==", bizId))), 
        getDocs(query(collection(db, "fixed_client_slots"), where("business_id", "==", bizId))),
        getDocs(query(collection(db, "clients"), where("business_id", "==", bizId))),
        getDocs(query(collection(db, "services"), where("business_id", "==", bizId), where("is_active", "==", true))),
      ]);

      const profsList = profsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Professional));
      const profIds = profsList.map(p => p.id);

      return {
        professionals: profsList,
        workingHours: whSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as WorkingHour))
          .filter(wh => profIds.includes(wh.professional_id))
          .map(wh => ({ ...wh, professionals: { name: profsList.find(p => p.id === wh.professional_id)?.name || "" } })),
        fixedSlots: fsSnap.docs.map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            ...data,
            professionals: { name: profsList.find(p => p.id === data.professional_id)?.name || "" }
          } as FixedSlot;
        }),
        clients: clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)),
        services: servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service))
      };
    },
    enabled: !!business?.id,
  });

  const { workingHours = [], professionals = [], fixedSlots = [], services = [] } = scheduleData || {};

  const addWhMutation = useMutation({
    mutationFn: async (data: any) => {
      await addDoc(collection(db, "working_hours"), { ...data, business_id: business?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_data"] });
      toast({ title: "Horário adicionado!" });
      setWhDialog(false);
    },
    onError: (err) => handleFirestoreError(err, OperationType.WRITE, "working_hours")
  });

  const deleteWhMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, "working_hours", id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_data"] });
      toast({ title: "Horário removido" });
    },
    onError: (err) => handleFirestoreError(err, OperationType.DELETE, "working_hours")
  });

  const addFsMutation = useMutation({
    mutationFn: async (data: any) => {
      await addDoc(collection(db, "fixed_client_slots"), { ...data, business_id: business?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_data"] });
      toast({ title: "Cliente fixo adicionado!" });
      setFsDialog(false);
    },
    onError: (err) => handleFirestoreError(err, OperationType.WRITE, "fixed_client_slots")
  });

  const deleteFsMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, "fixed_client_slots", id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_data"] });
      toast({ title: "Removido" });
    },
    onError: (err) => handleFirestoreError(err, OperationType.DELETE, "fixed_client_slots")
  });

  const whByProfessional = useMemo(() => {
    const map: Record<string, { profId: string, name: string, hours: WorkingHour[] }> = {};
    professionals.forEach(p => {
      map[p.id] = { profId: p.id, name: p.name, hours: [] };
    });
    workingHours.forEach(wh => {
      if (map[wh.professional_id]) {
        map[wh.professional_id].hours.push(wh);
      }
    });
    return map;
  }, [professionals, workingHours]);

  const dayLabel = (d: string) => DAYS.find(dd => dd.value === d)?.label || d;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-48 h-10 rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="w-full h-12 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agenda & Horários</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure horários de trabalho e clientes recorrentes</p>
        </div>
      </div>

      <Tabs defaultValue="hours" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl grid grid-cols-2 w-full max-w-md border border-border">
          <TabsTrigger value="hours" className="rounded-xl font-bold gap-2 text-xs h-10 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Clock className="w-4 h-4" /> Horários
          </TabsTrigger>
          <TabsTrigger value="fixed" className="rounded-xl font-bold gap-2 text-xs h-10 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Users className="w-4 h-4" /> Cliente Fixo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
             <h2 className="text-lg font-bold">Disponibilidade</h2>
             <Button onClick={() => setWhDialog(true)} size="sm" className="h-10 px-5 rounded-xl gap-2 bg-primary shadow-lg shadow-primary/20">
               <Plus className="w-4 h-4" /> Novo Horário
             </Button>
          </div>

          {professionals.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border shadow-sm">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="font-bold text-lg">Nenhum profissional cadastrado</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">Cadastre sua equipe para definir os horários de cada um.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.values(whByProfessional).map(({ profId, name, hours }) => (
                <div key={profId} className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">
                        {name.charAt(0)}
                      </div>
                      <h3 className="font-black text-lg tracking-tight uppercase">{name}</h3>
                    </div>
                  </div>
                  
                  {hours.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 text-center border border-dashed border-border rounded-2xl bg-muted/5">
                      <p className="text-xs text-muted-foreground font-medium opacity-60">Sem horários definidos</p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        onClick={() => { setWhForm({ ...whForm, professional_id: profId }); setWhDialog(true); }}
                        className="text-[10px] font-black uppercase text-primary"
                      >
                        Configurar agora
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hours.sort((a, b) => DAYS.findIndex(d => d.value === a.day_of_week) - DAYS.findIndex(d => d.value === b.day_of_week)).map((wh) => (
                        <div key={wh.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40 group hover:border-primary/20 transition-all">
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-xs uppercase tracking-widest min-w-[70px] text-primary">{dayLabel(wh.day_of_week)}</span>
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{wh.start_time?.slice(0, 5)}</span>
                              <span className="text-muted-foreground opacity-50">—</span>
                              <span>{wh.end_time?.slice(0, 5)}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteWhMutation.mutate(wh.id)} 
                            disabled={deleteWhMutation.isPending}
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fixed" className="space-y-6 mt-6">
           <div className="flex justify-between items-center">
             <h2 className="text-lg font-bold">Clientes Recorrentes</h2>
             <Button onClick={() => setFsDialog(true)} size="sm" className="h-10 px-5 rounded-xl gap-2 bg-primary shadow-lg shadow-primary/20">
               <Plus className="w-4 h-4" /> Novo Fixo
             </Button>
          </div>

          {fixedSlots.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border shadow-sm">
              <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="font-bold text-lg">Sem clientes fixos</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">Clientes fixos são agendamentos automáticos semanais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fixedSlots.map((fs) => (
                <div key={fs.id} className="bg-card border border-border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group border-l-4 border-l-primary/40">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-black text-foreground text-base underline decoration-primary/20 underline-offset-4 uppercase italic">{fs.client_name || "Cliente"}</p>
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mt-1">
                        <CalendarDays className="w-3 h-3" />
                        <span>{dayLabel(fs.day_of_week)}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteFsMutation.mutate(fs.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span className="font-bold leading-none">{fs.start_time?.slice(0, 5)} — {fs.end_time?.slice(0, 5)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium text-muted-foreground">Com: <span className="text-foreground font-bold">{fs.professionals?.name}</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Working Hours Dialog */}
      <ResponsiveModal open={whDialog} onOpenChange={setWhDialog} title="Horário de Trabalho">
        <form onSubmit={(e) => { e.preventDefault(); addWhMutation.mutate(whForm); }} className="space-y-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Profissional</label>
              <Select value={whForm.professional_id} onValueChange={(v) => setWhForm({ ...whForm, professional_id: v })}>
                <SelectTrigger className="h-12 rounded-xl focus:ring-primary/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  {professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Dia da Semana</label>
              <Select value={whForm.day_of_week} onValueChange={(v) => setWhForm({ ...whForm, day_of_week: v })}>
                <SelectTrigger className="h-12 rounded-xl focus:ring-primary/20"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  {DAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Início</label>
                <Input type="time" value={whForm.start_time} onChange={(e) => setWhForm({ ...whForm, start_time: e.target.value })} required className="h-12 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fim</label>
                <Input type="time" value={whForm.end_time} onChange={(e) => setWhForm({ ...whForm, end_time: e.target.value })} required className="h-12 rounded-xl" />
              </div>
            </div>
          </div>
          <Button type="submit" className="w-full h-14 rounded-2xl font-black uppercase tracking-tight shadow-xl shadow-primary/20" disabled={addWhMutation.isPending || !whForm.professional_id || !whForm.day_of_week}>
            {addWhMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar Horário"}
          </Button>
        </form>
      </ResponsiveModal>

      {/* Fixed Slot Dialog */}
      <ResponsiveModal open={fsDialog} onOpenChange={setFsDialog} title="Novo Cliente Fixo">
        <form onSubmit={(e) => { e.preventDefault(); addFsMutation.mutate(fsForm); }} className="space-y-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome do Cliente</label>
              <Input value={fsForm.client_name} onChange={(e) => setFsForm({ ...fsForm, client_name: e.target.value })} placeholder="Ex: Roberto Carlos" required className="h-12 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Profissional Responsável</label>
              <Select value={fsForm.professional_id} onValueChange={(v) => setFsForm({ ...fsForm, professional_id: v })}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  {professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Dia da Semana</label>
              <Select value={fsForm.day_of_week} onValueChange={(v) => setFsForm({ ...fsForm, day_of_week: v })}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  {DAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Início</label>
                <Input type="time" value={fsForm.start_time} onChange={(e) => setFsForm({ ...fsForm, start_time: e.target.value })} required className="h-12 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fim</label>
                <Input type="time" value={fsForm.end_time} onChange={(e) => setFsForm({ ...fsForm, end_time: e.target.value })} required className="h-12 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Serviço (Opcional)</label>
              <Select value={fsForm.service_id} onValueChange={(v) => setFsForm({ ...fsForm, service_id: v })}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration || s.duration_minutes}min)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full h-14 rounded-2xl font-black uppercase tracking-tight shadow-xl shadow-primary/20" disabled={addFsMutation.isPending || !fsForm.professional_id || !fsForm.day_of_week}>
            {addFsMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Cliente Fixo"}
          </Button>
        </form>
      </ResponsiveModal>
    </div>
  );
};

export default Schedule;
