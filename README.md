# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
## IMPORTANTE
# Requerimientos esenciales para correr este programa 


#### ========== LO UNICO QUE SE REQUIRE PARA QUE TRABAJE EN CADA EQUIPO ========== #####


### Node js 
----> Visitar nodejs.org y descargar la versión LTS como cualquier archivo 
----> Revisar con el comando " node -v " para verificar su correcta instalación

### Después de clonar repositorio
----> usar el comando "npm install" dentro de la carpeta en el que se trabaja la clonación del repositorio 
----> crear un archivo .env que este al mismo nivel que src que contenga lo siguiente escrito dentro de este: 

VITE_SUPABASE_URL=https://kuvpownbspwntjneshtt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dnBvd25ic3B3bnRqbmVzaHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MTkyMjIsImV4cCI6MjEwMTI5NTIyMn0.cbXcRpDcgXVHGPenaYSF1olCcwSOnAoVzGjDMHkKff4

Estas serán las variables de entorno que conectan con la base de supabase si no estan la autenticación no servirá ni registrara datos o inicio de sesión


##### ================ ADICIONAL SOLO SI EL PROYECTO DA ERROR Y REQUIERE UNO DE ESTOS PAQUETES PARA COMPLEMENTAR ==================== #####


### Taildwind CSS 
------> npm install tailwindcss @tailwindcss/vite 

### Shadcn UI ###
------> Depende de Taildwind para sus componentes y si se requiere agregar más componentes se visita la página de ui.shadcn.com
Ejemplos de ShadcnUI

- Para un Botón:
npx shadcn@latest add button
- Para una tarjeta (Card):
npx shadcn@latest add card

### GSAP 
-----> Permite animaciones sencillas y fáciles para utilizar en la vista de la página
-----> npm install gsap @gsap/react 

### Lucide
-----> Componente para iconos
-----> npm install lucide-react
