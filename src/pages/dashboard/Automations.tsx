import React, { useState, useEffect } from "react";
import { useBusiness } from "@/contexts/BusinessContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MessageSquare, CalendarCheck, UserX, Star, Zap, Save, RefreshCw } from "lucide-react";
import { FeatureLock } from "@/components/dashboard/MonetizationComponents";
import { PlanId } from "@/types";

interface Playbook {
  id: string;
  name: string;
  event: string;
  description: string;
  icon: React.ElementType;
  color: string;
  defaultTemplate: string;
}

const PLAYBOOKS: Playbook[] = [
  {
    id: "on_booking_confirmed",
    name: "Agendamento Confirmado",
    event: "Sempre que um cliente agenda",
    description: "Envia uma mensagem automática confirmando o agendamento.",
    icon: CalendarCheck,
    color: "text-green-500",
    defaultTemplate: "Olá {nome}! Seu agendamento de {servico} para {data} às {hora} foi confirmado! Te esperamos lá."
  },
  {
    id: "on_no_show",
    name: "Follow-up de Falta (No-Show)",
    event: "Quando o status muda para 'Faltou'",
    description: "Tenta reagendar automaticamente com clientes que não compareceram.",
    icon: UserX,
    color: "text-red-500",
    defaultTemplate: "Oi {nome}, senti sua falta hoje para o(a) {servico}. Aconteceu algum imprevisto? Vamos remarcar o seu horário!"
  },
  {
    id: "on_completed_review",
    name: "Pedido de Avaliação",
    event: "2h após o serviço ser concluído",
    description: "Pede ao cliente para deixar uma avaliação ou nota no Google.",
    icon: Star,
    color: "text-yellow-500",
    defaultTemplate: "Olá {nome}! O que achou do seu {servico} hoje? Sua opinião é muito importante, poderia nos avaliar? {link_avaliacao}"
  },
  {
    id: "on_reactivation",
    name: "Reativação de Cliente (30 dias)",
    event: "Cliente sem agendar há >30 dias",
    description: "Envia um incentivo automático (Playbook de reativação).",
    icon: Zap,
    color: "text-blue-500",
    defaultTemplate: "Oi {nome}! Já faz um tempo que não nos vemos. Que tal agendar um horário essa semana? Tenho um brinde separado para você! {link_agendamento}"
  }
];

export default function Automations() {
  const { business, plan , limits } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<Record<string, { enabled: boolean; template: string }>>({});

  const isEligible = limits?.automation === "full";

  const loadConfigs = React.useCallback(async () => {
    if (!business?.id) return;
    try {
      const docSnap = await getDoc(doc(db, "business_automations", business.id));
      const data = docSnap.exists() ? docSnap.data() : {};
      
      const newConfigs: Record<string, { enabled: boolean; template: string }> = {};
      PLAYBOOKS.forEach(p => {
        newConfigs[p.id] = {
          enabled: data[p.id]?.enabled || false,
          template: data[p.id]?.template || p.defaultTemplate
        };
      });
      setConfigs(newConfigs);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar automações");
    } finally {
      setLoading(false);
    }
  }, [business?.id]);

  useEffect(() => {
    if (business?.id) {
      loadConfigs();
    }
  }, [business?.id, loadConfigs]);

  const saveConfigs = async () => {
    if (!business?.id) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "business_automations", business.id), configs, { merge: true });
      toast.success("Automações salvas com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar automações");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], enabled }
    }));
  };

  const handleTemplateChange = (id: string, template: string) => {
    setConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], template }
    }));
  };

  if (loading) return <div className="p-8 flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <FeatureLock isLocked={!isEligible} featureName="Playbooks e Automações" planName="Business ou Premium">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Playbooks & Automações</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
            Configure regras de negócio que reagem automaticamente a eventos. Personalize as mensagens disparadas pelo sistema via WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PLAYBOOKS.map((playbook) => {
            const config = configs[playbook.id];
            const Icon = playbook.icon;
            
            return (
              <Card key={playbook.id} className={`border-l-4 transition-all ${config?.enabled ? 'border-l-primary' : 'border-l-muted'}`}>
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-background shadow-sm border border-border/50 ${playbook.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{playbook.name}</CardTitle>
                        <CardDescription className="text-xs uppercase tracking-wider font-bold mt-1 text-primary">
                          Gatilho: {playbook.event}
                        </CardDescription>
                      </div>
                    </div>
                    <Switch 
                      checked={config?.enabled}
                      onCheckedChange={(val) => handleToggle(playbook.id, val)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">{playbook.description}</p>
                  
                  {config?.enabled && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                      <Label className="text-xs font-bold text-muted-foreground">MENSAGEM (WHATSAPP)</Label>
                      <Textarea 
                        className="resize-none h-24 text-sm font-mono bg-muted/30"
                        value={config?.template || playbook.defaultTemplate}
                        onChange={(e) => handleTemplateChange(playbook.id, e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Variáveis permitidas: <code className="text-primary font-bold">{'{nome}'}</code>, <code className="text-primary font-bold">{'{servico}'}</code>, <code className="text-primary font-bold">{'{data}'}</code>, <code className="text-primary font-bold">{'{hora}'}</code>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button onClick={saveConfigs} disabled={saving} className="gap-2 px-8">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Automações
          </Button>
        </div>
      </div>
    </FeatureLock>
  );
}
