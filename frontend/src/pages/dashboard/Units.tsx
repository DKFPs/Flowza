import { useEffect, useState, useCallback } from "react";
import { 
  collection, 
  query, 
  where,
  getDocs,
  doc,
  orderBy,
  writeBatch,
  increment,
  serverTimestamp
} from "firebase/firestore";
import { compressImage } from "@/lib/imageUtils";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestoreUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, MapPin, Zap, Navigation, Search, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Unit, PlanId } from "@shared/types";
import LeafletMap from "@/components/ui/LeafletMap";

const Units = () => {
  const { user } = useAuth();
  const { business, limits, usage } = useBusiness();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ 
    id: "",
    name: "", 
    address: "", 
    city: "", 
    state: "", 
    phone: "", 
    latitude: undefined as number | undefined, 
    longitude: undefined as number | undefined,
    description: "",
    image_url: "",
    file: null as File | null
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-23.55052, -46.633308]);
  const [searchLoading, setSearchLoading] = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.address) {
        const { road, house_number, city, town, village, state } = data.address;
        const newAddress = road ? `${road}${house_number ? `, ${house_number}` : ''}` : '';
        const newCity = city || town || village || '';
        const newState = state || '';
        
        setForm(prev => ({ 
          ...prev, 
          address: newAddress || prev.address,
          city: newCity || prev.city,
          state: newState || prev.state,
        }));
        
        toast({ title: "Endereço encontrado!", description: "Os campos de endereço foram preenchidos." });
      }
    } catch (error) {
      console.error("Erro ao buscar endereço", error);
    }
  };

  const fetchData = useCallback(async () => {
    if (!user || !business) return;
    try {
      const q = query(collection(db, "units"), where("business_id", "==", business.id));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit));
      const sortedData = data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setUnits(sortedData);
      if (sortedData.length > 0 && sortedData[0].latitude && sortedData[0].longitude) {
        setMapCenter([sortedData[0].latitude, sortedData[0].longitude]);
      }
    } catch (error) {
      console.error("Error fetching units:", error);
    } finally {
      setFetching(false);
    }
  }, [user, business]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const searchAddress = async () => {
    if (!form.address) return;
    setSearchLoading(true);
    try {
      // Nominatim search for OpenStreetMap
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        // Extract display name parts
        const displayName = result.display_name || "";
        const parts = displayName.split(", ");
        
        // Very basic extraction of city/state if available
        // Usually parts are [Street, Neighborhood, City, State, ZIP, Country] but it varies
        const city = parts[parts.length - 4] || "";
        const state = parts[parts.length - 3] || "";

        setForm(prev => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          city: prev.city || city,
          state: prev.state || state
        }));
        setMapCenter([lat, lon]);
        toast({ title: "Endereço localizado!" });
      } else {
        toast({ title: "Endereço não encontrado", variant: "destructive" });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({ title: "Erro na busca", variant: "destructive" });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    if (!form.id && usage.units >= (limits.multiUnit ? 999 : 1)) {
      toast({ 
        title: "Limite de unidades atingido", 
        description: `Seu plano atual permite apenas ${(limits.multiUnit ? 999 : 1)} unidade(s).`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let imageUrl = form.image_url;
      if (form.file) {
        try {
          imageUrl = await compressImage(form.file);
        } catch (error: any) {
          toast({ title: "Erro no Upload", description: "Ocorreu um erro ao processar a imagem.", variant: "destructive" });
          throw error;
        }
      }

      const batch = writeBatch(db);
      
      if (form.id) {
        const unitRef = doc(db, "units", form.id);
        const updateData: any = {
          name: form.name,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          phone: form.phone || null,
          latitude: form.latitude ?? null,
          longitude: form.longitude ?? null,
          description: form.description || null,
        };
        if (imageUrl) {
          updateData.image_url = imageUrl;
        }
        batch.update(unitRef, updateData);
      } else {
        const newUnitRef = doc(collection(db, "units"));
        batch.set(newUnitRef, { 
          business_id: business.id, 
          name: form.name,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          phone: form.phone || null,
          latitude: form.latitude ?? null,
          longitude: form.longitude ?? null,
          description: form.description || null,
          image_url: imageUrl || null,
          is_active: true,
          created_at: serverTimestamp()
        });

        batch.update(doc(db, "businesses", business.id), {
          usage_units: increment(1)
        });
      }

      await batch.commit();

      toast({ title: form.id ? "Unidade atualizada!" : "Unidade criada!" });
      setDialogOpen(false);
      setForm({ id: "", name: "", address: "", city: "", state: "", phone: "", latitude: undefined, longitude: undefined, description: "", image_url: "", file: null });
      fetchData();
    } catch (error: unknown) {
      handleFirestoreError(error, form.id ? OperationType.UPDATE : OperationType.CREATE, "units");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!business) return;
    if (!window.confirm("Deseja realmente excluir esta unidade?")) return;
    
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "units", id));
      batch.update(doc(db, "businesses", business.id), {
        usage_units: increment(-1)
      });
      await batch.commit();

      toast({ title: "Unidade removida" });
      fetchData();
    } catch (error: unknown) {
      handleFirestoreError(error, OperationType.DELETE, `units/${id}`);
    }
  };

  if (fetching) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Unidades</h1>
        <Button onClick={() => {
          setForm({ id: "", name: "", address: "", city: "", state: "", phone: "", latitude: undefined, longitude: undefined, description: "", image_url: "", file: null });
          setDialogOpen(true);
        }} className="gap-2"><Plus className="w-4 h-4" />Nova Unidade</Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {units.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
              <p className="text-muted-foreground">Nenhuma unidade cadastrada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {units.map((u) => (
                <div 
                  key={u.id} 
                  className="bg-card rounded-xl border border-border p-4 flex items-start justify-between group hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => u.latitude && u.longitude && setMapCenter([u.latitude, u.longitude])}
                >
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{u.address || "Sem endereço"}</p>
                      {u.phone && <p className="text-xs text-muted-foreground mt-1">{u.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setForm({
                          id: u.id,
                          name: u.name,
                          address: u.address || "",
                          city: u.city || "",
                          state: u.state || "",
                          phone: u.phone || "",
                          latitude: u.latitude,
                          longitude: u.longitude,
                          description: u.description || "",
                          image_url: u.image_url || "",
                          file: null
                        });
                        setDialogOpen(true);
                      }} 
                        className="text-muted-foreground hover:text-primary p-2 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }} 
                      className="text-muted-foreground hover:text-destructive p-2 transition-colors"
                      disabled={units.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {usage.units >= (limits.multiUnit ? 999 : 1) && (limits.multiUnit ? 999 : 1) < 999 && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-primary" />
                <p className="text-xs text-foreground font-medium">Limite de unidades atingido.</p>
              </div>
              <Button variant="outline" size="sm" className="w-full">Fazer Upgrade</Button>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 h-[400px] lg:h-auto min-h-[400px] rounded-xl border border-border overflow-hidden shadow-sm z-0">
          <LeafletMap 
            center={mapCenter} 
            zoom={13} 
            markers={units.filter(u => u.latitude && u.longitude).map(u => ({
              id: u.id,
              position: [u.latitude!, u.longitude!],
              title: u.name,
              popup: u.address
            }))}
          />
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Unidade</label>
                <Input 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  required 
                  placeholder="Ex: Unidade Centro" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <Input 
                  value={form.description} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                  placeholder="Detalhes sobre a unidade..." 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Endereço Completo</label>
                <div className="flex gap-2">
                  <Input 
                    value={form.address} 
                    onChange={(e) => setForm({ ...form, address: e.target.value })} 
                    placeholder="Rua, Número, Bairro..." 
                    required
                  />
                  <Button 
                    type="button" 
                    size="icon" 
                    variant="outline" 
                    onClick={searchAddress}
                    disabled={searchLoading}
                  >
                    {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground italic">Dica: Digite o endereço e clique na lupa para localizar no mapa e preencher a região.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cidade</label>
                  <Input 
                    value={form.city} 
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">UF</label>
                  <Input 
                    value={form.state} 
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="Estado"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Telefone de Contato</label>
                <Input 
                  value={form.phone} 
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Foto (Opcional)</label>
                <div className="flex items-center gap-3">
                  {form.image_url && !form.file && (
                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                      <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} 
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" 
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg flex gap-3">
                <Navigation className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700">A localização exata no mapa ajuda seus clientes a encontrarem sua unidade mais facilmente. Clique no mapa ao lado para ajustar o marcador.</p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Salvar Unidade
              </Button>
            </div>

            <div className="flex flex-col space-y-2 h-[300px] lg:h-auto min-h-[300px]">
               <label className="text-sm font-medium">Localização no Mapa</label>
               <p className="text-[10px] text-muted-foreground">Clique em qualquer lugar do mapa para mover o pino e definir a localização exata.</p>
               <div className="flex-1 rounded-xl border border-border overflow-hidden relative shadow-inner">
                 <LeafletMap 
                   center={[form.latitude || mapCenter[0], form.longitude || mapCenter[1]]} 
                   zoom={form.latitude && form.longitude ? 16 : 13} 
                   markers={form.latitude && form.longitude ? [{
                     id: "form-marker",
                     position: [form.latitude, form.longitude],
                     title: form.name || "Nova Unidade",
                     popup: form.address || "Localização selecionada"
                   }] : []}
                   onClickMap={reverseGeocode}
                 />
               </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Units;
