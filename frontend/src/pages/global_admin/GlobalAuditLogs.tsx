import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldAlert, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";

export default function GlobalAuditLogs() {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const q = query(collection(db, "admin_audit_logs"), orderBy("timestamp", "desc"), limit(50));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching audit logs", error);
    }
  }

  const getStatusIcon = (status?: string) => {
    if (status === "error") return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-amber-500" />;
    return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Logs de Auditoria de Segurança</h2>
        <p className="text-slate-500">Histórico de ações críticas realizadas por administradores globais.</p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
           <CardTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-500" /> Registro de Operações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-t">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Data/Hora</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Administrador</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Ação</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 && (
                   <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum log de auditoria encontrado.</td></tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                       <div className="flex items-center gap-2">
                           {getStatusIcon(log.status)}
                           <span className="capitalize text-xs font-medium">{log.status || "success"}</span>
                       </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {log.timestamp?.toDate ? format(log.timestamp.toDate(), "dd/MM/yyyy HH:mm:ss") : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{log.adminEmail}</span>
                        <span className="text-xs text-slate-400 font-mono">{log.adminUid}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-xs">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl">
                       <div className="truncate flex flex-col gap-1 text-xs">
                          {log.details?.uid && <span className="bg-slate-100 px-1.5 py-0.5 rounded border">UID Contexto: {log.details.uid}</span>}
                          {log.action.includes('ADMIN') ? (
                             <span className="truncate">{log.details?.email || JSON.stringify(log.details)}</span>
                          ) : (
                             <span className="truncate">{JSON.stringify(log.details)}</span>
                          )}
                       </div>
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
