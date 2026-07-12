import { Link } from "react-router-dom";
import { Calendar, Users, BarChart3, Zap, Shield, Globe, Check, Sparkles, Rocket, Crown, Ticket, Star, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";

const features = [
    { icon: Calendar, title: "Agenda de Alta Performance", desc: "Processo de reserva otimizado para conversão instantânea. Transforme visitantes em lucro bruto." },
    { icon: Zap, title: "Automação Implacável", desc: "Lembretes e sequências de e-mail/WhatsApp que garantem 98% de presença sem esforço manual." },
    { icon: Shield, title: "LTV Exponencial", desc: "Mantenha o cliente fiel com réguas de relacionamento que fazem ele comprar mais vezes de você." },
    { icon: Users, title: "IA de Recuperação", desc: "O sistema identifica clientes esfriando e envia propostas personalizadas para retomar o fluxo de caixa." },
    { icon: BarChart3, title: "Painel de Crescimento", desc: "Métricas claras de CAC, LTV e ROI. Saiba exatamente onde investir para dobrar seu negócio." },
    { icon: Globe, title: "Autoridade Digital Flowza", desc: "Uma presença online de elite que eleva sua percepção de valor e justifica preços maiores." },
];

const testimonials = [
  {
    name: "Mariana Costa",
    role: "Proprietária do Studio Beauty & Co",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    text: "Minhas faltas caíram de 18% para quase zero. O disparo automático do WhatsApp é surreal de prático e mudou completamente meu faturamento mensal.",
    rating: 5,
    location: "São Paulo, SP"
  },
  {
    name: "Dr. Roberto Martins",
    role: "Diretor da Clínica Martins Odontologia",
    image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150",
    text: "O Flowza organiza toda a agenda de médicos e salas sem nenhum conflito. Além de economizar tempo de recepção, nossos pacientes elogiam a facilidade do agendamento.",
    rating: 5,
    location: "Belo Horizonte, MG"
  },
  {
    name: "Felipe Almeida",
    role: "Fundador da Barbearia OldSchool",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    text: "Usei o cupom START30, montei minha página em 15 minutos e no primeiro dia já recebi 12 agendamentos sem precisar atender nenhuma ligação. Absurdo!",
    rating: 5,
    location: "Curitiba, PR"
  },
  {
    name: "Gabriela Mendes",
    role: "Personal Trainer & Coach",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    text: "O sistema de planos e recorrência do Flowza automatizou a cobrança dos meus alunos de consultoria. Recomendo de olhos fechados para prestadores de serviço.",
    rating: 5,
    location: "Rio de Janeiro, RJ"
  }
];

const Landing = () => {
  const { user, role, loading: authLoading } = useAuth();
  const dashboardUrl = role === "client" ? "/client" : "/dashboard";

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <span className="font-heading text-xl font-bold text-foreground">
            Flowza<span className="text-primary">.</span>
          </span>
          <div className="hidden md:flex items-center gap-8 mx-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Funcionalidades</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Preços</a>
            <Link to="/b/demo" className="text-sm font-medium text-green-600 dark:text-green-500 hover:text-green-700 transition-colors flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Ver Demonstração
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {authLoading ? (
              <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
            ) : user ? (
              <Link to={dashboardUrl}>
                <Button size="sm" variant="premium">Ir para o Painel</Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">Entrar</Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button size="sm">Começar agora</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Side-by-side Badges */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 mb-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 px-4 py-2 rounded-full text-xs font-bold border border-green-500/20 shadow-sm"
            >
              <Ticket className="w-4 h-4" /> Use o cupom <span className="underline decoration-2 underline-offset-2 tracking-wider text-green-400 font-extrabold">START30</span> para 30% OFF
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-xs font-medium border border-primary/20 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-primary" /> A máquina automática de faturamento
            </motion.div>
          </div>

          <h1 className="text-4xl md:text-7xl font-bold text-foreground leading-tight mb-6 tracking-tighter">
            Pare de perder clientes.<br />
            <span className="text-primary bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">Automatize e cresça no piloto automático.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed border-l-4 border-primary/40 pl-4 py-1 text-left sm:text-center sm:border-0 sm:pl-0 sm:py-0 font-medium">
            Agendamento inteligente, automações e fidelização — tudo em um só lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
            {authLoading ? (
              <div className="h-14 w-40 bg-muted animate-pulse rounded-xl" />
            ) : user ? (
              <div className="relative w-full sm:w-auto group">
                {/* Glowing beacon backdrop rings */}
                <motion.div
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-purple-400 opacity-40 blur-xl"
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                
                {/* Subtle ripple wave */}
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-primary/40"
                  animate={{
                    scale: [1, 1.25],
                    opacity: [0.8, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />

                <Link to={dashboardUrl} className="relative block w-full sm:w-auto">
                  <motion.div
                    animate={{
                      scale: [1, 1.02, 1],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full sm:w-auto"
                  >
                    <Button 
                      variant="premium" 
                      size="lg" 
                      className="text-base px-10 h-14 shadow-2xl shadow-primary/40 w-full font-bold relative overflow-hidden"
                    >
                      <motion.div
                        className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                        initial={{ left: "-100%" }}
                        animate={{ left: "200%" }}
                        transition={{
                          duration: 2.2,
                          repeat: Infinity,
                          repeatDelay: 2.5,
                          ease: "easeInOut",
                        }}
                      />
                      Acessar meu Dashboard
                    </Button>
                  </motion.div>
                </Link>
              </div>
            ) : (
              <div className="relative w-full sm:w-auto group">
                {/* Glowing beacon backdrop rings */}
                <motion.div
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-purple-400 opacity-40 blur-xl"
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                
                {/* Subtle ripple wave */}
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-primary/40"
                  animate={{
                    scale: [1, 1.25],
                    opacity: [0.8, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />

                <Link to="/auth?mode=signup&coupon=START30" className="relative block w-full sm:w-auto">
                  <motion.div
                    animate={{
                      scale: [1, 1.02, 1],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full sm:w-auto"
                  >
                    <Button 
                      variant="premium" 
                      size="lg" 
                      className="text-base px-10 h-14 shadow-2xl shadow-primary/40 w-full font-bold relative overflow-hidden"
                    >
                      <motion.div
                        className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                        initial={{ left: "-100%" }}
                        animate={{ left: "200%" }}
                        transition={{
                          duration: 2.2,
                          repeat: Infinity,
                          repeatDelay: 2.5,
                          ease: "easeInOut",
                        }}
                      />
                      Começar agora
                    </Button>
                  </motion.div>
                </Link>
              </div>
            )}
            <Link to="/b/demo" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="text-base px-10 h-14 bg-secondary/50 hover:bg-secondary w-full">
                Ver Demonstração
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground italic">
            Sem cartão de crédito necessário. Teste todas as funções PRO por 14 dias.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Faça seus clientes voltarem automaticamente
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Seu faturamento não pode depender da sua memória para enviar mensagens.
              Nossa tecnologia faz o trabalho pesado de reter e ativar clientes sem que você levante um dedo.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title} className="bg-card rounded-2xl p-8 border border-border hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5 group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading text-xl font-bold text-card-foreground mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent to-secondary/10 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold mb-4 uppercase tracking-wider">
              Depoimentos Reais
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Quem usa o Flowza, aprova e recomenda
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Descubra como empreendedores de diversos setores escalaram suas agendas e reduziram faltas para zero com nossas automações.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((t, idx) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="bg-card rounded-3xl p-8 border border-border/80 hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 flex flex-col justify-between relative group"
              >
                <div className="absolute top-6 right-8 text-primary/10 group-hover:text-primary/20 transition-colors">
                  <Quote className="w-12 h-12 stroke-[3]" />
                </div>
                
                <div>
                  <div className="flex gap-1 mb-4">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  
                  <p className="text-muted-foreground leading-relaxed mb-6 italic text-base relative z-10">
                    "{t.text}"
                  </p>
                </div>

                <div className="flex items-center gap-4 border-t border-border/50 pt-4 mt-2">
                  <img
                    src={t.image}
                    alt={t.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="font-bold text-foreground text-sm">{t.name}</h4>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                    <p className="text-[10px] text-primary font-medium mt-0.5">{t.location}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
              O investimento que rapidamente se paga
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Ao recuperar apenas 1 cliente inativo ou evitar 2 faltas por mês, nosso sistema gera lucro líquido imediato para sua operação.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {Object.values(PLANS).map((plan) => {
              const isBusiness = plan.id === PlanId.BUSINESS;
              const isPremium = plan.id === PlanId.PREMIUM;

              return (
                <div 
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col bg-card rounded-3xl p-8 border transition-all duration-500 hover:translate-y-[-8px] hover:shadow-xl hover:border-primary/50",
                    isBusiness 
                      ? "border-primary shadow-2xl shadow-primary/10 ring-1 ring-primary/50 bg-gradient-to-b from-primary/[0.02] to-transparent animate-soft-pulse hover:shadow-primary/20" 
                      : "border-border shadow-sm"
                  )}
                >
                  {isBusiness && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 whitespace-nowrap shadow-lg">
                      <Zap className="w-3 h-3 fill-current" /> Plano Recomendado
                    </div>
                  )}

                  <div className="mb-8">
                    <h3 className="text-lg font-bold text-muted-foreground mb-2 uppercase tracking-widest">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground tracking-tighter">R$ {plan.price}</span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </div>
                  </div>

                  <ul className="space-y-4 mb-10 flex-1">
                    {plan.id === PlanId.FREE && (
                      <div className="space-y-4 opacity-80">
                        <FeatureItem text="Até 30 agendamentos/mês" />
                        <FeatureItem text="1 profissional" />
                        <FeatureItem text="Até 3 serviços" />
                        <FeatureItem text="Página pública básica" />
                        <FeatureItem text="Suporte via chat" />
                      </div>
                    )}
                    {plan.id === PlanId.PRO && (
                      <div className="space-y-4">
                        <FeatureItem text="Até 150 agendamentos/mês" />
                        <FeatureItem text="1 profissional" />
                        <FeatureItem text="Serviços ilimitados" />
                        <FeatureItem text="Notificações via WhatsApp" />
                        <FeatureItem text="Confirmação Automática" />
                        <FeatureItem text="Avaliações de Clientes" />
                      </div>
                    )}
                    {plan.id === PlanId.BUSINESS && (
                      <div className="space-y-4">
                        <FeatureItem text="Até 500 agendamentos/mês" highlighted />
                        <FeatureItem text="Até 5 profissionais" highlighted />
                        <FeatureItem text="Sistema de Fidelidade" highlighted />
                        <FeatureItem text="Agendamento Recorrente" highlighted />
                        <FeatureItem text="Automações Completas" highlighted />
                        <FeatureItem text="Integração Instagram/Meta" highlighted />
                        <FeatureItem text="Relatórios de Faturamento" highlighted />
                      </div>
                    )}
                    {plan.id === PlanId.PREMIUM && (
                      <div className="space-y-4">
                        <FeatureItem text="Agendamentos Ilimitados" />
                        <FeatureItem text="Profissionais Ilimitados" />
                        <FeatureItem text="Analytics de Escala" />
                        <FeatureItem text="Gestão Multi-Unidade" />
                        <FeatureItem text="Suporte VIP 24/7" />
                        <FeatureItem text="Acesso Antecipado Beta" />
                      </div>
                    )}
                  </ul>

                  <Link to={`/auth?mode=signup&plan=${plan.id}&coupon=START30`} className="mt-auto">
                    <Button 
                      className={cn(
                        "w-full h-12 rounded-xl font-bold transition-all",
                        isBusiness ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                      )}
                    >
                      {plan.price === 0 ? "Começar sem custo" : "Aumentar meus lucros"}
                      {isBusiness ? <Zap className="w-4 h-4 ml-2 fill-current" /> : (isPremium ? <Crown className="w-4 h-4 ml-2 fill-current" /> : <Rocket className="w-4 h-4 ml-2" />)}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Comparison Table Link */}
          <div className="mt-20 text-center">
            <h3 className="text-2xl font-bold mb-8">Compare os recursos</h3>
            <div className="overflow-x-auto rounded-3xl border border-border shadow-sm">
              <table className="w-full text-left border-collapse bg-card">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-6 text-sm font-bold uppercase tracking-wider">Recurso</th>
                    <th className="p-6 text-sm font-bold uppercase tracking-wider text-center">Free</th>
                    <th className="p-6 text-sm font-bold uppercase tracking-wider text-center">Pro</th>
                    <th className="p-6 text-sm font-bold uppercase tracking-wider text-center text-primary">Business</th>
                    <th className="p-6 text-sm font-bold uppercase tracking-wider text-center">Premium</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <TableRow label="Agendamentos/mês" values={["30", "150", "500", "Ilimitados"]} />
                  <TableRow label="Profissionais" values={["1", "1", "5", "Ilimitados"]} />
                  <TableRow label="Lembretes WhatsApp" values={[false, true, true, true]} />
                  <TableRow label="Confirm. Automática" values={[false, true, true, true]} />
                  <TableRow label="Sistema Fidelidade" values={[false, false, true, true]} />
                  <TableRow label="Agendamento Recorrente" values={[false, false, true, true]} />
                  <TableRow label="Analytics Avançado" values={[false, false, true, true]} />
                  <TableRow label="Suporte Prioritário" values={[false, false, "Prioritário", "VIP 24/7"]} />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 px-6 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-balance">Pronto para colocar seu negócio no piloto automático?</h2>
          <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto">Rápido de configurar. Fácil de usar. Escala automaticamente. Tudo 100% focado no seu crescimento.</p>
          <Link to="/auth?mode=signup">
            <Button size="lg" variant="secondary" className="text-lg px-12 h-16 rounded-2xl font-bold shadow-2xl">
              Começar agora
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border bg-card">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="font-heading text-xl font-bold text-foreground">
            Flowza<span className="text-primary">.</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Flowza. Todos os direitos reservados.
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Termos</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacidade</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureItem = ({ text, highlighted = false }: { text: string; highlighted?: boolean }) => (
  <li className="flex items-start gap-3 text-sm">
    <div className={cn("p-0.5 rounded-full mt-0.5", highlighted ? "bg-primary/20" : "bg-green-500/10")}>
      <Check className={cn("w-3.5 h-3.5", highlighted ? "text-primary" : "text-green-500")} />
    </div>
    <span className={cn("leading-tight", highlighted ? "text-foreground font-semibold" : "text-muted-foreground")}>{text}</span>
  </li>
);

const TableRow = ({ label, values }: { label: string; values: (string | boolean)[] }) => (
  <tr className="hover:bg-muted/30 transition-colors">
    <td className="p-6 text-sm font-medium text-foreground">{label}</td>
    {values.map((v, i) => (
      <td key={i} className="p-6 text-center">
        {typeof v === "boolean" ? (
          v ? <Check className="w-5 h-5 text-primary mx-auto" /> : <span className="text-muted-foreground/30">—</span>
        ) : (
          <span className={cn("text-sm", i === 2 ? "font-bold text-primary" : "text-muted-foreground")}>{v}</span>
        )}
      </td>
    ))}
  </tr>
);

export default Landing;
