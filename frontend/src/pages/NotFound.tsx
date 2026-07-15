import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-background px-6">
    <div className="text-center">
      <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
      <p className="text-lg text-muted-foreground mb-6">Página não encontrada</p>
      <Link to="/"><Button>Voltar ao início</Button></Link>
    </div>
  </div>
);

export default NotFound;
