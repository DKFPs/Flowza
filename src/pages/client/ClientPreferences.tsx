import { useEffect, useState } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  limit
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Heart, Clock, User, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Service, Professional } from "@/types";

const ClientPreferences = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  const [favoriteServices, setFavoriteServices] = useState<string[]>([]);
  const [preferredProfessional, setPreferredProfessional] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const clientQuery = query(collection(db, "clients"), where("user_id", "==", user.uid), limit(1));
        const clientSnap = await getDocs(clientQuery);

        if (clientSnap.empty) {
          setLoading(false);
          return;
        }

        const client = clientSnap.docs[0];
        const clientData = client.data();
        setClientId(client.id);
        const bizId = clientData.business_id;
        setNotes(clientData.notes || "");

        const prefsResource = clientData.preferences || {};
        setFavoriteServices(prefsResource.favorite_services || []);
        setPreferredProfessional(prefsResource.preferred_professional || "");
        setPreferredTime(prefsResource.preferred_time || "");
        setAllergies(prefsResource.allergies || "");

        // Load services and professionals
        const [svcSnap, proSnap] = await Promise.all([
          getDocs(query(collection(db, "services"), where("business_id", "==", bizId), where("is_active", "==", true))),
          getDocs(query(collection(db, "professionals"), where("business_id", "==", bizId), where("is_active", "==", true)))
        ]);

        setServices(svcSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
        setProfessionals(proSnap.docs.map(d => ({ id: d.id, ...d.data() } as Professional)));

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const toggleService = (id: string) => {
    setFavoriteServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!clientId) return;
    setSaving(true);

    const preferences = {
      favorite_services: favoriteServices,
      preferred_professional: preferredProfessional,
      preferred_time: preferredTime,
      allergies,
    };

    try {
      await updateDoc(doc(db, "clients", clientId), {
        preferences,
        notes
      });
      toast({ title: "Preferências salvas!" });
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!clientId) {
    return (
      <div className="text-center py-16">
        <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">Sem vínculo</h3>
        <p className="text-muted-foreground">Faça um agendamento para configurar suas preferências.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Minhas Preferências</h1>

      {/* Serviços favoritos */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" /> Serviços Favoritos
        </h2>
        <div className="flex flex-wrap gap-2">
          {services.map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => toggleService(svc.id)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                favoriteServices.includes(svc.id)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {svc.name}
            </button>
          ))}
          {services.length === 0 && <p className="text-sm text-muted-foreground">Nenhum serviço disponível.</p>}
        </div>
      </div>

      {/* Profissional preferido */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Profissional Preferido
        </h2>
        <Select value={preferredProfessional} onValueChange={setPreferredProfessional}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um profissional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem preferência</SelectItem>
            {professionals.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Horário preferido */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Horário Preferido
        </h2>
        <Select value={preferredTime} onValueChange={setPreferredTime}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem preferência</SelectItem>
            <SelectItem value="morning">Manhã (8h - 12h)</SelectItem>
            <SelectItem value="afternoon">Tarde (12h - 18h)</SelectItem>
            <SelectItem value="evening">Noite (18h - 21h)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alergias */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" /> Alergias / Restrições
        </h2>
        <Textarea
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          placeholder="Ex: Alergia a látex, sensibilidade a certos produtos..."
          rows={3}
        />
      </div>

      {/* Observações */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground">Observações Gerais</h2>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Algo que o profissional deve saber..."
          rows={3}
        />
      </div>

      <Button onClick={handleSave} className="w-full" disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Salvar Preferências
      </Button>
    </div>
  );
};

export default ClientPreferences;
