import { useState, useEffect } from "react";
import { useBusiness } from "@/contexts/BusinessContext";
import { PlanId } from "@/types";
import { CampaignAIService, SmartCampaign } from "@/services/campaignAIService";
import { Button } from "@/components/ui/button";
import { Brain, Play, Pause, ChartBar, Plus, MessageSquare, CheckCircle2, TrendingUp, AlertCircle, RefreshCw, Send, Filter, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { Textarea } from "@/components/ui/textarea";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FeatureLock, UpgradeTrigger, GrowthOpportunity } from "@/components/dashboard/MonetizationComponents";

const SEGMENT_LABELS: Record<string, string> = {
  inactive: "Clientes Inativos",
  single_visit: "Apenas 1 Visita",
  vip: "Clientes VIP (+5 visitas)",
  all: "Todos os Clientes"
};

const CAMPAIGN_TYPES: Record<string, string> = {
  all: "Todos os Tipos",
  reactivation: "Reativação",
  loyalty_boost: "Fidelidade",
  welcome: "Boas-Vindas",
  vip_exclusive: "Exclusivo VIP",
  new_service: "Novo Serviço"
};

const STATUS_TYPES: Record<string, string> = {
  all: "Todos os Status",
  active: "Ativa",
  paused: "Pausada"
};

