import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { MessageSquarePlus, AlertTriangle, Lightbulb, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const getOS = () => {
  const ua = window.navigator.userAgent;
  if (ua.indexOf("Win") !== -1) return "Windows";
  if (ua.indexOf("Mac") !== -1) return "macOS";
  if (ua.indexOf("Linux") !== -1) return "Linux";
  if (ua.indexOf("Android") !== -1) return "Android";
  if (ua.indexOf("like Mac") !== -1) return "iOS";
  return "Unknown OS";
};

const getBrowser = () => {
  const ua = window.navigator.userAgent;
  if (ua.indexOf("Chrome") !== -1) return "Google Chrome";
  if (ua.indexOf("Safari") !== -1) return "Safari";
  if (ua.indexOf("Firefox") !== -1) return "Firefox";
  if (ua.indexOf("Edge") !== -1) return "Microsoft Edge";
  return "Other Browser";
};

export function FeedbackWidget() {
  const { user } = useAuth();
  const { business, plan } = useBusiness();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"suggestion" | "bug">("suggestion");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast({ title: "Por favor, digite uma descrição.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "feedbacks"), {
        user_id: user?.uid || "anonymous",
        user_email: user?.email || "anonymous",
        business_id: business?.id || null,
        business_name: business?.name || null,
        browser: getBrowser(),
        system_os: getOS(),
        user_agent: window.navigator.userAgent,
        current_page: window.location.pathname,
        plan_id: plan?.id || "free",
        app_version: "1.2.0-beta",
        feedback_type: feedbackType,
        description: description,
        status: "pending",
        created_at: serverTimestamp()
      });

      setIsSuccess(true);
      setDescription("");
      toast({ title: "Feedback enviado! 🎉", description: "Sua contribuição ajuda a moldar o futuro do Flowza!" });
      
      setTimeout(() => {
        setIsSuccess(false);
        setIsOpen(false);
      }, 2000);
    } catch (err: any) {
      console.error("Error submitting feedback:", err);
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="bg-primary text-primary-foreground flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl hover:bg-primary/90 transition-all font-bold text-xs uppercase tracking-wider"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>Beta Feedback</span>
        </motion.button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <AnimatePresence mode="wait">
            {!isSuccess ? (
              <motion.form 
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <DialogHeader>
                  <DialogTitle className="text-xl font-black flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> Compartilhe com a gente
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Estamos refinando o Flowza. Sua opinião é essencial para criarmos a melhor experiência.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                    Tipo de Feedback
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={feedbackType === "suggestion" ? "default" : "outline"}
                      onClick={() => setFeedbackType("suggestion")}
                      className="rounded-2xl font-bold py-5 h-auto flex items-center gap-2"
                    >
                      <Lightbulb className="w-4 h-4" />
                      Enviar Sugestão
                    </Button>
                    <Button
                      type="button"
                      variant={feedbackType === "bug" ? "destructive" : "outline"}
                      onClick={() => setFeedbackType("bug")}
                      className="rounded-2xl font-bold py-5 h-auto flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Relatar Problema
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                    Detalhes do Feedback
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      feedbackType === "suggestion"
                        ? "O que tornaria o Flowza ainda melhor para o seu negócio?"
                        : "Explique o que aconteceu e os passos para reproduzir o problema..."
                    }
                    className="rounded-2xl min-h-[120px]"
                    required
                  />
                </div>

                <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="rounded-2xl font-bold"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="rounded-2xl font-bold flex-1"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      "Enviar Feedback"
                    )}
                  </Button>
                </DialogFooter>
              </motion.form>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center text-center py-10 space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black">Muito Obrigado! 🎉</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Sua sugestão foi registrada com sucesso e nossa equipe de engenharia já foi notificada.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
