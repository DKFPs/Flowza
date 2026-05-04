import { useState, useMemo } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useBusiness } from "@/contexts/BusinessContext";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Client } from "@/types";
import { Search, UserPlus, FileDown, MoreHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { LoyaltyService } from "@/services/loyaltyService";

const Clients = () => {
  const { business } = useBusiness();
  const [searchTerm, setSearchTerm] = useState("");
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [pointsToAdd, setPointsToAdd] = useState<number>(0);
  const [addingPoints, setAddingPoints] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const q = query(
        collection(db, "clients"), 
        where("business_id", "==", business.id), 
        orderBy("name")
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
    },
    enabled: !!business?.id,
  });

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const lowerTerm = searchTerm.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(lowerTerm) || 
      c.email?.toLowerCase().includes(lowerTerm) || 
      c.phone?.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const handleAddPoints = async () => {
    if (!selectedClient || !business?.id || pointsToAdd <= 0) return;
    setAddingPoints(true);
    try {
      await LoyaltyService.awardBonusPoints(business.id, selectedClient.id, pointsToAdd, 'manual_addition');
      toast({ title: "Pontos adicionados com sucesso!" });
      setPointsModalOpen(false);
      setPointsToAdd(0);
      setSelectedClient(null);
    } catch (e: any) {
      toast({ title: "Erro ao adicionar pontos", description: e.message, variant: "destructive" });
    } finally {
      setAddingPoints(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seu banco de dados de clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl gap-2 hidden md:flex">
            <FileDown className="w-4 h-4" /> Exportar
          </Button>
          <Button size="sm" className="h-10 px-5 rounded-xl gap-2 bg-primary shadow-lg shadow-primary/20">
            <UserPlus className="w-4 h-4" /> Novo Cliente
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-card border border-border px-4 py-1 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome, email ou telefone..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-none shadow-none focus-visible:ring-0 text-sm h-10 px-0"
        />
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="w-32 h-4" />
                  <Skeleton className="w-24 h-3" />
                </div>
              </div>
              <Skeleton className="w-4 h-4 rounded-full" />
            </div>
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground opacity-20" />
          </div>
          <p className="text-muted-foreground font-medium">
            {searchTerm ? "Nenhum cliente encontrado para esta busca." : "Nenhum cliente cadastrado ainda."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-4">Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-4 hidden sm:table-cell">Contato</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-4 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/10 border-b border-border last:border-0">
                    <TableCell className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {c.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm leading-tight">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground sm:hidden">{c.phone || c.email || "Sem contato"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 hidden sm:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium">{c.phone || "—"}</span>
                        <span className="text-[10px] text-muted-foreground">{c.email || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedClient(c);
                            setPointsToAdd(10);
                            setPointsModalOpen(true);
                          }}>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Adicionar Pontos
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={pointsModalOpen} onOpenChange={setPointsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Pontos de Fidelidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Quantos pontos você quer adicionar para <strong>{selectedClient?.name}</strong>?
            </p>
            <div className="space-y-2">
              <Label>Quantidade de Pontos</Label>
              <Input
                type="number"
                value={pointsToAdd}
                onChange={e => setPointsToAdd(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddPoints} disabled={addingPoints}>
              {addingPoints ? "Adicionando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
