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
  /** Envia el correo con el enlace para poner una contrasena nueva. */
  pedirRestablecer: (email: string) => Promise<{ error: string | null }>;
  /** Cambia la contrasena de la sesion abierta (o de la del enlace del correo). */
  cambiarContrasena: (nueva: string) => Promise<{ error: string | null }>;
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

  /**
   * Correo de restablecimiento.
   *
   * `redirectTo` tiene que apuntar a /restablecer, y ese origen debe estar en la
   * lista de "Redirect URLs" de Supabase (Authentication -> URL Configuration).
   * Si no esta, el enlace del correo lleva al sitio pero sin la sesion temporal y
   * no se puede cambiar nada.
   *
   * No se distingue si el correo existe o no: el mensaje de la interfaz es el
   * mismo en ambos casos, a proposito. Decir "ese correo no esta registrado"
   * convierte el formulario en una forma de averiguar quien tiene cuenta.
   */
  const pedirRestablecer: AuthContextValue["pedirRestablecer"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer`,
    });
    return { error: error ? traducirError(error.message) : null };
  };

  /**
   * Cambio de contrasena.
   *
   * Sirve para los dos casos, porque los dos son lo mismo para Supabase: hay una
   * sesion abierta y se actualiza al usuario de esa sesion. Al llegar desde el
   * enlace del correo, `detectSessionInUrl` ya ha canjeado el token por una
   * sesion antes de que esto se llame.
   */
  const cambiarContrasena: AuthContextValue["cambiarContrasena"] = async (nueva) => {
    const { error } = await supabase.auth.updateUser({ password: nueva });
    return { error: error ? traducirError(error.message) : null };
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
        pedirRestablecer,
        cambiarContrasena,
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
    "New password should be different from the old password.":
      "La contraseña nueva tiene que ser distinta de la actual.",
    "Auth session missing!":
      "El enlace ha caducado o ya se usó. Pide otro correo de restablecimiento.",
    "For security purposes, you can only request this after 60 seconds.":
      "Por seguridad, espera un minuto antes de pedir otro correo.",
  };
  return mapa[message] ?? message;
}