import React, { useState, useEffect } from "react";
import { useBusiness } from "@/contexts/BusinessContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RefreshCw, Save, Code, Share2, Target, Megaphone, Webhook } from "lucide-react";
import { FeatureLock } from "@/components/dashboard/MonetizationComponents";
import { PlanId } from "@/types";

export default function Integrations() {
  const { business, plan , limits } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState({
    metaPixel: "",
    tiktokPixel: "",
    googleAnalytics: "",
    webhookUrl: "",
    webhookEnabled: false,
    googleTagManager: ""
  });

  const isEligible = limits?.whiteLabelPartial;

  const loadConfigs = React.useCallback(async () => {
    if (!business?.id) return;
    try {
      const docSnap = await getDoc(doc(db, "business_integrations", business.id));
      if (docSnap.exists()) {
        setConfigs(prev => ({ ...prev, ...docSnap.data() }));
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar integrações");
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
      await setDoc(doc(db, "business_integrations", business.id), configs, { merge: true });
      toast.success("Integrações salvas com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar integrações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <FeatureLock isLocked={!isEligible} featureName="Integrações e Escala" planName="Business ou Premium">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Crescimento & Ecossistema</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
            Conecte sua conta a painéis de tráfego, sistemas de automação e análises globais para escalar suas vendas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                Pixel Meta (Facebook / Instagram)
              </CardTitle>
              <CardDescription>Acompanhe conversões de agendamento</CardDescription>
            </CardHeader>
            <CardContent>
              <Label>ID do Pixel</Label>
              <Input 
                placeholder="Ex: 123456789012345" 
                value={configs.metaPixel}
                onChange={e => setConfigs({ ...configs, metaPixel: e.target.value })}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                TikTok Pixel
              </CardTitle>
              <CardDescription>Para campanhas no TikTok Ads</CardDescription>
            </CardHeader>
            <CardContent>
              <Label>ID do Pixel (TikTok)</Label>
              <Input 
                placeholder="Ex: CXXXXXXX" 
                value={configs.tiktokPixel}
                onChange={e => setConfigs({ ...configs, tiktokPixel: e.target.value })}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5 text-orange-500" />
                Google Analytics 4 / GTM
              </CardTitle>
              <CardDescription>Monitoramento profundo de visitas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>ID de Medição do GA4</Label>
                <Input 
                  placeholder="Ex: G-XXXXXXXXXX" 
                  value={configs.googleAnalytics}
                  onChange={e => setConfigs({ ...configs, googleAnalytics: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>ID do Google Tag Manager (GTM)</Label>
                <Input 
                  placeholder="Ex: GTM-XXXXXXX" 
                  value={configs.googleTagManager}
                  onChange={e => setConfigs({ ...configs, googleTagManager: e.target.value })}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-purple-500" />
                  Webhooks (Zapier / Make)
                </div>
                <Switch 
                  checked={configs.webhookEnabled}
                  onCheckedChange={v => setConfigs({ ...configs, webhookEnabled: v })}
                />
              </CardTitle>
              <CardDescription>Envie dados de novos agendamentos para outros sistemas</CardDescription>
            </CardHeader>
            <CardContent>
              <Label>URL do Webhook</Label>
              <Input 
                placeholder="https://hooks.zapier.com/..." 
                value={configs.webhookUrl}
                disabled={!configs.webhookEnabled}
                onChange={e => setConfigs({ ...configs, webhookUrl: e.target.value })}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Eventos disparados: <code className="bg-muted px-1 py-0.5 rounded">appointment_created</code>, <code className="bg-muted px-1 py-0.5 rounded">status_changed</code>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4 border-t border-border mt-6">
          <Button onClick={saveConfigs} disabled={saving} className="gap-2 px-8">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </FeatureLock>
  );
}
