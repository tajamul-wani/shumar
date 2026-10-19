import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/noto-nastaliq-urdu/500.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { createSupabase, readSupabaseConfig } from './lib/supabase.ts'
import { startTheme } from './lib/theme.ts'

startTheme()

const supabase = createSupabase(readSupabaseConfig(import.meta.env))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider client={supabase}>
      <App />
    </AuthProvider>
  </StrictMode>,
)
