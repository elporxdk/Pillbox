//Creación del componente según supabase y su SDK (Ya instaladas)
import { createClient } from "@supabase/supabase-js";
//Importación de las variables de entorno para la conexión 
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

//Mensaje en consola por si falla algo de las variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan las variables VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. " +
      "Revisa tu archivo .env en la raíz del proyecto."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Mantiene la sesión guardada en localStorage y la refresca sola
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});