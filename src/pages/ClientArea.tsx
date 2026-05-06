/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Calendar, Clock, User, Coins, Gift, ArrowLeft, Star, Send, XCircle, RefreshCw, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useParams, Link } from "react-router-dom";
import { LoyaltyService } from "@/services/loyaltyService";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  increment
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";
import { normalizePhone } from "@/lib/normalization";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Appointment, Client } from "@/types";

const statusLabels: Record<string, string> = {
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
};

const TIME_SLOTS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00",
];

const StarRating = ({ rating, onRate }: { rating: number; onRate: (r: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button key={star} type="button" onClick={() => onRate(star)} className="transition-transform hover:scale-125">
        <Star className={`w-8 h-8 ${star <= rating ? "fill-primary text-primary" : "text-muted-foreground/40 hover:text-primary/60"} transition-colors`} />
      </button>
    ))}
  </div>
);

const ClientArea = () => {
  const { slug } = useParams();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loyaltyCurrency, setLoyaltyCurrency] = useState("RESGATE");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState<{ balance: number; total_earned: number } | null>(null);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [availableRewards, setAvailableRewards] = useState<any[]>([]);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);

  // Review state
  const [reviewingApt, setReviewingApt] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Cancel/Reschedule state
  const [cancellingApt, setCancellingApt] = useState<string | null>(null);
  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleSearch = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      // 1. Find business by slug
      const bizQuery = query(collection(db, "businesses"), where("slug", "==", slug), limit(1));
      const bizSnap = await getDocs(bizQuery).catch(e => handleFirestoreError(e, OperationType.GET, "businesses_by_slug"));
      
      if (!bizSnap || bizSnap.empty) {
        setClientData(null);
        setLoading(false);
        return;
      }
      const bizId = bizSnap.docs[0].id;
      const bizData = bizSnap.docs[0].data();
      setBusinessId(bizId);
      setLoyaltyCurrency(bizData.loyalty_currency_name || "RESGATE");

      // 2. Find client by phone in this business
      const cleanPhone = normalizePhone(phone);
      const clientQuery = query(
        collection(db, "clients"), 
        where("business_id", "==", bizId),
        where("phone", "==", cleanPhone),
        limit(1)
      );
      const clientSnap = await getDocs(clientQuery).catch(e => handleFirestoreError(e, OperationType.LIST, "clients_by_phone"));
      
      if (!clientSnap || clientSnap.empty) {
        setClientData(null);
        setLoading(false);
        return;
      }

      const client = { id: clientSnap.docs[0].id, ...clientSnap.docs[0].data() } as Client;
      setClientData(client);

      // 3. Fetch appointments
      const aptsQuery = query(
        collection(db, "appointments"),
        where("client_id", "==", client.id),
        limit(20)
      );
      const aptsSnap = await getDocs(aptsQuery).catch(e => handleFirestoreError(e, OperationType.LIST, "appointments_by_client"));
      if (aptsSnap) {
        // Sort in memory to avoid index requirement
        const sortedApts = aptsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Appointment))
          .sort((a, b) => {
            const dateA = a.appointment_date || "";
            const dateB = b.appointment_date || "";
            return dateB.localeCompare(dateA);
          });
        setAppointments(sortedApts);
      }

      // 4. Fetch loyalty points
      const loyaltyQuery = query(
        collection(db, "loyalty_balances"),
        where("client_id", "==", client.id),
        limit(1)
      );
      const loyaltySnap = await getDocs(loyaltyQuery).catch(e => handleFirestoreError(e, OperationType.GET, "loyalty_balances"));
      if (loyaltySnap && !loyaltySnap.empty) {
        setLoyaltyPoints(loyaltySnap.docs[0].data() as any);
      } else {
        setLoyaltyPoints({ balance: 0, total_earned: 0 });
      }

      // 5. Fetch redemptions
      const redQuery = query(
        collection(db, "loyalty_redemptions"),
        where("client_id", "==", client.id)
      );
      const redSnap = await getDocs(redQuery).catch(e => handleFirestoreError(e, OperationType.LIST, "loyalty_redemptions"));
      if (redSnap) {
        const sortedRed = redSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .sort((a, b) => {
            const dateA = a.created_at?.toMillis?.() || 0;
            const dateB = b.created_at?.toMillis?.() || 0;
            return dateB - dateA;
          });
        setRedemptions(sortedRed);
      }

      // 6. Fetch reviews to get reviewed IDs
      const reviewsQuery = query(
        collection(db, "reviews"),
        where("client_id", "==", client.id)
      );
      const reviewsSnap = await getDocs(reviewsQuery).catch(e => handleFirestoreError(e, OperationType.LIST, "reviews_by_client"));
      if (reviewsSnap) {
        setReviewedIds(reviewsSnap.docs.map(d => d.data().appointment_id));
      }

      // 7. Fetch available rewards
      const rewardsQuery = query(
        collection(db, "loyalty_rewards"),
        where("business_id", "==", bizId),
        where("is_active", "==", true),
        orderBy("points_required", "asc")
      );
      const rewardsSnap = await getDocs(rewardsQuery).catch(e => handleFirestoreError(e, OperationType.LIST, "loyalty_rewards"));
      if (rewardsSnap) {
        setAvailableRewards(rewardsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }

    } catch (err) {
      console.error("Search error:", err);
      setClientData(null);
      toast({ title: "Erro na busca", description: "Ocorreu um erro ao buscar seus dados.", variant: "destructive" });
    }

    setLoading(false);
  };

  const handleRedeemReward = async (reward: any) => {
    if (!clientData?.id || !businessId) return;
    if ((loyaltyPoints?.balance || 0) < reward.points_required) {
      toast({ title: "Pontos insuficientes!", variant: "destructive" });
      return;
    }
    
    setActionLoading(true);
    try {
      // Create redemption code
      let code = "";
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        code = LoyaltyService.generateRedemptionCode(loyaltyCurrency, clientData.business_id || "RESGATE");
        
        // check uniqueness
        const codeQuery = query(
          collection(db, "loyalty_redemptions"),
          where("code", "==", code),
          limit(1)
        );
        const codeSnap = await getDocs(codeQuery).catch(e => handleFirestoreError(e, OperationType.GET, "loyalty_redemptions_check"));
        if (!codeSnap || codeSnap.empty) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new Error("Não foi possível gerar um código único. Tente novamente.");
      }

      await addDoc(collection(db, "loyalty_redemptions"), {
        business_id: businessId,
        client_id: clientData.id,
        reward_id: reward.id,
        points_spent: reward.points_required,
        code,
        is_used: false,
        loyalty_rewards: { name: reward.name },
        created_at: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, "loyalty_redemptions"));

      // Deduct points from balance
      const loyaltyBalanceQuery = query(
        collection(db, "loyalty_balances"),
        where("client_id", "==", clientData.id),
        limit(1)
      );
      const balanceSnap = await getDocs(loyaltyBalanceQuery).catch(e => handleFirestoreError(e, OperationType.GET, "loyalty_balances"));
      if (balanceSnap && !balanceSnap.empty) {
         await updateDoc(doc(db, "loyalty_balances", balanceSnap.docs[0].id), {
           balance: increment(-reward.points_required),
           updated_at: serverTimestamp()
         }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `loyalty_balances/${balanceSnap.docs[0].id}`));
      }

      toast({ title: "Recompensa resgatada!", description: `Seu código é ${code}` });
      await handleSearch(); // Refresh data
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao resgatar recompensa", variant: "destructive" });
    }
    setActionLoading(false);
  };

  const handleSubmitReview = async (aptId: string) => {
    if (reviewRating === 0 || !clientData?.id || !businessId) return;
    setSubmittingReview(true);

    try {
      await addDoc(collection(db, "reviews"), {
        business_id: businessId,
        client_id: clientData.id,
        appointment_id: aptId,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
        created_at: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, "reviews"));

      toast({ title: "Avaliação enviada com sucesso! Obrigado!" });
      setReviewedIds((prev) => [...prev, aptId]);
      setReviewingApt(null);
      setReviewRating(0);
      setReviewComment("");
    } catch (err) {
      console.error("Review error:", err);
      toast({ title: "Erro ao enviar avaliação", variant: "destructive" });
    }

    setSubmittingReview(false);
  };

  const handleCancel = async (aptId: string) => {
    if (!clientData?.id) return;
    setActionLoading(true);

    try {
      await updateDoc(doc(db, "appointments", aptId), {
        status: "cancelled",
        updated_at: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `appointments/${aptId}`));

      toast({ title: "Agendamento cancelado com sucesso!" });
      setAppointments((prev) => prev.map((a) => a.id === aptId ? { ...a, status: "cancelled" } : a));
    } catch (err) {
      console.error("Cancel error:", err);
      toast({ title: "Erro ao cancelar", variant: "destructive" });
    }

    setActionLoading(false);
    setCancellingApt(null);
  };

  const handleReschedule = async () => {
    if (!rescheduleApt || !rescheduleDate || !rescheduleTime || !clientData?.id) return;
    setActionLoading(true);

    const duration = rescheduleApt?.services?.duration || 30; // Attempt to use service duration
    const aptDateStr = format(rescheduleDate, "yyyy-MM-dd");

    try {
      // Validar disponibilidade
      const availabilityResponse = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: rescheduleApt.business_id,
          professionalId: rescheduleApt.professional_id,
          date: aptDateStr,
          duration: duration,
          checkOnlyTime: rescheduleTime
        })
      });

      if (availabilityResponse.ok) {
         const availabilityData = await availabilityResponse.json();
         if (!availabilityData.available) {
           toast({ title: "Horário Indisponível", description: "O horário que você escolheu não está mais disponível. Escolha outro.", variant: "destructive" });
           setActionLoading(false);
           return;
         }
      }

      const [h, m] = rescheduleTime.split(":").map(Number);
      const endMin = h * 60 + m + duration;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}:00`;

      await updateDoc(doc(db, "appointments", rescheduleApt.id), {
        appointment_date: aptDateStr,
        start_time: rescheduleTime + ":00",
        end_time: endTime,
        status: "scheduled",
        updated_at: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `appointments/${rescheduleApt.id}`));

      toast({ title: "Agendamento Alterado", description: "O seu reagendamento foi realizado com sucesso!" });
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === rescheduleApt.id
            ? { ...a, appointment_date: aptDateStr, start_time: rescheduleTime + ":00", status: "scheduled" }
            : a
        )
      );
      setRescheduleApt(null);
    } catch (err) {
      console.error("Reschedule error:", err);
      toast({ title: "Erro ao reagendar", variant: "destructive" });
    }

    setActionLoading(false);
  };

  const canModify = (status: string) => !["cancelled", "completed", "no_show"].includes(status);

  const pendingReviewApts = appointments.filter(
    (apt) => apt.status === "completed" && !reviewedIds.includes(apt.id)
  );

  const formatAptDate = (dateStr: string) => {
    try {
      const [y, mo, d] = dateStr.split("-").map(Number);
      return format(new Date(y, mo - 1, d), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Link to={`/b/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="text-2xl font-bold mb-1">Minha Área</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Digite seu número de telefone para acessar seu histórico.
        </p>

        <div className="flex gap-2 mb-8">
          <input
            value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Seu telefone (ex: 11999887766)" type="tel"
            className="flex-1 h-11 px-4 text-sm rounded-lg border border-border bg-card text-foreground outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch} disabled={loading || !phone.trim()}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <><Search className="w-4 h-4" /> Buscar</>}
          </button>
        </div>

        {searched && !loading && !clientData && (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground">Nenhum cadastro encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Verifique o número ou faça seu primeiro agendamento.</p>
          </div>
        )}

        {clientData && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="font-bold text-lg">{clientData.name}</p>
              <p className="text-sm text-muted-foreground">{clientData.phone}</p>
            </div>

            {/* Pending Reviews */}
            {pendingReviewApts.length > 0 && (
              <div className="bg-card border-2 border-primary/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">Avalie seu atendimento</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Sua avaliação é anônima e nos ajuda a melhorar!</p>
                <div className="space-y-3">
                  {pendingReviewApts.map((apt) => (
                    <div key={apt.id} className="p-4 rounded-lg border border-border bg-background">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm">{apt.services?.name || "Serviço"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatAptDate(apt.appointment_date)} • {apt.start_time?.slice(0, 5)}
                            {apt.professionals?.name && ` • ${apt.professionals.name}`}
                          </p>
                        </div>
                      </div>

                      {reviewingApt === apt.id ? (
                        <div className="space-y-3 mt-3">
                          <div className="flex flex-col items-center gap-2">
                            <p className="text-sm font-medium">Como foi sua experiência?</p>
                            <StarRating rating={reviewRating} onRate={setReviewRating} />
                            {reviewRating > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {["", "Ruim", "Regular", "Bom", "Muito bom", "Excelente!"][reviewRating]}
                              </p>
                            )}
                          </div>
                          <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Deixe um comentário (opcional)..." rows={3} className="text-sm" />
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setReviewingApt(null); setReviewRating(0); setReviewComment(""); }}>Cancelar</Button>
                            <Button size="sm" disabled={reviewRating === 0 || submittingReview} onClick={() => handleSubmitReview(apt.id)} className="gap-1">
                              {submittingReview ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Enviar</>}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="mt-2 gap-1" onClick={() => { setReviewingApt(apt.id); setReviewRating(0); setReviewComment(""); }}>
                          <Star className="w-3.5 h-3.5" /> Avaliar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loyalty */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">Pontos de Fidelidade</h2>
                </div>
              </div>
              {loyaltyPoints ? (
                <div className="flex flex-col gap-3">
                  {(() => {
                    const points = loyaltyPoints.total_earned || 0;
                    let tier = { name: 'Bronze', color: 'text-amber-700', bg: 'bg-amber-700/10', border: 'border-amber-700/20' };
                    if (points >= 10000) tier = { name: 'Rubi', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
                    else if (points >= 5000) tier = { name: 'Diamante', color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20' };
                    else if (points >= 3000) tier = { name: 'Platina', color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' };
                    else if (points >= 1500) tier = { name: 'Ouro', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
                    else if (points >= 500) tier = { name: 'Prata', color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/20' };
                    
                    return (
                      <div className={`p-3 rounded-xl border flex items-center gap-3 ${tier.bg} ${tier.border}`}>
                         <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center border-2 border-current bg-background/50 ${tier.color}`}>
                           <Trophy className="w-6 h-6" />
                         </div>
                         <div>
                           <p className={`font-bold ${tier.color}`}>Nível {tier.name}</p>
                           <p className="text-xs text-muted-foreground">{points} pontos totais acumulados</p>
                         </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-xl bg-primary/10">
                      <p className="text-2xl font-bold text-primary">{loyaltyPoints.balance}</p>
                      <p className="text-xs text-primary/80 font-medium uppercase mt-1">Saldo Atual</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">{loyaltyPoints.total_earned}</p>
                      <p className="text-xs text-muted-foreground font-medium uppercase mt-1">Total Ganho</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="p-3 rounded-xl border flex items-center gap-3 bg-amber-700/10 border-amber-700/20">
                     <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center border-2 border-current bg-background/50 text-amber-700">
                       <Trophy className="w-6 h-6" />
                     </div>
                     <div>
                       <p className="font-bold text-amber-700">Nível Bronze</p>
                       <p className="text-xs text-muted-foreground">0 pontos totais acumulados</p>
                     </div>
                  </div>
                  <p className="text-sm text-center text-muted-foreground mt-2">Você ainda não possui pontos.</p>
                </div>
              )}
            </div>

            {/* Available Rewards */}
            {availableRewards.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">Recompensas Disponíveis</h2>
                </div>
                <div className="space-y-3">
                  {availableRewards.map((reward) => (
                    <div key={reward.id} className="p-4 rounded-lg border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background">
                      <div>
                        <p className="font-semibold">{reward.name}</p>
                        {reward.description && <p className="text-xs text-muted-foreground mt-1">{reward.description}</p>}
                        <p className="text-sm font-bold text-primary mt-2">{reward.points_required} pts</p>
                      </div>
                      <Button 
                        size="sm" 
                        disabled={(loyaltyPoints?.balance || 0) < reward.points_required || actionLoading}
                        onClick={() => handleRedeemReward(reward)}
                        className="shrink-0"
                      >
                        Resgatar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Redemptions */}
            {redemptions.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">Recompensas Resgatadas</h2>
                </div>
                <div className="space-y-2">
                  {redemptions.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="font-mono font-bold text-primary text-lg">{r.code}</p>
                        <p className="text-xs text-muted-foreground">{r.loyalty_rewards?.name} • {r.points_spent} pts</p>
                      </div>
                      <Badge variant={r.is_used ? "secondary" : "default"}>{r.is_used ? "Usado" : "Ativo"}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Appointments */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">Histórico de Agendamentos</h2>
              </div>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="p-3 rounded-lg border border-border space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="font-semibold text-sm">{apt.services?.name || apt.service_name_snapshot || "Serviço"}</p>
                        <div className="flex items-center gap-1">
                          {reviewedIds.includes(apt.id) && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Star className="w-3 h-3 fill-primary text-primary" /> Avaliado
                            </Badge>
                          )}
                          <Badge variant={apt.status === "completed" ? "default" : apt.status === "cancelled" ? "destructive" : "secondary"}>
                            {statusLabels[apt.status] || apt.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatAptDate(apt.appointment_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {apt.start_time?.slice(0, 5)}
                        </span>
                        {apt.professionals?.name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {apt.professionals.name}
                          </span>
                        )}
                      </div>
                      {apt.services?.price > 0 && (
                        <p className="text-xs font-medium">R$ {Number(apt.services.price).toFixed(2)}</p>
                      )}

                      {/* Cancel / Reschedule buttons */}
                      {canModify(apt.status) && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm" variant="outline"
                            className="gap-1 text-xs h-7"
                            onClick={() => {
                              setRescheduleApt(apt);
                              setRescheduleDate(undefined);
                              setRescheduleTime(null);
                            }}
                          >
                            <RefreshCw className="w-3 h-3" /> Reagendar
                          </Button>
                          <Button
                            size="sm" variant="destructive"
                            className="gap-1 text-xs h-7"
                            onClick={() => setCancellingApt(apt.id)}
                          >
                            <XCircle className="w-3 h-3" /> Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancellingApt} onOpenChange={() => setCancellingApt(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Cancelar agendamento</DialogTitle>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja cancelar este agendamento? Essa ação não pode ser desfeita.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="ghost" size="sm" onClick={() => setCancellingApt(null)}>Voltar</Button>
            <Button variant="destructive" size="sm" disabled={actionLoading} onClick={() => cancellingApt && handleCancel(cancellingApt)}>
              {actionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Confirmar cancelamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleApt} onOpenChange={() => setRescheduleApt(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Reagendar</DialogTitle>
          <p className="text-sm text-muted-foreground mb-3">Escolha uma nova data e horário:</p>
          <CalendarPicker
            mode="single"
            selected={rescheduleDate}
            onSelect={(d) => { setRescheduleDate(d); setRescheduleTime(null); }}
            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || d.getDay() === 0}
            locale={ptBR}
            className="pointer-events-auto mx-auto"
          />
          {rescheduleDate && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Horários — {format(rescheduleDate, "dd/MM", { locale: ptBR })}
              </p>
              <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-auto">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setRescheduleTime(slot)}
                    className={`py-2 text-xs font-medium rounded-md border transition-all ${
                      rescheduleTime === slot
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-foreground hover:border-primary"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="ghost" size="sm" onClick={() => setRescheduleApt(null)}>Cancelar</Button>
            <Button size="sm" disabled={!rescheduleDate || !rescheduleTime || actionLoading} onClick={handleReschedule}>
              {actionLoading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : "Confirmar reagendamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientArea;
