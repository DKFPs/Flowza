import { apiFetch } from "@/lib/api";
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Instagram, LogOut, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Business, InstagramConfig } from '@shared/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { InstagramService } from '@backend/services/instagramService';

interface InstagramIntegrationProps {
  business: Business;
  onUpdate: () => void;
}

const InstagramIntegration: React.FC<InstagramIntegrationProps> = ({ business, onUpdate }) => {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const config = business.instagram_config;

  const handleAuthSuccess = useCallback(async (payload: { access_token: string; user_id: string; expires_at: number }) => {
    try {
      setSyncing(true);
      const businessRef = doc(db, "businesses", business.id);
      const newConfig: InstagramConfig = {
        access_token: payload.access_token,
        user_id: payload.user_id,
        expires_at: payload.expires_at,
        is_active: true
      };

      await updateDoc(businessRef, {
        instagram_config: newConfig
      });

      // Sync initial posts
      await InstagramService.syncPosts(business.id, newConfig);
      
      toast({ title: "Conectado!", description: "Seu Instagram foi configurado com sucesso." });
      onUpdate();
    } catch (error: any) {
      console.error(error);
      if (error && error.message === "OAuthException") {
        toast({ title: "Erro na conexão", description: "O Instagram não autorizou sua conta.", variant: "destructive" });
      } else {
        toast({ title: "Erro na conexão", description: error?.message || "Não foi possível salvar os dados do Instagram.", variant: "destructive" });
      }
    } finally {
      setSyncing(false);
    }
  }, [business.id, onUpdate, toast]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Security check
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) return;

      if (event.data?.type === 'INSTAGRAM_AUTH_SUCCESS') {
        const payload = event.data.payload;
        await handleAuthSuccess(payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleAuthSuccess]);

  const handleConnect = async () => {
    setConnecting(true);
    
    // Open window immediately to avoid popup blocker
    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;
    const authWindow = window.open(
      '',
      'instagram_auth',
      `width=${width},height=${height},top=${top},left=${left}`
    );

    try {
      const origin = window.location.origin;
      const response = await apiFetch(`/api/auth/instagram/url?origin=${encodeURIComponent(origin)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Erro na API de autenticação");
      }
      
      const { url } = data;
      
      if (authWindow) {
        authWindow.location.href = url;
      }
    } catch (error: unknown) {
      console.error(error);
      if (authWindow) authWindow.close();
      const message = error instanceof Error ? error.message : "Não foi possível iniciar a autenticação.";
      toast({ title: "Atenção", description: message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Instagram? Seu feed deixará de ser exibido.")) return;
    
    setSyncing(true);
    try {
      await InstagramService.disconnect(business.id);
      toast({ title: "Desconectado", description: "Integração removida." });
      onUpdate();
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao desconectar.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    if (!config) return;
    setSyncing(true);
    try {
      await InstagramService.syncPosts(business.id, config);
      toast({ title: "Sincronizado", description: "Feed atualizado com sucesso." });
    } catch (error: any) {
      if (error && error.message === "OAuthException") {
        toast({ title: "Sessão Expirada", description: "Por favor, reconecte seu Instagram.", variant: "destructive" });
        await InstagramService.disconnect(business.id);
        onUpdate();
      } else {
        toast({ title: "Erro na sincronização", description: error?.message || "Houve uma falha desconhecida", variant: "destructive" });
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Instagram className="w-6 h-6 text-pink-600" />
          Integração com Instagram
        </CardTitle>
        <CardDescription>
          Exiba seus posts do Instagram diretamente na sua página pública de agendamento para aumentar sua credibilidade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {config?.is_active ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-4">
              <CheckCircle2 className="w-10 h-10 text-green-500 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-green-700 dark:text-green-400">Instagram Conectado</p>
                </div>
                <p className="text-sm text-green-600 dark:text-green-500/80">Seus últimos posts estão sendo exibidos na sua página pública.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Status da Conta</p>
                <p className="text-sm font-medium">Conta de Criador de Conteúdo / Business</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Última Sincronização</p>
                <p className="text-sm font-medium">Agora mesmo</p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
               <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={handleDisconnect} disabled={syncing}>
                  <LogOut className="w-4 h-4 mr-2" /> Desconectar Instagram
               </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 space-y-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg">
              <Instagram className="w-10 h-10" />
            </div>
            
            <div className="max-w-xs mx-auto space-y-2">
              <h3 className="font-bold text-xl">Conectar seu Feed</h3>
              <p className="text-sm text-muted-foreground">Mostre seu trabalho e transforme seguidores em clientes fiéis.</p>
            </div>

            <Button size="lg" className="bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 hover:opacity-90 border-none px-8" onClick={handleConnect} disabled={connecting || syncing}>
              {connecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Instagram className="w-4 h-4 mr-2" />}
              Conectar Instagram
            </Button>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg max-w-sm mx-auto flex gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                A Flowza utiliza a API oficial da Meta Graph API. Suas fotos são sincronizadas de forma segura e você pode desconectar a qualquer momento.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstagramIntegration;
