import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "departamento";

export interface AppUser {
  id: string;
  nombre: string;
  email: string;
  role: UserRole;
  departamento?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  users: AppUser[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addUser: (user: Omit<AppUser, "id">, password: string) => Promise<void>;
  removeUser: (id: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

type ProfileRow = {
  id: string;
  email: string;
  nombre: string;
  role: UserRole;
  departamento: string | null;
  activo: boolean;
};

function toAppUser(profile: ProfileRow): AppUser {
  return {
    id: profile.id,
    email: profile.email,
    nombre: profile.nombre,
    role: profile.role,
    departamento: profile.departamento ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);

  const fetchProfile = useCallback(async (userId: string): Promise<AppUser | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,nombre,role,departamento,activo")
      .eq("id", userId)
      .single();

    if (error || !data || !data.activo) {
      return null;
    }
    return toAppUser(data as ProfileRow);
  }, []);

  const refreshUsers = useCallback(async () => {
    if (!currentUser || currentUser.role !== "admin") {
      setUsers(currentUser ? [currentUser] : []);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,nombre,role,departamento,activo")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error || !data) {
      setUsers([currentUser]);
      return;
    }

    setUsers((data as ProfileRow[]).map(toAppUser));
  }, [currentUser]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;

      if (mounted && sessionUser) {
        const profile = await fetchProfile(sessionUser.id);
        setCurrentUser(profile);
      }

      if (mounted) {
        setLoading(false);
      }
    };

    bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user;
      if (!authUser) {
        setCurrentUser(null);
        setUsers([]);
        setLoading(false);
        return;
      }

      const profile = await fetchProfile(authUser.id);
      setCurrentUser(profile);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return false;
    }

    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return false;
    }

    setCurrentUser(profile);
    return true;
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUsers([]);
  }, []);

  const addUser = useCallback(async (_user: Omit<AppUser, "id">, _password: string) => {
    throw new Error(
      "En modo sin backend, crea usuarios en Supabase > Authentication > Users y luego registra su perfil en public.profiles"
    );
  }, []);

  const removeUser = useCallback(async (id: string) => {
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Solo administradores pueden eliminar perfiles");
    }

    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
    await refreshUsers();
  }, [currentUser, refreshUsers]);

  return (
    <AuthContext.Provider value={{ user: currentUser, users, loading, login, logout, addUser, removeUser, refreshUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
