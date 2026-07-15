import { apiFetch } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  getDoc,
  orderBy,
  addDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { format, isAfter, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, XCircle, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Appointment, Service, Professional } from "@shared/types";

interface HydratedAppointment extends Appointment {
  service?: Service;
  professional?: Professional;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  scheduled: { label: "Agendado", variant: "default" },
  confirmed: { label: "Confirmado", variant: "default" },
  in_progress: { label: "Em andamento", variant: "secondary" },
  completed: { label: "Concluído", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  no_show: { label: "Não compareceu", variant: "destructive" },
};

const MyAppointments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<HydratedAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States for Cancel/Reschedule
  const [selectedApt, setSelectedApt] = useState<HydratedAppointment | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // States for Rescheduling
  const [newDate, setNewDate] = useState<Date | undefined>(new Date());
  const [newTime, setNewTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedBizData, setSelectedBizData] = useState<any>(null);

  const fetchAppointments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Get user phone from profile to find client records
      const profileSnap = await getDoc(doc(db, "profiles", user.uid));
      const profileData = profileSnap.data();
      const userPhone = profileData?.phone || user.phoneNumber;

      if (!userPhone) {
        setAppointments([]);
        setLoading(false);
        return;
      }

      // 2. Find clients with this phone
      const clientsQ = query(collection(db, "clients"), where("phone", "==", userPhone));
      const clientsSnap = await getDocs(clientsQ);
      const clientIds = clientsSnap.docs.map(d => d.id);

      if (clientIds.length === 0) {
        setAppointments([]);
        setLoading(false);
        return;
      }

      // 3. Find appointments for these clients
      const apptsQ = query(
        collection(db, "appointments"), 
        where("client_id", "in", clientIds),
        orderBy("appointment_date", "desc")
      );
      const apptsSnap = await getDocs(apptsQ);
      
