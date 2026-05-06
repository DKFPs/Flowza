import React, { useEffect, useState, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { logger } from "@/lib/logger";
import { analytics } from "@/lib/analytics";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  orderBy,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  serverTimestamp,
  increment,
  runTransaction,
  onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizePhone, normalizeName, isValidPhone } from "@/lib/normalization";
import { withRetry, withFallback, ErrorType } from "@/lib/resilience";
import { enqueueJob } from "@/lib/queue";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";
import { LoyaltyService } from "@/services/loyaltyService";
import { AISchedulingService } from "@/services/aiSchedulingService";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Loader2, Clock, User, ChevronLeft, Instagram, Phone, Facebook, ArrowRight, X, Star, MapPin, Navigation, Image as ImageIcon, UserCircle, Wand2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Business, Service, Professional, Unit, Review } from "@/types";
import StyleSimulator from "@/components/gallery/StyleSimulator";
import InstagramFeed from "@/components/public/InstagramFeed";
import { TrackingScripts } from "@/components/public/TrackingScripts";
import { useSocialProof } from "@/hooks/useSocialProof";
import { PRESET_THEMES } from "@/lib/themes";

const Watermark = ({ slug, className }: { slug?: string, className?: string }) => {
  if (slug !== "demo") return null;
  return (
    <div className={`absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[9px] font-black text-white/90 tracking-widest uppercase z-20 pointer-events-none select-none flex items-center gap-1 ${className || ''}`}>
       <Sparkles className="w-3 h-3 text-purple-400" /> FLOWZA
    </div>
  );
};

// Lazy load Map to reduce bundle size for initial page load
const LeafletMap = lazy(() => import("@/components/ui/LeafletMap"));

const TIME_SLOTS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00",
];

const getRadius = (r?: string) => {
  switch (r) {
    case "none": return "0px";
    case "small": return "4px";
    case "large": return "16px";
    case "full": return "9999px";
    default: return "8px";
  }
};

// Memoized Sub-components for better performance
const ServiceCard = memo(({ service, t, isPopular, onBook, slug }: { service: Service; t: { primary: string; secondary: string; accent: string; bg: string; text: string; textMuted: string; fontBody: string; fontHeading: string; radius: string }; isPopular?: boolean; onBook: (s: Service) => void, slug?: string }) => (
  <div
    className="group relative flex flex-col transition-all active:scale-[0.98] border border-white/5 overflow-hidden"
    style={{
      backgroundColor: t.secondary + "40",
      borderRadius: t.radius || "20px",
    }}
  >
    {isPopular && (
      <div className="absolute top-3 right-3 z-10">
        <span className="px-2 py-1 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1">
          <Star className="w-3 h-3 fill-black" />
          Mais Popular
        </span>
      </div>
    )}
    <div className="relative w-full h-40 overflow-hidden bg-white/5 shrink-0">
      {service.image_url ? (
        <img src={service.image_url} alt={service.name} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/10 transition-transform duration-500 group-hover:scale-105">
          <Calendar className="w-8 h-8 opacity-40" />
        </div>
      )}
      <Watermark slug={slug} />
    </div>
    <div className="p-6 flex flex-col flex-1">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold leading-tight" style={{ fontFamily: t.fontHeading }}>{service.name}</h3>
          <div className="flex items-center gap-2 text-xs font-medium opacity-60">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{service.duration || service.duration_minutes} min</span>
          </div>
        </div>
        <span className="text-xl font-black text-primary" style={{ fontFamily: t.fontHeading }}>
          R${Number(service.price).toFixed(0)}
        </span>
      </div>
      
      {service.description && (
        <p className="text-sm opacity-60 line-clamp-3 mb-6 leading-relaxed" style={{ color: t.text }}>
          {service.description}
        </p>
      )}
      
      <button
        onClick={() => onBook(service)}
        className="mt-auto w-full h-12 flex items-center justify-center gap-2 text-sm font-bold transition-all border border-primary/20 hover:bg-primary hover:text-white"
        style={{ 
          backgroundColor: t.primary + "10", 
          color: t.primary, 
          borderRadius: t.radius || "12px" 
        }}
      >
        Agendar Agora <ChevronLeft className="w-4 h-4 rotate-180" />
      </button>
    </div>
  </div>
));

