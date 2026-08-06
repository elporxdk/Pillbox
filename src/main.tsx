import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* attribute="class" hace que next-themes ponga `.dark` en <html>, que es de
        donde cuelgan los tokens de color de index.css.

        defaultTheme="system" + enableSystem: al entrar por primera vez se
        respeta lo que pida el sistema operativo. En cuanto el visitante toca el
        interruptor, su eleccion se guarda y manda sobre el sistema.

        disableTransitionOnChange evita que la transicion de color del body se
        dispare al conmutar: sin esto el cambio se ve como un barrido lento y
        sucio en vez de un salto limpio. */}
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <App />
    </ThemeProvider>
  </StrictMode>,
)
