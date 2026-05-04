import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, HeartPulse, RefreshCw } from "lucide-react";
import { logAdminAction } from "@/lib/adminLogger";

export default function GlobalAutoHealing() {
  const [logs, setLogs] = useState<any[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
      try {
        const q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(20));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.event === "auto_healing" || l.action === "auto_healing"));
      } catch (error) {
        console.error("Error global healing logs", error);
      }
  }

  const handleToggle = async () => {
     const newState = !enabled;
     setEnabled(newState);
     await logAdminAction("TOGGLE_AUTO_HEALING", { enabled: newState });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Auto-Healing Global</h2>
          <p className="text-slate-500">Monitoramento e recuperação de falhas ativas no sistema.</p>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Status do Motor:</span>
            <Button 
                variant={enabled ? "default" : "destructive"} 
                className={enabled ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                onClick={handleToggle}
            >
                {enabled ? "Ativo" : "Desativado"}
            </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
         <Card>
             <CardHeader>
                 <CardTitle className="flex items-center gap-2"><HeartPulse className="w-5 h-5 text-emerald-500" /> Saúde do Sistema</CardTitle>
             </CardHeader>
             <CardContent>
                 <p className="text-slate-600">O sistema está verificando ativamente desvios de estado em todos os tenants.</p>
                 <div className="mt-4 p-4 bg-slate-50 border rounded-lg flex items-center justify-between">
                     <span className="font-medium text-slate-700">Workers Ativos:</span>
                     <span className="font-bold text-emerald-600">3/3</span>
                 </div>
                 <div className="mt-2 p-4 bg-slate-50 border rounded-lg flex items-center justify-between">
                     <span className="font-medium text-slate-700">Taxa de Recuperação:</span>
                     <span className="font-bold text-blue-600">99.8%</span>
                 </div>
             </CardContent>
         </Card>
         <Card>
             <CardHeader className="flex flex-row justify-between items-center">
                 <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-500" /> Últimos Healings</CardTitle>
                 <Button variant="outline" size="icon" onClick={fetchLogs}><RefreshCw className="w-4 h-4" /></Button>
             </CardHeader>
             <CardContent>
                 <div className="space-y-4">
                    {logs.length === 0 && <p className="text-sm text-slate-500">Nenhum evento de recuperação recente.</p>}
                    {logs.map((log) => (
                        <div key={log.id} className="p-3 bg-slate-50 border rounded flex justify-between items-start">
                            <div className="text-sm">
                                <p className="font-medium text-slate-800">{log.business_id}</p>
                                <p className="text-slate-500 mt-1">{log.details}</p>
                            </div>
                            <span className="text-xs text-slate-400">{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : ''}</span>
                        </div>
                    ))}
                 </div>
             </CardContent>
         </Card>
      </div>
    </div>
  );
}
