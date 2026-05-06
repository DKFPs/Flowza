import { useState, useEffect } from "react";
import { collection, query, getDocs, limit, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Database, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/adminLogger";

const COLLECTIONS = [
  "businesses",
  "users",
  "appointments",
  "clients",
  "system_events",
  "learning_insights",
  "admin_audit_logs"
];

export default function GlobalDatabase() {
  const [selectedCol, setSelectedCol] = useState(COLLECTIONS[0]);
  const [docs, setDocs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchDocs() {
     setLoading(true);
     try {
         const q = query(collection(db, selectedCol), limit(100)); // Limit for safety
         const snap = await getDocs(q);
         setDocs(snap.docs.map(d => ({ id: d.id, _data: d.data() })));
     } catch (e) {
         console.error("Error fetching docs", e);
         toast.error("Erro ao carregar documentos.");
     } finally {
         setLoading(false);
     }
  }

  useEffect(() => {
     fetchDocs();
  }, [selectedCol]);

  async function handleDelete(id: string) {
     try {
         await deleteDoc(doc(db, selectedCol, id));
         await logAdminAction("DELETE_DOCUMENT", { collection: selectedCol, documentId: id });
         toast.success("Documento excluído da base de dados.");
         setDocs(docs.filter(d => d.id !== id));
     } catch(e) {
         console.error("Erro ao excluir", e);
         toast.error("Erro ao excluir documento. Verifique as permissões de segurança.");
         await logAdminAction("DELETE_DOCUMENT_FAILED", { collection: selectedCol, documentId: id, error: String(e) }, "error");
     }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-600" /> Controle de Banco de Dados
          </h2>
          <p className="text-slate-500">Visualização e edição direta dos documentos do Firestore.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
         <Card className="md:w-64 flex-shrink-0 self-start border-slate-200">
            <CardHeader className="py-4 bg-slate-50 border-b">
                <CardTitle className="text-sm text-slate-700">Coleções</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="flex flex-col">
                  {COLLECTIONS.map(col => (
                     <button
                        key={col}
                        onClick={() => setSelectedCol(col)}
                        className={`text-left px-4 py-3 text-sm font-medium transition-colors ${selectedCol === col ? 'bg-indigo-50 text-indigo-700 border-l-2 border-indigo-600' : 'border-l-2 border-transparent text-slate-600 hover:bg-slate-50'}`}
                     >
                        {col}
                     </button>
                  ))}
               </div>
            </CardContent>
         </Card>

         <Card className="flex-1 border-slate-200 min-w-0">
            <CardHeader className="py-4 flex flex-row items-center justify-between bg-slate-50 border-b">
                <CardTitle className="text-sm font-mono text-slate-700 flex items-center gap-2">
                    /{selectedCol} 
                    {loading && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100/50 px-2.5 py-1 rounded border border-amber-200 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> Exibindo limite de 100 registros
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-100/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium text-slate-600 w-48">ID do Documento</th>
                      <th className="px-4 py-3 font-medium text-slate-600">Dados Armazenados</th>
                      <th className="px-4 py-3 font-medium text-slate-600 w-16">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {docs.length === 0 && !loading && (
                        <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-500">Nenhum documento encontrado nesta coleção.</td></tr>
                    )}
                    {docs.map(doc => (
                        <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                           <td className="px-4 py-3 font-mono text-xs text-slate-700">{doc.id}</td>
                           <td className="px-4 py-3 font-mono text-xs text-slate-500">
                               <div className="max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-2xl xl:max-w-3xl truncate" title={JSON.stringify(doc._data, null, 2)}>
                                   {JSON.stringify(doc._data)}
                               </div>
                           </td>
                           <td className="px-4 py-3">
                               <Button variant="ghost" size="icon" title="Excluir documento" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors" onClick={() => handleDelete(doc.id)}>
                                   <Trash2 className="w-4 h-4" />
                               </Button>
                           </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
