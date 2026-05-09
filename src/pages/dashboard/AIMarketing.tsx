import { useState, useEffect } from "react";
import { useBusiness } from "@/contexts/BusinessContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Send, RefreshCw, BarChart2, MessageSquare, Target, Clock, MessageCircle, AlertCircle, Play, CheckCircle2, Settings } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, doc, setDoc } from "firebase/firestore";
import { MarketingCampaign, generateMarketingOpportunities, executeCampaign, approveCampaign } from "@/lib/marketingEngine";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { FeatureLock } from "@/components/dashboard/MonetizationComponents";
import { PlanId } from "@/types";

export default function AIMarketing() {
  const { business, plan , limits } = useBusiness();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  
  const isEligible = limits?.aiMarketing;
  
  // Limites
  const [dailySendLimit, setDailySendLimit] = useState(100);
  const [daysBetweenCampaigns, setDaysBetweenCampaigns] = useState(7);
  const [configId, setConfigId] = useState<string | null>(null);

  const fetchConfig = React.useCallback(async () => {
    if (!business?.id) return;
    try {
        const q = query(collection(db, "marketing_configs"), where("businessId", "==", business.id));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const data = snap.docs[0].data();
            setConfigId(snap.docs[0].id);
            setIsAutoPilot(data.isAutoPilot || false);
            setDailySendLimit(data.dailySendLimit || 100);
            setDaysBetweenCampaigns(data.daysBetweenCampaigns || 7);
        }
    } catch (e) {
        console.error("Error fetching marketing config", e);
    }
  }, [business?.id]);

  const saveConfig = async (autoPilot: boolean, limit: number, days: number) => {
      if (!business?.id) return;
      try {
          const docRef = configId ? doc(db, "marketing_configs", configId) : doc(collection(db, "marketing_configs"));
          await setDoc(docRef, {
              businessId: business.id,
              isAutoPilot: autoPilot,
              dailySendLimit: limit,
              daysBetweenCampaigns: days
          }, { merge: true });
          if (!configId) setConfigId(docRef.id);
          toast.success("Configurações salvas com sucesso!");
      } catch (e) {
          toast.error("Falha ao salvar configurações");
      }
  };

  const toggleAutoPilot = async () => {
      const newVal = !isAutoPilot;
      setIsAutoPilot(newVal);
      await saveConfig(newVal, dailySendLimit, daysBetweenCampaigns);
  };

  const fetchCampaigns = React.useCallback(async () => {
    if (!business?.id) return;
    try {
      const q = query(
        collection(db, "marketing_campaigns"),
        where("businessId", "==", business.id)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketingCampaign));
      
      // Order: Drafts first, then processing, then completed
      data.sort((a, b) => {
          const statusOrder: Record<string, number> = { draft: 1, approved: 2, running: 3, completed: 4, paused: 5 };
          return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      });
      setCampaigns(data);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar campanhas.");
    } finally {
      setLoading(false);
    }
  }, [business?.id]);

  useEffect(() => {
    if (business?.id) {
        fetchCampaigns();
        fetchConfig();
    }
  }, [business?.id, fetchCampaigns, fetchConfig]);

  const handleGenerate = async () => {
    if (!business?.id) return;
    setIsGenerating(true);
    toast.info("A IA está analisando a base de clientes para encontrar oportunidades...");
    try {
        await generateMarketingOpportunities(business.id);
        await fetchCampaigns();
        toast.success("Análise concluída. Novas oportunidades foram mapeadas!");
    } catch (e) {
        toast.error("Falha ao rodar motor de IA.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleApprove = async (id: string) => {
     try {
       const ok = await approveCampaign(id);
       if (ok) {
           toast.success("Campanha aprovada. Ela está pronta para ser executada!");
           fetchCampaigns(); // refresh
       }
     } catch (e) {
         toast.error("Falha ao aprovar.");
     }
  };

  const handleExecute = async (id: string, count: number) => {
      if (!business?.id) return;
      try {
       const ok = await executeCampaign(business.id, id, count);
       if (ok) {
           toast.success("Campanha iniciada! Disparos no WhatsApp começaram respeitando seus limites diários.");
           fetchCampaigns(); // refresh
       }
     } catch (e) {
         toast.error("Falha ao executar campanha.");
     }
  };

  return (
    <FeatureLock isLocked={!isEligible} featureName="AI Marketing" planName="Premium">
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <MessageCircle className="h-8 w-8 text-primary" />
            AI Marketing & Growth
          </h1>
          <p className="text-gray-500 mt-1">
            Módulos 1-7: Campanhas automáticas personalizadas para recuperar e converter mais.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white px-3 py-2 rounded border text-sm font-medium flex items-center gap-2">
             <span>Piloto Automático:</span>
             <Button 
                variant={isAutoPilot ? "default" : "outline"}
                size="sm"
                className={isAutoPilot ? "bg-green-600 hover:bg-green-700" : ""}
                onClick={toggleAutoPilot}
             >
                {isAutoPilot ? "Ativado" : "Desativado"}
             </Button>
          </div>

          <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                    <Settings className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Limites Anti-Spam & Controles</DialogTitle>
                    <DialogDescription>
                        Evite saturar seus clientes controlando a frequência de mensagens.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="dailyLimit">Limite de envios diários (WhatsApp)</Label>
                        <Input 
                            id="dailyLimit" 
                            type="number" 
                            value={dailySendLimit}
                            onChange={(e) => setDailySendLimit(Number(e.target.value))}
                        />
                         <p className="text-xs text-muted-foreground">Evita banimento do número garantindo um limite seguro.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="daysBetween">Dias entre campanhas (mesmo cliente)</Label>
                        <Input 
                            id="daysBetween" 
                            type="number" 
                            value={daysBetweenCampaigns}
                            onChange={(e) => setDaysBetweenCampaigns(Number(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">Um cliente não receberá mensagens de marketing num intervalo menor que este.</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => saveConfig(isAutoPilot, dailySendLimit, daysBetweenCampaigns)}>Salvar Configurações</Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Minerar Oportunidades
          </Button>
        </div>
      </div>

      {isAutoPilot && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                  <h4 className="font-semibold text-green-900">Piloto Automático de Growth Ativado</h4>
                  <p className="text-sm mt-1">A IA criará e disparará campanhas aprovadas automaticamente baseada nos seus clientes inativos e retenção, mantendo sua agenda cheia sem esforço humano (Módulo 9 - Premium).</p>
              </div>
          </div>
      )}

      {!isAutoPilot && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
                <h4 className="font-semibold text-amber-900">Modo de Controle Manual (Módulo 8)</h4>
                <p className="text-sm mt-1">A IA fará a análise profunda da base e vai sugerir rascunhos. Você precisará aprovar os disparos massivos protegendo sua marca.</p>
            </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {campaigns.length === 0 && !loading && (
          <Card className="bg-gray-50 border-dashed col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Nenhuma campanha sugerida ainda</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-2">
                A IA não detectou necessidades imediatas baseada no banco atual, ou a base é inicial. Clique em 'Minerar Oportunidades' para varrer a base novamente.
              </p>
            </CardContent>
          </Card>
        )}

        {campaigns.map(campaign => (
          <Card key={campaign.id} className={campaign.status === 'completed' ? 'border-gray-200 opacity-80' : 'border-l-4 border-l-primary shadow-sm'}>
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex gap-2 items-center mb-1">
                    {campaign.objective === 'reactivation' && <Badge className="bg-orange-500">Reativação</Badge>}
                    {campaign.objective === 'upsell' && <Badge className="bg-indigo-500">Upsell VIP</Badge>}
                    {campaign.objective === 'fill_slots' && <Badge className="bg-blue-500">Promocional</Badge>}
                    
                    {campaign.status === 'draft' && <Badge variant="outline" className="text-gray-600">Revisão Necessária</Badge>}
                    {campaign.status === 'approved' && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aprovado</Badge>}
                    {campaign.status === 'running' && <Badge variant="default" className="animate-pulse bg-blue-600">Disparando WhatsApp...</Badge>}
                    {campaign.status === 'completed' && <Badge variant="secondary">Finalizada</Badge>}
                  </div>
                  <CardTitle className="text-lg">{campaign.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              
               <div>
                  <span className="text-xs text-gray-500 uppercase font-semibold">Público-Alvo Automapeado</span>
                  <p className="text-sm text-gray-900 font-medium flex items-center gap-1 mt-1">
                     <Target className="h-4 w-4 text-gray-400" /> {campaign.targetAudience}
                  </p>
               </div>

              <div className="bg-indigo-50 rounded-lg p-3">
                <span className="text-xs text-indigo-600 uppercase font-semibold flex items-center gap-1 mb-1">
                    <MessageSquare className="h-3 w-3" /> Copy Gerado (Módulo 4)
                </span>
                <p className="text-sm font-medium text-gray-900 italic">"{campaign.messageTemplate}"</p>
              </div>

              {campaign.status === 'completed' && campaign.metrics && (
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t">
                      <div className="text-center">
                          <p className="text-xs text-gray-500 uppercase">Enviados</p>
                          <p className="font-bold text-lg">{campaign.metrics.sent}</p>
                      </div>
                      <div className="text-center">
                          <p className="text-xs text-gray-500 uppercase">Lidas</p>
                          <p className="font-bold text-lg text-blue-600">{campaign.metrics.opened}</p>
                      </div>
                      <div className="text-center border-x">
                          <p className="text-xs text-gray-500 uppercase">Respostas</p>
                          <p className="font-bold text-lg text-purple-600">{campaign.metrics.replied}</p>
                      </div>
                      <div className="text-center">
                          <p className="text-xs text-gray-500 uppercase">Conversão</p>
                          <p className="font-bold text-lg text-green-600">{campaign.metrics.converted}</p>
                      </div>
                  </div>
              )}
            </CardContent>
            
            {campaign.status === 'draft' && (
              <CardFooter className="flex justify-end gap-2 bg-gray-50/50 pt-4">
                <Button onClick={() => handleApprove(campaign.id!)} className="bg-primary hover:bg-primary/90">
                   Aprovar Modelo
                </Button>
              </CardFooter>
            )}

            {campaign.status === 'approved' && (
              <CardFooter className="flex justify-end gap-2 bg-gray-50/50 pt-4">
                <Button onClick={() => handleExecute(campaign.id!, campaign.targetClientIds.length)} className="bg-green-600 hover:bg-green-700">
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Disparos WhatsApp
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
      </div>
    </FeatureLock>
  );
}
