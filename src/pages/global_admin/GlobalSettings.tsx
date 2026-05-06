import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { OperationType, handleFirestoreError } from "@/lib/firebase";
import { PLANS, PlanId } from "@/lib/plans";

export default function GlobalSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [trialDays, setTrialDays] = useState<number | "">("");
  const [trialPlanId, setTrialPlanId] = useState<string>(PlanId.PREMIUM);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "platform_settings", "global"));
        if (settingsDoc.exists()) {
          setTrialDays(settingsDoc.data().trial_days || "");
          if (settingsDoc.data().trial_plan_id) {
            setTrialPlanId(settingsDoc.data().trial_plan_id);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "platform_settings/global");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "platform_settings", "global"), {
        trial_days: trialDays === "" ? 0 : Number(trialDays),
        trial_plan_id: trialPlanId,
        updated_at: serverTimestamp()
      }, { merge: true });
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, "platform_settings/global");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Configurações da Plataforma</h2>
        <p className="text-muted-foreground mt-1">Configure regras de negócio, limites e comportamentos globais.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Período de Teste (Free Trial)</CardTitle>
          <CardDescription>
            Defina quantos dias de trial e qual plano um novo negócio/tenant recebe ao se cadastrar. Deixe os dias em 0 para não dar trial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
                <div className="space-y-2">
                  <Label>Dias de Trial</Label>
                  <Input 
                    type="number"
                    placeholder="Ex: 7"
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Plano do Trial</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={trialPlanId}
                    onChange={(e) => setTrialPlanId(e.target.value)}
                  >
                    {Object.values(PLANS).map(plan => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Configurações
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
