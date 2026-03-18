import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTAMENTOS, type Departamento } from "@/config/departamentos";
import { Navigate } from "react-router-dom";
import { DashboardHeader } from "@/components/DashboardHeader";
import { UserPlus, Trash2, Shield, Building2 } from "lucide-react";

export default function Admin() {
  const { user, users, addUser, removeUser } = useAuth();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "departamento">("departamento");
  const [depto, setDepto] = useState<Departamento>(DEPARTAMENTOS[0]);
  const [msg, setMsg] = useState("");

  if (!user || user.role !== "admin") return <Navigate to="/" replace />;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !email || !password) return;
    try {
      await addUser(
        { nombre, email, role, departamento: role === "departamento" ? depto : undefined },
        password
      );
      setNombre("");
      setEmail("");
      setPassword("");
      setMsg("Usuario creado exitosamente");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "No se pudo crear usuario");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader lastUpdated={undefined} onRefresh={() => {}} isLoading={false} />

      <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Administración de Usuarios</h2>
            <p className="text-xs text-muted-foreground">Perfiles de acceso en Supabase</p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          En modo sin backend, los usuarios de login se crean en Supabase &gt; Authentication &gt; Users.
          Luego se registra su rol/departamento en la tabla `public.profiles`.
        </div>

        {/* Create user form */}
        <div className="rounded-md border border-border bg-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserPlus className="h-4 w-4 text-primary" /> Nuevo Usuario
          </h3>
          <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Nombre completo"
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Correo</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="correo@serimar.com"
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Rol</label>
              <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "departamento")}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="admin">Administrador (ve todo)</option>
                <option value="departamento">Por Departamento</option>
              </select>
            </div>
            {role === "departamento" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Departamento</label>
                <select value={depto} onChange={(e) => setDepto(e.target.value as Departamento)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {DEPARTAMENTOS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-end sm:col-span-2">
              <button type="submit" className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <UserPlus className="h-3.5 w-3.5" /> Crear Usuario
              </button>
              {msg && <span className="ml-3 text-xs font-medium text-semaforo-verde">{msg}</span>}
            </div>
          </form>
        </div>

        {/* User list */}
        <div className="rounded-md border border-border bg-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-primary" /> Usuarios Registrados
          </h3>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    u.role === "admin" ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground"
                  }`}>
                    {u.nombre.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.email} · {u.role === "admin" ? "Admin" : u.departamento}
                    </p>
                  </div>
                </div>
                {u.id !== user.id && (
                  <button
                    onClick={async () => {
                      try {
                        await removeUser(u.id);
                        setMsg("Perfil eliminado");
                      } catch (error) {
                        setMsg(error instanceof Error ? error.message : "No se pudo eliminar");
                      }
                      setTimeout(() => setMsg(""), 3000);
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
