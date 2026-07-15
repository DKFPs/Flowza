import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { 
  AlertTriangle, 
  Activity, 
  CheckCircle, 
  Brain, 
  Cpu, 
  HardDrive, 
  Zap, 
  Layers, 
  Clock, 
  Bell,
  RefreshCw,
  ServerCrash
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

export default function GlobalObservability() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState({
    cpuUsage: 22,
    memoryUsage: 48,
    activeRequests: 14,
    queueSize: 0,
    apiLatency: 92,
  });

  // Simulated live resource updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemHealth(prev => ({
        cpuUsage: Math.floor(18 + Math.random() * 12),
        memoryUsage: Math.floor(45 + Math.random() * 4),
        activeRequests: Math.floor(10 + Math.random() * 10),
        queueSize: Math.max(0, Math.floor(Math.random() * 2)),
        apiLatency: Math.floor(85 + Math.random() * 15),
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error global logs", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const getStatusIcon = (status: string, level: string) => {
    if (level === "error" || status === "failure") return <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />;
    if (level === "warn") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (status === "ai_insight") return <Brain className="h-4 w-4 text-purple-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  // Pre-configured simulation alert checks
  const alertsList = [
    { id: "api_500", name: "Erro 500 API Gateway", status: "healthy", description: "Todos os gateways de API respondendo com status 200/300" },
    { id: "stripe", name: "Integração Stripe Checkout", status: "healthy", description: "Sincronização de assinaturas e webhooks ativa" },
    { id: "webhooks", name: "Fila de Webhooks", status: "healthy", description: "Taxa de entrega de webhooks de terceiros em 100%" },
    { id: "queue", name: "Fila de Automações & Agendamentos", status: "healthy", description: "Delay de processamento abaixo de 2s" },
    { id: "memory", name: "Memory Leak & CPU Throttling", status: "healthy", description: "Uso de Heap estável e livre de sobrecarga de memória" },
    { id: "timeout", name: "Timeout de Conexão Firestore", status: "healthy", description: "Tempo de resposta do banco dentro de limites saudáveis" }
  ];

  // Visual latency tracking chart dataset
  const latencyTimeline = [
    { time: "14:00", latency: 89, reqs: 14 },
    { time: "14:10", latency: 95, reqs: 18 },
    { time: "14:20", latency: 92, reqs: 12 },
    { time: "14:30", latency: 104, reqs: 22 },
    { time: "14:40", latency: 88, reqs: 15 },
    { time: "14:50", latency: 91, reqs: 19 },
    { time: "15:00", latency: systemHealth.apiLatency, reqs: systemHealth.activeRequests },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Observabilidade & Monitoramento</h2>
          <p className="text-slate-500 text-sm">Acompanhe telemetria de infraestrutura, status de conexões, integridade de APIs e filas de eventos.</p>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl font-bold h-10 gap-2 border-slate-200" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4" /> Recarregar Dados
        </Button>
      </div>

      {/* System Resources Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="rounded-2xl border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Uso de CPU</span>
            <Cpu className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-900 tabular-nums">{systemHealth.cpuUsage}%</h3>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${systemHealth.cpuUsage}%` }} />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Memória (Heap)</span>
            <HardDrive className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-900 tabular-nums">{systemHealth.memoryUsage}%</h3>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-purple-500 h-full transition-all duration-1000" style={{ width: `${systemHealth.memoryUsage}%` }} />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Requests Ativas</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-900 tabular-nums">{systemHealth.activeRequests} req/s</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Nginx Ingress Proxy</p>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Fila de Eventos</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-900 tabular-nums">{systemHealth.queueSize} itens</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Sem Gargalos Ativos</p>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Latência de API</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-900 tabular-nums">{systemHealth.apiLatency}ms</h3>
            <p className="text-[10px] text-emerald-600 font-black uppercase mt-2">⚡ Excelente</p>
          </div>
        </Card>
      </div>

      {/* Latency and telemetry charts */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Latency Timeline Chart */}
        <Card className="rounded-2xl border-slate-200 shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-black tracking-tight">Latência das APIs em Tempo Real</CardTitle>
            <CardDescription className="text-xs">Tempo médio de resposta dos endpoints `/api/*` em milissegundos</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyTimeline}>
                <defs>
                  <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="latency" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#latencyGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Realtime Alarms Panel */}
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" /> Painel de Alertas Ativos
            </CardTitle>
            <CardDescription className="text-xs">Status operacional de gatilhos críticos do ecossistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {alertsList.map((alert) => (
              <div key={alert.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-start gap-2.5">
                <div className="mt-0.5">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {alert.name}
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[8px] px-1 py-0 border-0 uppercase">Saudável</Badge>
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight">{alert.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Live Logging Streams */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle className="text-lg font-black tracking-tight">Stream de Eventos do Sistema</CardTitle>
            <CardDescription className="text-xs">Transações do Firestore, erros de frontend, requisições de backend e auditoria</CardDescription>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold bg-slate-50 border px-3 py-1.5 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
            Conexão Live Ativa
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Status/Gravidade</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Business ID</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Ação / Evento</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Mensagem de Telemetria</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-xs font-medium">
                      Nenhum evento registrado no log do Firestore no momento.
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status, log.level)}
                        <span className="capitalize font-bold text-slate-800 text-xs">{log.level || "info"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{log.business_id || "Sistema Global"}</td>
                    <td className="px-6 py-4 font-bold text-slate-900 text-xs">{log.action || log.event || "api_request"}</td>
                    <td className="px-6 py-4 text-slate-600 max-w-md truncate text-xs">{log.message || JSON.stringify(log.details)}</td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs">
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
