import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Departamento } from "@/config/departamentos";

export type UserRole = "admin" | "departamento";

export interface AppUser {
  id: string;
  nombre: string;
  email: string;
  role: UserRole;
  departamento?: Departamento; // required for role "departamento"
}

interface AuthContextType {
  user: AppUser | null;
  users: AppUser[];
  login: (email: string, password: string) => boolean;
  logout: () => void;
  addUser: (user: Omit<AppUser, "id">, password: string) => void;
  removeUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock user store (passwords stored plaintext for mock only)
const INITIAL_USERS: (AppUser & { password: string })[] = [
  { id: "1", nombre: "Administrador", email: "admin@serimar.com", role: "admin", password: "admin123" },
  { id: "2", nombre: "Supervisor Producción", email: "produccion@serimar.com", role: "departamento", departamento: "Producción", password: "prod123" },
  { id: "3", nombre: "Supervisor Calidad", email: "calidad@serimar.com", role: "departamento", departamento: "Calidad", password: "cal123" },
  { id: "4", nombre: "Supervisor Mantenimiento", email: "mantenimiento@serimar.com", role: "departamento", departamento: "Mantenimiento", password: "mant123" },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userStore, setUserStore] = useState(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const login = useCallback((email: string, password: string): boolean => {
    const found = userStore.find((u) => u.email === email && u.password === password);
    if (found) {
      const { password: _, ...user } = found;
      setCurrentUser(user);
      return true;
    }
    return false;
  }, [userStore]);

  const logout = useCallback(() => setCurrentUser(null), []);

  const addUser = useCallback((user: Omit<AppUser, "id">, password: string) => {
    const newUser = { ...user, id: String(Date.now()), password };
    setUserStore((prev) => [...prev, newUser]);
  }, []);

  const removeUser = useCallback((id: string) => {
    setUserStore((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const users: AppUser[] = userStore.map(({ password: _, ...u }) => u);

  return (
    <AuthContext.Provider value={{ user: currentUser, users, login, logout, addUser, removeUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
