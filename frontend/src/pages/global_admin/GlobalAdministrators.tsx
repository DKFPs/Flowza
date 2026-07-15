import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/adminLogger";

export default function GlobalAdministrators() {
  const [admins, setAdmins] = useState<Record<string, unknown>[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newUid, setNewUid] = useState("");

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
      try {
        const q = query(collection(db, "users"), where("role", "==", "admin"));
        const snap = await getDocs(q);
        setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching admins", error);
      }
  }

  async function handleAddAdmin() {
      if (!newUid || !newEmail) return toast.error("Preencha UID e Email");
      try {
          await setDoc(doc(db, "users", newUid), {
              email: newEmail,
              role: "admin",
              createdAt: new Date().toISOString()
          });
          await logAdminAction("GRANT_ADMIN", { uid: newUid, email: newEmail });
          toast.success("Admin adicionado com sucesso!");
          setNewUid("");
          setNewEmail("");
          fetchAdmins();
      } catch(e) {
          toast.error("Erro ao adicionar admin");
          console.error(e);
      }
  }

  async function handleRemoveAdmin(id: string, email: string) {
      try {
          await deleteDoc(doc(db, "users", id));
          await logAdminAction("REVOKE_ADMIN", { uid: id, email });
          toast.success("Admin removido");
          fetchAdmins();
      } catch(e) {
          toast.error("Erro ao remover");
      }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Gerenciar Administradores</h2>
        <p className="text-slate-500">Adicione ou remova permissões de administrador global.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
         <Card>
             <CardHeader>
                 <CardTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-500" /> Administradores Atuais</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="space-y-4">
                    <div className="p-3 bg-red-50 text-red-900 border border-red-100 rounded flex justify-between items-start">
                        <div className="text-sm">
                            <p className="font-bold">italocar19@gmail.com</p>
                            <p className="text-red-700/70 mt-1">Hardcoded Root Admin</p>
                        </div>
                    </div>
                    {admins.map((adm) => (
                        <div key={adm.id} className="p-3 bg-slate-50 border rounded flex justify-between items-center">
                            <div className="text-sm">
                                <p className="font-medium text-slate-800">{adm.email}</p>
                                <p className="text-slate-500 mt-1 text-xs">UID: {adm.id}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveAdmin(adm.id, adm.email)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                 </div>
             </CardContent>
         </Card>

         <Card>
             <CardHeader>
                 <CardTitle>Adicionar Novo Admin</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label>UID do Usuário (Firebase Auth)</Label>
                        <Input value={newUid} onChange={e => setNewUid(e.target.value)} placeholder="ex: 8fkR2A..." />
                    </div>
                    <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="ex: admin@flowza.com" />
                    </div>
                    <Button onClick={handleAddAdmin} className="w-full">Conceder Acesso Admin</Button>
                 </div>
             </CardContent>
         </Card>
      </div>
    </div>
  );
}
