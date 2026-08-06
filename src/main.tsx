import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ShortcutVisibilityProvider } from './hooks/useShortcutVisibility'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

const root = document.getElementById('root')
if (!root) throw new Error('Fant ikke #root i index.html')

createRoot(root).render(
  <StrictMode>
    <ShortcutVisibilityProvider>
      <App />
    </ShortcutVisibilityProvider>
  </StrictMode>,
)
