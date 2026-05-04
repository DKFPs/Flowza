import { useState, useEffect } from "react";
import { collection, query, getDocs, limit, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Building2, RefreshCw, Crown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/adminLogger";
import { PLANS, PlanId } from "@/lib/plans";
import { format } from "date-fns";

export default function GlobalTenants() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function fetchBusinesses() {
     setLoading(true);
     try {
         const q = query(collection(db, "businesses"), limit(100)); // We can add pagination later
         const snap = await getDocs(q);
         setBusinesses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
     } catch (e) {
         console.error("Error fetching businesses", e);
         toast.error("Erro ao carregar clientes/businesses.");
     } finally {
         setLoading(false);
     }
  }

  useEffect(() => {
     fetchBusinesses();
  }, []);

  async function handlePlanChange(bizId: string, oldPlan: string, newPlan: string, name?: string) {
      setUpdatingId(bizId);
      try {
          await updateDoc(doc(db, "businesses", bizId), {
              plan_id: newPlan
          });
          
          await logAdminAction("CHANGE_TENANT_PLAN", { 
              bizId, 
              name, 
              oldPlan, 
              newPlan 
          });
          
          toast.success("Plano atualizado com sucesso!");
          
          setBusinesses(prev => prev.map(b => b.id === bizId ? { ...b, plan_id: newPlan } : b));
      } catch (e) {
          console.error("Error updating plan", e);
          toast.error("Erro ao atualizar o plano. Verifique as permissões de segurança.");
          await logAdminAction("CHANGE_TENANT_PLAN_FAILED", { bizId, error: String(e) }, "error");
      } finally {
          setUpdatingId(null);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" /> Clientes (Tenants) e Planos
          </h2>
          <p className="text-slate-500">Gerencie os negócios cadastrados e controle atualizações de planos manualmente.</p>
        </div>
        <Button onClick={fetchBusinesses} disabled={loading} variant="outline" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="py-4 bg-slate-50 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Todos os Clientes
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-100/50 border-b">
                    <tr>
                        <th className="px-4 py-3 text-slate-600 w-1/4">Business / ID</th>
                        <th className="px-4 py-3 text-slate-600 w-1/4">Owner Info</th>
                        <th className="px-4 py-3 text-slate-600">Criado em</th>
                        <th className="px-4 py-3 text-slate-600 w-1/4">Plano Atual</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {businesses.length === 0 && !loading && (
                        <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">Nenhum tenant encontrado.</td></tr>
                    )}
                    {businesses.map(biz => (
                        <tr key={biz.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-4 py-3">
                                <div className="font-semibold text-slate-800">{biz.name || 'Sem nome'}</div>
                                <div className="font-mono text-xs text-slate-400 mt-0.5">{biz.id}</div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="text-slate-700 truncate max-w-[200px]">{biz.email || 'Email não disponível'}</div>
                                <div className="font-mono text-xs text-slate-400 mt-0.5" title={biz.owner_id}>{biz.owner_id}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">
                                {biz.created_at?.toDate ? format(biz.created_at.toDate(), "dd/MM/yyyy HH:mm") : '-'}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    {updatingId === biz.id ? (
                                        <div className="flex items-center gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                                            <span className="text-xs text-indigo-600 font-medium">Atualizando...</span>
                                        </div>
                                    ) : (
                                        <select 
                                            className={`text-sm h-9 px-3 rounded border font-medium outline-none transition-colors ${
                                                biz.plan_id === PlanId.PREMIUM ? 'bg-amber-100/50 border-amber-200 text-amber-700 focus:ring-amber-500' :
                                                biz.plan_id === PlanId.BUSINESS ? 'bg-blue-100/50 border-blue-200 text-blue-700 focus:ring-blue-500' :
                                                biz.plan_id === PlanId.PRO ? 'bg-green-100/50 border-green-200 text-green-700 focus:ring-green-500' :
                                                'bg-white border-slate-200 text-slate-700 focus:ring-indigo-500'
                                            }`}
                                            value={biz.plan_id || PlanId.FREE}
                                            onChange={(e) => handlePlanChange(biz.id, biz.plan_id || PlanId.FREE, e.target.value, biz.name)}
                                        >
                                            <option value={PlanId.FREE}>Free</option>
                                            <option value={PlanId.PRO}>Pro</option>
                                            <option value={PlanId.BUSINESS}>Business</option>
                                            <option value={PlanId.PREMIUM}>Premium</option>
                                        </select>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </CardContent>
      </Card>
    </div>
  );
}
