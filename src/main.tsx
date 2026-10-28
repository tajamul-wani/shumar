import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { watchInstall } from './lib/install.ts'
import { registerServiceWorker } from './lib/serviceWorker.ts'
import { createSupabase, readSupabaseConfig } from './lib/supabase.ts'
import { ThemeProvider } from './theme/ThemeProvider.tsx'

const supabase = createSupabase(readSupabaseConfig(import.meta.env))

// The browser can offer to install the app before any screen is drawn, so listen from the start.
watchInstall()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider client={supabase}>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)

// The built app keeps its own files for offline use; the dev server never does.
if (import.meta.env.PROD) registerServiceWorker()