      const appts = apptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));

      // 4. Hydrate with service and professional names
      const hydratedAppts = await Promise.all(appts.map(async (apt) => {
        const [svcSnap, profSnap] = await Promise.all([
          getDoc(doc(db, "services", apt.service_id)),
          getDoc(doc(db, "professionals", apt.professional_id))
        ]);
        return {
          ...apt,
          service: svcSnap.data() as Service,
          professional: profSnap.data() as Professional
        };
      }));

      setAppointments(hydratedAppts);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const canActionStatus = (apt: HydratedAppointment) => {
    return ["pending", "confirmed", "scheduled"].includes(apt.status);
  };

  const getBusinessSettings = async (businessId: string) => {
    const bizSnap = await getDoc(doc(db, "businesses", businessId));
    return bizSnap.data();
  };

  const handleCancelClick = (apt: HydratedAppointment) => {
    setSelectedApt(apt);
    setIsCancelModalOpen(true);
  };

  const handleRescheduleClick = async (apt: HydratedAppointment) => {
    setSelectedApt(apt);
    setNewDate(new Date(apt.appointment_date + "T00:00:00"));
    setNewTime(apt.start_time.slice(0, 5));
    setIsRescheduleModalOpen(true);
    const biz = await getBusinessSettings(apt.business_id);
    setSelectedBizData(biz);
  };

  const notifyBusiness = async (apt: HydratedAppointment, action: "cancel" | "reschedule", details?: string) => {
    try {
      await addDoc(collection(db, "notifications"), {
        business_id: apt.business_id,
        client_id: apt.client_id,
        type: "appointment_update",
        title: action === "cancel" ? "Agendamento Cancelado" : "Agendamento Reagendado",
        body: action === "cancel" 
          ? `O cliente cancelou o agendamento de ${apt.service?.name} para ${format(new Date(apt.appointment_date + "T00:00:00"), "dd/MM")}.` 
          : `O cliente reagendou o serviço ${apt.service?.name} para ${details}.`,
        status: "pending",
        channel: "push",
        created_at: serverTimestamp()
      });
    } catch (e) {
      console.error("Notify fail:", e);
    }
  };

  const confirmCancellation = async () => {
    if (!selectedApt) return;
    setIsProcessing(true);
    try {
      const biz = await getBusinessSettings(selectedApt.business_id);
      const windowHours = biz?.cancel_window_hours || 24;

      const aptDateTime = new Date(`${selectedApt.appointment_date}T${selectedApt.start_time}`);
      const limitTime = subHours(aptDateTime, windowHours);

      if (isAfter(new Date(), limitTime)) {
        toast({
          title: "Limite excedido",
          description: `O cancelamento deve ser feito com pelo menos ${windowHours}h de antecedência.`,
          variant: "destructive"
        });
        return;
      }

      await updateDoc(doc(db, "appointments", selectedApt.id), {
        status: "cancelled",
        updated_at: serverTimestamp()
      });

      await notifyBusiness(selectedApt, "cancel");

      toast({ title: "Agendamento cancelado", description: "O estabelecimento foi notificado." });
      setIsCancelModalOpen(false);
      fetchAppointments();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível cancelar o agendamento.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchSlots = useCallback(async (date: Date) => {
    if (!selectedApt) return;
    setLoadingSlots(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const q = query(
        collection(db, "appointments"),
        where("business_id", "==", selectedApt.business_id),
        where("professional_id", "==", selectedApt.professional_id),
        where("appointment_date", "==", dateStr),
        where("status", "!=", "cancelled")
      );
      const snap = await getDocs(q);
      const bookedStartTimes = snap.docs.map((d) => d.data().start_time.slice(0, 5));
      
      let start = "08:00";
      let end = "18:00";
      if (selectedBizData && selectedBizData.default_working_hours) {
         const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
         const dayConfig = selectedBizData.default_working_hours.find((c: any) => c.day_of_week === dayNames[date.getDay()]);
         if (dayConfig && dayConfig.is_active) {
            start = dayConfig.start_time || start;
            end = dayConfig.end_time || end;
         }
      }

      const generateTimeSlots = (startStr: string, endStr: string) => {
         const slots = [];
         const [startH, startM] = startStr.split(':').map(Number);
         const [endH, endM] = endStr.split(':').map(Number);
         let currentMins = startH * 60 + startM;
         const endMins = endH * 60 + endM;
         
         while (currentMins <= endMins) {
           const h = Math.floor(currentMins / 60).toString().padStart(2, '0');
           const m = (currentMins % 60).toString().padStart(2, '0');
           slots.push(`${h}:${m}`);
           currentMins += 30; // 30 min intervals
         }
         return slots;
      };

      const ALL_SLOTS = generateTimeSlots(start, end);
      
      setAvailableSlots(ALL_SLOTS.filter(s => !bookedStartTimes.includes(s) || s === selectedApt.start_time.slice(0, 5)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedApt]);

  useEffect(() => {
    if (isRescheduleModalOpen && newDate) {
      fetchSlots(newDate);
    }
  }, [isRescheduleModalOpen, newDate, fetchSlots]);

  const confirmRescheduling = async () => {
    if (!selectedApt || !newDate || !newTime) return;
    setIsProcessing(true);
    try {
      const biz = await getBusinessSettings(selectedApt.business_id);
      const windowHours = biz?.reschedule_window_hours || 24;

      const aptDateTime = new Date(`${selectedApt.appointment_date}T${selectedApt.start_time}`);
      const limitTime = subHours(aptDateTime, windowHours);

      if (isAfter(new Date(), limitTime)) {
        toast({
          title: "Limite excedido",
          description: `O reagendamento deve ser feito com pelo menos ${windowHours}h de antecedência.`,
          variant: "destructive"
        });
        return;
      }

      const duration = selectedApt.service?.duration || 30;
      const endMinutes = parseInt(newTime.split(":")[0]) * 60 + parseInt(newTime.split(":")[1]) + duration;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

      const dateStr = format(newDate, "yyyy-MM-dd");

      // Verify availability
      const availabilityResponse = await apiFetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: selectedApt.business_id,
          professionalId: selectedApt.professional_id,
          date: dateStr,
          duration: duration,
          checkOnlyTime: newTime
        })
      });

      if (availabilityResponse.ok) {
         const availabilityData = await availabilityResponse.json();
         if (!availabilityData.available) {
           toast({ title: "Horário Indisponível", description: "O horário que você escolheu não está mais disponível. Escolha outro.", variant: "destructive" });
           setIsProcessing(false);
           return;
         }
      }

      await updateDoc(doc(db, "appointments", selectedApt.id), {
        appointment_date: dateStr,
        start_time: newTime + ":00",
        end_time: endTime + ":00",
        updated_at: serverTimestamp()
      });

      await notifyBusiness(selectedApt, "reschedule", `${format(newDate, "dd/MM")} às ${newTime}`);

      toast({ title: "Agendamento Alterado", description: "O seu reagendamento foi realizado com sucesso!" });
      setIsRescheduleModalOpen(false);
      fetchAppointments();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível reagendar.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-16 bg-card border border-border rounded-2xl">
        <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum agendamento</h3>
        <p className="text-muted-foreground">Você ainda não tem agendamentos registrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Meus Agendamentos</h1>
        <Badge variant="outline">{appointments.length} Total</Badge>
      </div>

      <div className="grid gap-4">
        {appointments.map((apt) => {
          const status = statusMap[apt.status] || { label: apt.status, variant: "outline" as const };
          const aptDate = new Date(apt.appointment_date + "T00:00:00");
          const isPast = isAfter(new Date(), new Date(`${apt.appointment_date}T${apt.start_time}`));
          
          return (
            <div key={apt.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-lg text-card-foreground">{apt.service?.name || "Serviço"}</p>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-4 h-4 text-primary" />
                      {format(aptDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-4 h-4 text-primary" />
                      {apt.start_time?.slice(0, 5)}
                    </span>
                  </div>
                  {apt.professional?.name && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                      Profissional: <span className="font-semibold text-foreground/80">{apt.professional.name}</span>
                    </p>
                  )}
                </div>
                
                <div className="text-right">
                   <p className="text-xl font-black text-primary">R${Number(apt.service?.price || 0).toFixed(2)}</p>
                </div>
              </div>

              {canActionStatus(apt) && !isPast && (
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 h-10 gap-2 font-bold"
                    onClick={() => handleRescheduleClick(apt)}
                  >
                    <RefreshCw className="w-4 h-4" /> Reagendar
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="flex-1 h-10 gap-2 font-bold bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border-rose-500/20"
                    onClick={() => handleCancelClick(apt)}
                  >
                    <XCircle className="w-4 h-4" /> Cancelar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cancel Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <AlertCircle className="w-5 h-5" /> Cancelar Agendamento
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar seu atendimento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
             <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <p className="text-sm font-bold">{selectedApt?.service?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedApt && format(new Date(selectedApt.appointment_date + "T00:00:00"), "dd/MM")} às {selectedApt?.start_time?.slice(0, 5)}
                </p>
             </div>
             <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
               <AlertCircle className="w-3 h-3" /> Sujeito às regras de cancelamento do estabelecimento.
             </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>Voltar</Button>
            <Button 
              variant="destructive" 
              onClick={confirmCancellation}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Modal */}
      <Dialog open={isRescheduleModalOpen} onOpenChange={setIsRescheduleModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reagendar Atendimento</DialogTitle>
            <DialogDescription>
              Escolha uma nova data e horário disponível.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2 block">Nova Data</Label>
              <div className="p-1 bg-muted/20 border border-border rounded-xl">
                <CalendarComponent
                  mode="single"
                  selected={newDate}
                  onSelect={setNewDate}
                  locale={ptBR}
                  className="mx-auto scale-90 sm:scale-100"
                  disabled={(d) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (d < today) return true;
                    const dayOfWeek = d.getDay();
                    if (selectedBizData && selectedBizData.default_working_hours) {
                       const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                       const dayName = dayNames[dayOfWeek];
                       const dayConfig = selectedBizData.default_working_hours.find((c: any) => c.day_of_week === dayName);
                       if (dayConfig && !dayConfig.is_active) {
                           return true;
                       }
                       return false;
                    }
                    return dayOfWeek === 0;
                  }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Horários Disponíveis</Label>
                {loadingSlots && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableSlots.map((s) => (
                  <Button
                    key={s}
                    variant={newTime === s ? "default" : "outline"}
                    className={`h-12 font-bold ${newTime === s ? "bg-primary text-white" : ""}`}
                    onClick={() => setNewTime(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
              {availableSlots.length === 0 && !loadingSlots && (
                <p className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-lg">Nenhum horário disponível para esta data.</p>
              )}
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-card pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsRescheduleModalOpen(false)}>Cancelar</Button>
            <Button 
              className="flex-1 font-bold" 
              onClick={confirmRescheduling}
              disabled={isProcessing || !newTime || (newDate?.toISOString().split('T')[0] === selectedApt?.appointment_date && newTime === selectedApt?.start_time.slice(0, 5))}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirmar Reagendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Label = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <label className={`text-sm font-medium text-foreground ${className}`}>{children}</label>
);

export default MyAppointments;
