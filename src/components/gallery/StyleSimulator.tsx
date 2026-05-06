import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Upload, Loader2, Download, RotateCcw } from "lucide-react";

interface StyleSimulatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  galleryStyles?: { title: string; description?: string }[];
  businessId?: string;
}

const StyleSimulator = ({ open, onOpenChange, galleryStyles, businessId }: StyleSimulatorProps) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [clientImage, setClientImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [styleInput, setStyleInput] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setClientImage(reader.result as string);
      setResultImage(null);
      setDescription("");
    };
    reader.readAsDataURL(file);
  };

  const handleSimulate = async () => {
    if (!clientImage) return;
    setLoading(true);
    setResultImage(null);
    setDescription("");

    const response = await fetch("/api/simulate-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        imageUrl: clientImage,
        styleDescription: styleInput || undefined,
      }),
    });
    
    const data = await response.json();

    if (!response.ok) {
      toast({ title: "Erro na simulação", description: data.error || "Erro desconhecido", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (data?.generatedImage) {
      setResultImage(data.generatedImage);
    }
    if (data?.description) {
      setDescription(data.description);
    }
    if (data?.error) {
      toast({ title: "Erro", description: data.error, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleReset = () => {
    setClientImage(null);
    setResultImage(null);
    setDescription("");
    setStyleInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Simulação de Estilo com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie uma foto do cliente e descreva o estilo desejado. A IA irá gerar uma simulação visual do resultado.
          </p>

          {/* Style presets from gallery */}
          {galleryStyles && galleryStyles.length > 0 && !clientImage && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Estilos da galeria:</p>
              <div className="flex flex-wrap gap-2">
                {galleryStyles.slice(0, 6).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setStyleInput(s.title + (s.description ? `: ${s.description}` : ""))}
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/40 text-foreground transition-colors"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input
            placeholder="Descreva o estilo desejado (ex: corte degradê com barba desenhada)"
            value={styleInput}
            onChange={e => setStyleInput(e.target.value)}
          />

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

          {!clientImage ? (
            <Button onClick={() => fileRef.current?.click()} variant="outline" className="w-full gap-2 h-32 border-dashed">
              <Upload className="w-5 h-5" />
              Enviar foto do cliente
            </Button>
          ) : (
            <div className="space-y-4">
              <div className={`grid gap-4 ${resultImage ? "grid-cols-2" : "grid-cols-1"}`}>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Foto original</p>
                  <img src={clientImage} alt="Cliente" loading="lazy" decoding="async" className="w-full rounded-xl object-cover aspect-[3/4]" />
                </div>
                {resultImage && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Simulação</p>
                    <img src={resultImage} alt="Simulação" loading="lazy" decoding="async" className="w-full rounded-xl object-cover aspect-[3/4]" />
                  </div>
                )}
              </div>

              {description && (
                <div className="bg-muted rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap">
                  {description}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSimulate} disabled={loading} className="flex-1 gap-1">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loading ? "Gerando simulação..." : resultImage ? "Gerar nova simulação" : "Simular estilo"}
                </Button>
                <Button onClick={handleReset} variant="outline" size="icon">
                  <RotateCcw className="w-4 h-4" />
                </Button>
                {resultImage && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = resultImage;
                      a.download = "simulacao-estilo.png";
                      a.click();
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StyleSimulator;
