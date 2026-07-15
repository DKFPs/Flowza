import { useState, useEffect } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Percent, DollarSign, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Discount {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  current_uses: number;
  max_uses?: number;
  is_active: boolean;
}

export default function GlobalCoupons() {
  const [coupons, setCoupons] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Coupon Form
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState<'percentage' | 'fixed'>("percentage");
  const [newValue, setNewValue] = useState("");

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "discounts"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Discount));
      setCoupons(data);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar cupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreateCoupon = async () => {
    if (!newCode || !newValue) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const codeUpper = newCode.toUpperCase().trim();
    const parsedValue = Number(newValue);

    if (isNaN(parsedValue) || parsedValue <= 0) {
      toast.error("O valor de desconto deve ser um número positivo");
      return;
    }

    if (newType === 'percentage' && parsedValue > 100) {
      toast.error("O desconto percentual não pode ser maior que 100%");
      return;
    }

    setIsSubmitting(true);
    try {
      // Usamos setDoc para que o ID do documento possa ser o próprio promo_CODE ou semelhante,
      // ou apenas addDoc sem id específico.
      await addDoc(collection(db, "discounts"), {
        code: codeUpper,
        type: newType,
        value: parsedValue,
        current_uses: 0,
        is_active: true,
        createdAt: serverTimestamp()
      });

      toast.success("Cupom criado com sucesso");
      setIsDialogOpen(false);
      setNewCode("");
      setNewValue("");
      fetchCoupons();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar cupom");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCouponStatus = async (couponId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "discounts", couponId), {
        is_active: !currentStatus
      });
      setCoupons(c => c.map(cup => cup.id === couponId ? { ...cup, is_active: !currentStatus } : cup));
      toast.success("Status atualizado");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar cupom");
    }
  };

  const deleteCoupon = async (couponId: string) => {
    try {
      await deleteDoc(doc(db, "discounts", couponId));
      setCoupons(c => c.filter(cup => cup.id !== couponId));
      toast.success("Cupom excluído");
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, "discounts");
      toast.error("Erro ao excluir cupom");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Cupons de Desconto (Stripe)</h2>
          <p className="text-muted-foreground mt-1">Gerencie os cupons da plataforma. Lembre-se, o código do cupom deve ser **idêntico** ao ID do Cupom (ou código promocional) que você criou na <a href="https://dashboard.stripe.com/coupons" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Stripe</a>.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Cupom</DialogTitle>
              <DialogDescription>Crie o cupom na Stripe primeiro, e adicione o código aqui para que os clientes possam validá-lo no app.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Código do Cupom</Label>
                <Input 
                  placeholder="EX: START30"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value.toUpperCase())}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Desconto</Label>
                <div className="flex items-center gap-4">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" value="percentage" checked={newType === 'percentage'} onChange={() => setNewType('percentage')} />
                    Porcentagem (%)
                  </Label>
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" value="fixed" checked={newType === 'fixed'} onChange={() => setNewType('fixed')} />
                    Valor Fixo (R$)
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor / Quantia</Label>
                <Input 
                  type="number"
                  placeholder={newType === 'percentage' ? "Ex: 30" : "Ex: 50.00"}
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateCoupon} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Cupom
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cupons Ativos</CardTitle>
          <CardDescription>Lista de promoções criadas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
              Nenhum cupom cadastrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map(coupon => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono font-medium">
                      {coupon.code}
                    </TableCell>
                    <TableCell>
                      {coupon.type === 'percentage' ? (
                        <div className="flex items-center text-muted-foreground"><Percent className="w-3 h-3 mr-1" /> Perc.</div>
                      ) : (
                        <div className="flex items-center text-muted-foreground"><DollarSign className="w-3 h-3 mr-1" /> Fixo</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {coupon.type === 'percentage' ? `${coupon.value}%` : `R$ ${coupon.value}`}
                    </TableCell>
                    <TableCell>
                      {coupon.current_uses} {coupon.max_uses ? `/ ${coupon.max_uses}` : ''}
                    </TableCell>
                    <TableCell>
                      {coupon.is_active ? 
                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1"/>Ativo</Badge> : 
                        <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100"><Ban className="w-3 h-3 mr-1"/>Inativo</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-2">
                         <Switch 
                           checked={coupon.is_active}
                           onCheckedChange={() => toggleCouponStatus(coupon.id, coupon.is_active)}
                         />
                         <AlertDialog>
                           <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </AlertDialogTrigger>
                           <AlertDialogContent>
                             <AlertDialogHeader>
                               <AlertDialogTitle>Excluir Cupom Permanente?</AlertDialogTitle>
                               <AlertDialogDescription>
                                 Esta ação não pode ser desfeita. O cupom será permanentemente removido e clientes não poderão mais usá-lo.
                               </AlertDialogDescription>
                             </AlertDialogHeader>
                             <AlertDialogFooter>
                               <AlertDialogCancel>Cancelar</AlertDialogCancel>
                               <AlertDialogAction 
                                 onClick={() => deleteCoupon(coupon.id)}
                                 className="bg-red-600 hover:bg-red-700 text-white"
                               >
                                 Sim, excluir cupom
                               </AlertDialogAction>
                             </AlertDialogFooter>
                           </AlertDialogContent>
                         </AlertDialog>
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
