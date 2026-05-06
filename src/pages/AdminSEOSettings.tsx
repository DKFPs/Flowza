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
import { RefreshCw, Save } from 'lucide-react';

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

  const isEligible = limits?.customDomain;

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
  }, [business?.id]);

  const saveConfigs = async () => {
    if (!business?.id) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "business_integrations", business.id), configs, { merge: true });
      toast.success("Configurações de SEO e Tracking salvas!");
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
        <div className="grid gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Meta Tags</CardTitle>
              <CardDescription>Como sua página de agendamento aparece nos resultados do Google</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                  <label className="text-sm font-medium">Título da Página (SEO Title)</label>
                  <Input 
                    value={configs.seoTitle} 
                    onChange={(e) => setConfigs(prev => ({...prev, seoTitle: e.target.value}))}
                    placeholder={`Ex: ${business?.name} - Agendamento`}
                  />
              </div>
              <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição da Página (Meta Description)</label>
                  <Textarea 
                    value={configs.seoDescription} 
                    onChange={(e) => setConfigs(prev => ({...prev, seoDescription: e.target.value}))}
                    placeholder="Insira uma breve descrição sobre seus serviços..."
                  />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pixels e Rastreamento</CardTitle>
              <CardDescription>Adicione scripts para acompanhar métricas e tráfego</CardDescription>
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
              <Button onClick={saveConfigs} disabled={saving} size="lg">
                  {saving ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Salvar Configurações
              </Button>
          </div>
        </div>
      </PlanGuard>
    </div>
  );
};

export default AdminSEOSettings;