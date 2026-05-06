import { useEffect, useState, useRef, useCallback } from "react";
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Sparkles, Trash2, Image as ImageIcon, Loader2, Wand2 } from "lucide-react";
import StyleSimulator from "@/components/gallery/StyleSimulator";

const categories = [
  { value: "haircut", label: "Corte de Cabelo" },
  { value: "beard", label: "Barba" },
  { value: "eyebrow", label: "Sobrancelha" },
  { value: "combo", label: "Combo" },
];

interface GalleryItem {
  id: string;
  business_id: string;
  title: string;
  description: string;
  category: string;
  image_url: string;
  storage_path: string;
  tags: string[];
  is_active: boolean;
  created_at: unknown;
}

const StyleGallery = () => {
  const { user } = useAuth();
  const { business } = useBusiness();
  const { toast } = useToast();
  const businessId = business?.id;
  const isOwner = user?.uid === business?.owner_id;
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [simOpen, setSimOpen] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({ title: "", description: "", category: "haircut", tags: "" });
  const [fileInputKey, setFileInputKey] = useState(0); 

  const fetchData = useCallback(async () => {
    if (!user || !businessId) { 
      setLoading(false); 
      return; 
    }

    try {
      console.log("Fetching gallery for business:", businessId);
      const q = query(
        collection(db, "style_gallery"), 
        where("business_id", "==", businessId), 
        orderBy("created_at", "desc")
      );
      
      const snap = await getDocs(q);
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as GalleryItem));
      
      if (filterCat !== "all") {
        data = data.filter((d: GalleryItem) => d.category === filterCat);
      }

      setGallery(data);
    } catch (err: unknown) {
      console.error("Error fetching gallery:", err);
      toast({ 
        title: "Erro ao carregar galeria", 
        description: "Verifique sua conexão ou aguarde a criação de índices no Firebase.",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }, [user, businessId, filterCat, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!businessId) {
      toast({ 
        title: "Erro de Contexto", 
        description: "Não foi possível identificar o seu negócio. Tente recarregar a página.", 
        variant: "destructive" 
      });
      return;
    }
    
    console.log("Starting upload for file:", file.name, "Size:", file.size);
    
    // Check file size (limit to 5MB for safety)
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: "Arquivo muito grande", 
        description: "O limite de tamanho é 5MB.", 
        variant: "destructive" 
      });
      setFileInputKey(prev => prev + 1);
      return;
    }

    if (!window.navigator.onLine) {
      toast({ 
        title: "Sem conexão", 
        description: "Você parece estar offline. Verifique sua rede e tente novamente.", 
        variant: "destructive" 
      });
      setFileInputKey(prev => prev + 1);
      return;
    }

    setUploading(true);

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${Date.now()}.${ext}`;
    const path = `${businessId}/gallery/${fileName}`;
    const storageRef = ref(storage, path);
    
    try {
      console.log("Uploading bytes to storage path:", path);
      
      // Use uploadBytesResumable for better control and progress monitoring
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      // Manual timeout implementation (30 seconds)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: O upload demorou muito para responder. Verifique sua conexão.")), 30000);
      });

      // Wait for upload complete or timeout
      try {
        await Promise.race([
          new Promise<void>((resolve, reject) => {
            uploadTask.on(
              "state_changed",
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Upload progress: ${progress.toFixed(2)}%`);
              },
              (error) => {
                console.error("Storage upload task error:", error);
                reject(error);
              },
              () => resolve()
            );
          }),
          timeoutPromise
        ]);
      } catch (raceError: unknown) {
        // Cancel the task if it timed out or hit another race error
        uploadTask.cancel();
        throw raceError;
      }
      
      console.log("Upload complete, getting download URL...");
      const publicUrl = await getDownloadURL(storageRef);

      const tagsArr = form.tags.split(",").map(t => t.trim()).filter(Boolean);

      console.log("Adding doc to Firestore...");
      await addDoc(collection(db, "style_gallery"), {
        business_id: businessId,
        title: form.title || "Sem título",
        description: form.description || null,
        category: form.category,
        image_url: publicUrl,
        storage_path: path,
        tags: tagsArr,
        is_active: true,
        created_at: serverTimestamp(),
      });

      toast({ title: "Estilo adicionado com sucesso!" });
      setForm({ title: "", description: "", category: "haircut", tags: "" });
      setAddOpen(false);
      
      await fetchData();
    } catch (err: unknown) {
      console.error("Error during gallery upload detail:", err);
      let errorMsg = "Ocorreu um erro ao processar a imagem.";
      
      if (err instanceof Error) {
        if (err.message.includes("storage/retry-limit-exceeded")) {
          errorMsg = "Limite de tempo excedido. Isso geralmente indica falha nas permissões do Storage ou bloqueio de rede (CORS).";
        } else if (err.message.includes("storage/unauthorized")) {
          errorMsg = "Sem permissão para fazer upload. Verifique as regras do Firebase Storage.";
        } else {
          errorMsg = err.message;
        }
      }
      
      toast({ 
        title: "Erro no envio", 
        description: errorMsg, 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
      setFileInputKey(prev => prev + 1); // Reset the input regardless of outcome
    }
  }, [businessId, form, toast, fetchData]);

  const handleDelete = async (id: string, storagePath?: string) => {
    try {
      if (storagePath) {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef).catch(e => console.warn("Failed to delete storage file", e));
      }
      await deleteDoc(doc(db, "style_gallery", id));
      toast({ title: "Estilo removido" });
      fetchData();
    } catch (err: unknown) {
      toast({ title: "Erro ao excluir", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleAiSuggest = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;
    setAiLoading(true);
    setAiResult("");

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;

      // Get gallery styles for context
      const q = query(collection(db, "style_gallery"), where("business_id", "==", businessId), where("is_active", "==", true));
      const snap = await getDocs(q);
      const styles = snap.docs.map(d => ({ title: d.data().title, description: d.data().description, tags: d.data().tags }));

      const response = await fetch("/api/suggest-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          imageUrl: base64,
          galleryStyles: styles || [],
        }),
      });
      
      const data = await response.json();

      if (!response.ok) {
        toast({ title: "Erro na sugestão de IA", description: data.error || "Erro misterioso", variant: "destructive" });
        setAiLoading(false);
        return;
      }

      setAiResult(data.suggestion || data.error || "Sem resultado");
      setAiLoading(false);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Galeria de Estilos</h1>
          <p className="text-sm text-muted-foreground">
            {isOwner ? "Gerencie fotos de cortes e use IA para sugestões personalizadas" : "Encontre o seu próximo visual ideal com a ajuda da nossa IA."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setSimOpen(true)} className="gap-1">
            <Wand2 className="w-4 h-4" /> Simular Estilo
          </Button>
          <Button variant="outline" onClick={() => setAiOpen(true)} className="gap-1">
            <Sparkles className="w-4 h-4" /> Sugestão IA
          </Button>
          {isOwner && (
            <Button onClick={() => setAddOpen(true)} className="gap-1">
              <Plus className="w-4 h-4" /> Adicionar Estilo
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <Select value={filterCat} onValueChange={setFilterCat}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Gallery grid */}
      {gallery.length === 0 ? (
        <div className="text-center py-16">
          <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum estilo na galeria ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione fotos de cortes para montar seu portfólio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {gallery.map((item) => (
            <div key={item.id} className="group relative bg-card border border-border rounded-xl overflow-hidden">
              <img src={item.image_url} alt={item.title} className="w-full aspect-square object-cover" />
              <div className="p-3">
                <h3 className="font-medium text-card-foreground text-sm">{item.title}</h3>
                {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>}
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{categories.find(c => c.value === item.category)?.label || item.category}</Badge>
                  {item.tags?.slice(0, 3).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
              {isOwner && (
                <button
                  onClick={() => handleDelete(item.id, item.storage_path)}
                  className="absolute top-2 right-2 bg-destructive/90 text-destructive-foreground p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Style Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Estilo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Título do estilo" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Textarea placeholder="Descrição (opcional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Tags (separadas por vírgula)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            <input key={fileInputKey} ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <Button onClick={() => fileRef.current?.click()} className="w-full gap-1" disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Enviando..." : "Selecionar Foto e Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Style Simulator */}
      <StyleSimulator businessId={businessId}
        open={simOpen}
        onOpenChange={setSimOpen}
        galleryStyles={gallery.map(g => ({ title: g.title, description: g.description }))}
      />

      {/* AI Suggestion Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Sugestão de Estilo com IA</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Envie uma foto do cliente para receber sugestões personalizadas de estilos baseadas no formato do rosto e tipo de cabelo.</p>
            <input ref={aiFileRef} type="file" accept="image/*" className="hidden" onChange={handleAiSuggest} />
            <Button onClick={() => aiFileRef.current?.click()} variant="outline" className="w-full gap-1" disabled={aiLoading}>
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {aiLoading ? "Analisando com IA..." : "Enviar Foto do Cliente"}
            </Button>
            {aiResult && (
              <div className="bg-muted rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap max-h-80 overflow-y-auto">
                {aiResult}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StyleGallery;
