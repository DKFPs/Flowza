
import { useState, useEffect } from "react";
import { Check, Sparkles, Zap, Rocket, Crown, Star, Shield, Clock, Target, Ticket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PLANS, PlanId } from "@/lib/plans";
import { useBusiness } from "@/contexts/BusinessContext";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { DiscountService, UserOffer, Discount } from "@/services/discountService";
import { StripeService } from "@/services/stripeService";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

const trackEvent = async (name: string, data: Record<string, unknown>) => {
  try {
    const response = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
         level: "info",
         event: name,
         type: "business_metric",
         user_id: data?.user_id || "anonymous",
         business_id: data?.business_id || "system",
         status: "success",
         metadata: data
      })
    });
    if (!response.ok) {
      console.error("Error tracking event via api/log");
    }
  } catch (e) {
    console.error("Error tracking event:", e);
  }
};

export default function SubscriptionPlans() {
  const { business } = useBusiness();
  const { user } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annually">("monthly");
  const [activeDiscount, setActiveDiscount] = useState<{ type: string; value: number; code: string } | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [enableAnnualPlan, setEnableAnnualPlan] = useState<boolean>(true);

  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const docRef = await getDoc(doc(db, "platform_settings", "global"));
        if (docRef.exists()) {
           if (docRef.data().enable_annual_plan !== undefined) {
             setEnableAnnualPlan(docRef.data().enable_annual_plan);
           }
        }
      } catch (err) {
        console.error("Failed to load global platform settings", err);
      }
    };
    fetchGlobalSettings();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    trackEvent("pricing_page_view", { business_id: business?.id, user_id: user.uid });
    
    const params = new URLSearchParams(window.location.search);
    const urlCoupon = params.get("coupon");

    if (params.get("success")) {
      toast({ title: "Sucesso!", description: "Sua assinatura foi processada com sucesso. Em breve seus limites serão atualizados.", variant: "default" });
    } else if (params.get("cancel")) {
      toast({ title: "Cancelado", description: "O processo de checkout foi cancelado.", variant: "destructive" });
    }

    if (urlCoupon) {
      setCouponInput(urlCoupon);
    }
  }, [business?.id, user]);

  const handleApplyCoupon = async () => {
    if (!couponInput) return;
    setIsValidating(true);
    const discount = await DiscountService.validateCoupon(couponInput);
    setIsValidating(false);

    if (discount) {
      setActiveDiscount({ type: discount.type, value: discount.value, code: discount.code });
      toast({ title: "Cupom aplicado!", description: `Desconto de ${discount.value}${discount.type === 'percentage' ? '%' : ' R$'} ativado.` });
      trackEvent("coupon_applied", { code: discount.code, user_id: user?.uid });
    } else {
      toast({ title: "Cupom inválido", description: "O código informado expirou ou não existe.", variant: "destructive" });
    }
  };

  const calculatePrice = (basePrice: number) => {
    let price = basePrice;
    if (billingPeriod === "annually") {
      price = (basePrice * 10) / 12; // 2 meses grátis
    }
    
    if (activeDiscount && price > 0) {
      if (activeDiscount.type === "percentage") {
        price = price * (1 - activeDiscount.value / 100);
      } else {
        price = Math.max(0, price - activeDiscount.value);
      }
    }
    
    return price.toFixed(2);
  };

  const handleSelectPlan = async (planId: PlanId) => {
    if (business?.plan_id === planId) {
      toast({ title: "Plano Atual", description: `Você já está utilizando o plano ${PLANS[planId].name}.` });
      return;
    }

    const plan = PLANS[planId];
    const priceId = billingPeriod === "annually" ? plan.stripePriceIdAnnually : plan.stripePriceIdMonthly;

    if (!priceId) {
      toast({ title: "Erro", description: "Este plano ainda não está configurado para pagamentos.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    trackEvent("plan_click", { plan_id: planId, billing_period: billingPeriod, business_id: business?.id });
    
    try {
      const { url } = await StripeService.createCheckoutSession({
        priceId,
        customerEmail: user?.email || undefined,
        discountCode: activeDiscount?.code,
        businessId: business?.id,
        planId: planId,
      });

      if (url) {
        // Open Stripe Checkout in a new tab because Stripe cannot be embedded in an iframe (which is how this AI preview works).
        window.open(url, '_blank');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível iniciar o checkout. Tente novamente mais tarde.";
      toast({ 
        title: "Erro no Checkout", 
        description: message, 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const FAQS = [
    {
      q: "Posso cancelar a qualquer momento?",
      a: "Sim, você pode cancelar sua assinatura quando desejar sem fidelidade (exceto no plano anual que tem renovação anual)."
    },
    {
      q: "Como funcionam os lembretes?",
      a: "O sistema envia notificações automáticas para seus clientes via WhatsApp e E-mail para reduzir faltas."
    },
    {
      q: "Preciso baixar algum app?",
      a: "Não! O sistema é 100% online e responsivo, funcionando perfeitamente em qualquer dispositivo via navegador."
    }
  ];

  return (
    <div className="container py-10 space-y-12 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold tracking-tight sm:text-5xl"
        >
          Escolha o plano ideal para o seu negócio
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-muted-foreground"
        >
          Comece grátis, evolua conforme seus clientes aumentam e automatize sua agenda.
        </motion.p>
      </div>

      {/* Discount Banner */}
      {activeDiscount && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto"
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-full">
              <Star className="w-5 h-5 fill-current" />
            </div>
            <div>
              <p className="font-semibold text-primary">Oferta Especial de Ativação!</p>
              <p className="text-sm text-muted-foreground">Use o cupom <span className="font-bold underline">{activeDiscount.code}</span> e ganhe {activeDiscount.value}% OFF no primeiro mês.</p>
            </div>
          </div>
          <Badge variant="outline" className="text-primary border-primary animate-pulse py-1 px-3">
            Expira em 24h
          </Badge>
        </motion.div>
      )}

      {/* Billing Toggle */}
      {enableAnnualPlan && Object.values(PLANS).some(plan => plan.stripePriceIdAnnually) && (
        <div className="flex items-center justify-center gap-4">
          <Label className={cn(billingPeriod === "monthly" ? "text-foreground font-bold" : "text-muted-foreground")}>Mensal</Label>
          <Switch 
            checked={billingPeriod === "annually"}
            onCheckedChange={(checked) => setBillingPeriod(checked ? "annually" : "monthly")}
          />
          <div className="flex items-center gap-2">
            <Label className={cn(billingPeriod === "annually" ? "text-foreground font-bold" : "text-muted-foreground")}>Anual</Label>
            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
              2 meses grátis
            </Badge>
          </div>
        </div>
      )}

      {/* Coupon Input */}
      {!activeDiscount && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-md mx-auto w-full"
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Tem um cupom? Digite aqui" 
                className="pl-10 h-10"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              />
            </div>
            <Button 
              variant="outline" 
              onClick={handleApplyCoupon} 
              disabled={isValidating || !couponInput}
              className="h-10"
            >
              Aplicar
            </Button>
          </div>
        </motion.div>
      )}

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.values(PLANS).map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={cn(
              "relative flex flex-col h-full border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
              plan.isRecommended ? "border-primary shadow-lg scale-105 z-10 animate-soft-pulse hover:shadow-primary/20" : "border-border shadow-sm hover:border-primary/50"
            )}>
              {plan.isRecommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1 font-bold">
                    MAIS ESCOLHIDO
                  </Badge>
                </div>
              )}
              
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {plan.id === PlanId.FREE && <Target className="w-5 h-5" />}
                    {plan.id === PlanId.PRO && <Zap className="w-5 h-5" />}
                    {plan.id === PlanId.BUSINESS && <Rocket className="w-5 h-5" />}
                    {plan.id === PlanId.PREMIUM && <Crown className="w-5 h-5" />}
                  </div>
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  {plan.id === PlanId.FREE && "Comece grátis e teste o sistema"}
                  {plan.id === PlanId.PRO && "Pare de perder clientes por falta de organização"}
                  {plan.id === PlanId.BUSINESS && "Automatize e faça seu negócio crescer"}
                  {plan.id === PlanId.PREMIUM && "Escala e controle total do seu negócio"}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1 space-y-6">
                <div className="space-y-1">
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={`${billingPeriod}-${activeDiscount?.code}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex flex-col"
                    >
                      {activeDiscount && plan.price > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground line-through text-lg">
                              R$ {billingPeriod === 'annually' ? ((plan.price * 10)/12).toFixed(2) : plan.price.toFixed(2)}
                            </span>
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs font-bold py-0.5">
                              -{activeDiscount.value}{activeDiscount.type === 'percentage' ? '%' : ' OFF'}
                            </Badge>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-extrabold text-primary drop-shadow-sm">
                              R$ {calculatePrice(plan.price)}
                            </span>
                            <span className="text-muted-foreground font-medium text-sm">/mês</span>
                          </div>
                          <p className="text-[10px] text-green-600 font-bold animate-pulse">CUPOM {activeDiscount.code} APLICADO</p>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold">R$ {calculatePrice(plan.price)}</span>
                          <span className="text-muted-foreground font-medium text-sm">/mês</span>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                  
                  {billingPeriod === "annually" && plan.price > 0 && (
                    <p className="text-xs text-muted-foreground font-medium">Cobrado anualmente</p>
                  )}
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {"Agendamentos Ilimitados"}
                  </div>
                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{plan.limits.professionalsLimit === 999 ? "Equipe ilimitada" : `Até ${plan.limits.professionalsLimit} profissional`}</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{plan.limits.multiUnit ? "Múltiplas unidades" : "1 Unidade"}</span>
                    </li>
                    {plan.limits.automation !== "none" && (
                      <li className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span>Lembretes automáticos</span>
                      </li>
                    )}
                    {plan.limits.reviews && (
                      <li className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span>Programa de fidelidade</span>
                      </li>
                    )}
                    {plan.limits.analytics !== "none" && (
                      <li className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span>Relatórios avançados</span>
                      </li>
                    )}
                  </ul>
                </div>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className={cn("w-full py-6 text-lg font-bold transition-all", plan.isRecommended ? "scale-100 shadow-md" : "")}
                  variant={plan.isRecommended ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan.id as PlanId)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {business?.plan_id === plan.id ? "Plano Atual" : "Assinar Plano"}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Features Showcase */}
      <div className="bg-muted/30 rounded-3xl p-8 lg:p-12 space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Tudo que você precisa em um só lugar</h2>
          <p className="text-muted-foreground">Ferramentas poderosas desenhadas para o seu crescimento.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3 bg-background p-6 rounded-2xl shadow-sm">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl">Agenda 24/7</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Seus clientes agendam sozinhos, mesmo quando você está dormindo ou atendendo.</p>
          </div>
          <div className="space-y-3 bg-background p-6 rounded-2xl shadow-sm">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl">Menos Faltas</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Lembretes inteligentes via WhatsApp reduzem o "no-show" em até 40%.</p>
          </div>
          <div className="space-y-3 bg-background p-6 rounded-2xl shadow-sm">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl">Retenção de Clientes</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Mantenha seus clientes fiéis com programas de pontos e ofertas exclusivas.</p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto space-y-8">
        <h2 className="text-3xl font-bold text-center">Dúvidas Frequentes</h2>
        <div className="grid gap-4">
          {FAQS.map((faq, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-lg">{faq.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-primary text-primary-foreground rounded-3xl p-10 lg:p-16 text-center space-y-6">
        <h2 className="text-3xl lg:text-5xl font-bold">Pronto para transformar seu negócio?</h2>
        <p className="text-primary-foreground/80 max-w-2xl mx-auto text-lg lg:text-xl">
          Junte-se a milhares de empreendedores que já automatizaram sua agenda e estão lucrando mais.
        </p>
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" variant="secondary" className="px-10 py-7 text-xl font-bold h-auto rounded-full w-full sm:w-auto shadow-xl">
            Começar Gratuitamente
          </Button>
          <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/30 hover:bg-white/10 px-10 py-7 text-lg font-semibold h-auto rounded-full w-full sm:w-auto">
            Falar com Consultor
          </Button>
        </div>
      </div>
    </div>
  );
}
