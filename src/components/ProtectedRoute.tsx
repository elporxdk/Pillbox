import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

//Permite controlar las rutas de la página y ver que cada una funcione debidamente, permite ver las sesiones y dejar al usuario solo acceder cuando tenga sesión a la página de dashboard
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F4FAFB] p-8">
        <Loader2 className="w-16 h-16 text-[#01BAEF] animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}