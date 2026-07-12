import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Facebook } from "lucide-react";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<"login" | "signup" | "forgot-password">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "E-mail necessário",
        description: "Por favor, digite seu e-mail para receber o link de redefinição.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "E-mail enviado",
        description: "Enviamos um link para redefinir sua senha no seu e-mail. Verifique sua caixa de entrada e spam."
      });
      setView("login");
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error("Reset error:", error);
      let message = "Não foi possível enviar o link. Verifique o endereço de e-mail.";
      
      if (error.code === "auth/user-not-found") {
        message = "Nenhum usuário encontrado com este e-mail.";
      } else if (error.code === "auth/invalid-email") {
        message = "O formato do e-mail é inválido.";
      }
      
      toast({
        title: "Erro ao enviar e-mail",
        description: message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user) return;
    
    const plan = searchParams.get("plan");
    const coupon = searchParams.get("coupon");
    let target = "/dashboard";
    
    // If role is loaded
    if (role) {
      if (role === "admin") {
        target = plan ? `/dashboard/plans?plan=${plan}${coupon ? `&coupon=${coupon}` : ""}` : "/dashboard";
      } else {
        target = "/client";
      }
    } else if (!authLoading) {
      // If role is null (new user), default to dashboard for onboarding
      target = plan ? `/dashboard/plans?plan=${plan}${coupon ? `&coupon=${coupon}` : ""}` : "/dashboard";
    }

    navigate(target);
  }, [user, role, authLoading, navigate, searchParams]);

  const handleSocialLogin = async (providerName: "google" | "facebook") => {
    setLoading(true);
    const provider = providerName === "google" ? new GoogleAuthProvider() : new FacebookAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if profile exists
      const docRef = doc(db, "profiles", user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        // Create profile for new social user
        await setDoc(doc(db, "profiles", user.uid), {
          full_name: user.displayName || "Usuário Social",
          role: "admin", // Default to admin for now, or use a param to decide
          created_at: new Date().toISOString()
        });
      }

      toast({ 
        title: "Bem-vindo!", 
        description: `Login com ${providerName === "google" ? "Google" : "Facebook"} realizado com sucesso.` 
      });
    } catch (err: unknown) {
      console.error(`${providerName} login error:`, err);
      const error = err as { code?: string; message?: string };
      
      if (error.code === "auth/popup-closed-by-user") {
        return; // Don't show toast if user just closed the popup
      }

      toast({
        title: "Erro na autenticação",
        description: `Não foi possível entrar com ${providerName}. Tente novamente.`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const trimmedEmail = email.trim();

    try {
      if (view === "signup") {
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const newUser = userCredential.user;
        
        // Update profile in Auth
        await updateProfile(newUser, { displayName: fullName });

        // Create profile in Firestore
        await setDoc(doc(db, "profiles", newUser.uid), {
          full_name: fullName,
          role: "admin", // Default for owners registering via this page
          created_at: new Date().toISOString()
        });

        toast({ title: "Cadastro realizado!", description: "Bem-vindo ao Flowza!" });
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
        toast({ title: "Bem-vindo de volta!", description: "Login realizado com sucesso." });
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error("Auth error:", error);
      
      const errorCode = error.code || "";
      const errorMessage = error.message || "";
      let message = "Ocorreu um erro inesperado.";
      
      const fullError = (errorCode + " " + errorMessage).toLowerCase();
      
      if (fullError.includes("email-already-in-use")) {
        message = "Este e-mail já está cadastrado. Se você já tem uma conta, clique em 'Entrar' logo abaixo para fazer login.";
      } else if (fullError.includes("invalid-credential") || 
                 fullError.includes("wrong-password") || 
                 fullError.includes("user-not-found") ||
                 fullError.includes("user-not-existing") ||
                 fullError.includes("invalid-login-credentials")) {
        
        if (view === "signup") {
          message = "Não foi possível criar a conta. Verifique se os dados estão corretos ou se você já possui uma conta com este e-mail.";
        } else {
          message = "E-mail ou senha incorretos. Caso tenha esquecido sua senha, use a opção 'Esqueci minha senha'. Se você limpou seu projeto recentemente, tente 'Cadastrar' novamente.";
        }
      } else if (fullError.includes("weak-password")) {
        message = "A senha é muito fraca. Ela deve conter pelo menos 6 caracteres.";
      } else if (fullError.includes("too-many-requests")) {
        message = "Muitas tentativas sem sucesso. Sua conta foi temporariamente bloqueada. Tente novamente mais tarde ou redefina sua senha.";
      } else if (fullError.includes("invalid-email")) {
        message = "O formato do e-mail é inválido. Por favor, verifique.";
      } else if (fullError.includes("popup-closed-by-user")) {
        setLoading(false);
        return;
      } else {
        message = "Erro na autenticação: " + (errorCode || errorMessage || "Verifique sua conexão e tente novamente.");
      }

      toast({ 
        title: view === "signup" ? "Erro no cadastro" : "Erro no login", 
        description: message, 
        variant: "destructive" 
      });
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="relative flex flex-col items-center space-y-6 max-w-sm">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-primary font-bold text-xs">F</span>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold font-heading">Carregando o Flowza</h2>
            <p className="text-sm text-muted-foreground">Autenticando e preparando seu ambiente...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative">
      {loading && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="relative flex flex-col items-center space-y-6 max-w-sm">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-primary font-bold text-xs">F</span>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold font-heading">
                {view === "signup" ? "Criando sua conta..." : view === "forgot-password" ? "Enviando e-mail..." : "Entrando..."}
              </h2>
              <p className="text-sm text-muted-foreground">Isso levará apenas alguns segundos. Por favor, aguarde.</p>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-8">
          <span className="font-heading text-2xl font-bold text-foreground">
            Flowza<span className="text-primary">.</span>
          </span>
        </Link>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h1 className="font-heading text-xl font-semibold text-card-foreground mb-1">
            {view === "signup" ? "Criar conta" : view === "login" ? "Entrar" : "Recuperar senha"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {view === "signup" 
              ? "Crie sua conta para começar" 
              : view === "login" 
                ? "Acesse sua conta" 
                : "Digite seu e-mail para receber as instruções"}
          </p>

          {view === "forgot-password" ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">E-mail</label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="email@exemplo.com" 
                  required 
                />
              </div>
              <Button variant="premium" type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Enviar link de recuperação
              </Button>
              <button 
                type="button" 
                onClick={() => setView("login")}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors py-2"
              >
                Voltar para o login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {view === "signup" && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Nome completo</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" required />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" required />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-foreground">Senha</label>
                  {view === "login" && (
                    <button 
                      type="button" 
                      onClick={() => setView("forgot-password")}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <Button variant="premium" type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {view === "signup" ? "Cadastrar" : "Entrar"}
              </Button>

              {(view === "login" || view === "signup") && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      type="button" 
                      className="w-full" 
                      onClick={() => handleSocialLogin("google")}
                      disabled={loading}
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google
                    </Button>
                    <Button 
                      variant="outline" 
                      type="button" 
                      className="w-full" 
                      onClick={() => handleSocialLogin("facebook")}
                      disabled={loading}
                    >
                      <Facebook className="w-4 h-4 mr-2 text-[#1877F2]" />
                      Facebook
                    </Button>
                  </div>
                </>
              )}
            </form>
          )}

          {view !== "forgot-password" && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              {view === "signup" ? "Já tem conta?" : "Não tem conta?"}{" "}
              <button 
                onClick={() => setView(view === "signup" ? "login" : "signup")} 
                className="text-primary hover:underline font-medium"
              >
                {view === "signup" ? "Entrar" : "Cadastrar"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
