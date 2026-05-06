import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  deleteDoc,
  limit,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, Palette, Check, Plus, Trash2, Link as LinkIcon, Instagram } from "lucide-react";
import { PricingGrid } from "@/components/dashboard/PricingGrid";
import { PlanGuard } from "@/components/dashboard/PlanGuard";
import { PlanId } from "@/types";
import InstagramIntegration from "@/components/dashboard/InstagramIntegration";

import { CustomDomainSettings } from "@/components/dashboard/CustomDomainSettings";

interface BusinessData {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  description: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_body: string;
  font_heading: string;
  border_radius: string;
  layout_style: string;
  hero_image_url: string;
  cover_image_url: string;
  logo_url: string;
  custom_css: string;
  welcome_message: string;
  footer_text: string;
  social_instagram: string;
  social_whatsapp: string;
  social_facebook: string;
  hero_title: string;
  hero_subtitle: string;
  cta_text: string;
  show_team_section: boolean;
  show_services_section: boolean;
  show_stats_section: boolean;
  stats_data: { label: string; value: string }[];
  enable_payment_setup?: boolean;
  payment_methods?: string[];
  payment_timings?: string[];
  pix_key?: string;
  cancel_window_hours?: number;
  reschedule_window_hours?: number;
  custom_domain?: string;
  domain_status?: 'pending' | 'validation_pending' | 'verified' | 'failed';
  dns_txt_record?: string;
  default_working_hours?: {
    day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    start_time: string;
    end_time: string;
    is_active: boolean;
  }[];
}

import { PRESET_THEMES } from "@/lib/themes";
import { normalizePhone, normalizeEmail } from "@/lib/normalization";
import { Clock } from "lucide-react";

