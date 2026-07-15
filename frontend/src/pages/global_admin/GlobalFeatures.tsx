import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { handleFirestoreError, OperationType } from "@/lib/firebase";

const DEFAULT_TABS = [
  { id: "overview", to: "/dashboard", label: "Visão Geral" },
  { id: "appointments", to: "/dashboard/appointments", label: "Agendamentos" },
  { id: "checkin", to: "/dashboard/checkin", label: "Check-in" },
  { id: "services", to: "/dashboard/services", label: "Serviços" },
  { id: "professionals", to: "/dashboard/professionals", label: "Profissionais" },
  { id: "units", to: "/dashboard/units", label: "Unidades" },
  { id: "clients", to: "/dashboard/clients", label: "Clientes" },
  { id: "analytics", to: "/dashboard/analytics", label: "Analytics" },
  { id: "campaigns", to: "/dashboard/campaigns", label: "Smart Campaigns" },
  { id: "loyalty", to: "/dashboard/loyalty", label: "Fidelidade" },
  { id: "subscriptions", to: "/dashboard/subscriptions", label: "Assinaturas" },
  { id: "reviews", to: "/dashboard/reviews", label: "Avaliações" },
  { id: "notifications", to: "/dashboard/notifications", label: "Notificações" },
  { id: "queue", to: "/dashboard/queue", label: "Fila de Mensagens" },
  { id: "automations", to: "/dashboard/automations", label: "Playbooks & Automações" },
  { id: "integrations", to: "/dashboard/integrations", label: "Integrações & Escala" },
  { id: "gallery", to: "/dashboard/gallery", label: "Galeria" },
  { id: "forecast", to: "/dashboard/forecast", label: "Previsão" },
  { id: "ai-power", to: "/dashboard/ai-power", label: "AI Power Center" },
  { id: "rewards", to: "/dashboard/rewards", label: "Recompensas" },
  { id: "schedule", to: "/dashboard/schedule", label: "Agenda & Horários" },
  { id: "marketing", to: "/dashboard/marketing", label: "AI Marketing" },
  { id: "seo", to: "/dashboard/seo", label: "Posicionamento SEO" },
  { id: "settings", to: "/dashboard/settings", label: "Configurações" },
  { id: "plans", to: "/dashboard/plans", label: "Planos & Upgrade" },
];

export default function GlobalFeatures() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabledTabs, setEnabledTabs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "platform_settings", "features"));
        if (settingsDoc.exists() && settingsDoc.data().enabled_tabs) {
          setEnabledTabs(settingsDoc.data().enabled_tabs);
        } else {
          // Initialize all to true
          const initial = DEFAULT_TABS.reduce((acc, tab) => {
            acc[tab.id] = true;
            return acc;
          }, {} as Record<string, boolean>);
          setEnabledTabs(initial);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "platform_settings/features");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleToggle = (id: string, value: boolean) => {
    setEnabledTabs(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "platform_settings", "features"), {
        enabled_tabs: enabledTabs
      }, { merge: true });
      toast.success("Abas configuradas com sucesso!");
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, "platform_settings/features");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Configuração de Abas</h2>
        <p className="text-muted-foreground mt-1">Selecione quais abas serão exibidas na dashboard dos clientes (negócios).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Abas da Dashboard do Flowza</CardTitle>
          <CardDescription>
            Ative ou desative seções inteiras. Abas nativas essenciais não deveriam ser desativadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           {DEFAULT_TABS.map(tab => (
             <div key={tab.id} className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-slate-50 px-2 rounded-md transition-colors">
               <div className="flex items-center gap-3">
                 <div className="flex flex-col">
                   <span className="font-medium text-slate-700">{tab.label}</span>
                   <span className="text-xs text-slate-500 font-mono">{tab.to}</span>
                 </div>
               </div>
               <Switch 
                 checked={enabledTabs[tab.id] !== false} 
                 onCheckedChange={(val) => handleToggle(tab.id, val)} 
               />
             </div>
           ))}

           <div className="pt-6">
             <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
               {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
               Salvar Configurações
             </Button>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
