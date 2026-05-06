import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertTriangle, Activity, CheckCircle, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function GlobalObservability() {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error global logs", error);
      }
    }
    fetchLogs();
  }, []);

  const getStatusIcon = (status: string, level: string) => {
    if (level === "error" || status === "failure") return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (level === "warn") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (status === "ai_insight") return <Brain className="h-4 w-4 text-purple-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Observabilidade Global</h2>
        <p className="text-slate-500">Acompanhe falhas e eventos ocorrendo em todo o sistema, sem filtro de tenant.</p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium text-slate-500">Status</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Business ID</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Evento</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Mensagem</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 && (
                   <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum log no momento.</td></tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status, log.level)}
                        <span className="capitalize font-medium">{log.level}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">{log.business_id || "Sistema"}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{log.action || log.event}</td>
                    <td className="px-6 py-4 text-slate-600 max-w-md truncate">{log.message || JSON.stringify(log.details)}</td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : new Date().toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
