import React, { useState, useEffect } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { PlanGuard } from '@/components/dashboard/PlanGuard';
import { PlanId } from '@/types';
import { RefreshCw, Save, Sparkles, Check, ChevronRight, BarChart3, HelpCircle, AlertCircle } from 'lucide-react';

const SECTORS_CONFIG = {
  barbearia: {
    name: "Barbearia",
    keywords: ["Barbearia", "Corte de cabelo masculino", "Barba", "Agendamento online", "Navalha", "Cabelo e barba", "Barbeiro"],
    titleTemplate: "[Nome] | Barbearia de Elite e Agendamento Online em [Cidade]",
    descTemplate: "Marque seu corte de cabelo ou barba no [Nome] em [Cidade]. Escolha seu profissional preferido, veja horários disponíveis e agende online 24h sem complicação!"
  },
  beleza: {
    name: "Salão de Beleza & Estética",
    keywords: ["Salão de beleza", "Manicure", "Cabeleireira", "Corte feminino", "Agendamento de salão", "Estética", "Limpeza de pele"],
    titleTemplate: "[Nome] | Salão de Beleza e Estética em [Cidade] - Agende Online",
    descTemplate: "Realce sua beleza no [Nome] em [Cidade]. Serviços completos de cabelo, manicure, maquiagem e tratamentos estéticos. Agende seu horário online com facilidade."
  },
  odontologia: {
    name: "Consultório Odontológico / Clínicas",
    keywords: ["Dentista", "Consulta odontológica", "Clínica médica", "Agendar consulta", "Sorriso", "Implante", "Médico"],
    titleTemplate: "Clínica [Nome] | Dentistas e Consultas em [Cidade]",
    descTemplate: "Cuide da sua saúde e do seu sorriso na Clínica [Nome] em [Cidade]. Atendimento humanizado, agendamento de consultas facilitado e profissionais especialistas."
  },
  fitness: {
    name: "Personal Trainer & Academia",
    keywords: ["Personal trainer", "Treino individual", "Estúdio fitness", "Emagrecimento", "Hipertrofia", "Consultoria", "Treino"],
    titleTemplate: "[Nome] Personal Trainer | Treinos e Consultoria em [Cidade]",
    descTemplate: "Alcance seus objetivos de saúde e estética com [Nome] em [Cidade]. Treinos personalizados de emagrecimento, hipertrofia e reabilitação. Agende sua aula experimental."
  },
  clinica: {
    name: "Fisioterapia / Pilates",
    keywords: ["Estúdio de pilates", "Fisioterapia", "Pilates clínico", "RPG", "Reabilitação", "Dor nas costas", "Alongamento"],
    titleTemplate: "[Nome] | Fisioterapia Integrada e Pilates em [Cidade]",
    descTemplate: "Recupere sua mobilidade e viva sem dor no [Nome] em [Cidade]. Atendimento individualizado em pilates clínico, fisioterapia ortopédica e RPG. Agende sua avaliação!"
  },
  outros: {
    name: "Outros Serviços",
    keywords: ["Agendamento online", "Prestação de serviços", "Atendimento rápido", "Consultoria", "Horário flexível", "Agendar online"],
    titleTemplate: "[Nome] | Agendamento Online de Serviços em [Cidade]",
    descTemplate: "Agende seus serviços no [Nome] em [Cidade]. Escolha o melhor dia e horário para o seu atendimento de forma rápida, segura e 100% digital."
  }
};

