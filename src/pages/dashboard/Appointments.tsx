import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Trash2, Clock, User, Scissors, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  deleteDoc,
  updateDoc,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";
import { useBusiness } from "@/contexts/BusinessContext";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { LoyaltyService } from "@/services/loyaltyService";
import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-primary/10 text-primary border-primary/20",
  confirmed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  in_progress: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  completed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  cancelled: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  no_show: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

const statusLabels: Record<string, string> = {
  scheduled: "Agendado",
  pending: "Pendente",
  confirmed: "Confirmado",
  in_progress: "Em Andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

const Appointments = () => {
  const { business } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date>(new Date());

  // Fetch appointments for the selected date
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", business?.id, format(date, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const q = query(
        collection(db, "appointments"),
        where("business_id", "==", business.id),
        where("appointment_date", "==", format(date, "yyyy-MM-dd")),
        orderBy("start_time", "asc")
      );
      
      const snap = await getDocs(q);
      const appts = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const clientIds = [...new Set(appts.map(a => a.client_id).filter(Boolean))];
      const profIds = [...new Set(appts.map(a => a.professional_id).filter(Boolean))];
      const serviceIds = [...new Set(appts.map(a => a.service_id).filter(Boolean))];

      const [clientsSnap, profsSnap, svcsSnap] = await Promise.all([
        clientIds.length > 0 ? getDocs(query(collection(db, "clients"), where("__name__", "in", clientIds))) : Promise.resolve({ docs: [] }),
        profIds.length > 0 ? getDocs(query(collection(db, "professionals"), where("__name__", "in", profIds))) : Promise.resolve({ docs: [] }),
        serviceIds.length > 0 ? getDocs(query(collection(db, "services"), where("__name__", "in", serviceIds))) : Promise.resolve({ docs: [] })
      ]);

      const clientsMap = Object.fromEntries(clientsSnap.docs.map(d => [d.id, d.data().name]));
      const profsMap = Object.fromEntries(profsSnap.docs.map(d => [d.id, d.data().name]));
      const svcsMap = Object.fromEntries(svcsSnap.docs.map(d => [d.id, { name: d.data().name, price: d.data().price }]));

      return appts.map(a => ({
        ...a,
        client_name: a.client_name || clientsMap[a.client_id] || "—",
        professional_name: a.professional_name || profsMap[a.professional_id] || "—",
        service_name: a.service_name || svcsMap[a.service_id]?.name || "—",
        service_price: svcsMap[a.service_id]?.price || 0,
        services: svcsMap[a.service_id] 
      }));
    },
    enabled: !!business?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, appointment }: { id: string, status: string, appointment: any }) => {
      await updateDoc(doc(db, "appointments", id), {
        status,
        updated_at: serverTimestamp()
      });

      if (status === 'completed') {
        const fullApt = { ...appointment, status: 'completed' };
        await LoyaltyService.awardPointsForAppointment(fullApt);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: `Status atualizado para ${statusLabels[variables.status]}` });
    },
    onError: (error) => {
      handleFirestoreError(error, OperationType.UPDATE, "appointments");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, "appointments", id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Agendamento removido" });
    },
    onError: (error) => {
      handleFirestoreError(error, OperationType.DELETE, "appointments");
    }
  });

  const nextDay = () => setDate(d => {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return next;
  });

  const prevDay = () => setDate(d => {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    return prev;
  });

  const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seu tempo e seus clientes</p>
        </div>
        
        <div className="flex items-center gap-2 bg-card p-1 rounded-2xl border border-border shadow-sm">
          <Button variant="ghost" size="icon" onClick={prevDay} className="h-9 w-9 rounded-xl">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="h-9 px-4 rounded-xl gap-2 text-sm font-bold">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {isToday ? "Hoje" : format(date, "dd 'de' MMM", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} locale={ptBR} className="p-3" />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={nextDay} className="h-9 w-9 rounded-xl">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl bg-card border border-border" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
          <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-primary opacity-20" />
          </div>
          <h3 className="font-bold text-lg">Sem agenda para este dia</h3>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1">Aproveite para descansar ou planejar sua semana!</p>
          <Button variant="outline" className="mt-6 rounded-xl border-primary color-primary" onClick={() => setDate(new Date())}>
            Voltar para Hoje
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {appointments.map((apt: any) => (
            <div 
              key={apt.id} 
              className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/20 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center bg-primary/5 w-16 h-16 rounded-xl border border-primary/10">
                  <span className="text-lg font-black text-primary leading-none">{apt.start_time?.slice(0, 5)}</span>
                  <span className="text-[10px] font-bold text-primary/60 uppercase mt-1">Início</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-bold text-base leading-none">{apt.client_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Scissors className="w-3 h-3" />
                      <span>{apt.service_name}</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-border" />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 text-primary" />
                      <span>{apt.professional_name}</span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[apt.status] || ""}`}>
                      {statusLabels[apt.status] || apt.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-border bg-card w-48">
                    <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-40 px-2 pt-2">Mudar Status</DropdownMenuLabel>
                    <DropdownMenuItem className="text-xs font-bold py-2 px-3 cursor-pointer" onClick={() => updateStatusMutation.mutate({ id: apt.id, status: 'confirmed', appointment: apt })}>
                      Marcar como Confirmado
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs font-bold py-2 px-3 cursor-pointer" onClick={() => updateStatusMutation.mutate({ id: apt.id, status: 'in_progress', appointment: apt })}>
                      Marcar Em Andamento
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs font-bold py-2 px-3 cursor-pointer text-emerald-500 focus:text-emerald-500" onClick={() => updateStatusMutation.mutate({ id: apt.id, status: 'completed', appointment: apt })}>
                      Marcar Concluído ✨
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs font-bold py-2 px-3 cursor-pointer text-rose-500 focus:text-rose-500" onClick={() => updateStatusMutation.mutate({ id: apt.id, status: 'no_show', appointment: apt })}>
                      Marcar como Falta
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem className="text-xs font-bold py-2 px-3 cursor-pointer text-destructive focus:text-destructive active:bg-destructive/10" onClick={() => deleteMutation.mutate(apt.id)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Cancelar Agendamento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Appointments;