const DAYS_OF_WEEK: { value: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', label: string }[] = [
  { value: 'monday', label: 'Segunda-feira' },
  { value: 'tuesday', label: 'Terça-feira' },
  { value: 'wednesday', label: 'Quarta-feira' },
  { value: 'thursday', label: 'Quinta-feira' },
  { value: 'friday', label: 'Sexta-feira' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

const FONT_OPTIONS = [
  "Inter", "Space Grotesk", "Poppins", "Roboto", "Montserrat", "Playfair Display",
  "Lato", "Oswald", "Raleway", "Merriweather", "Nunito", "DM Sans", "Libre Baskerville",
  "Bebas Neue", "Crimson Text", "Work Sans", "Fira Sans", "Outfit", "Sora",
];

const LAYOUT_OPTIONS = [
  { value: "modern", label: "Moderno — Clean e minimalista" },
  { value: "classic", label: "Clássico — Elegante e sofisticado" },
  { value: "bold", label: "Ousado — Cores vibrantes e impactantes" },
  { value: "minimal", label: "Minimal — Essencial e direto" },
];

const RADIUS_OPTIONS = [
  { value: "none", label: "Sem arredondamento" },
  { value: "small", label: "Sutil (4px)" },
  { value: "rounded", label: "Arredondado (8px)" },
  { value: "large", label: "Grande (16px)" },
  { value: "full", label: "Totalmente arredondado" },
];

const Settings = () => {
  const { user } = useAuth();
  const { refreshBusiness } = useBusiness();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "themes";
  
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [form, setForm] = useState<Omit<BusinessData, "id">>({
    name: "", slug: "", phone: "", email: "", description: "",
    primary_color: "#7c3aed", secondary_color: "#1a1a2e", accent_color: "#d4a853",
    background_color: "#0c0c14", text_color: "#FFFFFF",
    font_body: "Inter", font_heading: "Inter",
    border_radius: "large", layout_style: "modern",
    hero_image_url: "", cover_image_url: "", logo_url: "",
    custom_css: "", welcome_message: "", footer_text: "",
    social_instagram: "", social_whatsapp: "", social_facebook: "",
    hero_title: "", hero_subtitle: "", cta_text: "Agendar",
    show_team_section: true, show_services_section: true, show_stats_section: true,
    stats_data: [
      { label: "Anos de Experiência", value: "10+" },
      { label: "Clientes Felizes", value: "5000+" },
      { label: "Profissionais", value: "15+" },
      { label: "Avaliação", value: "4.9" },
    ],
    enable_payment_setup: false,
    payment_methods: ["pix"],
    payment_timings: ["on_site"],
    pix_key: "",
    cancel_window_hours: 24,
    reschedule_window_hours: 24,
    custom_domain: "",
    domain_status: "pending",
    dns_txt_record: "",
    default_working_hours: DAYS_OF_WEEK.map(day => ({
      day_of_week: day.value,
      start_time: "09:00",
      end_time: "18:00",
      is_active: day.value !== 'sunday'
    }))
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const fetchBusiness = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(collection(db, "businesses"), where("owner_id", "==", user.uid), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as BusinessData;
        const bizId = snap.docs[0].id;
        setBusiness({ ...data, id: bizId });
        setForm({
          name: data.name || "", slug: data.slug || "", phone: data.phone || "",
          email: data.email || "", description: data.description || "",
          primary_color: data.primary_color || "#7c3aed",
          secondary_color: data.secondary_color || "#1a1a2e",
          accent_color: data.accent_color || "#d4a853",
          background_color: data.background_color || "#0c0c14",
          text_color: data.text_color || "#FFFFFF",
          font_body: data.font_body || "Inter",
          font_heading: data.font_heading || "Inter",
          border_radius: data.border_radius || "large",
          layout_style: data.layout_style || "modern",
          hero_image_url: data.hero_image_url || "",
          cover_image_url: data.cover_image_url || "",
          logo_url: data.logo_url || "",
          custom_css: data.custom_css || "",
          welcome_message: data.welcome_message || "",
          footer_text: data.footer_text || "",
          social_instagram: data.social_instagram || "",
          social_whatsapp: data.social_whatsapp || "",
          social_facebook: data.social_facebook || "",
          hero_title: data.hero_title || "",
          hero_subtitle: data.hero_subtitle || "",
          cta_text: data.cta_text || "Agendar",
          show_team_section: data.show_team_section !== false,
          show_services_section: data.show_services_section !== false,
          show_stats_section: data.show_stats_section !== false,
          stats_data: data.stats_data || [
            { label: "Anos de Experiência", value: "10+" },
            { label: "Clientes Felizes", value: "5000+" },
            { label: "Profissionais", value: "15+" },
            { label: "Avaliação", value: "4.9" },
          ],
          enable_payment_setup: data.enable_payment_setup || false,
          payment_methods: data.payment_methods || ["pix"],
          payment_timings: data.payment_timings || ["on_site"],
          pix_key: data.pix_key || "",
          cancel_window_hours: data.cancel_window_hours !== undefined ? data.cancel_window_hours : 24,
          reschedule_window_hours: data.reschedule_window_hours !== undefined ? data.reschedule_window_hours : 24,
          custom_domain: data.custom_domain || "",
          domain_status: data.domain_status || "pending",
          dns_txt_record: data.dns_txt_record || "",
          default_working_hours: data.default_working_hours || DAYS_OF_WEEK.map(day => ({
            day_of_week: day.value,
            start_time: "09:00",
            end_time: "18:00",
            is_active: day.value !== 'sunday'
          })),
        });
      }
    } catch (error) {
      console.error("Error fetching business:", error);
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBusiness();
  }, [fetchBusiness]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setLoading(true);
    try {
      // MÓDULO 2 — NORMALIZAÇÃO
      const normalizedForm = {
        ...form,
        phone: normalizePhone(form.phone),
        email: normalizeEmail(form.email),
        social_instagram: form.social_instagram.startsWith("@") ? form.social_instagram : `@${form.social_instagram.trim()}`
      };

      await updateDoc(doc(db, "businesses", business.id), normalizedForm);
      setForm(normalizedForm); // Update local state with normalized data
      toast({ title: "Configurações salvas!" });
    } catch (error: unknown) {
      handleFirestoreError(error, OperationType.UPDATE, `businesses/${business.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user) {
      toast({ title: "Erro", description: "Usuário não autenticado." });
      return;
    }
    
    setLoading(true);

    try {
      // Tentar deletar o usuário no Auth PRIMEIRO. 
      // Se não der erro (ex: requires-recent-login), continuamos e a conta foi deletada da Auth no backend,
      // mas precisamos limpar Firestore antes que os tokens percam validade (as regras podem continuar funcionando com o cache de auth atual)
      // Wait, se deletarmos o usuário no firebase Auth antes, nós perdemos a permissão de escrever no Firestore usando a API cliente?
      // Sim, então devemos deletar no firestore PRIMEIRO, mas se a Auth falhar depois exigindo re-autenticação, não podemos desfazer a exclusão no Firestore!
      
      // Assim, vamos primeiro TESTAR excluir doc falso para ter certeza? Não.
      // O recomendável é tentar apagar os dados do usuário, se der required-recent-login vamos ter q avisar.
      
      // Delete business document
      if (business?.id) {
        try {
          await deleteDoc(doc(db, "businesses", business.id));
        } catch(e) {
          console.warn("Negocio ja estava deletado ou falha (businesses)", e);
        }
      }
      
      // Excluir o perfil do Firestore
      try {
        await deleteDoc(doc(db, "profiles", user.uid));
      } catch (e) {
        console.warn("Perfil não encontrado ou falha", e);
      }

      // Delete auth user
      try {
        await deleteUser(user);
        toast({ title: "Conta e negócio excluídos com sucesso." });
      } catch (authErr: any) {
        console.warn("Conta firebase auth não deletada", authErr);
        if (authErr.code === 'auth/requires-recent-login') {
          toast({ 
            title: "Reautenticação necessária", 
            description: "Por segurança, faça login novamente para excluir sua conta da plataforma.", 
            variant: "destructive" 
          });
          // Forçar o logout para o usuário se logar novamente
          await auth.signOut();
          navigate("/auth");
          return;
        } else {
           toast({ title: "Erro ao excluir conta Auth:", description: authErr.message });
        }
      }
      
      try {
        await auth.signOut();
      } catch(e) {}
      
      navigate("/auth");
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast({ 
        title: "Erro ao excluir dado:", 
        description: error.message || "Tente novamente mais tarde.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (fetching) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const ColorField = ({ label, field }: { label: string; field: keyof typeof form }) => (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={form[field] as string}
          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          className="w-10 h-10 rounded border border-border cursor-pointer"
        />
        <Input
          value={form[field] as string}
          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          className="flex-1"
        />
      </div>
    </div>
  );

  const ImageUrlField = ({ label, field }: { label: string; field: keyof typeof form }) => (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      {form[field] && (
        <img src={form[field] as string} alt="" className="w-full h-32 object-cover rounded-lg mb-2 border border-border" />
      )}
      <Input
        value={form[field] as string}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        placeholder="URL da imagem"
      />
    </div>
  );

  const previewUrl = `/b/${form.slug}`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, "_blank")} disabled={!form.slug}>
            <Eye className="w-4 h-4 mr-1" /> Visualizar
          </Button>
          <Button variant="premium" size="sm" onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Salvar Alterações
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })} className="space-y-4">
          <TabsList className="flex flex-wrap w-full h-auto">
            {business?.plan_id !== PlanId.PREMIUM && <TabsTrigger value="subscription">Assinatura</TabsTrigger>}
            <TabsTrigger value="payment">Pagamento</TabsTrigger>
            <TabsTrigger value="hours">Horários</TabsTrigger>
            <TabsTrigger value="themes">Temas</TabsTrigger>
            <TabsTrigger value="page">Página</TabsTrigger>
            <TabsTrigger value="instagram">Instagram</TabsTrigger>
            <TabsTrigger value="apis">APIs</TabsTrigger>
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="domain">Domínio Personalizado</TabsTrigger>
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="colors">Cores</TabsTrigger>
            <TabsTrigger value="images">Imagens</TabsTrigger>
            <TabsTrigger value="advanced">Avançado</TabsTrigger>
          </TabsList>

          {/* Assinatura e Planos */}
          {business?.plan_id !== PlanId.PREMIUM && (
            <TabsContent value="subscription" className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-xl font-bold text-foreground mb-1">Planos e Assinatura</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Gerencie sua assinatura, veja seus limites e faça upgrade para desbloquear novas funcionalidades.
              </p>
              <PricingGrid />
            </div>
          </TabsContent>
          )}

          {/* Horários Padrão */}
          <TabsContent value="hours" className="bg-card rounded-xl border border-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" /> Horários Padrão do Negócio
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Estes horários serão sugeridos para novos profissionais cadastrados.
                </p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={async () => {
                  if (!business) return;
                  if (!confirm("Isso irá sobrescrever os horários de TODOS os profissionais cadastrados. Deseja continuar?")) return;
                  
                  setLoading(true);
                  try {
                    // 1. Fetch all professionals
                    const profQuery = query(collection(db, "professionals"), where("business_id", "==", business.id));
                    const profSnap = await getDocs(profQuery);
                    const profIds = profSnap.docs.map(d => d.id);
                    
                    if (profIds.length === 0) {
                      toast({ title: "Nenhum profissional encontrado." });
                      return;
                    }

                    // 2. Clear old working hours and add new ones (using a batch or sequential writes)
                    // Note: Firestore batch has a 500 operation limit. If many professionals/days, we should be careful.
                    // 7 days * N professionals. If N=10, 70 ops. OK.
                    for (const profId of profIds) {
                      // Delete existing hours for this prof
                      const oldHoursQ = query(collection(db, "working_hours"), where("professional_id", "==", profId));
                      const oldHoursSnap = await getDocs(oldHoursQ);
                      const deletePromises = oldHoursSnap.docs.map(d => deleteDoc(d.ref));
                      await Promise.all(deletePromises);

                      // Create new ones based on defaults
                      const createPromises = (form.default_working_hours || []).filter(h => h.is_active).map(h => {
                         const hourRef = doc(collection(db, "working_hours"));
                         return setDoc(hourRef, {
                           business_id: business.id,
                           professional_id: profId,
                           day_of_week: h.day_of_week,
                           start_time: h.start_time,
                           end_time: h.end_time,
                           created_at: serverTimestamp()
                         });
                      });
                      await Promise.all(createPromises);
                    }
                    
                    toast({ title: "Horários aplicados a todos os profissionais!" });
                  } catch (error) {
                    handleFirestoreError(error, OperationType.WRITE, "bulk_update_hours");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Aplicar a todos os profissionais
              </Button>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              {DAYS_OF_WEEK.map((day, idx) => {
                const hourConfig = form.default_working_hours?.find(h => h.day_of_week === day.value) || {
                  day_of_week: day.value,
                  start_time: "09:00",
                  end_time: "18:00",
                  is_active: false
                };

                return (
                  <div key={day.value} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-3 min-w-[160px]">
                      <Switch 
                        checked={hourConfig.is_active}
                        onCheckedChange={(checked) => {
                          const newHours = [...(form.default_working_hours || [])];
                          const index = newHours.findIndex(h => h.day_of_week === day.value);
                          if (index !== -1) {
                            newHours[index] = { ...newHours[index], is_active: checked };
                          } else {
                            newHours.push({ day_of_week: day.value, start_time: "09:00", end_time: "18:00", is_active: checked });
                          }
                          setForm({ ...form, default_working_hours: newHours });
                        }}
                      />
                      <span className={`font-medium ${hourConfig.is_active ? "text-foreground" : "text-muted-foreground"}`}>
                        {day.label}
                      </span>
                    </div>

                    {hourConfig.is_active ? (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                        <Input 
                          type="time" 
                          value={hourConfig.start_time} 
                          onChange={(e) => {
                            const newHours = [...(form.default_working_hours || [])];
                            const index = newHours.findIndex(h => h.day_of_week === day.value);
                            newHours[index] = { ...newHours[index], start_time: e.target.value };
                            setForm({ ...form, default_working_hours: newHours });
                          }}
                          className="w-32"
                        />
                        <span className="text-muted-foreground">até</span>
                        <Input 
                          type="time" 
                          value={hourConfig.end_time} 
                          onChange={(e) => {
                            const newHours = [...(form.default_working_hours || [])];
                            const index = newHours.findIndex(h => h.day_of_week === day.value);
                            newHours[index] = { ...newHours[index], end_time: e.target.value };
                            setForm({ ...form, default_working_hours: newHours });
                          }}
                          className="w-32"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Fechado / Folga</span>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Pagamento */}
          <TabsContent value="payment" className="bg-card rounded-xl border border-border p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-foreground mb-4">Configurações de Pagamento</h3>
              <div className="flex items-center space-x-2 border p-4 rounded-lg">
                <Switch 
                  id="enable_payment_setup" 
                  checked={form.enable_payment_setup} 
                  onCheckedChange={(c) => setForm({ ...form, enable_payment_setup: c })}
                />
                <Label htmlFor="enable_payment_setup" className="font-semibold cursor-pointer flex-1">
                  Ativar opções de pagamento no agendamento
                  <p className="text-sm font-normal text-muted-foreground mt-1">
                    Permita que os clientes escolham como e quando pagar ao reservar um serviço.
                  </p>
                </Label>
              </div>
            </div>

            {form.enable_payment_setup && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Métodos de pagamento aceitos</h4>
                  {['pix', 'credit_card', 'cash'].map(method => (
                    <div key={method} className="flex items-center space-x-2 bg-muted/30 p-3 rounded-md">
                      <Checkbox 
                        id={`pm-${method}`}
                        checked={(form.payment_methods || []).includes(method)}
                        onCheckedChange={(c) => {
                          const methods = new Set(form.payment_methods || []);
                          if (c) methods.add(method);
                          else methods.delete(method);
                          setForm({ ...form, payment_methods: Array.from(methods) });
                        }}
                      />
                      <Label htmlFor={`pm-${method}`} className="cursor-pointer flex-1 capitalize">
                        {method === 'pix' ? 'PIX' : method === 'credit_card' ? 'Cartão de Crédito' : 'Dinheiro (No local)'}
                      </Label>
                    </div>
                  ))}
                  {(form.payment_methods || []).length === 0 && (
                    <p className="text-xs text-destructive">Selecione pelo menos um método de pagamento.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Regras de adiantamento / momento de pagamento</h4>
                  {[
                    { id: 'full', label: '100% adiantado online (No momento do agendamento)' },
                    { id: 'half', label: '50% adiantado online (Sinal / Garantia de reserva)' },
                    { id: 'on_site', label: 'Pagamento total no local' }
                  ].map(timing => (
                    <div key={timing.id} className="flex items-center space-x-2 bg-muted/30 p-3 rounded-md">
                      <Checkbox 
                        id={`pt-${timing.id}`}
                        checked={(form.payment_timings || []).includes(timing.id)}
                        onCheckedChange={(c) => {
                          const timings = new Set(form.payment_timings || []);
                          if (c) timings.add(timing.id);
                          else timings.delete(timing.id);
                          setForm({ ...form, payment_timings: Array.from(timings) });
                        }}
                      />
                      <Label htmlFor={`pt-${timing.id}`} className="cursor-pointer flex-1">
                        {timing.label}
                      </Label>
                    </div>
                  ))}
                  {(form.payment_timings || []).length === 0 && (
                    <p className="text-xs text-destructive">Selecione pelo menos uma regra para os clientes.</p>
                  )}
                </div>

                {form.payment_methods.includes("pix") && (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <Label className="text-sm font-medium mb-1 block">Chave Pix para Recebimento</Label>
                    <Input 
                      value={form.pix_key} 
                      onChange={(e) => setForm({ ...form, pix_key: e.target.value })} 
                      placeholder="E-mail, CPF, CNPJ ou Chave Aleatória"
                    />
                    <p className="text-[10px] text-muted-foreground">Esta chave será mostrada aos clientes que escolherem pagar via PIX.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Temas pré-definidos */}
          <TabsContent value="themes" className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
                <Palette className="w-4 h-4" /> Temas pré-definidos
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione um tema para aplicar instantaneamente. Você pode personalizar depois.
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {PRESET_THEMES.map((theme) => {
                  const isActive =
                    form.primary_color === theme.primary_color &&
                    form.background_color === theme.background_color &&
                    form.font_heading === theme.font_heading;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={async () => {
                        const themeData: Partial<BusinessData> = {
                          primary_color: theme.primary_color,
                          secondary_color: theme.secondary_color,
                          accent_color: theme.accent_color,
                          background_color: theme.background_color,
                          text_color: theme.text_color,
                          font_body: theme.font_body,
                          font_heading: theme.font_heading,
                          border_radius: theme.border_radius,
                          layout_style: theme.layout_style,
                        };
                        setForm((prev) => ({ ...prev, ...themeData }));
                        if (business) {
                          try {
                            await updateDoc(doc(db, "businesses", business.id), themeData);
                            toast({ title: `Tema "${theme.name}" aplicado e salvo!` });
                          } catch (error: unknown) {
                            handleFirestoreError(error, OperationType.UPDATE, `businesses/${business.id}`);
                          }
                        }
                      }}
                      className={`relative text-left rounded-xl border-2 overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] ${
                        isActive ? "border-primary ring-2 ring-primary/30" : "border-border"
                      }`}
                    >
                      {/* Theme preview mini */}
                      <div
                        className="p-4 space-y-2"
                        style={{ backgroundColor: theme.background_color, color: theme.text_color, fontFamily: theme.font_body }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg">{theme.emoji}</span>
                          {isActive && (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.primary_color }}>
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-bold" style={{ fontFamily: theme.font_heading, color: theme.primary_color }}>
                          {theme.name}
                        </p>
                        <p className="text-[11px] leading-tight" style={{ opacity: 0.7 }}>{theme.desc}</p>
                        <div className="flex gap-1 pt-1">
                          {[theme.primary_color, theme.secondary_color, theme.accent_color, theme.background_color, theme.text_color].map((c, i) => (
                            <div key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <div
                          className="mt-2 text-[10px] font-semibold py-1 px-3 inline-block"
                          style={{
                            backgroundColor: theme.primary_color,
                            color: "#fff",
                            borderRadius: theme.border_radius === "none" ? 0 : theme.border_radius === "small" ? 4 : theme.border_radius === "rounded" ? 8 : theme.border_radius === "large" ? 16 : 9999,
                          }}
                        >
                          Agendar
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Página - Landing page config */}
          <TabsContent value="page" className="bg-card rounded-xl border border-border p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-foreground mb-3">Seção Hero (Destaque)</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Título principal</label>
                  <Input value={form.hero_title} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} placeholder={`Bem-vindo à ${form.name}`} />
                  <p className="text-xs text-muted-foreground mt-1">Use \n para quebrar linha. A última linha fica na cor primária.</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Subtítulo</label>
                  <Textarea value={form.hero_subtitle} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} placeholder="Agende seu horário com praticidade e rapidez." rows={2} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Texto do botão (CTA)</label>
                  <Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Agendar" />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-base font-semibold text-foreground mb-3">Seções visíveis</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Estatísticas</p>
                    <p className="text-xs text-muted-foreground">Números em destaque (ex: anos de experiência)</p>
                  </div>
                  <Switch checked={form.show_stats_section} onCheckedChange={(v) => setForm({ ...form, show_stats_section: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Serviços</p>
                    <p className="text-xs text-muted-foreground">Cards com seus serviços e preços</p>
                  </div>
                  <Switch checked={form.show_services_section} onCheckedChange={(v) => setForm({ ...form, show_services_section: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Equipe</p>
                    <p className="text-xs text-muted-foreground">Fotos e nomes dos profissionais</p>
                  </div>
                  <Switch checked={form.show_team_section} onCheckedChange={(v) => setForm({ ...form, show_team_section: v })} />
                </div>
              </div>
            </div>

            {form.show_stats_section && (
              <div className="border-t border-border pt-4">
                <h3 className="text-base font-semibold text-foreground mb-3">Estatísticas personalizadas</h3>
                <div className="space-y-2">
                  {form.stats_data.map((stat, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        value={stat.value}
                        onChange={(e) => {
                          const newStats = [...form.stats_data];
                          newStats[i] = { ...newStats[i], value: e.target.value };
                          setForm({ ...form, stats_data: newStats });
                        }}
                        placeholder="10+"
                        className="w-24"
                      />
                      <Input
                        value={stat.label}
                        onChange={(e) => {
                          const newStats = [...form.stats_data];
                          newStats[i] = { ...newStats[i], label: e.target.value };
                          setForm({ ...form, stats_data: newStats });
                        }}
                        placeholder="Anos de Experiência"
                        className="flex-1"
                      />
                      <Button
                        type="button" variant="ghost" size="icon"
                        onClick={() => setForm({ ...form, stats_data: form.stats_data.filter((_, idx) => idx !== i) })}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {form.stats_data.length < 6 && (
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={() => setForm({ ...form, stats_data: [...form.stats_data, { label: "", value: "" }] })}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Adicionar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Instagram Integration */}
          <TabsContent value="instagram">
            <PlanGuard 
              feature="instagramIntegration" 
              label="Instagram Feed"
              targetPlan={PlanId.BUSINESS}
            >
              {business && (
                <InstagramIntegration 
                  business={business as any} 
                  onUpdate={fetchBusiness} 
                />
              )}
            </PlanGuard>
          </TabsContent>

          <TabsContent value="apis">
            <PlanGuard 
              feature="automation" 
              label="Chaves de API Externas"
              targetPlan={PlanId.BUSINESS}
            >
              <div className="bg-card rounded-xl border border-border p-6 space-y-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>OpenAI API Key (Opcional - Inteligência Artificial Customizada)</Label>
                    <Input
                      type="password"
                      value={form.api_keys?.openai || ""}
                      onChange={(e) => setForm({ ...form, api_keys: { ...form.api_keys, openai: e.target.value } })}
                      placeholder="sk-..."
                    />
                    <p className="text-[10px] text-muted-foreground">Utilizada para melhorar funcionalidades de IA (Aviso: Opcional).</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>MercadoPago Access Token (Pagamentos)</Label>
                    <Input
                      type="password"
                      value={form.api_keys?.mercadopago || ""}
                      onChange={(e) => setForm({ ...form, api_keys: { ...form.api_keys, mercadopago: e.target.value } })}
                      placeholder="APP_USR-..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Stripe Secret Key (Pagamentos Internacionais)</Label>
                    <Input
                      type="password"
                      value={form.api_keys?.stripe || ""}
                      onChange={(e) => setForm({ ...form, api_keys: { ...form.api_keys, stripe: e.target.value } })}
                      placeholder="sk_live_..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>WhatsApp Cloud API Access Token</Label>
                    <Input
                      type="password"
                      value={form.whatsapp_api_config?.api_key || ""}
                      onChange={(e) => setForm({ 
                        ...form, 
                        whatsapp_api_config: { ...form.whatsapp_api_config, api_key: e.target.value }
                      })}
                      placeholder="EAAP..."
                    />
                  </div>
                </div>
              </div>
            </PlanGuard>
          </TabsContent>

          {/* Domínio Personalizado */}
          <TabsContent value="domain">
            <PlanGuard feature="hasCustomDomain" label="Domínio Personalizado" targetPlan={PlanId.BUSINESS}>
              <CustomDomainSettings 
                business={business} 
                onUpdate={(updatedData) => {
                   setBusiness(updatedData);
                }} 
              />
            </PlanGuard>
          </TabsContent>

          {/* Geral */}
          <TabsContent value="general" className="bg-card rounded-xl border border-border p-6 space-y-6">
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 mb-6">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-1">
                <LinkIcon className="w-4 h-4" /> Link de Agendamento
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Este é o link que você deve divulgar para seus clientes. O "slug" é o identificador único do seu negócio na URL.
              </p>
              <div className="flex items-center gap-2">
                <div className="bg-background border border-border px-3 py-1.5 rounded text-sm font-mono text-muted-foreground">
                  /b/
                </div>
                <Input 
                  value={form.slug} 
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-") })} 
                  required 
                  className="font-mono"
                  placeholder="seu-negocio"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Exemplo: {window.location.origin}/b/{form.slug || "seu-negocio"}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome do negócio</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium mb-1 block">Telefone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="text-sm font-medium mb-1 block">Email</label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Descrição</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Mensagem de boas-vindas</label>
              <Textarea value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} placeholder="Ex: Bem-vindo! Agende seu horário agora." rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="text-sm font-medium mb-1 block">Instagram</label><Input value={form.social_instagram} onChange={(e) => setForm({ ...form, social_instagram: e.target.value })} placeholder="@seuperfil" /></div>
              <div><label className="text-sm font-medium mb-1 block">WhatsApp</label><Input value={form.social_whatsapp} onChange={(e) => setForm({ ...form, social_whatsapp: e.target.value })} placeholder="5511999999999" /></div>
              <div><label className="text-sm font-medium mb-1 block">Facebook</label><Input value={form.social_facebook} onChange={(e) => setForm({ ...form, social_facebook: e.target.value })} placeholder="URL" /></div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Texto do rodapé</label>
              <Input value={form.footer_text} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} placeholder="© 2026 Seu Negócio. Todos os direitos reservados." />
            </div>

            <div className="border-t pt-6 space-y-4">
              <h3 className="text-base font-semibold text-foreground">Regras de Agendamento</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Janela de Cancelamento (horas)</label>
                  <Input 
                    type="number" 
                    value={form.cancel_window_hours} 
                    onChange={(e) => setForm({ ...form, cancel_window_hours: Number(e.target.value) })} 
                    placeholder="24"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Limite de antecedência para cancelar</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Janela de Reagendamento (horas)</label>
                  <Input 
                    type="number" 
                    value={form.reschedule_window_hours} 
                    onChange={(e) => setForm({ ...form, reschedule_window_hours: Number(e.target.value) })} 
                    placeholder="24"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Limite de antecedência para reagendar</p>
                </div>
              </div>
            </div>

            <div className="mt-12 border-t pt-8">
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6">
                <h3 className="text-destructive font-semibold flex items-center gap-2 mb-2">
                  <Trash2 className="w-5 h-5" /> Zona de Perigo
                </h3>
                <p className="text-sm text-foreground/80 mb-6">
                  Se você excluir o seu negócio, sua página sairá do ar imediatamente e os dados do negócio serão apagados.
                  Por enquanto, clientes, agendamentos e assinaturas devem ser cancelados antes.
                </p>
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Deletar Negócio
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Visual */}
          <TabsContent value="visual" className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Estilo do layout</label>
                <Select value={form.layout_style} onValueChange={(v) => setForm({ ...form, layout_style: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LAYOUT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Borda dos elementos</label>
                <Select value={form.border_radius} onValueChange={(v) => setForm({ ...form, border_radius: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RADIUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Fonte do corpo</label>
                <Select value={form.font_body} onValueChange={(v) => setForm({ ...form, font_body: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Fonte dos títulos</label>
                <Select value={form.font_heading} onValueChange={(v) => setForm({ ...form, font_heading: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Live preview mini */}
            <div className="mt-4">
              <label className="text-sm font-medium mb-2 block">Pré-visualização</label>
              <div
                className="border border-border rounded-xl p-6 space-y-3"
                style={{
                  backgroundColor: form.background_color,
                  color: form.text_color,
                  fontFamily: form.font_body,
                  borderRadius: form.border_radius === "none" ? 0 : form.border_radius === "small" ? 4 : form.border_radius === "rounded" ? 8 : form.border_radius === "large" ? 16 : 9999,
                }}
              >
                <h3 style={{ fontFamily: form.font_heading, color: form.primary_color, fontSize: "1.25rem", fontWeight: 700 }}>
                  {form.name || "Seu Negócio"}
                </h3>
                <p style={{ fontSize: "0.875rem", opacity: 0.8 }}>
                  {form.welcome_message || "Bem-vindo! Agende seu horário agora."}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    style={{
                      backgroundColor: form.primary_color,
                      color: "#fff",
                      padding: "8px 16px",
                      borderRadius: form.border_radius === "none" ? 0 : form.border_radius === "small" ? 4 : form.border_radius === "rounded" ? 8 : form.border_radius === "large" ? 16 : 9999,
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  >
                    Agendar
                  </button>
                  <button
                    type="button"
                    style={{
                      backgroundColor: form.accent_color,
                      color: "#fff",
                      padding: "8px 16px",
                      borderRadius: form.border_radius === "none" ? 0 : form.border_radius === "small" ? 4 : form.border_radius === "rounded" ? 8 : form.border_radius === "large" ? 16 : 9999,
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  >
                    Ver mais
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Cores */}
          <TabsContent value="colors" className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Cor primária" field="primary_color" />
              <ColorField label="Cor secundária" field="secondary_color" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <ColorField label="Cor de acento" field="accent_color" />
              <ColorField label="Cor de fundo" field="background_color" />
              <ColorField label="Cor do texto" field="text_color" />
            </div>

            {/* Color palette preview */}
            <div>
              <label className="text-sm font-medium mb-2 block">Paleta</label>
              <div className="flex gap-2">
                {(["primary_color", "secondary_color", "accent_color", "background_color", "text_color"] as (keyof typeof form)[]).map((c) => (
                  <div key={c} className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-lg border border-border" style={{ backgroundColor: form[c] as string }} />
                    <span className="text-[10px] text-muted-foreground">{form[c]}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Imagens */}
          <TabsContent value="images" className="bg-card rounded-xl border border-border p-6 space-y-4">
            <ImageUrlField label="Logo" field="logo_url" />
            <ImageUrlField label="Imagem de capa (header)" field="cover_image_url" />
            <ImageUrlField label="Imagem hero (destaque)" field="hero_image_url" />
          </TabsContent>

          {/* Avançado */}
          <TabsContent value="advanced" className="bg-card rounded-xl border border-border p-6 space-y-4">
            <PlanGuard feature="whiteLabelPartial" label="Personalização CSS" targetPlan={PlanId.BUSINESS}>
              <div>
                <label className="text-sm font-medium mb-1 block">CSS Customizado</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Adicione estilos CSS extras para a página de agendamento do seu negócio.
                </p>
                <Textarea
                  value={form.custom_css}
                  onChange={(e) => setForm({ ...form, custom_css: e.target.value })}
                  placeholder={`.booking-header {\n  background: linear-gradient(135deg, #667eea, #764ba2);\n}\n\n.service-card:hover {\n  transform: scale(1.02);\n}`}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            </PlanGuard>
          </TabsContent>
        </Tabs>
      </form>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Conta e Negócio</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Seu negócio e sua conta de usuário serão completamente excluídos.
              Para confirmar, digite <b>EXCLUIR</b> no campo abaixo:
            </DialogDescription>
          </DialogHeader>
          <Input 
            type="text"
            value={deleteConfirmationText}
            onChange={e => setDeleteConfirmationText(e.target.value)}
            placeholder="EXCLUIR"
          />
          <DialogFooter>
             <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
             <Button type="button" variant="destructive" disabled={deleteConfirmationText !== 'EXCLUIR' || loading} onClick={handleConfirmDelete}>Deletar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