const AdminSEOSettings: React.FC = () => {
  const { business, plan, limits } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState({
    seoTitle: "Meu Negócio - Agendamento Online",
    seoDescription: "Agende seus horários online com praticidade e rapidez. Atendimento de alta qualidade focado em você.",
    googleAnalytics: "",
    googleTagManager: "",
    metaPixel: "",
    tiktokPixel: ""
  });

  const [selectedSector, setSelectedSector] = useState<keyof typeof SECTORS_CONFIG>("barbearia");
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [suggestedDesc, setSuggestedDesc] = useState("");
  const [showSuggester, setShowSuggester] = useState(false);

  useEffect(() => {
    if (!business?.id) return;
    const loadConfigs = async () => {
      try {
        const docSnap = await getDoc(doc(db, "business_integrations", business.id));
        if (docSnap.exists() && docSnap.data()) {
          setConfigs({
            seoTitle: docSnap.data().seoTitle || `Agendamento - ${business.name}`,
            seoDescription: docSnap.data().seoDescription || "Agende seus horários.",
            googleAnalytics: docSnap.data().googleAnalytics || "",
            googleTagManager: docSnap.data().googleTagManager || "",
            metaPixel: docSnap.data().metaPixel || "",
            tiktokPixel: docSnap.data().tiktokPixel || ""
          });
        }
      } catch (e) {
        console.error("Error loading SEO:", e);
      } finally {
        setLoading(false);
      }
    };
    loadConfigs();
  }, [business?.id, business?.name]);

  // Generate suggestions
  useEffect(() => {
    if (!business) return;
    const sect = SECTORS_CONFIG[selectedSector];
    const city = business.city || "sua Cidade";
    const name = business.name || "Meu Negócio";

    const title = sect.titleTemplate.replace("[Nome]", name).replace("[Cidade]", city);
    const desc = sect.descTemplate.replace("[Nome]", name).replace("[Cidade]", city);

    setSuggestedTitle(title);
    setSuggestedDesc(desc);
  }, [selectedSector, business]);

  const applySuggestions = () => {
    setConfigs(prev => ({
      ...prev,
      seoTitle: suggestedTitle,
      seoDescription: suggestedDesc
    }));
    toast.success("Otimizações de SEO preenchidas nos campos! Não se esqueça de salvar.");
  };

  const calculateScore = () => {
    let score = 30;
    const titleLen = configs.seoTitle.length;
    const descLen = configs.seoDescription.length;

    // Title length evaluation
    if (titleLen >= 40 && titleLen <= 65) {
      score += 30;
    } else if (titleLen > 15 && titleLen < 40) {
      score += 15;
    }

    // Description length evaluation
    if (descLen >= 110 && descLen <= 165) {
      score += 30;
    } else if (descLen > 40 && descLen < 110) {
      score += 15;
    }

    // Specific sector keyword check
    const currentSectorKeywords = SECTORS_CONFIG[selectedSector].keywords;
    let foundKeywords = 0;
    const fullText = (configs.seoTitle + " " + configs.seoDescription).toLowerCase();
    
    currentSectorKeywords.forEach(kw => {
      if (fullText.includes(kw.toLowerCase())) {
        foundKeywords++;
      }
    });

    score += Math.min(foundKeywords * 5, 10);

    return Math.min(score, 100);
  };

  const score = calculateScore();

  const saveConfigs = async () => {
    if (!business?.id) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "business_integrations", business.id), configs, { merge: true });
      toast.success("Configurações de SEO e Tracking salvas com sucesso!");
    } catch (e) {
       console.error("Erro ao salvar:", e);
       toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Configurações de SEO & Rastreamento</h1>
        <p className="text-gray-500 mt-2">Otimize a indexação de sua página nas ferramentas de busca e acompanhe acessos.</p>
      </div>

      <PlanGuard feature="customDomain" label="Configurações de SEO Avançado" targetPlan={PlanId.BUSINESS}>
        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* Main SEO Meta Configuration Forms */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Meta Tags da Página</CardTitle>
                <CardDescription>Como sua página de agendamento aparece nos resultados de busca do Google</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Título da Página (SEO Title)</label>
                    <Input 
                      value={configs.seoTitle} 
                      onChange={(e) => setConfigs(prev => ({...prev, seoTitle: e.target.value}))}
                      placeholder={`Ex: ${business?.name} - Agendamento`}
                      maxLength={70}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Ideal: 40-60 caracteres</span>
                      <span className={configs.seoTitle.length >= 40 && configs.seoTitle.length <= 65 ? "text-green-500 font-medium" : "text-amber-500"}>
                        {configs.seoTitle.length} caracteres
                      </span>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Descrição da Página (Meta Description)</label>
                    <Textarea 
                      value={configs.seoDescription} 
                      onChange={(e) => setConfigs(prev => ({...prev, seoDescription: e.target.value}))}
                      placeholder="Insira uma breve descrição sobre seus serviços..."
                      maxLength={200}
                      rows={4}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Ideal: 110-160 caracteres</span>
                      <span className={configs.seoDescription.length >= 110 && configs.seoDescription.length <= 165 ? "text-green-500 font-medium" : "text-amber-500"}>
                        {configs.seoDescription.length} caracteres
                      </span>
                    </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pixels e Rastreamento</CardTitle>
                <CardDescription>Adicione scripts para acompanhar métricas, conversões de anúncios e tráfego</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Google Analytics (G-XXXXXXX)</label>
                    <Input 
                      value={configs.googleAnalytics} 
                      onChange={(e) => setConfigs(prev => ({...prev, googleAnalytics: e.target.value}))}
                      placeholder="ID de Medição do GA4"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Meta Pixel (Facebook)</label>
                    <Input 
                      value={configs.metaPixel} 
                      onChange={(e) => setConfigs(prev => ({...prev, metaPixel: e.target.value}))}
                      placeholder="ID do seu Pixel"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">TikTok Pixel</label>
                    <Input 
                      value={configs.tiktokPixel} 
                      onChange={(e) => setConfigs(prev => ({...prev, tiktokPixel: e.target.value}))}
                      placeholder="ID do Pixel no TikTok"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Google Tag Manager (GTM-XXXXX)</label>
                    <Input 
                      value={configs.googleTagManager} 
                      onChange={(e) => setConfigs(prev => ({...prev, googleTagManager: e.target.value}))}
                      placeholder="ID do contêiner GTM"
                    />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={saveConfigs} disabled={saving} size="lg" className="w-full sm:w-auto font-bold shadow-lg">
                    {saving ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Salvar Configurações
                </Button>
            </div>
          </div>

          {/* Intelligent SEO Analyzer and Suggestion Assistant Sidebar */}
          <div className="space-y-6">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                  SEO Analyzer & IA
                </CardTitle>
                <CardDescription>Otimizador automático e sugestões com base em palavras-chave</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Health Score Indicator */}
                <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-2xl border border-border/60">
                  <div className="relative shrink-0 flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
                      <circle 
                        cx="32" 
                        cy="32" 
                        r="28" 
                        fill="transparent" 
                        stroke="currentColor" 
                        strokeWidth="5" 
                        strokeDasharray={175} 
                        strokeDashoffset={175 - (175 * score) / 100} 
                        className={score >= 80 ? "text-green-500 transition-all duration-1000" : (score >= 50 ? "text-amber-500 transition-all duration-1000" : "text-destructive transition-all duration-1000")} 
                      />
                    </svg>
                    <span className="absolute text-base font-extrabold text-foreground">{score}%</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Pontuação de Saúde SEO</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {score >= 80 ? "Excelente! Sua página está pronta para indexar muito bem." : (score >= 50 ? "Moderada. Use nossas sugestões automáticas para melhorar." : "Fraca. Recomendamos aplicar sugestões de palavras-chave.")}
                    </p>
                  </div>
                </div>

                {/* Sector Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Setor de Atuação</label>
                  <select 
                    value={selectedSector} 
                    onChange={(e) => setSelectedSector(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    {Object.entries(SECTORS_CONFIG).map(([key, value]) => (
                      <option key={key} value={key}>{value.name}</option>
                    ))}
                  </select>
                </div>

                {/* Keyword Pills */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                    Principais Palavras-chave do Setor
                  </label>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SECTORS_CONFIG[selectedSector].keywords.map((kw, i) => {
                      const contains = (configs.seoTitle + " " + configs.seoDescription).toLowerCase().includes(kw.toLowerCase());
                      return (
                        <span 
                          key={i} 
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${contains ? 'bg-green-500/10 text-green-500 border-green-500/20 font-medium' : 'bg-secondary text-muted-foreground border-border'}`}
                        >
                          {contains && <Check className="w-3 h-3" />}
                          {kw}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Suggestion Card */}
                <div className="bg-primary/[0.02] border border-primary/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Sugestão do Flowza IA
                    </span>
                    <Button variant="ghost" size="xs" onClick={applySuggestions} className="text-xs font-bold text-primary hover:text-primary-foreground p-1 h-auto hover:bg-primary">
                      Aplicar
                    </Button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">Título Sugerido:</span>
                      <p className="text-foreground bg-background border border-border/60 p-2 rounded-lg font-medium leading-relaxed">
                        {suggestedTitle}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">Descrição Sugerida:</span>
                      <p className="text-foreground bg-background border border-border/60 p-2 rounded-lg leading-relaxed">
                        {suggestedDesc}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground flex items-start gap-1.5 bg-secondary/20 p-3 rounded-xl border">
                  <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Nossas sugestões automáticas são baseadas em fórmulas de SEO de alto impacto testadas e validadas para seu segmento, garantindo melhor visibilidade orgânica.</span>
                </div>

              </CardContent>
            </Card>
          </div>

        </div>
      </PlanGuard>
    </div>
  );
};

export default AdminSEOSettings;
