import { useEffect, useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  limit, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, Clock, MessageSquare, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface CheckInAppointment {
  id: string;
  business_id: string;
  client_id: string;
  professional_id: string;
  service_id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  client_name: string;
  professional_name: string;
  service_name: string;
  professional_notes?: string;
  checkin_at?: any;
}

const CheckIn = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<CheckInAppointment[]>([]);
  const [notesOpen, setNotesOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    try {
      const bizQuery = query(collection(db, "businesses"), where("owner_id", "==", user.uid), limit(1));
      const bizSnap = await getDocs(bizQuery);
      if (bizSnap.empty) { setLoading(false); return; }
      const bizId = bizSnap.docs[0].id;

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const q = query(
        collection(db, "appointments"),
        where("business_id", "==", bizId),
        where("appointment_date", "==", dateStr),
        orderBy("start_time", "asc")
      );
      
      const snap = await getDocs(q);
      
      const apts = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const client_name = data.client_name || "—";
        let professional_name = "";
        let service_name = "";

        if (data.professional_id) {
          const profSnap = await getDocs(query(collection(db, "professionals"), where("__name__", "==", data.professional_id), limit(1)));
          professional_name = profSnap.empty ? "" : profSnap.docs[0].data().name;
        }

        if (data.service_id) {
          const servSnap = await getDocs(query(collection(db, "services"), where("__name__", "==", data.service_id), limit(1)));
          service_name = servSnap.empty ? "" : servSnap.docs[0].data().name;
        }

        return {
          id: d.id,
          ...data,
          client_name,
          professional_name,
          service_name
        };
      }));

      setAppointments(apts);
    } catch (err) {
      console.error("Error fetching check-in appointments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user, selectedDate]);

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  const handleCheckin = async (id: string) => {
    try {
      await updateDoc(doc(db, "appointments", id), {
        status: "in_progress",
        checkin_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      toast({ title: "Atendimento iniciado!" });
      fetchData();
    } catch (err) {
      console.error("Checkin error:", err);
    }
  };

  const handleCheckout = async (appointment: any) => {
    try {
      await updateDoc(doc(db, "appointments", appointment.id), {
        status: "completed",
        checkout_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      
      const fullApt = { ...appointment, status: 'completed' };
      try {
        await LoyaltyService.awardPointsForAppointment(fullApt);
      } catch(e) {}

      toast({ title: "Atendimento finalizado!" });
      fetchData();
    } catch (err) {
      console.error("Checkout error:", err);
    }
  };

  const handleSaveNotes = async () => {
    if (!notesOpen) return;
    try {
      await updateDoc(doc(db, "appointments", notesOpen), {
        professional_notes: notes,
        updated_at: serverTimestamp()
      });
      toast({ title: "Observações salvas!" });
      setNotesOpen(null);
      setNotes("");
      fetchData();
    } catch (err) {
      console.error("Notes error:", err);
    }
  };

  const handleNoShow = async (id: string) => {
    try {
      await updateDoc(doc(db, "appointments", id), {
        status: "no_show",
        updated_at: serverTimestamp()
      });
      toast({ title: "Marcado como falta" });
      fetchData();
    } catch (err) {
      console.error("NoShow error:", err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Check-in</h1>
        <p className="text-sm text-muted-foreground">Atendimentos — {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[180px]">
              <CalendarIcon className="w-4 h-4" />
              {format(selectedDate, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) { setSelectedDate(d); setCalendarOpen(false); } }}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        {!isToday && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>Hoje</Button>
        )}
      </div>

      {appointments.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">Nenhum atendimento nesta data.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => {
            const isInProgress = apt.status === "in_progress";
            const isCompleted = apt.status === "completed";
            const isNoShow = apt.status === "no_show";
            const isCancelled = apt.status === "cancelled";
            const isPast = isCompleted || isNoShow || isCancelled;
            const duration = apt.checkin_at
              ? Math.round((Date.now() - new Date(apt.checkin_at).getTime()) / 60000)
              : null;

            return (
              <div key={apt.id} className={`bg-card rounded-xl border p-5 transition-colors ${isInProgress ? "border-primary/50 bg-primary/5" : isPast ? "border-border opacity-60" : "border-border"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-heading text-xl font-bold text-primary">{apt.start_time?.slice(0, 5)}</span>
                      {isInProgress && (
                        <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">
                          <Clock className="w-3 h-3" />
                          {duration} min
                        </span>
                      )}
                      {isCompleted && <span className="text-xs font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Concluído</span>}
                      {isNoShow && <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">Faltou</span>}
                      {isCancelled && <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Cancelado</span>}
                    </div>
                    <p className="font-medium text-card-foreground">{apt.client_name || "—"}</p>
                    <p className="text-sm text-muted-foreground">{apt.service_name} • {apt.professional_name}</p>
                    {apt.professional_notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic">"{apt.professional_notes}"</p>
                    )}
                  </div>

                  {!isPast && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setNotesOpen(apt.id); setNotes(apt.professional_notes || ""); }}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>

                      {!isInProgress ? (
                        <>
                          <Button size="sm" onClick={() => handleCheckin(apt.id)} className="gap-1">
                            <Play className="w-3.5 h-3.5" />Iniciar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleNoShow(apt.id)}>Faltou</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleCheckout(apt)} className="gap-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                          <Square className="w-3.5 h-3.5" />Finalizar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!notesOpen} onOpenChange={() => setNotesOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Observações do Cliente</DialogTitle></DialogHeader>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferências, alergias, observações..." rows={4} />
          <Button onClick={handleSaveNotes} className="w-full">Salvar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckIn;
