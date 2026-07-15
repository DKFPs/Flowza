import React, { useState } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useBusiness } from "@/contexts/BusinessContext";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { FeatureLock } from "@/components/dashboard/MonetizationComponents";
import { PlanId } from "@shared/types";

interface QueueJob {
  id: string;
  business_id: string;
  appointment_id: string;
  type: string;
  status: 'pending' | 'sent' | 'failed';
  retry_count: number;
  payload: {
    client_name?: string;
    service_name?: string;
    date?: string;
    time?: string;
  };
  created_at: any; // Firebase Timestamp
}

const NotificationQueue = () => {
  const { business, plan , limits } = useBusiness();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isEligible = limits?.automation === "full";

  const { data: jobs = [], isLoading, refetch } = useQuery<QueueJob[]>({
    queryKey: ["notification_queue", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const q = query(
        collection(db, "notification_queue"), 
        where("business_id", "==", business.id), 
        orderBy("created_at", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as QueueJob));
    },
    enabled: !!business?.id,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/20 bg-amber-500/5"><Clock className="w-3 h-3" /> Pendente</Badge>;
      case "sent":
        return <Badge variant="outline" className="gap-1 text-emerald-500 border-emerald-500/20 bg-emerald-500/5"><CheckCircle2 className="w-3 h-3" /> Enviado</Badge>;
      case "failed":
        return <Badge variant="outline" className="gap-1 text-rose-500 border-rose-500/20 bg-rose-500/5"><AlertCircle className="w-3 h-3" /> Falhou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <FeatureLock isLocked={!isEligible} featureName="Fila de Mensagens" planName="Business ou Premium">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Fila de Mensagens</h1>
          <p className="text-sm text-slate-500 mt-1">Acompanhe o status de envio do WhatsApp e notificações</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="gap-2 rounded-xl"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="w-[180px]">Data/Hora</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Tentativas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                  Nenhuma mensagem na fila
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id} className="hover:bg-slate-50/30 transition-colors">
                  <TableCell className="text-xs font-medium text-slate-500">
                    {job.created_at?.toDate ? format(job.created_at.toDate(), "dd/MM HH:mm:ss") : "Recente"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700">{job.payload?.client_name || "Cliente"}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1"><Smartphone className="w-3 h-3" /> WhatsApp</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {job.type === 'new_appointment' ? 'Novo Agendamento' : job.type}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{job.retry_count || 0}/3</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </div>
    </FeatureLock>
  );
};

export default NotificationQueue;
