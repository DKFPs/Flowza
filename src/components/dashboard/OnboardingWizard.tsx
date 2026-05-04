import { useState } from "react";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Rocket, 
  Zap, 
  User, 
  Clock, 
  CheckCircle2, 
  Share2, 
  Copy,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Smartphone,
  Plus
} from "lucide-react";
import { PlanId } from "@/types";
import { PLANS } from "@/lib/plans";
import { motion, AnimatePresence } from "motion/react";

const OnboardingWizard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [biz, setBiz] = useState({ name: "", phone: "", type: "Beleza", slug: "" });
  const [service, setService] = useState({ name: "Corte Masculino", price: "50", duration: "30" });
  const [pro, setPro] = useState({ name: "" });
  const [hours, setHours] = useState({ start: "09:00", end: "18:00", days: ["Seg", "Ter", "Qua", "Qui", "Sex"] });

  const totalSteps = 5;

  const handleNext = () => setStep(s => Math.min(s + 1, totalSteps));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const updateSlug = (name: string) => {
    const slug = name.toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/--+/g, "-");
    setBiz(prev => ({ ...prev, name, slug }));
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);

    const defaultPlan = PLANS[PlanId.FREE];

    try {
      // 1. Create Business
      const bizRef = await addDoc(collection(db, "businesses"), {
        ...biz,
        owner_id: user.uid,
        plan_id: PlanId.FREE,
        subscription_status: "active",
        limit_appointments: defaultPlan.limits.maxAppointments,
        limit_professionals: defaultPlan.limits.maxProfessionals,
        limit_services: defaultPlan.limits.maxServices,
        limit_units: defaultPlan.limits.maxUnits,
        usage_appointments: 0,
        usage_professionals: 1,
        usage_services: 1,
        usage_units: 0,
        settings: { business_hours: hours },
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // 2. Update Profile
      await updateDoc(doc(db, "profiles", user.uid), {
        business_id: bizRef.id,
        role: "admin",
        onboarding_completed: true,
        updated_at: serverTimestamp()
      });

      // 3. Create First Service
      await addDoc(collection(db, "services"), {
        business_id: bizRef.id,
        name: service.name,
        price: parseFloat(service.price),
        duration: parseInt(service.duration),
        is_active: true,
        created_at: serverTimestamp()
      });

      // 4. Create First Professional
      await addDoc(collection(db, "professionals"), {
        business_id: bizRef.id,
        name: pro.name || "Profissional Principal",
        user_id: user.uid,
        is_active: true,
        created_at: serverTimestamp()
      });

      toast({ title: "Configuração concluída! 🎉", description: "Seu dashboard está pronto." });
      window.location.reload();
    } catch (err: unknown) {
      console.error(err);
      toast({ title: "Erro na configuração", variant: "destructive" });
    }
    setLoading(false);
  };

  const copyLink = () => {
    const url = `${window.location.origin}/b/${biz.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  const shareWhatsApp = () => {
    const url = `${window.location.origin}/b/${biz.slug}`;
    const text = encodeURIComponent(`Olá! Agora você pode agendar seus horários comigo online aqui: ${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="max-w-xl mx-auto mt-6 px-4 pb-20">
      {/* Progress Bar */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Rocket className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Setup Rápido</h2>
          </div>
          <span className="text-xs font-bold text-primary">PASSO {step} DE {totalSteps}</span>
        </div>
        <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
            className="h-full bg-primary"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="bg-card rounded-3xl border shadow-xl shadow-primary/5 p-8"
        >
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight">O essencial primeiro.</h3>
                <p className="text-sm text-muted-foreground">Como os clientes verão seu negócio.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nome do Negócio</label>
                  <Input 
                    value={biz.name} 
                    onChange={(e) => updateSlug(e.target.value)} 
                    placeholder="Ex: Flowza Studio" 
                    className="rounded-xl h-12 text-lg font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Telefone WhatsApp</label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      value={biz.phone} 
                      onChange={(e) => setBiz(prev => ({ ...prev, phone: e.target.value }))} 
                      placeholder="(11) 99999-9999" 
                      className="rounded-xl h-12 pl-11"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Tipo de Negócio</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Beleza", "Saúde", "Educação", "Consultoria"].map(t => (
                      <Button 
                        key={t}
                        type="button"
                        variant={biz.type === t ? "default" : "outline"}
                        onClick={() => setBiz(prev => ({ ...prev, type: t }))}
                        className="rounded-xl h-12 font-bold"
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <div className="p-2 rounded-lg bg-green-50 text-green-600 w-fit mb-3 uppercase text-[10px] font-black border border-green-100">Próximo Nível</div>
                <h3 className="text-2xl font-black tracking-tight">O que você oferece?</h3>
                <p className="text-sm text-muted-foreground">Crie seu primeiro serviço agora.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nome do Serviço</label>
                  <Input 
                    value={service.name} 
                    onChange={(e) => setService(prev => ({ ...prev, name: e.target.value }))} 
                    placeholder="Ex: Corte de Cabelo" 
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Preço (R$)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        type="number"
                        value={service.price} 
                        onChange={(e) => setService(prev => ({ ...prev, price: e.target.value }))} 
                        className="rounded-xl h-12 pl-11"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Duração (min)</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        type="number"
                        value={service.duration} 
                        onChange={(e) => setService(prev => ({ ...prev, duration: e.target.value }))} 
                        className="rounded-xl h-12 pl-11"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight">Quem atende?</h3>
                <p className="text-sm text-muted-foreground">Pode ser você ou um profissional da equipe.</p>
              </div>
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl bg-muted/30">
                  <div className="w-20 h-20 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center mb-4 relative overflow-hidden group">
                     <User className="w-8 h-8 text-muted-foreground" />
                     <div className="absolute inset-0 bg-primary/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Plus className="w-6 h-6 text-white" />
                     </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Foto do Perfil (Opcional)</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nome do Profissional</label>
                  <Input 
                    value={pro.name} 
                    onChange={(e) => setPro(prev => ({ ...prev, name: e.target.value }))} 
                    placeholder="Seu nome ou apelido" 
                    className="rounded-xl h-12"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight">Horários de Trabalho</h3>
                <p className="text-sm text-muted-foreground">Quando os clientes podem agendar?</p>
              </div>
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Início</label>
                    <Input 
                      type="time" 
                      value={hours.start} 
                      onChange={(e) => setHours(prev => ({ ...prev, start: e.target.value }))}
                      className="rounded-xl h-12"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Fim</label>
                    <Input 
                      type="time" 
                      value={hours.end} 
                      onChange={(e) => setHours(prev => ({ ...prev, end: e.target.value }))}
                      className="rounded-xl h-12"
                    />
                  </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block">Dias de Atendimento</label>
                    <div className="flex flex-wrap gap-2">
                      {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => {
                        const active = hours.days.includes(day);
                        return (
                          <Button 
                            key={day}
                            variant={active ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setHours(prev => ({
                                ...prev,
                                days: active ? prev.days.filter(d => d !== day) : [...prev.days, day]
                              }))
                            }}
                            className="rounded-lg font-bold min-w-[50px]"
                          >
                            {day}
                          </Button>
                        )
                      })}
                    </div>
                 </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black tracking-tight">Tudo pronto! 🚀</h3>
                <p className="text-sm text-muted-foreground italic">"Sua agenda agora trabalha para você."</p>
              </div>

              <div className="p-6 rounded-3xl bg-primary/[0.03] border-2 border-primary/10 space-y-4">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Sua Página de Agendamento</p>
                    <p className="text-xs font-medium truncate text-muted-foreground">{window.location.origin}/b/{biz.slug}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <Button onClick={copyLink} variant="outline" className="rounded-xl font-bold gap-2">
                       <Copy className="w-4 h-4" /> Copiar Link
                    </Button>
                    <Button onClick={shareWhatsApp} variant="outline" className="rounded-xl font-bold gap-2 border-green-200 text-green-700 hover:bg-green-50">
                       <Share2 className="w-4 h-4" /> WhatsApp
                    </Button>
                 </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border space-y-3">
                 <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-primary" />
                    <p className="text-xs font-bold text-foreground">Dica: Ative o Checkout Prévio para reduzir faltas em 40%.</p>
                 </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-10 flex items-center gap-3">
            {step > 1 && step < 5 && (
              <Button 
                variant="ghost" 
                onClick={handleBack} 
                className="font-bold text-muted-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
            )}
            {step < 5 ? (
              <Button 
                onClick={handleNext} 
                disabled={step === 1 && !biz.name}
                className="flex-1 h-12 rounded-2xl font-black text-sm uppercase tracking-tight shadow-xl shadow-primary/20"
              >
                Próximo Passo <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleFinish}
                disabled={loading}
                className="flex-1 h-14 rounded-2xl font-black text-lg uppercase tracking-tight shadow-2xl shadow-primary/30"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ACESSAR MEU PAINEL"}
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default OnboardingWizard;
