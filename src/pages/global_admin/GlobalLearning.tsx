import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Brain, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function GlobalLearning() {
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const q = query(collection(db, "learning_insights"), orderBy("timestamp", "desc"), limit(20));
        const snap = await getDocs(q);
        setInsights(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error global learning insights", error);
      }
    }
    fetchInsights();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Aprendizado Contínuo (IA Global)</h2>
        <p className="text-slate-500">Insights gerados pela IA analisando padrões através de múltiplos tenants.</p>
      </div>

      <div className="grid gap-6">
         <Card>
             <CardHeader>
                 <CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-purple-500" /> Descobertas Recentes</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="space-y-4">
                    {insights.length === 0 && <p className="text-sm text-slate-500">Nenhum insight global gerado ainda.</p>}
                    {insights.map((ins) => (
                        <div key={ins.id} className="p-4 bg-slate-50 border border-slate-100 shadow-sm rounded-lg flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-slate-900">{ins.category || 'Recomendação de IA'}</h4>
                                    <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-200 bg-indigo-50">{ins.businessId}</Badge>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">{ins.description}</p>
                            </div>
                        </div>
                    ))}
                 </div>
             </CardContent>
         </Card>
      </div>
    </div>
  );
}