const ProfessionalCard = memo(({ professional, t, onSelect, slug }: { professional: Professional; t: { primary: string; secondary: string; accent: string; bg: string; text: string; textMuted: string; fontBody: string; fontHeading: string; radius: string }; onSelect: (p: Professional) => void, slug?: string }) => (
  <div
    className="flex-shrink-0 w-[200px] sm:w-auto text-left group cursor-pointer"
    onClick={() => onSelect(professional)}
  >
    <div className="relative aspect-[4/5] overflow-hidden mb-4 rounded-3xl border-2 border-white/5 group-hover:border-primary/50 transition-all duration-300 bg-white/5">
      {professional.avatar_url ? (
        <img src={professional.avatar_url} alt={professional.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110" />
      ) : (
        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(professional.name)}&background=random`} alt={professional.name} loading="lazy" decoding="async" className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110" />
      )}
      <Watermark slug={slug} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
      <div className="absolute bottom-4 left-0 right-0 px-4">
         <button 
          className="w-full h-10 bg-white/10 backdrop-blur-md text-[10px] uppercase font-bold tracking-widest text-white rounded-full border border-white/20 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all"
         >
           Ver Agenda
         </button>
      </div>
    </div>
    <div className="px-1 text-center">
      <h3 className="font-bold text-lg" style={{ fontFamily: t.fontHeading }}>{professional.name}</h3>
      {professional.specialty && <p className="text-xs font-medium opacity-50 uppercase tracking-wider mt-1">{professional.specialty}</p>}
      {professional.description && (
        <p className="text-[11px] opacity-60 line-clamp-2 mt-2 leading-relaxed max-w-[180px] mx-auto text-center" style={{ color: t.text }}>
          {professional.description}
        </p>
      )}
    </div>
  </div>
));

const BookingPageSkeleton = () => (
    <div className="min-h-screen bg-[#0F0F23] text-white p-6 space-y-12">
      <div className="h-16 flex items-center justify-between border-b border-white/10">
        <Skeleton className="w-32 h-8 bg-white/5" />
        <Skeleton className="w-10 h-10 rounded-full bg-white/5" />
      </div>
      <div className="space-y-6 pt-10 text-center">
        <Skeleton className="w-full h-12 max-w-lg mx-auto bg-white/5" />
        <Skeleton className="w-48 h-12 mx-auto bg-white/5" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 bg-white/5" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-10">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 bg-white/5" />)}
      </div>
    </div>
  );
  
  const BookingPage = ({ customSlug }: { customSlug?: string }) => {
    const params = useParams();
    const slug = customSlug || params.slug;
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [simOpen, setSimOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState("");
    const aiFileRef = React.useRef<HTMLInputElement>(null);

    const handleAiSuggest = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !bookingData?.business?.id) return;
      setAiLoading(true);
      setAiResult("");

      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;

        const response = await fetch("/api/suggest-style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: base64,
            galleryStyles: bookingData.gallery || [],
          }),
        });
        
        const data = await response.json();

        if (!response.ok) {
          toast({ title: "Erro na sugestão de IA", description: data.error || "Erro misterioso", variant: "destructive" });
          setAiLoading(false);
          return;
        }

        setAiResult(data.suggestion || data.error || "Sem resultado");
        setAiLoading(false);
      };
      reader.readAsDataURL(file);
    };

    const { data: bookingData, isLoading: isInitialLoading } = useQuery({
    queryKey: ["booking_page_data", slug],
    queryFn: async () => {
      let biz: Business | null = null;
      const bizQuery = query(collection(db, "businesses"), where("slug", "==", slug), limit(1));
      const bizSnap = await getDocs(bizQuery);
      
      if (bizSnap.empty) {
        if (slug === "demo") {
          biz = {
            id: "demo-biz",
            name: "Flowza Demo Studio",
            slug: "demo",
            owner_id: "system",
            primary_color: "#7c3aed",
            secondary_color: "#1f2937",
            accent_color: "#7c3aed",
            background_color: "#030712",
            text_color: "#f9fafb",
            font_body: "Inter",
            font_heading: "Space Grotesk",
            logo_url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23111827'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-weight='800' font-size='64' fill='%23f9fafb'%3EF%3Ctspan fill='%237c3aed'%3E.%3C/tspan%3E%3C/text%3E%3C/svg%3E",
            welcome_message: "Bem-vindo ao nosso espaço conceito. Agende seu horário e experimente a conveniência da automação inteligente.",
            hero_title: "Cresça seu Negócio\ncom Inteligência",
            hero_subtitle: "Gestão completa de agendamentos, clientes e fidelização. Onde a tecnologia encontra o resultado.",
            cta_text: "Agendar Agora",
            hero_image_url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1920&h=1080",
            instagram_config: {
              is_active: true,
              access_token: "demo"
            },
            stats_data: [
              { label: "Clientes Ativos", value: "2k+" },
              { label: "Agendamentos/mês", value: "1.5k+" },
              { label: "Profissionais", value: "12" },
              { label: "Retenção", value: "98%" },
            ]
          } as Business;
          
          return {
            business: biz,
            services: [
              { id: "s1", name: "Consultoria Premium", duration: 60, price: 150, description: "Sessão estratégica para otimização de processos.", is_active: true, business_id: "demo-biz", image_url: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=600&h=400" },
              { id: "s2", name: "Sessão de Mentoria", duration: 45, price: 120, description: "Acompanhamento focado em resultados rápidos.", is_active: true, business_id: "demo-biz", image_url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=600&h=400" },
              { id: "s3", name: "Workshop de Growth", duration: 120, price: 300, description: "Treinamento intensivo para equipes de alta performance.", is_active: true, business_id: "demo-biz", image_url: "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&q=80&w=600&h=400" },
              { id: "s4", name: "Análise de Dados", duration: 30, price: 80, description: "Diagnóstico completo das métricas do seu negócio.", is_active: true, business_id: "demo-biz", image_url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600&h=400" },
            ],
            professionals: [
              { id: "p1", name: "Alice Reiner", specialty: "Estrategista de Growth", is_active: true, business_id: "demo-biz", avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=400" },
              { id: "p2", name: "Lucas Mendes", specialty: "Especialista em Automação", is_active: true, business_id: "demo-biz", avatar_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400&h=400" },
              { id: "p3", name: "Sarah Connor", specialty: "Gestão de Fidelidade", is_active: true, business_id: "demo-biz", avatar_url: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=400&h=400" },
            ],
            units: [
              { id: "u1", name: "Unidade Central", address: "Av. Paulista, 1000", city: "São Paulo", state: "SP", is_active: true, business_id: "demo-biz", image_url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800&h=400", latitude: -23.5614, longitude: -46.6559 },
            ],
            reviews: [
              { id: "r1", rating: 5, comment: "Melhor atendimento que já tive! Recomendo o Ricardo.", created_at: new Date().toISOString(), business_id: "demo-biz", client_id: "c1", clients: { name: "João Pedro" } },
              { id: "r2", rating: 5, comment: "Lugar incrível e ambiente muito massa.", created_at: new Date().toISOString(), business_id: "demo-biz", client_id: "c2", clients: { name: "Marcio L." } },
            ],
            gallery: [
              { id: "g1", image_url: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=800&h=600", title: "Corte Moderno", category: "Barba" },
              { id: "g2", image_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800&h=600", title: "Barba Profissional", category: "Corte" },
              { id: "g3", image_url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=800&h=600", title: "Acabamento Premium", category: "Combo" },
              { id: "g4", image_url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=800&h=600", title: "Degradê Perfeito", category: "Infantil" },
            ]
          };
        }
        return { business: null, services: [], professionals: [], units: [], reviews: [] };
      }

      const bizDoc = bizSnap.docs[0];
      biz = { id: bizDoc.id, ...bizDoc.data() } as Business;

      const [svcSnap, profSnap, untSnap, revSnap, galSnap] = await Promise.all([
        getDocs(query(collection(db, "services"), where("business_id", "==", biz.id), where("is_active", "==", true))),
        getDocs(query(collection(db, "professionals"), where("business_id", "==", biz.id), where("is_active", "==", true))),
        getDocs(query(collection(db, "units"), where("business_id", "==", biz.id), where("is_active", "==", true))),
        getDocs(query(collection(db, "reviews"), where("business_id", "==", biz.id), limit(10))),
        getDocs(query(collection(db, "style_gallery"), where("business_id", "==", biz.id), where("is_active", "==", true))),
      ]);

      return {
        business: biz,
        services: svcSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)),
        professionals: profSnap.docs.map(d => ({ id: d.id, ...d.data() } as Professional)),
        units: untSnap.docs.map(d => ({ id: d.id, ...d.data() } as Unit)),
        reviews: revSnap.docs.map(d => ({ id: d.id, ...d.data() } as Review)),
        gallery: galSnap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; title: string; image_url: string; category?: string; description?: string }))
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { 
    business = null, 
    services = [], 
    professionals = [], 
    units = [], 
    reviews = [],
    gallery = []
  } = bookingData || {};

  const { recentBookings, realStats } = useSocialProof(business?.id);
  
  // MÓDULO 9 — MONETIZAÇÃO
  // PRO, BUSINESS, PREMIUM: Atividade
  const canShowActivity = business?.plan_id && ["pro", "business", "premium"].includes(business.plan_id) || business?.slug === "demo";
  // BUSINESS, PREMIUM: Contadores e Destaque
  const canShowCounters = business?.plan_id && ["business", "premium"].includes(business.plan_id) || business?.slug === "demo";

  const popularServiceId = useMemo(() => {
    if (!canShowCounters) return null;
    if (recentBookings.length === 0) return null;
    const counts: Record<string, number> = {};
    let max = 0;
    let popularId = null;
    for (const b of recentBookings) {
      if (b.service_id) {
        counts[b.service_id] = (counts[b.service_id] || 0) + 1;
        if (counts[b.service_id] > max) {
          max = counts[b.service_id];
          popularId = b.service_id;
        }
      }
    }
    return popularId;
  }, [recentBookings, canShowCounters]);

  const [activeToast, setActiveToast] = useState<{name: string, serviceName: string, time: string} | null>(null);

  useEffect(() => {
    if (canShowActivity && recentBookings.length > 0 && !activeToast) {
      // Pick a random recent booking to show every 30-45 seconds
      const interval = setInterval(() => {
        if (Math.random() > 0.3) { // 70% chance to show
          const randomBooking = recentBookings[Math.floor(Math.random() * Math.min(recentBookings.length, 5))];
          if (randomBooking && randomBooking.client_name) {
            // "Há 5 minutos" approx based on created_at or just randomized relative time
            const now = new Date();
            const created = randomBooking.created_at?.toDate ? randomBooking.created_at.toDate() : new Date(randomBooking.created_at || now.toISOString());
            const diffMinutes = Math.max(1, Math.floor((now.getTime() - created.getTime()) / 60000));
            let timeStr = `há ${diffMinutes} min`;
            if (diffMinutes > 60) {
              const hours = Math.floor(diffMinutes / 60);
              timeStr = `há ${hours > 24 ? "alguns dias" : hours + "h"}`;
            }

            const currentService = services.find(s => s.id === randomBooking.service_id);
            const serviceName = currentService?.name || "um serviço";
            // Anonymize: "Maria S."
            const parts = randomBooking.client_name.split(' ');
            const anonName = parts.length > 1 ? `${parts[0]} ${parts[parts.length-1].charAt(0)}.` : parts[0];

            setActiveToast({ name: anonName, serviceName, time: timeStr });
            
            setTimeout(() => setActiveToast(null), 5000); // Hide after 5 seconds
          }
        }
      }, 25000); // Check every 25s
      return () => clearInterval(interval);
    }
  }, [recentBookings, activeToast, services, canShowActivity]);

  // Booking modal state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [date, setDate] = useState<Date | undefined>(() => {
    const today = new Date();
    if (today.getDay() === 0) { // If sunday, pick tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    return today;
  });
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [success, setSuccess] = useState(false);
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'details' | 'payment_choice' | 'payment' | 'success'>('details');
  const [paymentMethod, setPaymentMethod] = useState<string>('pix');
  const [paymentTiming, setPaymentTiming] = useState<string>('full');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [isPaid, setIsPaid] = useState(false);
  const [additionalServices, setAdditionalServices] = useState<Service[]>([]);

  const toggleAdditionalService = useCallback((s: Service) => {
    setAdditionalServices(prev => {
      if (prev.find(a => a.id === s.id)) {
        return prev.filter(a => a.id !== s.id);
      }
      return [...prev, s];
    });
  }, []);

  // Timer logic for urgency
  useEffect(() => {
    if (bookingOpen && checkoutStep === 'payment' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [bookingOpen, checkoutStep, timeLeft]);

  // Default payment timing and method when business opens
  useEffect(() => {
    if (business?.enable_payment_setup) {
      if (business.payment_timings && business.payment_timings.length > 0) {
        setPaymentTiming(business.payment_timings[0]);
      }
      if (business.payment_methods && Array.isArray(business.payment_methods) && business.payment_methods.length > 0) {
        setPaymentMethod(business.payment_methods.includes('pix') ? 'pix' : business.payment_methods[0]);
      }
    }
  }, [business]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const { data: dayAppointments = [], isLoading: isLoadingSlots } = useQuery({
    queryKey: ["day_appointments", business?.id, selectedProfessional?.id, date ? format(date, "yyyy-MM-dd") : null],
    queryFn: async () => {
      if (!date || !selectedProfessional || !business) return [];
      const q = query(
        collection(db, "appointments"),
        where("business_id", "==", business.id),
        where("professional_id", "==", selectedProfessional.id),
        where("appointment_date", "==", format(date, "yyyy-MM-dd")),
        where("status", "!=", "cancelled"),
        limit(50)
      );
      try {
        const { getDocsFromServer } = await import("firebase/firestore");
        const snap = await getDocsFromServer(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
      } catch (err: unknown) {
        console.warn("Offline ou erro no servidor, caindo para cache local...", err);
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
      }
    },
    enabled: !!date && !!selectedProfessional && !!business,
  });

  useEffect(() => {
    if (!date || !selectedProfessional || !business) return;
    const q = query(
      collection(db, "appointments"),
      where("business_id", "==", business.id),
      where("professional_id", "==", selectedProfessional.id),
      where("appointment_date", "==", format(date, "yyyy-MM-dd")),
      where("status", "!=", "cancelled"),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedAppointments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
      queryClient.setQueryData(
        ["day_appointments", business.id, selectedProfessional.id, format(date, "yyyy-MM-dd")],
        updatedAppointments
      );
    }, (error) => {
      console.error("onSnapshot error: ", error);
    });
    return () => unsubscribe();
  }, [date, selectedProfessional, business, queryClient]);

  const bookMutation = useMutation({
    mutationFn: async ({ service, professional, date, time, name, phone, recurrence, paymentTiming, additionalServicesList, dynamicDiscount }: { service: Service; professional: Professional; date: Date; time: string; name: string; phone: string; recurrence: string | null; paymentTiming?: string, additionalServicesList?: Service[], dynamicDiscount?: number }) => {
      if (!business) return;

      try {
        // MÓDULO 2 — NORMALIZAÇÃO & ID ÚNICO DE CLIENTE
        const cleanPhone = normalizePhone(phone);
        const cleanName = normalizeName(name);
        const clientId = `${business.id}_${cleanPhone}`;
        
        if (!isValidPhone(cleanPhone)) {
          throw new Error("Por favor, informe um WhatsApp válido com DDD.");
        }

        if (cleanName.length < 3) {
          throw new Error("Por favor, informe seu nome completo.");
        }

        // Determine occurrences based on recurrence
        const datesToSchedule: Date[] = [date];
        if (recurrence === 'weekly') {
          for(let i=1; i<4; i++) { const d = new Date(date); d.setDate(d.getDate() + i*7); datesToSchedule.push(d); }
        } else if (recurrence === 'biweekly') {
          for(let i=1; i<4; i++) { const d = new Date(date); d.setDate(d.getDate() + i*14); datesToSchedule.push(d); }
        } else if (recurrence === 'monthly') {
          for(let i=1; i<12; i++) { const d = new Date(date); d.setMonth(d.getMonth() + i); datesToSchedule.push(d); }
        }

        let firstResult: any = null;

        for (const targetDate of datesToSchedule) {
           const aptDateStr = format(targetDate, "yyyy-MM-dd");
           // Skipping availability backend check for recurrences for speed, 
           // but `runTransaction` still protects against exact collisions.
           if (targetDate === date) {
              const response = await fetch("/api/availability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  businessId: business.id,
                  professionalId: professional.id,
                  date: aptDateStr,
                  duration: (service.duration || service.duration_minutes || 30) + (additionalServicesList?.reduce((acc, s) => acc + (s.duration || s.duration_minutes || 0), 0) || 0),
                  checkOnlyTime: time
                })
              });

              if (response.ok) {
                 const availData = await response.json();
                 if (availData.conflict) {
                    throw new Error("Este horário ou intervalo acabou de ser ocupado. Por favor, tente outro.");
                 }
              }
           }

           const executeTransaction = async () => runTransaction(db, async (transaction) => {
             // === Mapeamento de Refs ===
             const bizRef = doc(db, "businesses", business.id);
             const clientRef = doc(db, "clients", clientId);
             
             const startTimeStr = time + ":00";
             const slotId = `${business.id}_${professional.id}_${aptDateStr.replace(/-/g, "")}_${startTimeStr.replace(/:/g, "")}`;
             const aptRef = doc(db, "appointments", slotId);

             // === Execução de TODAS as Leituras (Reads) antes das Escritas ===
             const bizDoc = await transaction.get(bizRef);
             const clientSnap = await transaction.get(clientRef);
             const aptSnap = await transaction.get(aptRef);

             // 1. Verificar Limites e Status do Negócio
             if (!bizDoc.exists()) throw new Error("Estabelecimento não encontrado.");
             
             const bizData = bizDoc.data();
             if (slug !== "demo" && bizData.limit_appointments && (bizData.usage_appointments || 0) >= bizData.limit_appointments) {
               throw new Error("Limite de agendamentos atingido para este estabelecimento.");
             }

             // 2. Verificar Concorrência de Horário
             if (aptSnap.exists() && aptSnap.data().status !== 'cancelled') {
               const data = aptSnap.data();
               if (data.client_id === clientId) {
                 return { aptId: slotId, isOnlinePayment: data.payment_timing !== 'on_site', alreadyExists: true, targetDate };
               }
               
               if (targetDate !== date) {
                 // For recurrences, soft fail log and continue
                 console.warn(`Colisão em recorrência ${slotId}. Ignorado.`);
                 return { skip: true };
               } else {
                 throw new Error("Este horário acabou de ser ocupado por outra pessoa. Por favor, tente outro horário imediato.");
               }
             }

             let isNewClient = false;

             // 4. Configurar Tempos
             const mainDuration = service.duration || service.duration_minutes || 30;
             const additionalDuration = additionalServicesList?.reduce((acc, s) => acc + (s.duration || s.duration_minutes || 0), 0) || 0;
             const duration = mainDuration + additionalDuration;

             const endMinutes = parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]) + duration;
             const endTimeStr = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}:00`;

             let totalPrice = Number(service.price) + (additionalServicesList?.reduce((acc, s) => acc + Number(s.price), 0) || 0);
             if (dynamicDiscount && dynamicDiscount > 0) {
               totalPrice = totalPrice - (totalPrice * (dynamicDiscount / 100));
             }

             // === Escritas (Writes) ===
             // 3. Gerenciar Cliente
             if (!clientSnap.exists()) {
               transaction.set(clientRef, {
                 business_id: business.id,
                 name: cleanName,
                 phone: cleanPhone,
                 created_at: serverTimestamp(),
                 updated_at: serverTimestamp(),
                 appointments_count: 1,
                 total_revenue: totalPrice,
                 last_appointment_date: serverTimestamp()
               });
               isNewClient = true;
             } else {
               transaction.update(clientRef, { 
                 name: cleanName, 
                 updated_at: serverTimestamp(),
                 appointments_count: increment(1),
                 total_revenue: increment(totalPrice),
                 last_appointment_date: serverTimestamp()
               });
             }

             const isOnlinePayment = business.enable_payment_setup && paymentTiming !== 'on_site';
             const initialStatus = isOnlinePayment ? "pending_payment" : (business.auto_confirm ? "confirmed" : "pending");

             // 5. Criar Agendamento
             transaction.set(aptRef, {
               business_id: business.id,
               client_id: clientId,
               professional_id: professional.id,
               service_id: service.id,
               additional_service_ids: additionalServicesList?.map(s => s.id) || [],
               total_price: totalPrice,
               appointment_date: aptDateStr,
               start_time: startTimeStr,
               end_time: endTimeStr,
               status: initialStatus,
               recurrence_type: recurrence || null,
               payment_status: "unpaid",
               payment_timing: paymentTiming || 'on_site',
               created_at: serverTimestamp(),
               updated_at: serverTimestamp(),
               client_name: cleanName,
               client_phone: cleanPhone,
               service_name_snapshot: service.name + (additionalServicesList?.length ? ` (+${additionalServicesList.length})` : '')
             });

             // 6. Módulo 3 — Fila de Processamento (Auto-Healing Queue Async)
             await enqueueJob({
                type: 'sync_appointment_effects',
                payload: { aptId: slotId, paymentTiming, isOnlinePayment },
                businessId: business.id
             });

             // Single update to bizRef
             if (isNewClient) {
               transaction.update(bizRef, { usage_appointments: increment(1), usage_clients: increment(1) });
             } else {
               transaction.update(bizRef, { usage_appointments: increment(1) });
             }
             
             return { aptId: slotId, isOnlinePayment };
           });

           const fallbackTransaction = async (err: unknown) => {
               const eMsg = err instanceof Error ? err.message : String(err);
               // Ignorar double booking de salvar no fallback p n criar lixo
               if (!eMsg.includes("ocupado por outra pessoa") && !eMsg.includes("válido") && !eMsg.includes("completo")) {
                 await enqueueJob({
                     type: 'fallback_appointment_creation',
                     payload: { name, phone, date: targetDate.toISOString(), time, serviceId: service.id, professionalId: professional.id, error: eMsg },
                     businessId: business.id
                 }, 0);
               }
               throw err;
           };

           const result = await withFallback(
               () => withRetry(executeTransaction, { operationName: "create_appointment_txn", businessId: business.id }),
               fallbackTransaction,
               { operationName: "fallback_appointment", businessId: business.id }
           );
           
           if (!firstResult) firstResult = result;
        }
        
        // Tracking Escala & Diferenciação (Fase 4)
        if (typeof window !== 'undefined' && window.fbq) {
           window.fbq('track', 'Schedule', { value: Number(service.price), currency: 'BRL', content_ids: [service.id], content_type: 'product' });
        }
        if (typeof window !== 'undefined' && window.ttq) {
           window.ttq.track('CompleteRegistration', { value: Number(service.price), currency: 'BRL' });
        }
        if (typeof window !== 'undefined' && window.gtag) {
           window.gtag('event', 'conversion', { 'send_to': 'AW-CONVERSION_ID', value: Number(service.price), currency: 'BRL' });
        }

        // Pós-transaction
        if (slug !== "demo" && clientId) {
           try {
             await LoyaltyService.awardRegistrationPoints(business.id, clientId);
           } catch (e) {
             console.warn("Loyalty awarding failed", e);
           }
        }

        return firstResult;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, "booking_v3_transaction");
      }
    },
    onSuccess: (data) => {
      // Módulo 3/5: Rastrear Conversão
      analytics.trackEvent("booking_created", {
        businessId: business?.id,
        status: data?.isOnlinePayment ? "pending_payment" : "confirmed",
        isOnlinePayment: data?.isOnlinePayment
      });

      // Provide a slight delay so the user can see the success animation on the button
      setTimeout(() => {
        if (data?.isOnlinePayment) {
          setCheckoutStep('payment');
          setTimeLeft(600); // 10 minutes timer starts
        } else {
          setCheckoutStep('success');
        }
      }, 1000);
    },
    onError: (err: Error) => {
      // Módulo 1: Captura de erro em tela principal
      logger.error("Booking failed", err, { businessId: business?.id });
      toast({ title: "Erro ao agendar", description: err.message, variant: "destructive" });
    }
  });

  const availableSlots = useMemo(() => {
    // Check working days
    if (selectedProfessional?.working_days && date && !selectedProfessional.working_days.includes(date.getDay())) {
       return [];
    }

    // Check daily limits
    if (selectedProfessional?.limits?.dailyCount) {
       const nonCancelled = (dayAppointments || []).filter(a => a.status !== 'cancelled');
       if (nonCancelled.length >= selectedProfessional.limits.dailyCount) {
          return [];
       }
    }

    // Calculate total duration (main service + additional services)
    const mainDuration = Number(selectedService?.duration || selectedService?.duration_minutes || 30);
    const additionalDuration = Array.isArray(additionalServices) ? additionalServices.reduce((acc, s) => acc + Number(s.duration || s.duration_minutes || 0), 0) : 0;
    const totalDuration = mainDuration + additionalDuration;

    // Use professional's working hours if available, otherwise default to 08:00 - 18:00
    const workingHours = selectedProfessional?.working_hours || { start: '08:00', end: '18:00' };
    
    // Default buffer
    const buffer = selectedProfessional?.buffer_minutes ? Number(selectedProfessional.buffer_minutes) : 0;
    
    const intervalFromDuration = Math.max(15, totalDuration + buffer);

    const rawSlots = AISchedulingService.generateAvailableSlots(
      workingHours,
      totalDuration,
      dayAppointments || [],
      intervalFromDuration,
      buffer,
      selectedProfessional?.breaks,
      date ? date.getDay() : undefined
    );
    
    return AISchedulingService.rankSlots(
      rawSlots,
      dayAppointments || [],
      totalDuration,
      business?.ai_settings || undefined
    );
  }, [dayAppointments, business?.ai_settings, selectedService, additionalServices, selectedProfessional, date]);


  const openBooking = useCallback((service?: Service | null) => {
    setSuccess(false);
    setCheckoutStep('details');
    setIsPaid(false);
    if (service) {
      setSelectedService(service);
      if (professionals.length === 1) {
        setSelectedProfessional(professionals[0]);
        setStep(3);
      } else {
        setStep(2);
      }
    } else {
      setStep(1);
      setSelectedService(null);
      setSelectedProfessional(null);
    }
    setAdditionalServices([]);
    setTime(null);
    setName("");
    setPhone("");
    setRecurrence(null);
    setBookingOpen(true);
  }, [professionals]);

  // Auto-open booking if service param
  useEffect(() => {
    const serviceId = searchParams.get("service");
    if (serviceId && services.length > 0 && !bookingOpen) {
      const svc = services.find(s => s.id === serviceId);
      if (svc) openBooking(svc);
    }
  }, [searchParams, services, openBooking, bookingOpen]);

  // Load Google Fonts
  useEffect(() => {
    if (!business) return;
    const fonts = [business.font_body, business.font_heading].filter(Boolean);
    if (fonts.length === 0) return;
    const families = fonts.map((f: unknown) => typeof f === 'string' ? f.replace(/ /g, "+") : "").filter(Boolean).join("&family=");
    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?family=${families}:wght@300;400;500;600;700;800;900&display=swap`;
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [business]);

  // Custom CSS
  useEffect(() => {
    if (!business?.custom_css) return;
    const style = document.createElement("style");
    style.textContent = business.custom_css;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [business?.custom_css]);

  const t = useMemo(() => {
    const previewThemeId = searchParams.get("theme");
    const previewTheme = previewThemeId ? PRESET_THEMES.find(pt => pt.id === previewThemeId) : null;

    if (previewTheme) {
      return {
        primary: previewTheme.primary_color,
        secondary: previewTheme.secondary_color,
        accent: previewTheme.accent_color,
        bg: previewTheme.background_color,
        text: previewTheme.text_color,
        textMuted: previewTheme.text_color + "99",
        fontBody: previewTheme.font_body,
        fontHeading: previewTheme.font_heading,
        radius: getRadius(previewTheme.border_radius),
      };
    }

    return {
      primary: business?.primary_color || "#D4A853",
      secondary: business?.secondary_color || "#1A1A2E",
      accent: business?.accent_color || "#D4A853",
      bg: business?.background_color || "#0F0F23",
      text: business?.text_color || "#FFFFFF",
      textMuted: (business?.text_color || "#FFFFFF") + "99",
      fontBody: business?.font_body || "Inter",
      fontHeading: business?.font_heading || "Space Grotesk",
      radius: getRadius(business?.border_radius),
    };
  }, [business, searchParams]);

  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return 4.9;
    return (reviews.reduce((acc: number, r: Review) => acc + (r.rating || 0), 0) / reviews.length) || 4.9;
  }, [reviews]);

  const stats: { label: string; value: string }[] = useMemo(() => {
    if (!canShowCounters) return [];

    if (business?.stats_data && business.stats_data.length > 0) return business.stats_data;
    
    if (realStats) {
      return [
        { label: "Experiência", value: "Premium" },
        { label: "Atendimentos", value: `${realStats.totalAppointments}+` },
        { label: "Clientes Atendidos", value: `${realStats.totalClients}+` },
        { label: "Avaliação", value: averageRating.toFixed(1) },
      ];
    }
    
    return [
      { label: "Anos de Experiência", value: "10+" },
      { label: "Atendimentos", value: "2000+" },
      { label: "Profissionais", value: "Experientes" },
      { label: "Avaliação", value: "4.9" },
    ];
  }, [business, realStats, averageRating, canShowCounters]);

  const heroTitle = useMemo(() => {
    const title = business?.hero_title || `Bem-vindo à ${business?.name || ""}`;
    return typeof title === 'string' ? title : `Bem-vindo à ${business?.name || ""}`;
  }, [business]);

  const heroSubtitle = useMemo(() => {
    const subtitle = business?.hero_subtitle || business?.welcome_message || "Agende seu horário com praticidade e rapidez.";
    return typeof subtitle === 'string' ? subtitle : "Agende seu horário com praticidade e rapidez.";
  }, [business]);

  const ctaText = useMemo(() => business?.cta_text || "Agendar", [business]);
  const showServices = business?.show_services_section !== false;
  const showTeam = business?.show_team_section !== false;
  const showStats = business?.show_stats_section !== false;

  const socialLinks = useMemo(() => [
    business?.social_instagram && typeof business.social_instagram === 'string' && { icon: Instagram, href: `https://instagram.com/${business.social_instagram.replace("@", "")}` },
    business?.social_whatsapp && typeof business.social_whatsapp === 'string' && { icon: Phone, href: `https://wa.me/${business.social_whatsapp.replace(/\D/g, "")}` },
    business?.social_facebook && typeof business.social_facebook === 'string' && { icon: Facebook, href: business.social_facebook },
  ].filter(Boolean) as { icon: React.ElementType; href: string }[], [business]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Watch for selections and scroll
  useEffect(() => {
    if (selectedService && !selectedProfessional) {
      setTimeout(() => scrollTo("step-professional"), 300);
    } else if (selectedProfessional && !time) {
      setTimeout(() => scrollTo("step-datetime"), 300);
    } else if (time && (!name || !phone)) {
      setTimeout(() => scrollTo("step-form"), 300);
    }
  }, [selectedService, selectedProfessional, time, name, phone, scrollTo]);

  if (isInitialLoading) {
    return <BookingPageSkeleton />;
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Negócio não encontrado</h1>
          <p className="text-muted-foreground text-sm">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const handleBook = () => {
    if (!selectedService || !selectedProfessional || !date || !time || !name) return;
    
    // Check for dynamic pricing discount
    const selectedSlotInfo = availableSlots.find(s => s.time === time);
    let discountToApply = 0;
    if (selectedSlotInfo?.isDiscounted && selectedSlotInfo.discountPercentage) {
      discountToApply = selectedSlotInfo.discountPercentage;
    }

    bookMutation.mutate({
      service: selectedService,
      professional: selectedProfessional,
      date,
      time,
      name,
      phone,
      recurrence,
      paymentTiming,
      additionalServicesList: additionalServices,
      dynamicDiscount: discountToApply
    });
  };

  return (
    <div className="min-h-screen booking-page" style={{ backgroundColor: t.bg, fontFamily: t.fontBody, color: t.text }}>
      <TrackingScripts businessId={business.id} />
      {/* ─── NAVBAR ─── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-3 flex items-center justify-between"
        style={{ backgroundColor: t.bg + "E6", backdropFilter: "blur(12px)", borderBottom: `1px solid ${t.text}10` }}
      >
        <div className="flex items-center gap-2">
          {business.logo_url ? (
            <img src={business.logo_url} alt="" loading="eager" fetchpriority="high" referrerPolicy="no-referrer" className="w-8 h-8 object-cover shrink-0" style={{ borderRadius: "50%" }} />
          ) : (
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(business.name)}&background=random`} alt="" loading="eager" className="w-8 h-8 object-cover shrink-0" style={{ borderRadius: "50%" }} />
          )}
          <span className="text-base font-bold truncate max-w-[120px] sm:max-w-none" style={{ fontFamily: t.fontHeading }}>{business.name}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => scrollTo("units")}
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: t.textMuted }}
          >
            <MapPin className="w-4 h-4" />
            Localização
          </button>
          <Link
            to={`/b/${slug}/area`}
            className="p-2 sm:px-4 sm:py-2 text-sm font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            style={{ color: t.textMuted }}
            title="Minha Área"
          >
            <UserCircle className="w-5 h-5 sm:w-4 sm:h-4" /> 
            <span className="hidden sm:inline">Minha Área</span>
          </Link>
          <button
            onClick={() => openBooking()}
            className="px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-bold transition-all active:scale-95 shadow-lg whitespace-nowrap"
            style={{ backgroundColor: t.primary, color: "#fff", borderRadius: t.radius || "12px" }}
          >
            {ctaText}
          </button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section
        className="relative min-h-[85vh] flex items-center justify-center text-center px-6 overflow-hidden"
        style={{ paddingTop: "60px" }}
      >
        {(business.hero_image_url || business.cover_image_url) && (
          <>
            <img
              src={business.hero_image_url || business.cover_image_url}
              alt=""
              loading="eager"
              fetchpriority="high"
              decoding="sync"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover scale-105 animate-pulse-slow font-display"
              style={{ filter: "brightness(0.4) saturate(1.2)" }}
            />
            <Watermark slug={slug} className="bottom-6 right-6 text-xs sm:text-sm px-3 py-1.5" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent, ${t.bg})` }} />
          </>
        )}
        <div className="relative z-10 max-w-2xl mx-auto space-y-8 py-10">
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 mb-6">
            <div className="relative shrink-0">
              {business.logo_url ? (
                <img src={business.logo_url} alt="" loading="eager" fetchpriority="high" referrerPolicy="no-referrer" className="w-24 h-24 rounded-3xl shadow-2xl border-4 border-white/10 shrink-0" />
              ) : (
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(business.name)}&background=random&size=128`} alt="" loading="eager" className="w-24 h-24 rounded-3xl shadow-2xl border-4 border-white/10 shrink-0" />
              )}
              <Watermark slug={slug} className="-bottom-3 -right-3" />
            </div>
              <div className="flex flex-col items-center gap-1">
                <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20 backdrop-blur-md">
                   Beleza & Bem-Estar
                </span>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-bold">{averageRating.toFixed(1)}</span>
                  <span className="text-[10px] opacity-40">({reviews.length || 120}+ avaliações)</span>
                </div>
              </div>
            </div>
            <h1
              className="text-4xl xs:text-5xl sm:text-6xl font-black leading-[1.1] tracking-tighter"
              style={{ fontFamily: t.fontHeading, color: t.text }}
            >
              {heroTitle?.split?.("\n")?.map((line: string, i: number) => (
                <span key={i} className="block">
                  {i === (heroTitle?.split?.("\n")?.length || 1) - 1 ? (
                    <span style={{ color: t.primary }}>{line}</span>
                  ) : line}
                </span>
              ))}
            </h1>
            <p className="text-base sm:text-lg max-w-md mx-auto opacity-80 leading-relaxed font-medium" style={{ color: t.text }}>
              {heroSubtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => openBooking()}
              className="w-full sm:w-auto h-16 sm:h-auto px-10 py-5 text-lg font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl shadow-primary/30"
              style={{ backgroundColor: t.primary, color: "#fff", borderRadius: t.radius || "16px" }}
            >
              {ctaText} <ArrowRight className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-4">
              {socialLinks.map((s, i) => (
                <a 
                  key={i} 
                  href={s.href} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 border border-white/10 backdrop-blur-md transition-all active:scale-90"
                  style={{ color: t.text }}
                >
                  <s.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── STICKY BOOKING BAR (MOBILE ONLY) ─── */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500">
        <button
          onClick={() => openBooking()}
          className="w-full h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-center gap-3 active:scale-95 transition-all border border-white/20 group"
          style={{ backgroundColor: t.primary }}
        >
          <div className="flex flex-col items-start px-4">
            <span className="text-[10px] uppercase tracking-widest opacity-70 leading-none mb-1">Garanta sua vaga</span>
            <span className="leading-none group-active:scale-110 transition-transform">{ctaText}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center ml-auto mr-4">
            <ArrowRight className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* ─── STATS ─── */}
      {showStats && stats.length > 0 && (
        <section className="py-12 px-4" style={{ backgroundColor: t.secondary + "80", borderTop: `1px solid ${t.text}10`, borderBottom: `1px solid ${t.text}10` }}>
          <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {stats.map((stat, i) => (
              <div key={i}>
                <p className="text-3xl sm:text-4xl font-extrabold" style={{ fontFamily: t.fontHeading, color: t.primary }}>
                  {stat.value}
                </p>
                <p className="text-sm mt-1" style={{ color: t.textMuted }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── SERVICES ─── */}
      {showServices && services.length > 0 && (
        <section className="py-16 px-6" id="services">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: t.primary }}>Serviços Premium</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: t.fontHeading }}>
                O que oferecemos
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {services.map((s) => (
                <ServiceCard key={s.id} service={s} t={t} isPopular={s.id === popularServiceId} onBook={openBooking} slug={slug} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── TEAM ─── */}
      {showTeam && professionals.length > 0 && (
        <section className="py-16 px-6" style={{ backgroundColor: t.secondary + "20" }}>
          <div className="max-w-6xl mx-auto space-y-10">
            <div className="text-center space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: t.primary }}>Time de Especialistas</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: t.fontHeading }}>
                Com quem você quer agendar?
              </h2>
            </div>
            
            <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar -mx-6 px-6 sm:grid sm:grid-cols-3 lg:grid-cols-4 sm:overflow-visible sm:mx-0 sm:px-0">
              {professionals.map((p) => (
                <ProfessionalCard 
                  key={p.id} 
                  professional={p} 
                  t={t} 
                  onSelect={(prof) => { setSelectedProfessional(prof); setStep(3); setBookingOpen(true); }} 
                  slug={slug}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── GALLERY & AI SIMULATOR ─── */}
      <section className="py-16 sm:py-24 px-4" id="gallery">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest mb-2" style={{ color: t.primary }}>Portfólio & Inteligência Artificial</p>
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: t.fontHeading }}>
                Galeria de Estilos
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setSimOpen(true)} className="gap-1 bg-white/5 border-white/10 hover:bg-white/10 text-white">
                <Wand2 className="w-4 h-4" /> Simular Estilo
              </Button>
              <Button variant="outline" onClick={() => setAiOpen(true)} className="gap-1 bg-white/5 border-white/10 hover:bg-white/10 text-white">
                <Sparkles className="w-4 h-4" /> Sugestão IA
              </Button>
            </div>
          </div>
          
          {gallery.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {gallery.map((item) => (
                <div
                  key={item.id}
                  className="group relative overflow-hidden aspect-square flex items-center justify-center bg-white/5"
                  style={{ borderRadius: t.radius }}
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center transition-transform group-hover:scale-110">
                      <Sparkles className="w-8 h-8 opacity-40 mb-2" />
                    </div>
                  )}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3"
                    style={{ background: `linear-gradient(transparent 40%, ${t.bg}DD)` }}
                  >
                    <p className="text-sm font-bold" style={{ fontFamily: t.fontHeading }}>{item.title}</p>
                    {item.category && (
                      <p className="text-xs" style={{ color: t.textMuted }}>{item.category}</p>
                    )}
                  </div>
                  <Watermark slug={slug} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-white/10 rounded-xl bg-white/5">
              <Sparkles className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/70">Nenhuma foto no portfólio no momento, mas você pode usar nossa Inteligência Artificial para descobrir o melhor estilo para você!</p>
            </div>
          )}
        </div>
        
        <StyleSimulator businessId={business?.id}
          open={simOpen}
          onOpenChange={setSimOpen}
          galleryStyles={gallery.map((g) => ({ title: g.title, description: g.description }))}
        />
        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogContent className="max-w-lg bg-[#0F0F23] border border-white/10 text-white">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Sugestão de Estilo com IA</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-white/70">Envie uma foto sua para receber sugestões personalizadas de estilos baseadas no formato do seu rosto e características.</p>
              <input ref={aiFileRef} type="file" accept="image/*" className="hidden" onChange={handleAiSuggest} />
              <Button onClick={() => aiFileRef.current?.click()} className="w-full gap-1 bg-primary text-primary-foreground hover:brightness-110" disabled={aiLoading}>
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {aiLoading ? "Analisando com IA..." : "Enviar Minha Foto"}
              </Button>
              {aiResult && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white whitespace-pre-wrap max-h-80 overflow-y-auto">
                  {aiResult}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </section>

      {/* ─── UNITS / LOCATIONS ─── */}
      {units.length > 0 && (
        <section className="py-16 sm:py-24 px-4" style={{ backgroundColor: t.secondary + "40" }} id="units">
          <div className="max-w-6xl mx-auto">
            <p className="text-sm font-medium uppercase tracking-widest mb-2" style={{ color: t.primary }}>Localização</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-10" style={{ fontFamily: t.fontHeading }}>
              Nossas Unidades
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-8 items-start">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {units.map((unit) => {
                  const fullAddress = [unit.address, unit.city, unit.state, unit.zip_code].filter(Boolean).join(", ");
                  const mapsUrl = fullAddress
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
                    : null;
                  return (
                    <div
                      key={unit.id}
                      className="p-5 flex flex-col space-y-3 relative overflow-hidden group"
                      style={{
                        backgroundColor: t.secondary + "80",
                        border: `1px solid ${t.text}15`,
                        borderRadius: t.radius,
                      }}
                    >
                      <div className="relative w-full h-32 -mt-5 -mx-5 mb-2 overflow-hidden bg-white/5 shrink-0">
                        {unit.image_url ? (
                          <img src={unit.image_url} alt={unit.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/10 transition-transform duration-500 group-hover:scale-105">
                            <MapPin className="w-8 h-8 opacity-40" />
                          </div>
                        )}
                        <Watermark slug={slug} />
                      </div>
                      <h3 className="font-bold text-lg" style={{ fontFamily: t.fontHeading }}>{unit.name}</h3>
                      {unit.description && (
                         <p className="text-xs opacity-60 line-clamp-2 leading-relaxed" style={{ color: t.text }}>
                           {unit.description}
                         </p>
                      )}
                      {fullAddress && (
                        <p className="text-sm" style={{ color: t.textMuted }}>{fullAddress}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mt-auto pt-4">
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                            style={{ backgroundColor: t.primary, color: "#fff", borderRadius: t.radius }}
                          >
                            <MapPin className="w-3.5 h-3.5" /> Mapa
                          </a>
                        )}
                        {fullAddress && (
                          <a
                            href={(unit.latitude && unit.longitude) 
                              ? `https://www.google.com/maps/dir/?api=1&destination=${unit.latitude},${unit.longitude}`
                              : mapsUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border border-white/20 hover:bg-white/10"
                            style={{ color: t.text, borderRadius: t.radius }}
                          >
                            <Navigation className="w-3.5 h-3.5" /> Rotas
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Map display */}
              {units.some(u => u.latitude && u.longitude) && (
                <div className="h-[450px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative z-0 group">
                  <Suspense fallback={
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin opacity-20" />
                    </div>
                  }>
                    <LeafletMap
                      center={[
                        units.find(u => u.latitude)?.latitude || -23.5505,
                        units.find(u => u.longitude)?.longitude || -46.6333
                      ]}
                      zoom={15}
                      markers={units.filter(u => u.latitude && u.longitude).map(u => ({
                        id: u.id,
                        position: [u.latitude!, u.longitude!],
                        title: u.name,
                        popup: u.address
                      }))}
                      className="grayscale-[0.2] contrast-[1.1] transition-all group-hover:grayscale-0"
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── REVIEWS / SOCIAL PROOF ─── */}
      {reviews.length > 0 && (
        <section className="py-16 sm:py-24 px-4" id="reviews">
          <div className="max-w-5xl mx-auto">
            <p className="text-sm font-medium uppercase tracking-widest mb-2" style={{ color: t.primary }}>Depoimentos</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-10" style={{ fontFamily: t.fontHeading }}>
              O que nossos clientes dizem
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-5 space-y-3"
                  style={{
                    backgroundColor: t.secondary + "60",
                    border: `1px solid ${t.text}15`,
                    borderRadius: t.radius,
                  }}
                >
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className="w-4 h-4"
                        style={{ color: s <= review.rating ? t.primary : t.text + "30" }}
                        fill={s <= review.rating ? t.primary : "none"}
                      />
                    ))}
                  </div>
                  {review.comment && (
                    <p className="text-sm line-clamp-3" style={{ color: t.textMuted }}>
                      "{review.comment}"
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0 relative">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(review.clients?.name && typeof review.clients.name === 'string' ? review.clients.name : "Cliente")}&background=random`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        <Watermark slug={slug} className="scale-50 origin-bottom-right" />
                      </div>
                      <p className="text-xs font-medium" style={{ color: t.text + "80" }}>
                        {review.clients?.name && typeof review.clients.name === 'string' ? review.clients.name.split(" ")[0] + " ***" : "Cliente"}
                      </p>
                    </div>
                    <p className="text-xs" style={{ color: t.textMuted }}>
                      {review.created_at ? format(review.created_at?.toDate ? review.created_at.toDate() : new Date(review.created_at), "dd/MM/yyyy") : "Data não disponível"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── INSTAGRAM FEED ─── */}
      {business.instagram_config?.is_active && (
        <section className="py-16 sm:py-24 px-4 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <InstagramFeed 
              businessId={business.id} 
              businessName={business.name} 
            />
          </div>
        </section>
      )}

      {/* ─── CTA FINAL ─── */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: t.fontHeading }}>
            Pronto para agendar?
          </h2>
          <p style={{ color: t.textMuted }}>
            Reserve agora e garanta seu horário com nossos profissionais.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => openBooking()}
              className="px-10 py-4 text-lg font-bold transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: t.primary, color: "#fff", borderRadius: t.radius }}
            >
              {ctaText}
            </button>
            <Link
              to={`/b/${slug}/area`}
              className="px-8 py-4 text-lg font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
              style={{ border: `2px solid ${t.primary}`, color: t.primary, borderRadius: t.radius }}
            >
              <UserCircle className="w-5 h-5" /> Minha Área
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-6 px-4 text-center text-sm pb-24 sm:pb-6" style={{ color: t.textMuted, borderTop: `1px solid ${t.text}10` }}>
        {business.footer_text || `© ${new Date().getFullYear()} ${business.name}. Todos os direitos reservados.`}
      </footer>

      {/* ─── STICKY MOBILE CTA ─── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex justify-center z-40 sm:hidden pointer-events-none pb-8 animate-in slide-in-from-bottom-5">
         <button 
           onClick={() => openBooking()} 
           className="w-full max-w-sm h-14 rounded-full font-black text-lg shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 pointer-events-auto transform transition-all active:scale-95 flex items-center justify-center gap-2"
           style={{ backgroundColor: t.primary, color: '#fff' }}
         >
           <Sparkles className="w-5 h-5" /> {ctaText}
         </button>
      </div>

      {/* ─── BOOKING MODAL ─── */}
      <ResponsiveModal open={bookingOpen} onOpenChange={setBookingOpen} title={checkoutStep === "payment" ? "Pagamento Seguro" : "Agendamento Rápido"}>
        <div style={{ backgroundColor: t.bg, color: t.text, fontFamily: t.fontBody }} className="p-0 sm:p-2 min-h-[70vh]">
          {checkoutStep === 'success' ? (
            <div className="text-center py-10 px-6 sm:py-16 space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce shadow-2xl" 
                style={{ backgroundColor: t.primary + "20" }}
              >
                <Check className="w-12 h-12" style={{ color: t.primary }} />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black" style={{ fontFamily: t.fontHeading }}>Agendamento Confirmado!</h3>
                <p style={{ color: t.textMuted }}>Obrigado {name.split(' ')[0]}! Seu horário está garantido.</p>
              </div>
              
              <div 
                className="p-6 rounded-3xl text-left bg-white/5 border border-white/10 space-y-4"
                style={{ borderRadius: t.radius }}
              >
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-primary/20 shrink-0">
                    {selectedProfessional?.avatar_url ? (
                      <img src={selectedProfessional.avatar_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedProfessional?.name || 'Professional')}&background=random`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    )}
                    <Watermark slug={slug} className="opacity-0 group-hover:opacity-100" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-50 font-bold">{selectedService?.name}</p>
                    <p className="font-black text-lg">com {selectedProfessional?.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Data</p>
                     <p className="font-bold">{date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : ""}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Horário</p>
                     <p className="font-bold">{time}</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 space-y-3">
                {business.social_whatsapp && (
                  <a
                    href={`https://wa.me/${(typeof business.social_whatsapp === 'string' ? business.social_whatsapp : "").replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, confirmei meu agendamento de ${selectedService?.name} para ${date ? format(date, "dd/MM") : ""} às ${time}. Até logo!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full h-16 text-lg font-black bg-green-600 text-white transition-all active:scale-95 shadow-xl shadow-green-600/20"
                    style={{ borderRadius: t.radius }}
                  >
                    <Phone className="w-6 h-6 fill-current" /> Confirmar no WhatsApp
                  </a>
                )}
                <Link
                  to={`/b/${slug}/area`}
                  className="flex items-center justify-center gap-3 w-full h-16 text-lg font-black transition-all active:scale-95 bg-white/5 border border-white/10"
                  style={{ borderRadius: t.radius, color: t.text }}
                >
                  Meus Agendamentos <ArrowRight className="w-5 h-5" />
                </Link>
                <button
                  onClick={() => { setBookingOpen(false); setCheckoutStep('details'); }}
                  className="w-full h-12 text-sm font-bold opacity-60 active:scale-95"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : checkoutStep === 'payment' ? (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-10 duration-500">
               {/* URGENCY TIMER BAR */}
               <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-4 flex items-center justify-center gap-3">
                 <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />
                 <span className="text-sm font-bold text-yellow-500">
                   Horário reservado por {formatTime(timeLeft)}
                 </span>
               </div>

               <div className="p-6 space-y-8 flex-1 overflow-y-auto no-scrollbar pb-10">
                 {/* SUMMARY COMPACT */}
                 <div className="space-y-2">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-40">Resumo do Pagamento ({paymentTiming === 'half' ? '50% Sinal' : '100%'})</p>
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl" style={{ borderRadius: t.radius }}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-sm leading-tight">{selectedService?.name}</p>
                            <p className="text-[10px] opacity-60 font-medium">{date ? format(date, "EE, d 'de' MMM", { locale: ptBR }) : ""} às {time}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-primary">
                            R${(paymentTiming === 'half' ? Number(selectedService?.price || 0) / 2 : Number(selectedService?.price || 0)).toFixed(2)}
                          </p>
                        </div>
                    </div>
                 </div>

                 {/* PAYMENT METHODS */}
                 <div className="space-y-4">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-40">Forma de Pagamento</p>
                    <div className="flex flex-wrap items-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
                      {(!business.payment_methods || (Array.isArray(business.payment_methods) && business.payment_methods.includes('pix'))) && (
                        <button 
                          onClick={() => setPaymentMethod('pix')}
                          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${paymentMethod === 'pix' ? 'bg-primary text-white shadow-lg' : 'opacity-60'}`}
                        >
                          <span className="text-xs">💠</span> Pix
                        </button>
                      )}
                      {(!business.payment_methods || (Array.isArray(business.payment_methods) && business.payment_methods.includes('credit_card'))) && (
                        <button 
                          onClick={() => setPaymentMethod('card')}
                          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${paymentMethod === 'card' ? 'bg-primary text-white shadow-lg' : 'opacity-60'}`}
                        >
                           Cartão
                        </button>
                      )}
                    </div>

                    {paymentMethod === 'pix' ? (
                      <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                        <div className="bg-white p-6 rounded-3xl flex flex-col items-center gap-4 border border-white/20">
                          {business.pix_key ? (
                            <>
                              <div className="w-48 h-48 bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-primary/20">
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=00020126360014BR.GOV.BCB.PIX0114${business.pix_key}5204000053039865405${(paymentTiming === 'half' ? Number(selectedService?.price || 0) / 2 : Number(selectedService?.price || 0)).toFixed(2)}5802BR5915${(business?.name || "").replace(/ /g, "")}6009SaoPaulo62070503***6304AD0E`} 
                                  alt="QR Code Pix" 
                                  loading="lazy" 
                                  decoding="async" 
                                  className="w-40 h-40" 
                                />
                              </div>
                              <div className="text-center space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#000]">Escaneie o QR Code acima</p>
                                <p className="text-[10px] font-medium text-[#000]/60">Chave Pix: <span className="font-bold">{business.pix_key}</span></p>
                                <p className="text-[10px] font-medium text-[#000]/40">ou copie o código abaixo</p>
                              </div>
                            </>
                          ) : (
                            <div className="text-center space-y-2 py-4">
                              <p className="text-sm font-bold text-black text-center">Chave Pix não configurada</p>
                              <p className="text-xs text-black/60">Por favor, entre em contato com o estabelecimento ou peça para configurarem a chave Pix no painel.</p>
                            </div>
                          )}
                        </div>

                        {business.pix_key && (
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`00020126360014BR.GOV.BCB.PIX0114${business.pix_key}5204000053039865405${(paymentTiming === 'half' ? Number(selectedService?.price || 0) / 2 : Number(selectedService?.price || 0)).toFixed(2)}5802BR5915${(business?.name || "").replace(/ /g, "")}6009SaoPaulo62070503***6304AD0E`);
                              toast({ title: "Código copiado!", description: "Agora cole no seu app do banco." });
                            }}
                            className="w-full h-16 flex items-center justify-center gap-3 text-sm font-black border border-primary/30 active:scale-95 transition-all text-primary bg-primary/5 uppercase tracking-widest" 
                            style={{ borderRadius: t.radius }}
                          >
                             Copiar código Pix <ChevronLeft className="w-4 h-4 rotate-180" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 bg-white/5 border border-white/10 rounded-3xl text-center space-y-6 animate-in fade-in slide-in-from-top-4">
                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                           <Clock className="w-8 h-8 text-primary" />
                        </div>
                        <div className="space-y-2">
                           <h4 className="font-bold">Pagamento Online indispovível</h4>
                           <p className="text-xs opacity-60">O pagamento por cartão está temporariamente indisponível. Por favor, utilize o Pix para confirmar agora.</p>
                        </div>
                        <button 
                          onClick={() => setPaymentMethod('pix')}
                          className="px-6 py-3 text-xs font-black bg-primary text-white uppercase tracking-widest"
                          style={{ borderRadius: t.radius }}
                        >
                          Usar o Pix
                        </button>
                      </div>
                    )}
                 </div>

                 {/* TRUST & CTAs */}
                 <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-2xl border border-white/10">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-500" />
                        </div>
                        <div className="leading-tight">
                          <p className="text-[10px] font-black uppercase">Seguro</p>
                          <p className="text-[10px] opacity-50">Criptografia SSL</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-2xl border border-white/10">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <ArrowRight className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="leading-tight">
                          <p className="text-[10px] font-black uppercase">Cancelável</p>
                          <p className="text-[10px] opacity-50">Até {business?.cancel_window_hours || 24}h antes</p>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => setCheckoutStep('success')}
                      className="w-full h-20 text-xl font-black bg-white text-[#000] border-2 border-white transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3 overflow-hidden group"
                      style={{ borderRadius: t.radius }}
                    >
                      JÁ REALIZEI O PAGAMENTO
                    </button>

                    <button 
                      onClick={() => setCheckoutStep('details')}
                      className="w-full py-2 text-xs font-bold opacity-30 hover:opacity-100 transition-opacity"
                    >
                      Voltar e revisar detalhes
                    </button>
                 </div>
               </div>
            </div>
          ) : (
            <div className="flex flex-col h-full max-h-[85vh] overflow-y-auto no-scrollbar pb-10">
              {/* ─── UNIFIED FLOW ─── */}
              <div className="px-5 py-6 space-y-10">
                
                {/* 1. SELEÇÃO DE SERVIÇO */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black text-sm">1</div>
                        <h3 className="text-xl font-black" style={{ fontFamily: t.fontHeading }}>Serviço</h3>
                     </div>
                     {selectedService && (
                       <button onClick={() => { setSelectedService(null); setTime(null); }} className="text-xs font-bold text-primary px-3 py-1 bg-primary/10 rounded-full">Alterar</button>
                     )}
                  </div>
                  
                  {!selectedService ? (
                    <div className="grid grid-cols-1 gap-2">
                        {services.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedService(s)}
                            className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 hover:border-primary/50 transition-all active:scale-[0.98]"
                            style={{ borderRadius: t.radius }}
                          >
                            <div className="w-12 h-12 rounded-lg bg-white/10 shrink-0 overflow-hidden hidden sm:block">
                              {s.image_url ? (
                                <img src={s.image_url} alt={s.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center p-2">
                                  <Calendar className="w-6 h-6 opacity-40" />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-start gap-1 flex-1 text-left">
                              <span className="font-bold">{s.name}</span>
                              <span className="text-[10px] opacity-60 flex items-center gap-1"><Clock className="w-3 h-3" /> {s.duration || s.duration_minutes} min</span>
                            </div>
                            <span className="font-black text-primary">R${Number(s.price).toFixed(0)}</span>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-primary text-white rounded-2xl flex items-center justify-between shadow-lg animate-in zoom-in-95" style={{ borderRadius: t.radius }}>
                         <div>
                           <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Selecionado</p>
                           <p className="text-lg font-black">{selectedService.name}</p>
                         </div>
                         <Check className="w-6 h-6" />
                      </div>
                      
                      {/* UPSELL SECTION */}
                      {services.filter(s => s.id !== selectedService.id).length > 0 && (
                        <div className="bg-white/5 border border-white/10 p-4 animate-in slide-in-from-top-4" style={{ borderRadius: t.radius }}>
                          <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                             <Sparkles className="w-4 h-4 text-primary" />
                             Aproveite e adicione também:
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                             {services.filter(s => s.id !== selectedService.id).map(s => {
                               const isSelected = additionalServices.some(as => as.id === s.id);
                               return (
                                 <button
                                   key={s.id}
                                   onClick={() => toggleAdditionalService(s)}
                                   className={`flex items-center justify-between p-3 border transition-all text-left ${isSelected ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/30'}`}
                                   style={{ borderRadius: t.radius }}
                                 >
                                   <div className="flex flex-col">
                                     <span className="font-bold text-sm">{s.name}</span>
                                     <span className="text-[10px] opacity-60">+{s.duration || s.duration_minutes} min</span>
                                   </div>
                                   <div className="flex items-center gap-3">
                                     <span className="font-black text-sm text-primary">R${Number(s.price).toFixed(0)}</span>
                                     <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary border-primary text-white' : 'border-white/30'}`}>
                                       {isSelected && <Check className="w-3 h-3" />}
                                     </div>
                                   </div>
                                 </button>
                               );
                             })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* 2. SELEÇÃO DE PROFISSIONAL */}
                <section id="step-professional" className={`space-y-4 transition-opacity duration-300 ${!selectedService ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black text-sm">2</div>
                        <h3 className="text-xl font-black" style={{ fontFamily: t.fontHeading }}>Profissional</h3>
                     </div>
                     {selectedProfessional && (
                       <button onClick={() => { setSelectedProfessional(null); setTime(null); }} className="text-xs font-bold text-primary px-3 py-1 bg-primary/10 rounded-full">Alterar</button>
                     )}
                  </div>

                  {!selectedProfessional ? (
                    <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar -mx-5 px-5">
                       {professionals.length > 1 && (
                         <button
                           onClick={() => {
                              // Seleciona um aleatoriamente para balanceamento (Automático)
                              const autoAssign = professionals[Math.floor(Math.random() * professionals.length)];
                              setSelectedProfessional(autoAssign);
                           }}
                           className="flex-shrink-0 w-32 flex flex-col items-center gap-2"
                         >
                           <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30 flex items-center justify-center group active:scale-95 transition-all text-primary bg-primary/10">
                             <Sparkles className="w-8 h-8" />
                           </div>
                           <span className="text-sm font-bold text-center text-primary line-clamp-1">Automático</span>
                         </button>
                       )}
                       {professionals.map((p) => (
                         <button
                           key={p.id}
                           onClick={() => setSelectedProfessional(p)}
                           className="flex-shrink-0 w-32 flex flex-col items-center gap-2"
                         >
                           <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 group active:scale-95 transition-all">
                             {p.avatar_url ? (
                               <img src={p.avatar_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                             ) : (
                               <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random&size=128`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                             )}
                             <Watermark slug={slug} className="opacity-0 group-hover:opacity-100" />
                           </div>
                           <span className="text-sm font-bold text-center line-clamp-1">{p.name}</span>
                         </button>
                       ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-primary text-white rounded-2xl flex items-center gap-4 shadow-lg animate-in zoom-in-95" style={{ borderRadius: t.radius }}>
                       <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 shrink-0">
                          {selectedProfessional.avatar_url ? (
                            <img src={selectedProfessional.avatar_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedProfessional.name)}&background=random`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          )}
                       </div>
                       <div className="flex-1">
                         <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Atendimento com</p>
                         <p className="text-lg font-black">{selectedProfessional.name}</p>
                       </div>
                       <Check className="w-6 h-6" />
                    </div>
                  )}
                </section>

                {/* 3. DATA E HORÁRIO */}
                <section id="step-datetime" className={`space-y-6 transition-opacity duration-300 ${!selectedProfessional ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black text-sm">3</div>
                        <h3 className="text-xl font-black" style={{ fontFamily: t.fontHeading }}>Data e Horário</h3>
                     </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-2 rounded-3xl bg-white/5 border border-white/10">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => { setDate(d); setTime(null); }}
                        locale={ptBR}
                        className="scale-100 mx-auto"
                        disabled={(d) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          
                          if (d < today) return true;
                          
                          // Check exceptions
                          if (selectedProfessional?.exceptions && Array.isArray(selectedProfessional.exceptions)) {
                             const dateStr = format(d, "yyyy-MM-dd");
                             const hasOff = selectedProfessional.exceptions.some(ex => ex.date === dateStr && ex.type === 'off');
                             if (hasOff) return true;
                             const hasAvailable = selectedProfessional.exceptions.some(ex => ex.date === dateStr && ex.type === 'available');
                             if (hasAvailable) return false;
                          }

                          const dayOfWeek = d.getDay();
                          if (selectedProfessional?.working_days && Array.isArray(selectedProfessional.working_days)) {
                            return !selectedProfessional.working_days.includes(dayOfWeek);
                          }
                          // Fallback if not set: Assuming Sunday (0) is disabled
                          return dayOfWeek === 0;
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                       {availableSlots.length > 0 ? (
                         availableSlots.map((s: any) => {
                           const isSpecial = s.score > 40 || s.isDiscounted;
                           return (
                             <button
                               key={s.time}
                               onClick={() => setTime(s.time)}
                               className={`group relative h-16 flex flex-col items-center justify-center transition-all active:scale-95 border overflow-hidden ${isSpecial ? 'border-primary/40 shadow-[0px_0px_10px_rgba(255,255,255,0.05)]' : 'border-white/5'}`}
                               style={{ 
                                 backgroundColor: time === s.time ? t.primary : t.secondary + "40",
                                 color: time === s.time ? "#fff" : t.text,
                                 borderRadius: t.radius 
                               }}
                             >
                                {isSpecial && time !== s.time && (
                                  <div className="absolute inset-0 opacity-20 bg-gradient-to-tr from-primary to-transparent animate-pulse pointer-events-none" />
                                )}
                                
                                {(s.label || s.isDiscounted) && (
                                  <span className={`absolute top-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter transition-colors ${s.isDiscounted ? 'bg-green-500/20 text-green-500' : 'bg-primary/20 text-primary group-hover:bg-primary group-hover:text-white'}`}>
                                    {s.isDiscounted ? `-${s.discountPercentage}%` : <><Sparkles className="w-2 h-2" /> {s.label}</>}
                                  </span>
                                )}
                                <span className="text-sm font-bold z-10">{s.time}</span>
                                {s.score > 40 && (
                                  <span className="text-[9px] opacity-80 font-bold -mt-1 text-primary z-10 flex items-center gap-1">
                                    <Sparkles className="w-2 h-2" /> Sugestão IA
                                  </span>
                                )}
                             </button>
                           );
                         })
                       ) : (
                         <div className="col-span-full py-6 text-center text-xs opacity-40">Nenhum horário disponível</div>
                       )}
                    </div>
                  </div>
                </section>

                {/* 4. FORMULÁRIO FINAL */}
                <section id="step-form" className={`space-y-6 transition-opacity duration-300 ${!time ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black text-sm">4</div>
                      <h3 className="text-xl font-black" style={{ fontFamily: t.fontHeading }}>Seus Dados</h3>
                   </div>

                   <div className="space-y-4">
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Nome Completo"
                          className="w-full h-16 px-5 bg-white/5 border border-white/10 outline-none focus:border-primary transition-all text-lg font-bold"
                          style={{ borderRadius: t.radius }}
                        />
                      </div>
                      <div className="space-y-2">
                        <input
                          type="tel"
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            if (val.length <= 11) {
                              setPhone(val);
                            }
                          }}
                          placeholder="WhatsApp (ex: 11999999999)"
                          className="w-full h-16 px-5 bg-white/5 border border-white/10 outline-none focus:border-primary transition-all text-lg font-bold"
                          style={{ borderRadius: t.radius }}
                        />
                        <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest px-1">Somente números, com DDD</p>
                      </div>
                   </div>

                   <div className="space-y-4 pt-4 border-t border-white/10">
                      <h4 className="text-sm font-bold opacity-80" style={{ color: t.text }}>Repetir este agendamento (Opcional)</h4>
                      <div className="grid grid-cols-2 gap-2">
                         {[
                           { value: null, label: 'Não repetir' },
                           { value: 'weekly', label: 'Toda Semana (4 vzs)' },
                           { value: 'biweekly', label: 'A cada 15 dias (4 vzs)' },
                           { value: 'monthly', label: 'Todo Mês (12 vzs)' }
                         ].map(r => (
                           <button
                             key={r.value || 'none'}
                             onClick={() => setRecurrence(r.value)}
                             className={`h-12 border text-xs font-bold transition-all ${recurrence === r.value ? 'shadow-[0px_0px_10px_rgba(255,255,255,0.05)]' : 'border-white/5 opacity-60'}`}
                             style={{ 
                               backgroundColor: recurrence === r.value ? t.primary : "transparent",
                               color: recurrence === r.value ? "#ffffff" : t.text,
                               borderColor: recurrence === r.value ? 'transparent' : 'rgba(255,255,255,0.05)',
                               borderRadius: t.radius 
                             }}
                           >
                             {r.label}
                           </button>
                         ))}
                      </div>
                   </div>

                   {business.enable_payment_setup && Array.isArray(business.payment_timings) && business.payment_timings.length > 0 && (
                     <div className="space-y-4 pt-4 border-t border-white/10">
                        <h4 className="text-sm font-bold opacity-80" style={{ color: t.text }}>Como você prefere pagar?</h4>
                        <div className="grid gap-2">
                           {business.payment_timings.map(timing => (
                              <button
                                key={timing}
                                onClick={() => setPaymentTiming(timing)}
                                className={`p-4 text-left flex items-center justify-between transition-all border ${paymentTiming === timing ? 'border-primary shadow-lg' : 'border-white/10 opacity-60'}`}
                                style={{ 
                                  backgroundColor: paymentTiming === timing ? t.primary + '11' : t.secondary + '40',
                                  borderRadius: t.radius 
                                }}
                              >
                                <div>
                                  <span className="block font-bold text-sm" style={{ color: paymentTiming === timing ? t.primary : t.text }}>
                                    {timing === 'full' ? 'Pagar 100% online agora' : timing === 'half' ? 'Pagar 50% agora (Sinal)' : 'Pagar 100% no local'}
                                  </span>
                                  {timing === 'half' && <span className="text-[10px] sm:text-xs opacity-60 mt-1 block">Garante sua reserva. O restante (50%) é pago no local.</span>}
                                  {timing === 'full' && <span className="text-[10px] sm:text-xs opacity-60 mt-1 block">Mais praticidade no dia do serviço. Agiliza seu atendimento.</span>}
                                </div>
                                {paymentTiming === timing && <Check className="w-5 h-5 flex-shrink-0" style={{ color: t.primary }} />}
                              </button>
                           ))}
                        </div>
                     </div>
                   )}

                   <button
                     onClick={handleBook}
                     disabled={bookMutation.isPending || bookMutation.isSuccess || name.length < 3 || phone.length < 10 || !time}
                     className="w-full h-20 text-xl font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                     style={{ backgroundColor: t.primary, color: "#fff", borderRadius: t.radius }}
                   >
                     {bookMutation.isPending ? (
                       <>
                         <Loader2 className="w-8 h-8 animate-spin" />
                         <span>PROCESSANDO...</span>
                       </>
                     ) : bookMutation.isSuccess ? (
                       <>
                         <Check className="w-8 h-8 animate-in zoom-in spin-in-180 duration-300" />
                         <span className="animate-in fade-in slide-in-from-right-4 duration-300">CONCLUÍDO!</span>
                       </>
                     ) : (
                       <>
                         <span>RESERVAR HORÁRIO</span>
                         <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                       </>
                     )}
                   </button>
                   <p className="text-center text-[10px] opacity-30 px-6 uppercase tracking-widest font-black">
                     RÁPIDO • SEGURO • SEM CUSTO
                   </p>
                </section>
              </div>
            </div>
          )}
        </div>
      </ResponsiveModal>

      {/* ─── SOCIAL PROOF FLOATING TOAST ─── */}
      {activeToast && (
        <div 
          className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-50 animate-in slide-in-from-right-8 fade-in duration-500 max-w-sm pointer-events-none"
        >
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 shadow-2xl flex items-start gap-4 transform transition-all hover:scale-105" style={{ borderRadius: t.radius || '16px' }}>
             <div className="w-10 h-10 rounded-full bg-primary/20 flex flex-shrink-0 items-center justify-center border border-primary/30">
               <span className="text-primary font-bold text-lg">{activeToast.name.charAt(0)}</span>
             </div>
             <div className="flex-1">
               <p className="text-sm font-medium text-white leading-tight">
                 <span className="font-black">{activeToast.name}</span> acabou de agendar <span className="font-bold text-primary">{activeToast.serviceName}</span>.
               </p>
               <div className="flex items-center gap-1 mt-1 opacity-60">
                 <Clock className="w-3 h-3" />
                 <span className="text-[10px] uppercase font-bold tracking-widest">{activeToast.time}</span>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Floating Theme Switcher for Demo */}
      {slug === "demo" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#0F0F23]/90 backdrop-blur-md border border-white/10 rounded-full py-2 px-4 flex items-center justify-center gap-2 shadow-2xl z-50 overflow-x-auto max-w-[90vw] touch-pan-x">
          <span className="text-xs font-bold text-white/50 uppercase tracking-widest mr-2 flex-shrink-0">Temas</span>
          {PRESET_THEMES.map((theme) => {
            const isActive = searchParams.get("theme") === theme.id || (!searchParams.get("theme") && theme.id === "dark-luxury");
            return (
              <button
                key={theme.id}
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set("theme", theme.id);
                  setSearchParams(newParams);
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all flex-shrink-0 focus:outline-none ${isActive ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0F0F23]' : 'opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: theme.primary_color }}
                title={theme.name}
              >
                {theme.emoji}
              </button>
            )
          })}
        </div>
      )}
    </div>
  );
};

export default BookingPage;