const SmartCampaigns = () => {
  const { business, refreshBusiness, plan, checkPermission } = useBusiness();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<SmartCampaign[]>([]);
  const [suggestions, setSuggestions] = useState<Partial<SmartCampaign>[]>([]);
  const [loading, setLoading] = useState(true);
  const [waApiKey, setWaApiKey] = useState("");
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  const [isSavingWa, setIsSavingWa] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCampaign, setNewCampaign] = useState<Partial<SmartCampaign>>({
    type: 'reactivation',
    name: '',
    target_segment: 'all',
    message_template: '',
    anti_spam_days: 15,
    is_active: false
  });

  const loadData = async () => {
    if (!business) return;
    setLoading(true);
    try {
      const activeData = await CampaignAIService.getCampaigns(business.id);
      setCampaigns(activeData);
      
      if (business.whatsapp_api_config) {
        setWaApiKey(business.whatsapp_api_config.api_key || "");
        setWaPhoneNumberId(business.whatsapp_api_config.phone_number_id || "");
      }
      
      // Get real client stats
      const apptsRef = collection(db, "appointments");
      const apptsQuery = query(apptsRef, where("business_id", "==", business.id));
      const apptsSnapshot = await getDocs(apptsQuery);
      const appts = apptsSnapshot.docs.map(d => d.data());
      
      const clientCounts: Record<string, number> = {};
      appts.forEach(a => { if (a.client_id) clientCounts[a.client_id] = (clientCounts[a.client_id] || 0) + 1; });
      const totalClients = Object.keys(clientCounts).length;
      const recurringClients = Object.values(clientCounts).filter(c => c > 1).length;

      // Real analytics calculation for suggestions
      const suggestionsData = CampaignAIService.generateSuggestions(
        { totalClients, recurringClients },
        business.name
      );
      
      // Filter out suggestions that are already active campaigns of the same type/segment
      const filteredSuggestions = suggestionsData.filter(
        s => !activeData.some(a => a.type === s.type)
      );
      
      setSuggestions(filteredSuggestions);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);  

  const handleActivateSuggestion = async (suggestion: Partial<SmartCampaign>) => {
    if (!business) return;
    if (!business.whatsapp_api_config?.is_connected) {
      toast({ title: "Configure o WhatsApp", description: "Vincule o WhatsApp API antes de ativar campanhas.", variant: "destructive" });
      return;
    }
    try {
      await CampaignAIService.createCampaign(business.id, {
        ...suggestion,
        is_active: true
      });
      toast({ title: "Campanha ativada com sucesso!" });
      loadData();
    } catch (error) {
       toast({ title: "Erro ao ativar campanha", variant: "destructive" });
    }
  };

  const handleCreateManualCampaign = async () => {
    if (!business) return;
    if (!newCampaign.name || !newCampaign.message_template) {
      toast({ title: "Atenção", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    
    setIsCreating(true);
    try {
      await CampaignAIService.createCampaign(business.id, {
        ...newCampaign,
        is_active: false // começa pausada
      });
      toast({ title: "Campanha criada com sucesso!" });
      setCreateModalOpen(false);
      setNewCampaign({
        type: 'reactivation',
        name: '',
        target_segment: 'all',
        message_template: '',
        anti_spam_days: 15,
        is_active: false
      });
      loadData();
    } catch (error) {
       toast({ title: "Erro ao criar campanha", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (campaign: SmartCampaign) => {
    try {
      await CampaignAIService.toggleCampaignStatus(campaign.id!, !campaign.is_active);
      toast({ title: campaign.is_active ? "Campanha pausada" : "Campanha ativada" });
      loadData();
    } catch (error) {
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  };

  const handleSimulate = async (campaign: SmartCampaign) => {
    try {
      await CampaignAIService.simulateExecution(campaign.id!, campaign.performance);
      toast({ title: "Disparo simulado com sucesso!" });
      loadData();
    } catch (error) {
      toast({ title: "Erro ao processar disparo", variant: "destructive" });
    }
  };

  const handleSaveWhatsAppConfig = async () => {
    if (!business) return;
    setIsSavingWa(true);
    try {
      const isConnected = waApiKey.length > 0 && waPhoneNumberId.length > 0;
      await updateDoc(doc(db, "businesses", business.id), {
        whatsapp_api_config: {
          api_key: waApiKey,
          phone_number_id: waPhoneNumberId,
          is_connected: isConnected
        }
      });
      await refreshBusiness();
      toast({ title: "Configurações do WhatsApp salvas!" });
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSavingWa(false);
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchType = filterType === "all" || c.type === filterType;
    const matchStatus = filterStatus === "all" || (filterStatus === "active" ? c.is_active : !c.is_active);
    return matchType && matchStatus;
  });

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando inteligência de retenção...</div>;

  const isPremium = checkPermission('hasSmartCampaigns') || plan?.id === PlanId.PREMIUM;

  return (
    <div className="space-y-8">
      {!isPremium && (
        <div className="mb-6">
          <UpgradeTrigger 
            type="cancellation" 
            title="Você perdeu R$ 3.450 nos últimos 30 dias" 
            description="Clientes inativos estão deixando de comprar porque você não tem automação de follow-up." 
            solution="Com as Campanhas Automáticas (IA), o sistema identifica quem não volta há 30 dias e dispara uma oferta irresistível no WhatsApp, reativando a venda sem você mover um dedo." 
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" /> Smart Campaigns
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automação baseada em inteligência artificial para trazer clientes de volta.
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Criar Manualmente
          </Button>
        </div>
        
        {/* API WhatsApp Integration Section */}
        <FeatureLock isLocked={!isPremium} featureName="Smart Campaigns" planName="PREMIUM">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-8">
            <div className="flex items-center gap-3 mb-4">
             <div className={`w-10 h-10 rounded-full flex items-center justify-center ${business?.whatsapp_api_config?.is_connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
               <Send className="w-5 h-5" />
             </div>
             <div>
               <h2 className="text-lg font-bold text-foreground">Integração WhatsApp API</h2>
               <p className="text-sm text-muted-foreground">
                 Vincule sua API Oficial do WhatsApp para disparar campanhas.
                 {business?.whatsapp_api_config?.is_connected && <span className="ml-2 text-emerald-500 font-medium text-xs">Conectado</span>}
               </p>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Token da API (Access Token)</Label>
              <Input 
                type="password" 
                placeholder="EAAGm..." 
                value={waApiKey}
                onChange={(e) => setWaApiKey(e.target.value)}
              />
            </div>
            <div>
              <Label>ID do Número de Telefone</Label>
              <Input 
                placeholder="Ex: 104561234567890" 
                value={waPhoneNumberId}
                onChange={(e) => setWaPhoneNumberId(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveWhatsAppConfig} disabled={isSavingWa}>
              {business?.whatsapp_api_config?.is_connected ? "Atualizar Integração" : "Conectar WhatsApp"}
            </Button>
          </div>
        </div>
        </FeatureLock>

        {/* AI Suggestions Panel */}
        {suggestions.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                 <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                   <SparklesIcon className="w-5 h-5 text-primary" /> Oportunidades Identificadas
                 </h2>
                 <p className="text-sm text-muted-foreground">Nossa IA analisou sua base e sugere estas ações imediatas</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {suggestions.map((s, i) => (
                 <div key={i} className="bg-card rounded-xl border border-border p-5 flex flex-col">
                   <div className="flex-1">
                     <span className="inline-block px-2 py-1 bg-muted text-[10px] uppercase font-bold tracking-wider rounded text-muted-foreground mb-3">
                       Alvo: {SEGMENT_LABELS[s.target_segment || 'all']}
                     </span>
                     <h3 className="font-bold text-foreground mb-2">{s.name}</h3>
                     <p className="text-xs text-muted-foreground mb-4 line-clamp-3 italic">
                       "{s.message_template}"
                     </p>
                   </div>
                   <FeatureLock isLocked={!isPremium} featureName="Campanhas Automáticas" planName="PREMIUM">
                     <Button onClick={() => handleActivateSuggestion(s)} className="w-full" size="sm">
                       <Play className="w-4 h-4 mr-2" /> Ativar Automático
                     </Button>
                   </FeatureLock>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* Active Campaigns */}
        <FeatureLock isLocked={!isPremium} featureName="Gestão de Campanhas" planName="PREMIUM">
        <div>
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
             <h2 className="text-xl font-bold text-foreground">Suas Campanhas</h2>
             <div className="flex bg-muted/30 p-1.5 rounded-lg border flex-col sm:flex-row gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs border-transparent bg-transparent hover:bg-muted font-medium transition-colors">
                    <Filter className="w-3 h-3 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAMPAIGN_TYPES).map(([val, label]) => (
                      <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="w-px bg-border hidden sm:block mx-1"></div>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs border-transparent bg-transparent hover:bg-muted font-medium transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_TYPES).map(([val, label]) => (
                      <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
           </div>

           {filteredCampaigns.length === 0 ? (
             <div className="text-center p-12 bg-card border border-dashed rounded-xl">
               <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
               <h3 className="text-lg font-medium text-foreground mb-1">Nenhuma campanha encontrada</h3>
               <p className="text-sm text-muted-foreground mb-4">Ative uma das sugestões acima ou mude os filtros para ver outras campanhas.</p>
             </div>
           ) : (
             <div className="space-y-4">
                {filteredCampaigns.map(c => (
                  <div key={c.id} className="bg-card rounded-xl border p-5 flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                         <h3 className="text-lg font-bold text-foreground">{c.name}</h3>
                         <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                           {c.is_active ? 'Rodando em Background' : 'Pausada'}
                         </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        <b>Tipo:</b> {CAMPAIGN_TYPES[c.type]} • <b>Público:</b> {SEGMENT_LABELS[c.target_segment || 'all']} • <b>Intervalo:</b> {c.anti_spam_days} dias
                      </p>

                      <div className="p-3 bg-muted/30 rounded-lg border border-border/50 text-sm italic text-foreground mb-4">
                        {c.message_template}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant={c.is_active ? "outline" : "default"} size="sm" onClick={() => handleToggle(c)}>
                          {c.is_active ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                          {c.is_active ? 'Pausar' : 'Reativar'}
                        </Button>
                        {c.is_active && (
                           <Button variant="secondary" size="sm" onClick={() => handleSimulate(c)}>
                             <RefreshCw className="w-4 h-4 mr-2" /> Forçar Disparo (Demo)
                           </Button>
                        )}
                      </div>
                    </div>

                    <div className="md:w-64 flex flex-col gap-3">
                       <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
                         <ChartBar className="w-3 h-3" /> Resultados
                       </h4>
                       <div className="grid grid-cols-2 gap-2">
                          <div className="bg-muted/50 p-3 rounded-lg text-center">
                            <p className="text-2xl font-bold font-heading">{c.performance.sent}</p>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Enviados</p>
                          </div>
                          <div className="bg-muted/50 p-3 rounded-lg text-center">
                            <p className="text-2xl font-bold font-heading">{c.performance.converted}</p>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Retornos</p>
                          </div>
                       </div>
                       <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-center mt-auto">
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1 line-clamp-1">Receita Gerada</p>
                          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">R$ {c.performance.revenue_generated.toFixed(2)}</p>
                       </div>
                    </div>
                  </div>
                ))}
             </div>
           )}
        </div>
        </FeatureLock>
        
        <ResponsiveModal title="Criar Nova Campanha" open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
           <div className="p-6 space-y-4">
             <div>
               <Label>Nome da Campanha</Label>
               <Input 
                 placeholder="Ex: Reativação Fim de Ano" 
                 value={newCampaign.name}
                 onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
               />
             </div>
             <div>
               <Label>Tipo de Campanha</Label>
               <Select value={newCampaign.type} onValueChange={(val) => setNewCampaign({...newCampaign, type: val as SmartCampaign["type"]})}>
                 <SelectTrigger><SelectValue/></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="reactivation">Reativação</SelectItem>
                   <SelectItem value="loyalty_boost">Fidelidade</SelectItem>
                   <SelectItem value="welcome">Boas-Vindas</SelectItem>
                   <SelectItem value="vip_exclusive">Exclusivo VIP</SelectItem>
                   <SelectItem value="new_service">Novo Serviço</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div>
               <Label>Público Alvo</Label>
               <Select value={newCampaign.target_segment} onValueChange={val => setNewCampaign({...newCampaign, target_segment: val})}>
                 <SelectTrigger><SelectValue/></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">Todos os Clientes</SelectItem>
                   <SelectItem value="inactive">Clientes Inativos</SelectItem>
                   <SelectItem value="single_visit">Apenas 1 Visita</SelectItem>
                   <SelectItem value="vip">Clientes VIP (+5 visitas)</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div>
               <Label>Dias de Intervalo Anti-Spam</Label>
               <Input 
                 type="number" 
                 value={newCampaign.anti_spam_days}
                 onChange={e => setNewCampaign({...newCampaign, anti_spam_days: Number(e.target.value)})}
               />
             </div>
             <div>
               <Label>Mensagem (Template)</Label>
               <Textarea 
                 placeholder="Olá {{firstName}}, novidade..." 
                 value={newCampaign.message_template}
                 onChange={e => setNewCampaign({...newCampaign, message_template: e.target.value})}
                 rows={4}
               />
               <p className="text-[10px] text-muted-foreground mt-1">Variáveis suportadas: {`{{firstName}}`}</p>
             </div>
             <Button className="w-full" onClick={handleCreateManualCampaign} disabled={isCreating}>
               {isCreating ? "Criando..." : "Criar Campanha"}
             </Button>
           </div>
        </ResponsiveModal>
    </div>
  );
};

// Helper icon component for inline
const SparklesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

export default SmartCampaigns;
