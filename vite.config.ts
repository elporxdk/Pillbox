import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Sin estas dos, el sitio no puede hablar con Supabase. */
const VARIABLES_OBLIGATORIAS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] as const

/**
 * Corta el build si faltan las variables de entorno, en lugar de publicar un sitio roto.
 *
 * POR QUE HACE FALTA ESTO
 * -----------------------
 * `src/lib/supabase.ts` ya lanza un error si las variables no estan, pero lo lanza en
 * el cuerpo del modulo. Vite sustituye `import.meta.env.VITE_*` por su valor EN EL
 * MOMENTO DE COMPILAR, asi que sin variables ese `if` se vuelve una condicion siempre
 * cierta y el `throw` queda incondicional. El empaquetador ve entonces que todo lo que
 * viene detras es codigo inalcanzable y lo descarta.
 *
 * El resultado medido: `npm run build` termina con codigo 0 y escribe un bundle de
 * 253 kB en lugar de 1,83 MB. Sin Supabase, sin GSAP y sin el visor 3D. Es decir, el
 * despliegue sale en verde y el sitio esta roto, que es la peor combinacion posible:
 * no hay ningun error que buscar.
 *
 * Con esta comprobacion el build falla antes de escribir nada y dice cual falta.
 *
 * SOLO AL COMPILAR, NO EN DESARROLLO
 * ----------------------------------
 * En `vite dev` el aviso de `supabase.ts` salta en el navegador y se lee igual de bien.
 * Cortar tambien ahi impediria arrancar el servidor para trabajar en cualquier parte
 * del sitio que no toque la base de datos.
 *
 * DE DONDE SE LEEN
 * ----------------
 * De `loadEnv`, que mira los ficheros `.env*` Y las variables del proceso. Esa segunda
 * parte es la que importa en Cloudflare y en cualquier CI, donde no hay ningun `.env`
 * y los valores llegan del entorno.
 */
function exigirVariablesDeEntorno(): Plugin {
  return {
    name: "medibot:exigir-variables-de-entorno",
    apply: "build",
    config(_config, { mode }) {
      const env = loadEnv(mode, __dirname, "VITE_")
      const faltan = VARIABLES_OBLIGATORIAS.filter((clave) => !env[clave])
      if (faltan.length === 0) return

      throw new Error(
        `\n\nFaltan variables de entorno para compilar: ${faltan.join(", ")}\n\n` +
          "Sin ellas el sitio compila igualmente, pero sale sin Supabase, sin las\n" +
          "animaciones y sin el modelo 3D. Se corta aqui para que no se publique roto.\n\n" +
          "  En tu equipo:  copia .env.example a .env y rellena los valores.\n" +
          "  En Cloudflare: Workers & Pages -> el proyecto -> Settings -> Variables\n" +
          "                 and Secrets, y anadelas como variables de BUILD.\n\n" +
          "Las dos son claves de cliente: acaban dentro del bundle y las ve cualquier\n" +
          "visitante. Lo que protege los datos es el RLS de Supabase, no esconderlas.\n"
      )
    },
  }
}

export default defineConfig({
  plugins: [exigirVariablesDeEntorno(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
