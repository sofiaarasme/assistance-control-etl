import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import serimarLogo from "@/assets/serimar-logo-dark.png";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (login(email, password)) {
      navigate("/");
    } else {
      setError("Correo o contraseña incorrectos");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-serimar-dark via-background to-primary/10">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-3">
          <img src={serimarLogo} alt="Alimentos Serimar" className="h-12 object-contain" />
          <h1 className="text-xl font-bold text-foreground">Control de Asistencia</h1>
          <p className="text-sm text-muted-foreground">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@serimar.com"
              required
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Contraseña</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>
          )}

          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <LogIn className="h-4 w-4" />
            Iniciar Sesión
          </button>
        </form>

        <div className="rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
          <p className="mb-1 font-semibold">Usuarios de prueba:</p>
          <p>admin@serimar.com / admin123 (Admin)</p>
          <p>produccion@serimar.com / prod123</p>
          <p>calidad@serimar.com / cal123</p>
          <p>mantenimiento@serimar.com / mant123</p>
        </div>
      </div>
    </div>
  );
}
