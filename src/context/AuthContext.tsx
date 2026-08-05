import React, { createContext, useContext, useEffect, useState,} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
// Esta pagina sirve como contexto para crear las autenticaciones según el usuario, las sesiones y verificar que este tenga o no una cuenta
interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carga la sesión actual al montar la app
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Escucha cambios de sesión (login, logout, refresh de token)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp: AuthContextValue["signUp"] = async (
    email,
    password,
    fullName
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Se guarda en auth.users.user_metadata y lo puedes leer luego
        // para prellenar una tabla "profiles" con un trigger en Supabase.
        data: { full_name: fullName },
      },
    });
    return { error: error ? traducirError(error.message) : null };
  };

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? traducirError(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}

// Traduce los mensajes de error más comunes de Supabase al español
function traducirError(message: string): string {
  const mapa: Record<string, string> = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "User already registered": "Ya existe una cuenta con este correo.",
    "Email not confirmed": "Debes confirmar tu correo antes de iniciar sesión.",
    "Password should be at least 6 characters":
      "La contraseña debe tener al menos 6 caracteres.",
  };
  return mapa[message] ?? message;
}